'use client'

import { useState } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { parseBattleAccount, type BattleAccount } from '@/lib/solana/parser'
import { PROGRAM_ID } from '@/lib/solana/pda'
import Link from 'next/link'
import { Search, Loader2, Wallet, Coins, History, AlertTriangle, CheckCircle2, ExternalLink, Zap } from 'lucide-react'

const HELIUS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? '8b84d8d3-59ad-4778-829b-47db8a9149fa'
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

type HoldingStatus = 'ACTIVE' | 'WON' | 'LOST' | 'INACTIVE'

interface UserHolding {
  battleId: bigint
  mint: string
  amount: number
  side: 'A' | 'B'
  status: HoldingStatus
  artistASolBalance: bigint
  artistBSolBalance: bigint
  winnerArtistA: boolean
  winnerDecided: boolean
  isActive: boolean
}

async function fetchAllBattles(): Promise<BattleAccount[]> {
  const connection = new Connection(RPC_URL)
  const accounts = await connection.getProgramAccounts(PROGRAM_ID)
  const battles: BattleAccount[] = []
  for (const { account } of accounts) {
    if (account.data.length < 100) continue
    const parsed = parseBattleAccount(account.data)
    if (parsed) battles.push(parsed)
  }
  return battles
}

async function fetchUserHoldings(walletAddress: string, battles: BattleAccount[]): Promise<UserHolding[]> {
  const connection = new Connection(RPC_URL)
  const pubkey = new PublicKey(walletAddress)

  // Build mint → battle map
  const mintMap = new Map<string, { battle: BattleAccount; side: 'A' | 'B' }>()
  for (const b of battles) {
    mintMap.set(b.artistAMint.toBase58(), { battle: b, side: 'A' })
    mintMap.set(b.artistBMint.toBase58(), { battle: b, side: 'B' })
  }

  const response = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM })

  const holdings: UserHolding[] = []
  for (const item of response.value) {
    const info = item.account.data.parsed.info
    const mint: string = info.mint
    const amount: number = info.tokenAmount.uiAmount ?? 0

    if (amount > 0 && mintMap.has(mint)) {
      const { battle, side } = mintMap.get(mint)!
      let status: HoldingStatus = 'INACTIVE'
      if (battle.isActive) {
        status = 'ACTIVE'
      } else if (battle.winnerDecided) {
        const isWinner = (side === 'A' && battle.winnerArtistA) || (side === 'B' && !battle.winnerArtistA)
        status = isWinner ? 'WON' : 'LOST'
      }
      holdings.push({
        battleId: battle.battleId,
        mint,
        amount,
        side,
        status,
        artistASolBalance: battle.artistASolBalance,
        artistBSolBalance: battle.artistBSolBalance,
        winnerArtistA: battle.winnerArtistA,
        winnerDecided: battle.winnerDecided,
        isActive: battle.isActive,
      })
    }
  }

  return holdings
}

function statusSort(s: HoldingStatus) {
  if (s === 'WON') return 3
  if (s === 'ACTIVE') return 2
  if (s === 'LOST') return 1
  return 0
}

