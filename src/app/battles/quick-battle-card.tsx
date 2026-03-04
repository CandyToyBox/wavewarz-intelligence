'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'

export type QuickBattleCardData = {
  battle_id: number
  dateFormatted: string
  // Songs
  song1Title: string
  song2Title: string
  song1Link: string | null
  song2Link: string | null
  song1Handle: string | null
  song2Handle: string | null
  song1ArtUrl: string | null
  song2ArtUrl: string | null
  song1Color: string
  song2Color: string
  // Pools (final)
  song1PoolSol: string
  song1PoolUsd: string
  song2PoolSol: string
  song2PoolUsd: string
  // Volumes
  song1VolSol: string
  song1VolUsd: string
  song2VolSol: string
  song2VolUsd: string
  // Totals
  totalVolSol: string
  totalVolUsd: string
  streamEquivalent: string
  // Winner
  winnerTitle: string
  loserTitle: string
  winnerIsA: boolean
  marginSol: string
  marginPct: string
  // Artist earnings
  song1EarnSol: string
  song1EarnUsd: string
  song1TradeFeesSol: string
  song1TradeFeesUsd: string
  song1SettleSol: string
  song1SettleUsd: string
  song1SettleLabel: string   // "Winner bonus (5%)" or "Consolation (2%)"
  song2EarnSol: string
  song2EarnUsd: string
  song2TradeFeesSol: string
  song2TradeFeesUsd: string
  song2SettleSol: string
  song2SettleUsd: string
  song2SettleLabel: string
  // Platform
  platformEarnSol: string
  platformEarnUsd: string
  platformTradeFeesSol: string
  platformTradeFeesUsd: string
  platformSettleSol: string
  platformSettleUsd: string
  // Wallets
  song1Wallet: string | null
  song2Wallet: string | null
  wavewarzWallet: string | null
}

