/**
 * WaveWarz chain census — count every battle account the program holds on Solana
 * and set it against what this index lists. Writes one row to chain_census.
 *
 * Three groups make up the on-chain count, and they add up exactly:
 *   on_chain = listed + test_excluded + not_indexed
 *   listed         non-test battles this index holds (what the public API lists)
 *   test_excluded  test battles this index holds but leaves out on purpose
 *   not_indexed    on chain, never reached this index (almost all abandoned
 *                  launches that hold no SOL; any that do hold SOL are named)
 * A fourth number, db_only, counts real (non-test) battles held here that are not
 * on chain. It should always be 0; anything else is a finding. Test rows with no
 * chain account (webhook test fixtures) are noted but are not an alarm.
 *
 * One getProgramAccounts call, no per-battle reads. Read-only on chain.
 *
 * It also resolves which operator (arena) each battle belongs to, from the chain's
 * own fee wallet and launcher and the registry synced from spec/operators.json
 * (scripts/sync-operators.ts), and:
 *   - writes ONLY the four operator columns on battles (launcher_wallet,
 *     fee_wallet_chain, operator_id, operator_basis), via apply_battle_operators;
 *   - for a not-indexed battle that belongs to an operator in 'partner' mode and
 *     passes the listing test (explicit claim, declared redirect, or fee wallet AND
 *     registered launcher), records it in partner_battles, a separate table;
 *   - logs newly absent battles that could not be listed, and why, in intake_events.
 * It never writes winner, poll, judge, status, volume or any other battle field.
 *
 * Usage:
 *   npx tsx scripts/chain-census.ts             # count, compare, store a row
 *   npx tsx scripts/chain-census.ts --dry-run   # print only, store nothing
 *   npx tsx scripts/chain-census.ts --dry-run --assume-partner=arena-demo
 *       # rehearsal only: pretend that operator is granted 'partner' mode and show what
 *       # the pull WOULD list. Ignored unless --dry-run, so it can never grant anything.
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_HELIUS_API_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) { console.error('Missing .env.local'); process.exit(1) }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

import { parseBattleAccount } from '../src/lib/solana/parser'
import { PROGRAM_ID } from '../src/lib/solana/pda'
import { fetchAll } from '../src/lib/supabase/fetch-all'
import { registryFromRows, resolveOperator, listingDecision, validateRegistry, type Registry } from '../src/lib/operators/resolve'

const BATTLE_ACCOUNT_SIZE = 353
const LAMPORTS = 1e9

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  let lastErr = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      const j = await res.json()
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200))
      return j.result as T
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  throw new Error(`${method} failed after 3 tries: ${lastErr}`)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const HELIUS = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  if (!SUPABASE_URL || !SERVICE_KEY || !HELIUS) {
    console.error('Missing env vars (SUPABASE_URL / SERVICE_ROLE_KEY / HELIUS_API_KEY)')
    process.exit(1)
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS}`

  // 1. Every battle account the program owns (353 bytes each).
  type Acct = { pubkey: string; account: { data: [string, string] } }
  const accts = await rpc<Acct[]>(rpcUrl, 'getProgramAccounts', [
    PROGRAM_ID.toBase58(),
    { encoding: 'base64', filters: [{ dataSize: BATTLE_ACCOUNT_SIZE }] },
  ])

  type ChainBattle = { startedAt: string; endsAt: string; holdingSol: number; ended: boolean; launcher: string | null; fee: string
    a: string; b: string; poolA: number; poolB: number; settled: boolean; winnerA: boolean; distSol: number }
  const chain = new Map<string, ChainBattle>()
  let unparsed = 0
  for (const a of accts) {
    const parsed = parseBattleAccount(Buffer.from(a.account.data[0], 'base64'))
    if (!parsed) { unparsed++; continue }
    const holdingLamports = Number(parsed.artistAPool + parsed.artistBPool)
    chain.set(parsed.battleId.toString(), {
      startedAt: new Date(Number(parsed.startTime) * 1000).toISOString(),
      endsAt: new Date(Number(parsed.endTime) * 1000).toISOString(),
      holdingSol: Math.round((holdingLamports / LAMPORTS) * 1e6) / 1e6,
      ended: parsed.winnerDecided || !parsed.isActive,
      launcher: parsed.launcher ? parsed.launcher.toBase58() : null,
      fee: parsed.wavewarzWallet.toBase58(),
      a: parsed.artistAWallet.toBase58(), b: parsed.artistBWallet.toBase58(),
      poolA: Number(parsed.artistAPool) / LAMPORTS, poolB: Number(parsed.artistBPool) / LAMPORTS,
      settled: parsed.winnerDecided, winnerA: parsed.winnerArtistA, distSol: Number(parsed.totalDistributionAmount) / LAMPORTS,
    })
  }
  if (unparsed) console.warn(`  (${unparsed} accounts could not be parsed and are left out)`)
  if (chain.size < 1000) throw new Error(`census returned only ${chain.size} battles, refusing to store a partial count`)

  // 2. Every battle this index holds, with the test flag.
  const rows = await fetchAll<{ battle_id: number; is_test_battle: boolean | null }>((from, to) =>
    supabase.from('battles').select('battle_id, is_test_battle').range(from, to))
  const held = new Map(rows.map(r => [String(r.battle_id), r.is_test_battle === true]))

  // 2b. Operator registry (projected from spec/operators.json by sync-operators.ts).
  let registry: Registry | null = null
  {
    const [o, w, c] = await Promise.all([
      supabase.from('operators').select('operator_id,name,status,listing_mode'),
      supabase.from('operator_wallets').select('operator_id,wallet,kind'),
      supabase.from('operator_claims').select('operator_id,battle_id'),
    ])
    if (o.error || w.error || c.error) console.warn(`  (operator registry unreadable, skipping attribution: ${o.error?.message ?? w.error?.message ?? c.error?.message})`)
    else {
      registry = registryFromRows(o.data ?? [], w.data ?? [], c.data ?? [])
      const problems = validateRegistry(registry)
      if (problems.length || !registry.operators.length) { console.warn('  (operator registry empty or ambiguous, skipping attribution)' + problems.map(p => '\n    - ' + p).join('')); registry = null }
    }
  }
  const assume = process.argv.find(a => a.startsWith('--assume-partner='))?.slice(17)
  if (assume && dryRun && registry) { const op = registry.operators.find(o => o.id === assume); if (op) { op.listingMode = 'partner'; console.log(`  (rehearsal: treating ${assume} as granted 'partner' mode, dry run only)`) } else console.warn(`  (no operator ${assume} in the registry)`) }
  const matchOf = (id: string) => {
    const c = chain.get(id)!
    return registry ? resolveOperator({ battleId: Number(id), feeWallet: c.fee, launcher: c.launcher }, registry) : { operatorId: null, basis: 'unattributed' as const }
  }

  // 3. Classify. The three groups add up to the on-chain count.
  let listed = 0, testExcluded = 0
  const notIndexed: { battleId: number; startedAt: string; holdingSol: number; ended: boolean; launcher: string | null; operatorId: string | null; basis: string }[] = []
  for (const [id, info] of chain) {
    if (held.has(id)) { held.get(id) ? testExcluded++ : listed++ }
    else { const m = matchOf(id); notIndexed.push({ battleId: Number(id), startedAt: info.startedAt, holdingSol: info.holdingSol, ended: info.ended, launcher: info.launcher, operatorId: m.operatorId, basis: m.basis }) }
  }
  notIndexed.sort((a, b) => b.battleId - a.battleId)
  const notOnChain = [...held.keys()].filter(id => !chain.has(id))
  const dbOnly = notOnChain.filter(id => held.get(id) === false).length
  const testRowsNotOnChain = notOnChain.length - dbOnly
  const holding = notIndexed.filter(b => b.holdingSol > 0)
  const holdingSol = Math.round(holding.reduce((s, b) => s + b.holdingSol, 0) * 1e6) / 1e6

  // 4. What is newly absent since the last census (drift shows up in a day).
  const { data: prev } = await supabase.from('chain_census').select('not_indexed_ids, census_at').order('census_at', { ascending: false }).limit(1)
  const prevIds = new Set<number>(((prev?.[0]?.not_indexed_ids ?? []) as { battleId: number }[]).map(b => b.battleId))
  const newly = prev?.length ? notIndexed.filter(b => !prevIds.has(b.battleId)) : []

  const row = {
    on_chain: chain.size,
    listed,
    test_excluded: testExcluded,
    not_indexed: notIndexed.length,
    not_indexed_holding: holding.length,
    not_indexed_holding_sol: holdingSol,
    db_only: dbOnly,
    not_indexed_ids: notIndexed,
    newly_not_indexed_ids: newly,
  }

  const sumOk = row.on_chain === row.listed + row.test_excluded + row.not_indexed
  const lines = [
    `On chain:        ${row.on_chain}`,
    `  listed here:   ${row.listed}`,
    `  test (left out on purpose): ${row.test_excluded}`,
    `  not indexed:   ${row.not_indexed}  (${row.not_indexed_holding} still hold SOL, ${row.not_indexed_holding_sol} SOL in total)`,
    `Real battles held here but not on chain: ${row.db_only}${row.db_only ? '  <-- investigate' : ''}`,
    `Test rows with no chain account (webhook fixtures, expected): ${testRowsNotOnChain}`,
    `Newly absent since the last census: ${newly.length}${newly.length ? ' -> ' + newly.map(b => b.battleId).join(', ') : ''}`,
    `Groups add up to the on-chain count: ${sumOk ? 'yes' : 'NO  <-- investigate'}`,
  ]
  console.log('─'.repeat(70)); console.log('WaveWarz chain census'); console.log('─'.repeat(70))
  lines.forEach(l => console.log(l))

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Chain census\n\n| | |\n|---|---|\n' +
      `| On chain | ${row.on_chain} |\n| Listed here | ${row.listed} |\n| Test, left out on purpose | ${row.test_excluded} |\n` +
      `| Not indexed | ${row.not_indexed} (${row.not_indexed_holding} hold SOL, ${row.not_indexed_holding_sol} SOL) |\n` +
      `| Real battles held here, not on chain | ${row.db_only} |\n| Newly absent since last census | ${newly.length} |\n\n`)
  }

  // Operator attribution across the battles this index holds.
  const heldIds = [...chain.keys()].filter(id => held.has(id))
  const byOp = new Map<string, number>()
  const payload = heldIds.map(id => { const c = chain.get(id)!; const m = matchOf(id)
    if (!held.get(id)) byOp.set(`${m.operatorId ?? 'unattributed'} (${m.basis})`, (byOp.get(`${m.operatorId ?? 'unattributed'} (${m.basis})`) ?? 0) + 1)
    return { battle_id: Number(id), launcher_wallet: c.launcher, fee_wallet_chain: c.fee, operator_id: m.operatorId, operator_basis: m.basis } })
  if (registry) { console.log('Listed battles by operator:'); for (const [k, v] of [...byOp].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`) }

  // Partner decisions for battles the index does not hold.
  const toPull: typeof notIndexed = [], events: { kind: string; battle_id: number; operator_id: string | null; launcher_wallet: string | null; fee_wallet: string; reason: string }[] = []
  const newlyIds = new Set(newly.map(b => b.battleId))
  if (registry) for (const b of notIndexed) {
    const c = chain.get(String(b.battleId))!
    const facts = { battleId: b.battleId, feeWallet: c.fee, launcher: c.launcher }
    const d = listingDecision(facts, { operatorId: b.operatorId, basis: b.basis as never }, registry)
    if (d.list) toPull.push(b)
    else if (newlyIds.has(b.battleId)) events.push({ kind: b.operatorId && b.basis !== 'unattributed' && registry.operators.find(o => o.id === b.operatorId)?.listingMode === 'partner' ? 'rejected' : 'unmatched',
      battle_id: b.battleId, operator_id: b.operatorId, launcher_wallet: c.launcher, fee_wallet: c.fee, reason: d.reason })
  }
  if (registry) console.log(`Not indexed and listable for an approved partner: ${toPull.length}${toPull.length ? ' -> ' + toPull.map(b => `${b.battleId} (${b.operatorId})`).join(', ') : ''}`)

  if (dryRun) { console.log('\nDRY RUN — nothing stored'); return }
  const { error } = await supabase.from('chain_census').insert(row)
  if (error) throw new Error(`could not store census: ${error.message}`)
  console.log('\nStored.')

  if (registry) {
    let changed = 0
    for (let i = 0; i < payload.length; i += 400) {
      const { data, error: e } = await supabase.rpc('apply_battle_operators', { p: payload.slice(i, i + 400) })
      if (e) throw new Error(`apply_battle_operators: ${e.message}`)
      changed += Number(data) || 0
    }
    console.log(`Operator columns updated on ${changed} battles (of ${payload.length} held and on chain).`)

    if (toPull.length) {
      const { data: have } = await supabase.from('partner_battles').select('battle_id').in('battle_id', toPull.map(b => b.battleId))
      const had = new Set((have ?? []).map(r => Number(r.battle_id)))
      const rows2 = toPull.map(b => { const c = chain.get(String(b.battleId))!; return {
        battle_id: b.battleId, operator_id: b.operatorId!, basis: b.basis, launcher_wallet: c.launcher, fee_wallet: c.fee,
        artist_a_wallet: c.a, artist_b_wallet: c.b, started_at: c.startedAt, ends_at: c.endsAt, pool_a_sol: c.poolA, pool_b_sol: c.poolB,
        settled: c.settled, settlement_winner_a: c.winnerA, distribution_sol: c.distSol, last_seen_at: new Date().toISOString() } })
      const { error: pe } = await supabase.from('partner_battles').upsert(rows2, { onConflict: 'battle_id' })
      if (pe) throw new Error(`partner_battles: ${pe.message}`)
      for (const b of toPull) if (!had.has(b.battleId)) events.push({ kind: 'pulled', battle_id: b.battleId, operator_id: b.operatorId, launcher_wallet: chain.get(String(b.battleId))!.launcher, fee_wallet: chain.get(String(b.battleId))!.fee, reason: b.basis })
      console.log(`Partner battles recorded: ${toPull.length} (${toPull.length - had.size} new).`)
    }
    if (events.length) {
      const { error: ie } = await supabase.from('intake_events').insert(events)
      if (ie) console.warn(`  (could not log intake events: ${ie.message})`)
      else console.log(`Intake events logged: ${events.length}`)
    }
  }
  if (!sumOk || row.db_only > 0) process.exitCode = 2
}

main().catch(err => { console.error('\nFatal:', err instanceof Error ? err.message : err); process.exit(1) })
