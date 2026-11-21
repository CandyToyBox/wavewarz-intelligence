/**
 * Sync the operator registry into the database.
 *
 * The registry is Zaal's: spec/operators.json in the protocol repo is the single
 * approval list for which arenas exist and which wallets are theirs. This script
 * projects that file into the operators, operator_wallets and operator_claims
 * tables. Run it whenever the registry changes (a new arena is approved by a pull
 * request there). It never edits the file.
 *
 * What it does NOT touch: operators.listing_mode and granted_by. That is the grant
 * (off / main / partner) and is set by Candy, Zaal or Hurricane, on purpose, in
 * the database, never by a file sync. A newly registered operator starts at 'off'
 * (wavewarz and songchainn start at 'main': their battles already arrive through
 * the main index).
 *
 * Usage (from the repo root):
 *   npx tsx scripts/sync-operators.ts --file=../wavewarz-protocol/spec/operators.json
 *   npx tsx scripts/sync-operators.ts --file=... --dry-run
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n') : []) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}
import { validateRegistry, type Registry } from '../src/lib/operators/resolve'

const MAIN_MODE_AT_FIRST = new Set(['wavewarz', 'songchainn'])

type W = { wallet: string; role?: string }
type FileOp = { operator_id: string; name: string; home?: string; registered?: string;
  fee_wallets?: W[]; launcher_wallets?: W[]; declared_redirects?: W[]; claimed_battles?: number[] }

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const fileArg = process.argv.find(a => a.startsWith('--file='))
  if (!fileArg) { console.error('Usage: --file=<path to operators.json> [--dry-run]'); process.exit(1) }
  const reg = JSON.parse(fs.readFileSync(path.resolve(fileArg.slice(7)), 'utf8'))
  const ops: FileOp[] = reg.operators
  const version: string = String(reg.registry_version ?? '')

  const asRegistry: Registry = { operators: ops.map(o => ({
    id: o.operator_id, name: o.name, status: 'active', listingMode: 'off',
    feeWallets: new Set((o.fee_wallets ?? []).map(w => w.wallet)),
    launcherWallets: new Set((o.launcher_wallets ?? []).map(w => w.wallet)),
    redirectWallets: new Set((o.declared_redirects ?? []).map(w => w.wallet)),
    claims: new Set(o.claimed_battles ?? []),
  })) }
  const problems = validateRegistry(asRegistry)
  if (problems.length) { console.error('Registry is ambiguous, refusing to sync:\n  - ' + problems.join('\n  - ')); process.exit(2) }

  console.log(`Registry ${version}: ${ops.length} operators`)
  for (const o of ops) console.log(`  ${o.operator_id.padEnd(12)} fee ${(o.fee_wallets ?? []).length}  launcher ${(o.launcher_wallets ?? []).length}  redirect ${(o.declared_redirects ?? []).length}  claims ${(o.claimed_battles ?? []).length}`)
  if (dryRun) { console.log('\nDRY RUN — nothing written'); return }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: existing, error: e0 } = await sb.from('operators').select('operator_id')
  if (e0) throw new Error(e0.message)
  const have = new Set((existing ?? []).map(r => r.operator_id))

  for (const o of ops) {
    const base = { name: o.name, home: o.home ?? null, registered: o.registered ?? null, registry_version: version, updated_at: new Date().toISOString() }
    if (have.has(o.operator_id)) {
      const { error } = await sb.from('operators').update(base).eq('operator_id', o.operator_id)   // listing_mode and granted_by left alone
      if (error) throw new Error(`update ${o.operator_id}: ${error.message}`)
    } else {
      const { error } = await sb.from('operators').insert({ operator_id: o.operator_id, ...base, listing_mode: MAIN_MODE_AT_FIRST.has(o.operator_id) ? 'main' : 'off' })
      if (error) throw new Error(`insert ${o.operator_id}: ${error.message}`)
    }
    // wallets and claims are replaced as a set, so a removed entry really goes away
    for (const t of ['operator_wallets', 'operator_claims'] as const) {
      const { error } = await sb.from(t).delete().eq('operator_id', o.operator_id); if (error) throw new Error(`clear ${t}: ${error.message}`)
    }
    const wallets = [
      ...(o.fee_wallets ?? []).map(w => ({ operator_id: o.operator_id, wallet: w.wallet, kind: 'fee', role: w.role ?? null })),
      ...(o.launcher_wallets ?? []).map(w => ({ operator_id: o.operator_id, wallet: w.wallet, kind: 'launcher', role: w.role ?? null })),
      ...(o.declared_redirects ?? []).map(w => ({ operator_id: o.operator_id, wallet: w.wallet, kind: 'redirect', role: w.role ?? null })),
    ]
    if (wallets.length) { const { error } = await sb.from('operator_wallets').insert(wallets); if (error) throw new Error(`wallets ${o.operator_id}: ${error.message}`) }
    const claims = (o.claimed_battles ?? []).map(b => ({ operator_id: o.operator_id, battle_id: b }))
    if (claims.length) { const { error } = await sb.from('operator_claims').insert(claims); if (error) throw new Error(`claims ${o.operator_id}: ${error.message}`) }
  }
  // An operator removed from the file is suspended here, not deleted (history stays attributable).
  const inFile = new Set(ops.map(o => o.operator_id))
  for (const id of have) if (!inFile.has(id)) { await sb.from('operators').update({ status: 'suspended' }).eq('operator_id', id); console.log(`  ${id}: no longer in the registry, marked suspended`) }
  console.log('\nSynced.')
}
main().catch(e => { console.error('Fatal:', e instanceof Error ? e.message : e); process.exit(1) })
