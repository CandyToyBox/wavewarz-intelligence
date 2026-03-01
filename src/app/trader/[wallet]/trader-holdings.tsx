'use client'

import { useState, useEffect } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { parseBattleAccount } from '@/lib/solana/parser'
import { PROGRAM_ID } from '@/lib/solana/pda'
import Link from 'next/link'
import { Loader2, Coins, ExternalLink, Zap } from 'lucide-react'

const HELIUS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? '8b84d8d3-59ad-4778-829b-47db8a9149fa'
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

type Holding = {
  battleId: string
  mint: string
  amount: number
  side: 'A' | 'B'
  status: 'ACTIVE' | 'WON' | 'LOST' | 'INACTIVE'
  poolA: number
  poolB: number
}

export default function TraderHoldings({ wallet }: { wallet: string }) {
  const [holdings, setHoldings] = useState<Holding[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function scan() {
    setScanning(true)
    setError(null)
    try {
      const connection = new Connection(RPC_URL)
      const pubkey = new PublicKey(wallet)

      // Fetch all WaveWarz program accounts (battle accounts)
      const [programAccounts, tokenAccounts] = await Promise.all([
        connection.getProgramAccounts(PROGRAM_ID),
        connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM }),
      ])

      // Parse all battle accounts & build mint → battle map
      const mintMap = new Map<string, { battleId: string; side: 'A' | 'B'; poolA: number; poolB: number; isActive: boolean; winnerDecided: boolean; winnerArtistA: boolean }>()

      for (const { account } of programAccounts) {
        if (account.data.length < 100) continue
        const b = parseBattleAccount(account.data)
        if (!b) continue
        const poolA = Number(b.artistASolBalance) / 1e9
        const poolB = Number(b.artistBSolBalance) / 1e9
        const id = b.battleId.toString()
        mintMap.set(b.artistAMint.toBase58(), { battleId: id, side: 'A', poolA, poolB, isActive: b.isActive, winnerDecided: b.winnerDecided, winnerArtistA: b.winnerArtistA })
        mintMap.set(b.artistBMint.toBase58(), { battleId: id, side: 'B', poolA, poolB, isActive: b.isActive, winnerDecided: b.winnerDecided, winnerArtistA: b.winnerArtistA })
      }

      const results: Holding[] = []
      for (const item of tokenAccounts.value) {
        const info = item.account.data.parsed.info
        const mint: string = info.mint
        const amount: number = info.tokenAmount.uiAmount ?? 0
        if (amount <= 0 || !mintMap.has(mint)) continue

        const battle = mintMap.get(mint)!
        let status: Holding['status'] = 'INACTIVE'
        if (battle.isActive) status = 'ACTIVE'
        else if (battle.winnerDecided) {
          const isWinner = (battle.side === 'A' && battle.winnerArtistA) || (battle.side === 'B' && !battle.winnerArtistA)
          status = isWinner ? 'WON' : 'LOST'
        }

        results.push({ battleId: battle.battleId, mint, amount, side: battle.side, status, poolA: battle.poolA, poolB: battle.poolB })
      }

      results.sort((a, b) => {
        const score = (s: string) => s === 'WON' ? 3 : s === 'ACTIVE' ? 2 : s === 'LOST' ? 1 : 0
        return score(b.status) - score(a.status)
      })

      setHoldings(results)
    } catch (e) {
      console.error(e)
      setError('Scan failed. RPC may be rate limited — try again.')
    } finally {
      setScanning(false)
    }
  }

  const wonCount = holdings?.filter(h => h.status === 'WON').length ?? 0
  const activeCount = holdings?.filter(h => h.status === 'ACTIVE').length ?? 0

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-rajdhani font-bold text-white text-lg tracking-wide">Live On-Chain Holdings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Scans Solana for active or unclaimed WaveWarZ battle tokens</p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-[#95fe7c] hover:bg-[#95fe7c]/90 text-[#0d1321] font-bold text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          {scanning ? 'Scanning…' : 'Scan Wallet'}
        </button>
      </div>

      {scanning && (
        <div className="px-5 py-6 text-center">
          <Loader2 size={20} className="animate-spin text-[#95fe7c] mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Fetching all WaveWarZ program accounts…</p>
        </div>
      )}

      {error && !scanning && (
        <div className="px-5 py-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {holdings !== null && !scanning && (
        <div>
          {holdings.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Coins size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-white font-bold mb-1">No Active Holdings</p>
              <p className="text-xs text-muted-foreground">This wallet holds no WaveWarZ battle tokens on-chain.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-border flex gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{holdings.length} holding{holdings.length !== 1 ? 's' : ''} found</span>
                {wonCount > 0 && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30">{wonCount} claimable</span>}
                {activeCount > 0 && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 animate-pulse">{activeCount} live</span>}
              </div>
              <div className="divide-y divide-border/50">
                {holdings.map(h => {
                  const statusConfig = {
                    WON:      { color: '#95fe7c', label: 'Won — Claim Available' },
                    ACTIVE:   { color: '#facc15', label: 'Battle Live' },
                    LOST:     { color: '#989898', label: 'Battle Lost' },
                    INACTIVE: { color: '#989898', label: 'Inactive' },
                  }[h.status]
                  const isActionable = h.status === 'WON' || h.status === 'ACTIVE'

                  return (
                    <div key={`${h.battleId}-${h.side}`} className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActionable ? 'bg-[#95fe7c]/10' : 'bg-[#1f2937]'}`}>
                          <Coins size={16} style={{ color: statusConfig.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/battles/${h.battleId}`} className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm">
                              Battle #{h.battleId}
                            </Link>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
                              style={{ color: statusConfig.color, borderColor: `${statusConfig.color}30`, backgroundColor: `${statusConfig.color}10` }}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-white font-medium">{h.amount.toLocaleString()} shares</span> · Artist {h.side} · Pool {h.side === 'A' ? h.poolA.toFixed(3) : h.poolB.toFixed(3)} SOL
                          </p>
                        </div>
                      </div>
                      {isActionable && (
                        <a
                          href={`https://www.wavewarz.com/v2/battles/${h.battleId}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30 hover:bg-[#95fe7c]/20 transition-colors shrink-0"
                        >
                          {h.status === 'WON' ? 'Claim' : 'View'} <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {holdings === null && !scanning && (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          Click <span className="text-white">Scan Wallet</span> to check for live holdings and unclaimed payouts on Solana.
        </div>
      )}
    </div>
  )
}
