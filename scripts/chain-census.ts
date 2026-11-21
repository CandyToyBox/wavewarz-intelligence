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
 * One getProgramAccounts call, no per-battle reads. Read-only on chain, and the
 * only write is the census row. Never touches the battles table.
 *
 * Usage:
 *   npx tsx scripts/chain-census.ts             # count, compare, store a row
 *   npx tsx scripts/chain-census.ts --dry-run   # print only, store nothing
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

  const chain = new Map<string, { startedAt: string; holdingSol: number; ended: boolean }>()
  let unparsed = 0
  for (const a of accts) {
    const parsed = parseBattleAccount(Buffer.from(a.account.data[0], 'base64'))
    if (!parsed) { unparsed++; continue }
    const holdingLamports = Number(parsed.artistAPool + parsed.artistBPool)
    chain.set(parsed.battleId.toString(), {
      startedAt: new Date(Number(parsed.startTime) * 1000).toISOString(),
      holdingSol: Math.round((holdingLamports / LAMPORTS) * 1e6) / 1e6,
      ended: parsed.winnerDecided || !parsed.isActive,
    })
  }
  if (unparsed) console.warn(`  (${unparsed} accounts could not be parsed and are left out)`)
  if (chain.size < 1000) throw new Error(`census returned only ${chain.size} battles, refusing to store a partial count`)

  // 2. Every battle this index holds, with the test flag.
  const rows = await fetchAll<{ battle_id: number; is_test_battle: boolean | null }>((from, to) =>
    supabase.from('battles').select('battle_id, is_test_battle').range(from, to))
  const held = new Map(rows.map(r => [String(r.battle_id), r.is_test_battle === true]))

  // 3. Classify. The three groups add up to the on-chain count.
  let listed = 0, testExcluded = 0
  const notIndexed: { battleId: number; startedAt: string; holdingSol: number; ended: boolean }[] = []
  for (const [id, info] of chain) {
    if (held.has(id)) { held.get(id) ? testExcluded++ : listed++ }
    else notIndexed.push({ battleId: Number(id), startedAt: info.startedAt, holdingSol: info.holdingSol, ended: info.ended })
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

  if (dryRun) { console.log('\nDRY RUN — nothing stored'); return }
  const { error } = await supabase.from('chain_census').insert(row)
  if (error) throw new Error(`could not store census: ${error.message}`)
  console.log('\nStored.')
  if (!sumOk || row.db_only > 0) process.exitCode = 2
}

main().catch(err => { console.error('\nFatal:', err instanceof Error ? err.message : err); process.exit(1) })
