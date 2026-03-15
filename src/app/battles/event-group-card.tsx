'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { BattleImage } from './battle-image'

export type RoundData = {
  battle_id: number
  roundNumber: number
  dateFormatted: string
  artist1Name: string
  artist2Name: string
  // Pool values
  a1PoolSol: string
  a2PoolSol: string
  a1PoolUsd: string
  a2PoolUsd: string
  // Volumes
  a1VolSol: string
  a2VolSol: string
  totalVolSol: string
  totalVolUsd: string
  // Winner
  winner: string
  loser: string
  winnerIsA: boolean
  marginSol: string
  marginPct: string
  pct1: number
  pct2: number
  // Earnings
  a1EarnSol: string
  a1EarnUsd: string
  a1TradeFeesSol: string
  a1TradeFeesUsd: string
  a1SettleSol: string
  a1SettleUsd: string
  a1SettleLabel: string
  a2EarnSol: string
  a2EarnUsd: string
  a2TradeFeesSol: string
  a2TradeFeesUsd: string
  a2SettleSol: string
  a2SettleUsd: string
  a2SettleLabel: string
  platformEarnSol: string
  platformEarnUsd: string
  // Links
  youtubeLink: string | null
  streamLink: string | null
  // Wallets
  a1Wallet: string | null
  a2Wallet: string | null
  wavewarzWallet: string | null
}

export type EventGroupCardData = {
  groupKey: string
  eventType: 'main' | 'community' | 'charity' | 'spotlight'
  artist1Name: string
  artist2Name: string
  artist1PfpUrl: string | null
  artist2PfpUrl: string | null
  imageUrl: string | null
  latestDateFormatted: string
  totalRounds: number
  totalVolSol: string
  totalVolUsd: string
  streamEquivalent: string
  overallWinner: string | null
  rounds: RoundData[]
}