export function QuickBattleCard({ data }: { data: QuickBattleCardData }) {
  const [showEarnings, setShowEarnings] = useState(false)
  const w = data.winnerIsA ? data.song1Title : data.song2Title
  const wColor = data.winnerIsA ? data.song1Color : data.song2Color

  return (
    <div className="rounded-xl border border-border bg-[#0d1321] overflow-hidden">

      {/* ── STATUS HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-[#111827]">
        <span className="w-2 h-2 rounded-full bg-[#95fe7c] shrink-0" />
        <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest">
          QUICK BATTLE · COMPLETED
        </Badge>
        <span className="flex-1 text-xs text-muted-foreground truncate">
          {data.song1Title}
          <span className="mx-2 text-muted-foreground/50">vs</span>
          {data.song2Title}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{data.dateFormatted}</span>
        <Link href={`/battles/${data.battle_id}`} className="font-mono text-[10px] text-[#7ec1fb]/60 hover:text-[#7ec1fb] shrink-0 transition-colors">
          #{data.battle_id} ↗
        </Link>
      </div>

      {/* ── WINNER BANNER ── */}
      <div className="px-4 py-2 bg-[#95fe7c]/5 border-b border-[#95fe7c]/10">
        <p className="text-xs">
          <span className="font-rajdhani font-bold" style={{ color: wColor }}>{w}</span>
          <span className="text-muted-foreground ml-2">won with a</span>
          <span className="text-[#95fe7c] font-bold ml-2">+{data.marginPct}% margin</span>
        </p>
      </div>

      {/* ── HERO: TWO SIDES ── */}
      <div className="grid grid-cols-3 gap-0 p-3 sm:p-5">

        {/* Loser side */}
        <div className="flex flex-col items-center text-center gap-2">
          <SongAvatar title={data.winnerIsA ? data.song2Title : data.song1Title}
            artUrl={data.winnerIsA ? data.song2ArtUrl : data.song1ArtUrl}
            color={data.winnerIsA ? data.song2Color : data.song1Color} size="xl" dim />
          <p className="text-sm font-rajdhani font-bold text-white/60 leading-tight px-2">
            {data.winnerIsA ? data.song2Title : data.song1Title}
          </p>
          {data.winnerIsA
            ? <SolStat sol={data.song2PoolSol} usd={data.song2PoolUsd} label="FINAL POOL VALUE" dim />
            : <SolStat sol={data.song1PoolSol} usd={data.song1PoolUsd} label="FINAL POOL VALUE" dim />
          }
          {(data.winnerIsA ? data.song2Link : data.song1Link) && (
            <a href={data.winnerIsA ? data.song2Link! : data.song1Link!} target="_blank" rel="noreferrer"
              className="text-[10px] text-muted-foreground hover:text-[#7ec1fb] hover:underline">
              Audius ↗
            </a>
          )}
        </div>

        {/* Center: trophy + margin */}
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <TrophyIcon color={wColor} />
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Chart Winner</p>
          <p className="text-sm font-rajdhani font-bold leading-tight" style={{ color: wColor }}>
            {w}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Margin: <span className="font-mono text-white">{data.marginSol} SOL</span>
          </p>
          <p className="text-[10px] text-[#95fe7c] font-bold">+{data.marginPct}%</p>
        </div>

        {/* Winner side */}
        <div className="flex flex-col items-center text-center gap-2">
          <SongAvatar title={data.winnerIsA ? data.song1Title : data.song2Title}
            artUrl={data.winnerIsA ? data.song1ArtUrl : data.song2ArtUrl}
            color={data.winnerIsA ? data.song1Color : data.song2Color} size="xl" glow />
          <p className="text-sm font-rajdhani font-bold text-white leading-tight px-2">
            {data.winnerIsA ? data.song1Title : data.song2Title}
          </p>
          {data.winnerIsA
            ? <SolStat sol={data.song1PoolSol} usd={data.song1PoolUsd} label="FINAL POOL VALUE" accent />
            : <SolStat sol={data.song2PoolSol} usd={data.song2PoolUsd} label="FINAL POOL VALUE" accent />
          }
          {(data.winnerIsA ? data.song1Link : data.song2Link) && (
            <a href={data.winnerIsA ? data.song1Link! : data.song2Link!} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#7ec1fb] hover:underline">
              Audius ↗
            </a>
          )}
        </div>
      </div>

      {/* ── STATS GRID ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 sm:px-5 pb-4">
        <StatBox
          label={<Tip text="Total SOL traded by fans on both sides of this battle.">Total Trading Volume</Tip>}
          value={`${data.totalVolSol} SOL`} sub={data.totalVolUsd} />
        <StatBox
          label={<Tip text="Equivalent Spotify streams this battle's USD volume could buy at $0.003 per stream.">Spotify Equivalent</Tip>}
          value={data.streamEquivalent} sub="at $0.003 / stream" />
        <StatBox
          label={`${data.song1Title.split(' ').slice(0, 2).join(' ')} Vol`}
          value={`${data.song1VolSol} SOL`} sub={data.song1VolUsd} />
        <StatBox
          label={`${data.song2Title.split(' ').slice(0, 2).join(' ')} Vol`}
          value={`${data.song2VolSol} SOL`} sub={data.song2VolUsd} />
      </div>

      {/* ── EARNINGS TOGGLE ── */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowEarnings(e => !e)}
          className="text-xs font-rajdhani font-bold text-muted-foreground hover:text-white border border-border px-3 py-1.5 rounded-lg hover:border-white/20 transition-colors"
        >
          {showEarnings ? 'Hide Earnings ↑' : 'Show Artist Earnings ↓'}
        </button>
        <span className="text-[10px] text-muted-foreground">
          Platform earned: <span className="text-white font-mono">{data.platformEarnSol} SOL</span>
          <span className="ml-1">({data.platformEarnUsd})</span>
        </span>
      </div>

      {/* ── EARNINGS BREAKDOWN ── */}
      {showEarnings && (
        <div className="border-t border-border bg-[#111827]/50 divide-y divide-border/50">

          {/* Artist 1 */}
          <EarningsRow
            icon="🎵"
            name={data.song1Title}
            totalSol={data.song1EarnSol}
            totalUsd={data.song1EarnUsd}
            rows={[
              { label: `Trading fees (1% of ${data.song1VolSol} SOL)`, sol: data.song1TradeFeesSol, usd: data.song1TradeFeesUsd },
              { label: data.song1SettleLabel, sol: data.song1SettleSol, usd: data.song1SettleUsd },
            ]}
          />

          {/* Artist 2 */}
          <EarningsRow
            icon="🎵"
            name={data.song2Title}
            totalSol={data.song2EarnSol}
            totalUsd={data.song2EarnUsd}
            rows={[
              { label: `Trading fees (1% of ${data.song2VolSol} SOL)`, sol: data.song2TradeFeesSol, usd: data.song2TradeFeesUsd },
              { label: data.song2SettleLabel, sol: data.song2SettleSol, usd: data.song2SettleUsd },
            ]}
          />

          {/* Platform */}
          <EarningsRow
            icon="⚡"
            name="WaveWarZ Platform"
            totalSol={data.platformEarnSol}
            totalUsd={data.platformEarnUsd}
            accent="purple"
            rows={[
              { label: 'Trading fees (0.5% of total volume)', sol: data.platformTradeFeesSol, usd: data.platformTradeFeesUsd },
              { label: 'Settlement bonus (3% of loser pool)', sol: data.platformSettleSol, usd: data.platformSettleUsd },
            ]}
          />

          {/* Info callout */}
          <div className="px-5 py-3 bg-[#7ec1fb]/5 border-t border-[#7ec1fb]/10">
            <p className="text-[10px] text-[#7ec1fb] leading-relaxed">
              💡 Artists earn 1% of every trade in their pool, plus settlement bonuses:<br />
              • Winners get 5% of the losing pool &nbsp;· &nbsp;Losers get 2% consolation from their own pool
            </p>
          </div>

          {/* Wallet addresses */}
          {(data.song1Wallet || data.song2Wallet || data.wavewarzWallet) && (
            <div className="px-5 py-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Wallet Addresses</p>
              <div className="space-y-1.5">
                {data.song1Wallet && <WalletRow label="Wallet A" addr={data.song1Wallet} />}
                {data.song2Wallet && <WalletRow label="Wallet B" addr={data.song2Wallet} />}
                {data.wavewarzWallet && <WalletRow label="Treasury" addr={data.wavewarzWallet} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SongAvatar({ title, artUrl, color, size = 'md', glow, dim }: {
  title: string; artUrl?: string | null; color: string; size?: 'sm' | 'md' | 'lg' | 'xl'
  glow?: boolean; dim?: boolean
}) {
  const sizes = { sm: 'w-10 h-10 text-base', md: 'w-16 h-16 text-2xl', lg: 'w-20 h-20 text-3xl', xl: 'w-28 h-28 text-4xl' }
  const [imgFailed, setImgFailed] = useState(false)

  if (artUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artUrl}
        alt={title}
        className={`${sizes[size]} rounded-lg object-cover border-2 transition-all`}
        style={{
          borderColor: glow ? color : `${color}30`,
          boxShadow: glow ? `0 0 20px ${color}40, 0 0 8px ${color}20` : undefined,
          opacity: dim ? 0.5 : 1,
        }}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} rounded-lg flex items-center justify-center font-rajdhani font-bold border-2 transition-all`}
      style={{
        backgroundColor: `${color}18`,
        borderColor: glow ? color : `${color}30`,
        color: dim ? `${color}60` : color,
        boxShadow: glow ? `0 0 20px ${color}40, 0 0 8px ${color}20` : undefined,
        opacity: dim ? 0.6 : 1,
      }}
    >
      {title.charAt(0).toUpperCase()}
    </div>
  )
}

function SolStat({ sol, usd, label, accent, dim }: {
  sol: string; usd: string; label: string; accent?: boolean; dim?: boolean
}) {
  return (
    <div className="text-center">
      <p className={`font-mono font-bold text-lg leading-tight ${dim ? 'text-muted-foreground' : accent ? 'text-[#95fe7c]' : 'text-white'}`}>
        ◎{sol}
      </p>
      <p className={`text-[10px] ${dim ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>({usd})</p>
      <p className={`text-[9px] uppercase tracking-widest mt-0.5 ${dim ? 'text-muted-foreground/40' : accent ? 'text-[#95fe7c]/70' : 'text-muted-foreground/60'}`}>
        {label}
      </p>
    </div>
  )
}

function StatBox({ label, value, sub }: { label: React.ReactNode; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-[#111827] border border-border p-3">
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 leading-tight">{label}</p>
      <p className="text-sm font-rajdhani font-bold text-[#7ec1fb] font-mono">◎{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function EarningsRow({ icon, name, totalSol, totalUsd, rows, accent }: {
  icon: string; name: string; totalSol: string; totalUsd: string; accent?: string
  rows: { label: string; sol: string; usd: string }[]
}) {
  const textColor = accent === 'purple' ? 'text-[#a78bfa]' : 'text-[#95fe7c]'
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-rajdhani font-bold text-white">
          {icon} <span className="text-muted-foreground font-normal">
            {name.length > 30 ? name.slice(0, 30) + '…' : name}
          </span> earned:
        </p>
        <div className="text-right shrink-0">
          <p className={`font-mono font-bold text-sm ${textColor}`}>◎{totalSol}</p>
          <p className="text-[10px] text-muted-foreground">({totalUsd})</p>
        </div>
      </div>
      <div className="space-y-1 ml-4">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-muted-foreground">└── {r.label}</p>
            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] text-white">◎{r.sol}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({r.usd})</span>
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
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}:</span>
      <span className="font-mono text-[10px] text-[#7ec1fb] break-all">{addr}</span>
    </div>
  )
}