export default function ClaimChecker() {
  const [wallet, setWallet] = useState('')
  const [phase, setPhase] = useState<'idle' | 'battles' | 'holdings' | 'done'>('idle')
  const [holdings, setHoldings] = useState<UserHolding[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loading = phase === 'battles' || phase === 'holdings'

  const phaseLabel = phase === 'battles'
    ? 'Fetching all battles from Solana…'
    : phase === 'holdings'
    ? 'Scanning your token accounts…'
    : ''

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = wallet.trim()
    if (!trimmed) return

    try {
      new PublicKey(trimmed)
    } catch {
      setError('Invalid Solana wallet address.')
      return
    }

    setError(null)
    setHoldings(null)
    setPhase('battles')

    try {
      const battles = await fetchAllBattles()
      setPhase('holdings')
      const results = await fetchUserHoldings(trimmed, battles)
      results.sort((a, b) => statusSort(b.status) - statusSort(a.status))
      setHoldings(results)
      setPhase('done')
    } catch (err) {
      console.error(err)
      setError('Scan failed. Check your wallet address and try again.')
      setPhase('idle')
    }
  }

  const wonCount = holdings?.filter(h => h.status === 'WON').length ?? 0
  const activeCount = holdings?.filter(h => h.status === 'ACTIVE').length ?? 0

  return (
    <div className="space-y-6">
      {/* Search card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#95fe7c]/10 border border-[#95fe7c]/20 flex items-center justify-center">
            <Wallet size={18} className="text-[#95fe7c]" />
          </div>
          <div>
            <p className="font-rajdhani font-bold text-white text-base">Wallet Scanner</p>
            <p className="text-xs text-muted-foreground">Scans all on-chain WaveWarZ battles in real time</p>
          </div>
        </div>

        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Paste SOL wallet address…"
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              disabled={loading}
              className="w-full bg-[#0d1321] border border-border rounded-lg py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#95fe7c]/40 focus:border-[#95fe7c]/40 transition-colors disabled:opacity-50 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !wallet.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#95fe7c] hover:bg-[#95fe7c]/90 text-[#0d1321] font-bold text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {loading ? 'Scanning…' : 'Scan'}
          </button>
        </form>

        {loading && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            {phaseLabel}
          </p>
        )}

        {error && (
          <p className="text-xs text-red-400 mt-3 flex items-center gap-1.5">
            <AlertTriangle size={13} /> {error}
          </p>
        )}
      </div>

      {/* Results */}
      {holdings !== null && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-rajdhani font-bold text-white text-lg">
              Scan Results
              <span className="text-muted-foreground font-normal text-sm ml-2">({holdings.length} holding{holdings.length !== 1 ? 's' : ''} found)</span>
            </h2>
            <div className="flex gap-2">
              {wonCount > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30">
                  {wonCount} claimable
                </span>
              )}
              {activeCount > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 animate-pulse">
                  {activeCount} active
                </span>
              )}
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <CheckCircle2 size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-bold text-white mb-1">No Holdings Found</p>
              <p className="text-sm text-muted-foreground">This wallet doesn&apos;t hold shares in any active or historical WaveWarZ battles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {holdings.map(h => (
                <HoldingCard key={`${h.battleId}-${h.side}`} holding={h} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HoldingCard({ holding }: { holding: UserHolding }) {
  const { battleId, amount, side, status } = holding
  const isActionable = status === 'WON' || status === 'ACTIVE'

  const statusConfig = {
    WON: {
      label: 'Won — Claim Available',
      color: '#95fe7c',
      bg: 'bg-[#95fe7c]/5 border-[#95fe7c]/25',
      dot: <Coins size={14} className="text-[#95fe7c]" />,
      actionLabel: 'Claim Payout',
      actionStyle: 'bg-[#95fe7c] hover:bg-[#95fe7c]/90 text-[#0d1321]',
    },
    ACTIVE: {
      label: 'Battle Live',
      color: '#facc15',
      bg: 'bg-yellow-400/5 border-yellow-400/25',
      dot: <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />,
      actionLabel: 'Go to Battle',
      actionStyle: 'bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30',
    },
    LOST: {
      label: 'Battle Lost',
      color: '#989898',
      bg: 'bg-card border-border',
      dot: <History size={14} className="text-muted-foreground" />,
      actionLabel: null,
      actionStyle: '',
    },
    INACTIVE: {
      label: 'Inactive',
      color: '#989898',
      bg: 'bg-card border-border',
      dot: <History size={14} className="text-muted-foreground" />,
      actionLabel: null,
      actionStyle: '',
    },
  }[status]

  const poolA = Number(holding.artistASolBalance) / 1e9
  const poolB = Number(holding.artistBSolBalance) / 1e9
  const myPool = side === 'A' ? poolA : poolB

  return (
    <div className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${statusConfig.bg}`}>
      <div className="flex items-start gap-4 flex-1 min-w-0">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActionable ? 'bg-[#95fe7c]/10' : 'bg-[#1f2937]'}`}>
          <Coins size={20} style={{ color: statusConfig.color }} />
        </div>

        {/* Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link href={`/battles/${battleId.toString()}`}
              className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-base leading-tight">
              Battle #{battleId.toString()} ↗
            </Link>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
              style={{ color: statusConfig.color, borderColor: `${statusConfig.color}40`, backgroundColor: `${statusConfig.color}10` }}>
              {statusConfig.dot}
              {statusConfig.label}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="text-white font-medium">{amount.toLocaleString()} shares</span> on{' '}
            <span style={{ color: statusConfig.color }}>Artist {side}</span>
          </p>

          <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
            <span>Pool A: <span className="font-mono text-white">{poolA.toFixed(3)} SOL</span></span>
            <span>Pool B: <span className="font-mono text-white">{poolB.toFixed(3)} SOL</span></span>
            <span>Your side: <span className="font-mono text-white">{myPool.toFixed(3)} SOL</span></span>
          </div>

          <p className="font-mono text-[10px] text-muted-foreground/50 mt-1 truncate max-w-xs" title={holding.mint}>
            Mint: {holding.mint}
          </p>
        </div>
      </div>

      {/* Action */}
      {statusConfig.actionLabel && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <a
            href={`https://www.wavewarz.com/v2/battles/${battleId.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 font-bold text-sm py-2 px-5 rounded-lg transition-colors ${statusConfig.actionStyle}`}
          >
            {statusConfig.actionLabel}
            <ExternalLink size={13} />
          </a>
          <p className="text-[10px] text-muted-foreground">Opens wavewarz.com</p>
        </div>
      )}
    </div>
  )
}