const TYPE_CONFIG = {
  main:      { label: 'MAIN EVENT',  badge: 'bg-[#95fe7c]/20 text-[#95fe7c] border-[#95fe7c]/40', accent: '#95fe7c' },
  community: { label: 'COMMUNITY',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', accent: '#f59e0b' },
  charity:   { label: 'BENEFIT',     badge: 'bg-[#7ec1fb]/20 text-[#7ec1fb] border-[#7ec1fb]/40', accent: '#7ec1fb' },
  spotlight: { label: 'SPOTLIGHT',   badge: 'bg-[#7ec1fb]/20 text-[#7ec1fb] border-[#7ec1fb]/40', accent: '#7ec1fb' },
}

export function EventGroupCard({ data }: { data: EventGroupCardData }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TYPE_CONFIG[data.eventType]

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-[#1a2d44] transition-colors">
      <div className="flex flex-col md:flex-row">

        {/* ── LANDSCAPE IMAGE ── */}
        <div className="md:w-64 md:shrink-0 h-40 md:h-auto relative overflow-hidden bg-muted">
          <BattleImage
            src={data.imageUrl}
            alt={`${data.artist1Name} vs ${data.artist2Name}`}
            className="w-full h-full"
            fallbackText={data.artist1Name}
          />
          {data.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#04080f]/70 hidden md:block" />
          )}
        </div>

        {/* ── CARD BODY ── */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={`${cfg.badge} border text-[10px] font-bold tracking-widest`}>
                  {cfg.label}
                </Badge>
                {data.totalRounds > 1 && (
                  <span className="text-[10px] text-muted-foreground">{data.totalRounds} rounds</span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{data.latestDateFormatted}</span>
              </div>
              <h3 className="text-xl font-rajdhani font-bold text-white tracking-wide leading-tight flex items-center gap-2 flex-wrap">
                <ArtistAvatar name={data.artist1Name} pfpUrl={data.artist1PfpUrl} accent={cfg.accent} />
                {data.artist1Name}
                <span className="text-muted-foreground font-normal text-base">vs</span>
                <ArtistAvatar name={data.artist2Name} pfpUrl={data.artist2PfpUrl} accent={cfg.accent} />
                {data.artist2Name}
              </h3>
              {data.overallWinner && (
                <p className="text-xs font-bold font-rajdhani mt-1" style={{ color: cfg.accent }}>
                  Overall Winner: {data.overallWinner}
                </p>
              )}
            </div>
          </div>

          {/* Aggregate stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <AggregateStat label="Total Volume" value={`${data.totalVolSol} SOL`} sub={data.totalVolUsd} />
            <AggregateStat label="Spotify Equiv" value={data.streamEquivalent} sub="at $0.003/stream" />
            <AggregateStat label="Rounds" value={String(data.totalRounds)} sub="battle rounds" />
          </div>

          {/* Round pills */}
          {data.totalRounds > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {data.rounds.map(r => (
                <div
                  key={r.battle_id}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold border"
                  style={{ borderColor: `${cfg.accent}40`, backgroundColor: `${cfg.accent}10`, color: cfg.accent }}
                >
                  R{r.roundNumber}
                  <span className="text-muted-foreground font-normal ml-1">
                    {r.winner.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-auto">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs font-rajdhani font-bold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-white hover:border-white/20 transition-colors"
            >
              {expanded ? 'Hide Rounds ↑' : 'View Rounds ↓'}
            </button>
            {data.rounds[0]?.youtubeLink && (
              <a href={data.rounds[0].youtubeLink} target="_blank" rel="noreferrer"
                className="text-xs text-[#7ec1fb] hover:underline">Watch Replay ↗</a>
            )}
            {data.rounds[0]?.streamLink && (
              <a href={data.rounds[0].streamLink} target="_blank" rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-white hover:underline">Stream ↗</a>
            )}
            <Link
              href={`/battles/${data.rounds[0]?.battle_id}`}
              className="text-[10px] text-muted-foreground/40 hover:text-[#7ec1fb] ml-auto font-mono transition-colors"
            >
              #{data.rounds[0]?.battle_id}
              {data.rounds.length > 1 && `–#${data.rounds[data.rounds.length - 1].battle_id}`} ↗
            </Link>
          </div>
        </div>
      </div>

      {/* ── EXPANDED ROUNDS ── */}
      {expanded && (
        <div className="border-t border-border">
          <div className="px-5 py-2.5 bg-muted">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Round-by-Round Breakdown</p>
          </div>
          <div className="divide-y divide-border/50">
            {data.rounds.map(r => (
              <RoundDetail key={r.battle_id} round={r} accent={cfg.accent} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RoundDetail({ round: r, accent }: { round: RoundData; accent: string }) {
  const [showEarnings, setShowEarnings] = useState(false)

  return (
    <div className="bg-card">
      {/* Round header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-muted/60">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-rajdhani border shrink-0"
          style={{ borderColor: `${accent}40`, backgroundColor: `${accent}10`, color: accent }}
        >
          {r.roundNumber}
        </span>
        <div className="flex-1">
          <p className="text-sm font-rajdhani font-bold text-white leading-tight">
            {r.artist1Name} <span className="text-muted-foreground font-normal text-xs">vs</span> {r.artist2Name}
          </p>
          <p className="text-xs text-muted-foreground">{r.dateFormatted} · #{r.battle_id}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {r.youtubeLink && (
            <a href={r.youtubeLink} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#7ec1fb] hover:underline">Watch ↗</a>
          )}
          <Link href={`/battles/${r.battle_id}`} className="text-[10px] text-muted-foreground hover:text-white transition-colors">
            Details ↗
          </Link>
        </div>
      </div>

      {/* Winner banner */}
      <div className="px-5 py-2 bg-[#95fe7c]/5">
        <p className="text-xs">
          <span className="font-rajdhani font-bold" style={{ color: accent }}>{r.winner}</span>
          <span className="text-muted-foreground ml-2">won with a</span>
          <span className="text-[#95fe7c] font-bold ml-2">+{r.marginPct}% margin</span>
        </p>
      </div>

      {/* Pool bars */}
      <div className="px-5 py-4 space-y-2">
        <PoolBarRow name={r.artist1Name} poolSol={r.a1PoolSol} poolUsd={r.a1PoolUsd}
          pct={r.pct1} won={r.winnerIsA} accent={accent} />
        <PoolBarRow name={r.artist2Name} poolSol={r.a2PoolSol} poolUsd={r.a2PoolUsd}
          pct={r.pct2} won={!r.winnerIsA} accent={accent} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-5 pb-3">
        <MiniStatBox label="Round Volume" value={`${r.totalVolSol} SOL`} sub={r.totalVolUsd} />
        <MiniStatBox label="Margin" value={`${r.marginSol} SOL`} sub={`+${r.marginPct}%`} />
        <MiniStatBox label={`${r.artist1Name.split(' ')[0]} Vol`} value={`${r.a1VolSol} SOL`} sub={r.a1PoolUsd} />
        <MiniStatBox label={`${r.artist2Name.split(' ')[0]} Vol`} value={`${r.a2VolSol} SOL`} sub={r.a2PoolUsd} />
      </div>

      {/* Earnings toggle */}
      <div className="border-t border-border/30 px-5 py-2.5 flex items-center justify-between">
        <button
          onClick={() => setShowEarnings(e => !e)}
          className="text-[10px] font-rajdhani font-bold text-muted-foreground hover:text-white transition-colors"
        >
          {showEarnings ? 'Hide Earnings ↑' : 'Show Artist Earnings ↓'}
        </button>
        <span className="text-xs text-muted-foreground">
          Platform: <span className="text-[#f59e0b] font-mono font-bold">◎{r.platformEarnSol}</span>
          <span className="ml-1 text-muted-foreground">({r.platformEarnUsd})</span>
        </span>
      </div>

      {/* Earnings breakdown */}
      {showEarnings && (
        <div className="border-t border-border/30 bg-muted/40 divide-y divide-border/30">
          <EarningsRow icon="🎤" name={r.artist1Name} totalSol={r.a1EarnSol} totalUsd={r.a1EarnUsd}
            rows={[
              { label: `Trading fees (1% of ${r.a1VolSol} SOL)`, sol: r.a1TradeFeesSol, usd: r.a1TradeFeesUsd },
              { label: r.a1SettleLabel, sol: r.a1SettleSol, usd: r.a1SettleUsd },
            ]}
          />
          <EarningsRow icon="🎤" name={r.artist2Name} totalSol={r.a2EarnSol} totalUsd={r.a2EarnUsd}
            rows={[
              { label: `Trading fees (1% of ${r.a2VolSol} SOL)`, sol: r.a2TradeFeesSol, usd: r.a2TradeFeesUsd },
              { label: r.a2SettleLabel, sol: r.a2SettleSol, usd: r.a2SettleUsd },
            ]}
          />
          <EarningsRow icon="⚡" name="WaveWarZ Platform" totalSol={r.platformEarnSol} totalUsd={r.platformEarnUsd}
            accent="platform"
            rows={[
              { label: `Trading fees (0.5% of ${r.totalVolSol} SOL)`, sol: formatPlatformFee(r.totalVolSol), usd: '' },
              { label: 'Settlement bonus (3% of loser pool)', sol: r.platformEarnSol, usd: r.platformEarnUsd },
            ]}
          />
          {(r.a1Wallet || r.a2Wallet || r.wavewarzWallet) && (
            <div className="px-5 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Wallets</p>
              <div className="space-y-1">
                {r.a1Wallet && <WalletRow label="Wallet A" addr={r.a1Wallet} />}
                {r.a2Wallet && <WalletRow label="Wallet B" addr={r.a2Wallet} />}
                {r.wavewarzWallet && <WalletRow label="Treasury" addr={r.wavewarzWallet} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPlatformFee(volSol: string): string {
  return parseFloat((parseFloat(volSol) * 0.005).toFixed(4)).toString()
}

function AggregateStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-elevated px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-base font-rajdhani font-bold text-white leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

function PoolBarRow({ name, poolSol, poolUsd, pct, won, accent }: {
  name: string; poolSol: string; poolUsd: string; pct: number; won: boolean; accent: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{name}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: won ? accent : `${accent}40` }} />
      </div>
      <span className="font-mono text-xs w-16 text-right font-bold" style={{ color: won ? accent : '#6b7280' }}>
        ◎{poolSol}
      </span>
      <span className="text-xs text-muted-foreground w-16 text-right">{poolUsd}</span>
      <span className="text-xs font-bold w-4" style={{ color: won ? accent : 'transparent' }}>W</span>
    </div>
  )
}

function MiniStatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-elevated p-2.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5 leading-tight">{label}</p>
      <p className="text-sm font-rajdhani font-bold text-white font-mono">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

function EarningsRow({ icon, name, totalSol, totalUsd, rows, accent }: {
  icon: string; name: string; totalSol: string; totalUsd: string; accent?: string
  rows: { label: string; sol: string; usd: string }[]
}) {
  const textColor = accent === 'platform' ? 'text-[#f59e0b]' : 'text-[#95fe7c]'
  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-sm font-rajdhani font-bold text-white">
          {icon} <span className="text-muted-foreground font-normal text-xs">
            {name.length > 28 ? name.slice(0, 28) + '…' : name}
          </span> earned:
        </p>
        <div className="text-right shrink-0">
          <p className={`font-mono font-bold text-sm ${textColor}`}>◎{totalSol}</p>
          {totalUsd && <p className="text-xs text-muted-foreground">{totalUsd}</p>}
        </div>
      </div>
      <div className="space-y-1 ml-3">
        {rows.map(r => r.sol && (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">└── {r.label}</p>
            <div className="text-right shrink-0">
              <span className="font-mono text-xs text-white">◎{r.sol}</span>
              {r.usd && <span className="text-xs text-muted-foreground ml-1">{r.usd}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WalletRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}:</span>
      <span className="font-mono text-xs text-[#7ec1fb] break-all">{addr}</span>
    </div>
  )
}

function ArtistAvatar({ name, pfpUrl, accent }: {
  name: string; pfpUrl: string | null; accent: string
}) {
  const initial = name.charAt(0).toUpperCase()
  if (pfpUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pfpUrl}
        alt={name}
        className="w-7 h-7 rounded-full object-cover border-2 shrink-0"
        style={{ borderColor: `${accent}40` }}
      />
    )
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-rajdhani font-bold shrink-0 border"
      style={{ backgroundColor: `${accent}18`, borderColor: `${accent}40`, color: accent }}
    >
      {initial}
    </div>
  )
}
