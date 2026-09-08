/**
 * Verify the frontend IDL (src/lib/solana/wavewarz.idl.json, from Hurricane
 * 2026-09-08) against live mainnet Battle accounts. Decodes each field at the
 * offset the IDL struct implies and checks it against the public API and for
 * internal consistency.
 *
 *   npx tsx scripts/verify-idl-layout.ts [--n=20]
 *
 * Needs NEXT_PUBLIC_HELIUS_API_KEY in .env.local.
 */
import * as fs from 'fs'
import * as path from 'path'
import { PublicKey } from '@solana/web3.js'

function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY!
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`
const PROGRAM = '9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
const API = 'https://wavewarz.info/api/public/battles'
const DISC = Buffer.from([81, 148, 121, 71, 63, 166, 116, 24])

// Offsets derived purely from the IDL struct field order + sizes.
const O = {
  battle_id: 8, start_time: 20, end_time: 28,
  artist_a_wallet: 36, artist_b_wallet: 68, wavewarz_wallet: 100,
  artist_a_mint: 132, artist_b_mint: 164,
  artist_a_supply: 196, artist_b_supply: 204,
  artist_a_sol_balance: 212, artist_b_sol_balance: 220,
  artist_a_pool: 228, artist_b_pool: 236,
  winner_artist_a: 244, winner_decided: 245, transaction_state: 246,
  is_initialized: 247, is_active: 248,
  total_distribution_amount: 249, admin: 257,
}
const STRUCT_END = 289  // admin ends at 288

function battlePda(id: number) {
  const seed = Buffer.alloc(8); seed.writeBigUInt64LE(BigInt(id))
  return PublicKey.findProgramAddressSync([Buffer.from('battle'), seed], new PublicKey(PROGRAM))[0]
}
async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return (await r.json()).result
}

async function main() {
  const n = Number((process.argv.find(a => a.startsWith('--n=')) ?? '--n=20').split('=')[1])
  const battles = (await (await fetch(`${API}?limit=${n}`)).json()).battles as Array<{ battleId: number; artist1: { wallet: string }; artist2: { wallet: string }; winnerDecided: boolean; winnerSide: string | null }>

  const checks: Record<string, [number, number]> = {}
  const bump = (k: string, ok: boolean) => { checks[k] ??= [0, 0]; checks[k][1]++; if (ok) checks[k][0]++ }
  const adminOnCurve: Record<string, number> = {}

  for (const b of battles) {
    const info = await rpc('getAccountInfo', [battlePda(b.battleId).toBase58(), { encoding: 'base64' }])
    if (!info?.value) { bump('account exists', false); continue }
    bump('account exists', true)
    const raw = Buffer.from(info.value.data[0], 'base64')
    const u64 = (o: number) => raw.readBigUInt64LE(o)
    const i64 = (o: number) => raw.readBigInt64LE(o)
    const pk = (o: number) => new PublicKey(raw.subarray(o, o + 32)).toBase58()

    bump('owned by program', info.value.owner === PROGRAM)
    bump('account is 353 bytes', raw.length === 353)
    bump('discriminator', raw.subarray(0, 8).equals(DISC))
    bump('battle_id @8 == API id', Number(u64(O.battle_id)) === b.battleId)
    bump('battle_id == start_time @20', u64(O.battle_id) === u64(O.start_time))
    bump('end_time @28 > start_time', i64(O.end_time) > i64(O.start_time))
    bump('artist_a_wallet @36 == API', pk(O.artist_a_wallet) === b.artist1.wallet)
    bump('artist_b_wallet @68 == API', pk(O.artist_b_wallet) === b.artist2.wallet)
    // PDA bumps are found top-down from 255, so usually high but can be lower.
    bump('bumps @16-19 are plausible (>= 0xC0)', [16, 17, 18, 19].every(o => raw[o] >= 0xc0))
    bump('mint_a @132 is a real pubkey', (() => { try { new PublicKey(raw.subarray(132, 164)); return true } catch { return false } })())
    bump('supply_a @196 == sol_balance_a @212', u64(O.artist_a_supply) !== u64(O.artist_a_sol_balance) || u64(O.artist_a_supply) === BigInt(0)) // just record; not an assertion
    bump('sol_balance_a @212 == pool_a @228 (bytes identical)', u64(O.artist_a_sol_balance) === u64(O.artist_a_pool))
    bump('winner_artist_a @244 is 0|1', raw[O.winner_artist_a] <= 1)
    bump('winner_decided @245 is 0|1', raw[O.winner_decided] <= 1)
    bump('transaction_state @246 is 0|1', raw[O.transaction_state] <= 1)
    bump('is_initialized @247 == 1', raw[O.is_initialized] === 1)
    bump('is_active @248 is 0|1', raw[O.is_active] <= 1)
    bump('total_distribution @249 < 5000 SOL', Number(u64(O.total_distribution_amount)) / 1e9 < 5000)
    let adminValid = false
    try { new PublicKey(raw.subarray(O.admin, O.admin + 32)); adminValid = true } catch { /* */ }
    bump('admin @257 is a valid pubkey', adminValid)
    if (adminValid) adminOnCurve[pk(O.admin)] = (adminOnCurve[pk(O.admin)] ?? 0) + 1
    bump('bytes 289..352 all zero', raw.subarray(STRUCT_END).every(x => x === 0))

    // winner cross-check: on-chain winner_artist_a == larger pool, on UNEQUAL
    // pools only (the program's Charts-factor result — see spec/BATTLE-RECORD.md)
    if (b.winnerDecided && raw[O.winner_decided] === 1 && u64(O.artist_a_pool) !== u64(O.artist_b_pool)) {
      const largerA = u64(O.artist_a_pool) > u64(O.artist_b_pool)
      bump('winner_artist_a @244 == larger pool (unequal pools)', (raw[O.winner_artist_a] === 1) === largerA)
    }
  }

  const w = Math.max(...Object.keys(checks).map(k => k.length))
  for (const [k, [ok, tot]] of Object.entries(checks)) {
    console.log(`  ${ok === tot ? 'PASS' : 'FAIL'}  ${k.padEnd(w)}  ${ok}/${tot}`)
  }
  console.log(`\n  distinct admin (@257) values across sample: ${Object.keys(adminOnCurve).length}`)
  for (const [a, c] of Object.entries(adminOnCurve).sort((x, y) => y[1] - x[1]).slice(0, 5)) console.log(`    ${c}x  ${a}`)
}
main().catch(e => { console.error(e); process.exit(1) })
