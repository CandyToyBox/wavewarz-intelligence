/**
 * Verify Zaal's fee-split claim: total trade fee 1.500%, split 67/33 →
 * artist 1.005% / platform 0.495% (vs wavewarz-math.ts's 1.00% / 0.50%).
 *
 * For a sample of battles, pull the vault tx history, and for every BUY
 * decompose the native transfers:
 *   feePayer -> wavewarz_wallet  = platform fee
 *   feePayer -> artist wallet(s) = artist fee
 *   gross                        = u64 at instr bytes 8..15 (what trades.amount_sol stores)
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { PublicKey } from '@solana/web3.js'
const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }

function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

const KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY!
const PROGRAM = '9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
const BUY = [40, 239, 138, 154, 8, 37, 106, 108]
const LP = 1e9
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function vaultPda(id: number) {
  const s = Buffer.alloc(8); s.writeBigUInt64LE(BigInt(id))
  return PublicKey.findProgramAddressSync([Buffer.from('battle_vault'), s], new PublicKey(PROGRAM))[0].toBase58()
}

async function main() {
  // battles with a decent number of trades, spread across time
  const { data: battles } = await supabase
    .from('battles')
    .select('battle_id, artist1_wallet, artist2_wallet, wavewarz_wallet, trade_count, created_at')
    .eq('is_test_battle', false)
    .gt('trade_count', 8)
    .order('created_at', { ascending: false })
    .limit(400)
  const sample = (battles ?? []).filter((_, i) => i % 20 === 0).slice(0, 18)

  let nBuys = 0, platMissing = 0, platMissingGross = 0
  let sumGross = 0, sumPlatform = 0, sumArtist = 0
  const perBuy: { plat: number; art: number; tot: number }[] = []

  for (const b of sample) {
    const vault = vaultPda(b.battle_id)
    const artists = new Set([b.artist1_wallet, b.artist2_wallet].filter(Boolean))
    const ww = b.wavewarz_wallet
    let cursor: string | undefined
    for (let page = 0; page < 25; page++) {
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${vault}/transactions?api-key=${KEY}&limit=100` + (cursor ? `&before=${cursor}` : '')
      const res = await fetch(url)
      if (!res.ok) { await new Promise(r => setTimeout(r, 1500)); continue }
      const txs = await res.json() as any[]
      if (!txs.length) break
      for (const tx of txs) {
        const ix = (tx.instructions ?? []).find((i: any) => i.programId === PROGRAM)
        if (!ix?.data) continue
        let data: Buffer
        try { data = Buffer.from(bs58.decode(ix.data)) } catch { continue }
        if (data.length < 17 || !BUY.every((x, i) => data[i] === x)) continue
        const gross = Number(data.readBigUInt64LE(8)) / LP
        const payer = tx.feePayer
        let plat = 0, art = 0
        for (const nt of tx.nativeTransfers ?? []) {
          if (nt.fromUserAccount !== payer) continue
          if (nt.toUserAccount === ww) plat += nt.amount / LP
          else if (artists.has(nt.toUserAccount)) art += nt.amount / LP
        }
        if (gross <= 0 || (plat === 0 && art === 0)) continue
        nBuys++
        sumGross += gross; sumPlatform += plat; sumArtist += art
        perBuy.push({ plat: plat / gross, art: art / gross, tot: (plat + art) / gross })
        if (plat === 0 && gross > 0.001) { platMissing++; platMissingGross += gross }
      }
      if (txs.length < 100) break
      cursor = txs[txs.length - 1].signature
    }
    process.stdout.write(`  ${b.battle_id}: ${nBuys} buys so far\r`)
  }

  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  console.log(`\n\nsampled ${sample.length} battles, ${nBuys} buys with fee transfers\n`)
  console.log(`aggregate:`)
  console.log(`  platform fee / gross = ${(sumPlatform / sumGross * 100).toFixed(4)}%   (code: 0.5000%,  Zaal: 0.4950%)`)
  console.log(`  artist   fee / gross = ${(sumArtist / sumGross * 100).toFixed(4)}%   (code: 1.0000%,  Zaal: 1.0050%)`)
  console.log(`  total    fee / gross = ${((sumPlatform + sumArtist) / sumGross * 100).toFixed(4)}%   (both: 1.5000%)`)
  console.log(`\nper-buy median:`)
  console.log(`  platform = ${(med(perBuy.map(p => p.plat)) * 100).toFixed(4)}%`)
  console.log(`  artist   = ${(med(perBuy.map(p => p.art)) * 100).toFixed(4)}%`)
  console.log(`  total    = ${(med(perBuy.map(p => p.tot)) * 100).toFixed(4)}%`)
  console.log(`\nbuys with NO platform-fee transfer captured: ${platMissing} of ${nBuys} (${platMissingGross.toFixed(2)} SOL gross)`)
  console.log(`\nsplit (artist : platform) = ${(sumArtist / (sumArtist + sumPlatform) * 100).toFixed(2)} : ${(sumPlatform / (sumArtist + sumPlatform) * 100).toFixed(2)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
