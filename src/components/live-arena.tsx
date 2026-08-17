'use client'

import { useEffect, useState } from 'react'
import { OutboundLink } from '@/components/outbound-link'

export type LiveArenaData = {
  battleId: number
  type: 'quick' | 'main' | 'community'
  side1: { name: string; handle: string | null; artUrl: string | null; poolSol: number; durationSec?: number | null }
  side2: { name: string; handle: string | null; artUrl: string | null; poolSol: number; durationSec?: number | null }
  startedAt: string
  endsAt: string
  settledCount: number
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

// Design System v1 — "The Arena" signature component, wired to real battle data.
// https://claude.ai/code/artifact/e9ef036f-61d2-4785-be94-1e1bd421af26
export function LiveArena({ data }: { data: LiveArenaData }) {
  const start = new Date(data.startedAt).getTime()
  const end = new Date(data.endsAt).getTime()
  const total = Math.max(1, end - start)

  // Initial state is deterministic (server and client agree: "full time left")
  // so hydration never diffs on Date.now(). The real remaining time is only
  // computed client-side, after mount, inside the effect below.
  const [remaining, setRemaining] = useState(total)
  // Quick Battles play song 1 fully, then song 2 -- whichever is actually
  // playing right now needs to move the "NOW PLAYING" treatment with it.
  // Deterministic initial value (side1) for the same hydration-safety reason
  // as `remaining` above; corrected client-side once we know real elapsed time.
  const [activeSide, setActiveSide] = useState<'side1' | 'side2'>('side1')
  const song1DurationMs = (data.side1.durationSec ?? null) !== null ? data.side1.durationSec! * 1000 : null

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setRemaining(Math.max(0, end - now))
      if (song1DurationMs !== null) {
        setActiveSide(now - start >= song1DurationMs ? 'side2' : 'side1')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [end, start, total, song1DurationMs])

  const pct1 = data.side1.poolSol + data.side2.poolSol > 0
    ? (data.side1.poolSol / (data.side1.poolSol + data.side2.poolSol)) * 100
    : 50
  const R = 58
  const C = 2 * Math.PI * R
  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  const dashoffset = C * (1 - progress)

  const typeLabel = data.type === 'quick' ? 'QUICK BATTLEZ' : data.type === 'community' ? 'COMMUNITY BATTLE' : 'MAIN EVENT'

  return (
    <section aria-label="Live battle" className="relative">
      <style>{`
        @keyframes wwEq { 0%, 100% { height: 14%; } 50% { height: 88%; } }
        .ww-eq span { animation: wwEq 1s ease-in-out infinite; }
        .ww-eq span:nth-child(2n) { animation-duration: .85s; animation-delay: .12s; }
        .ww-eq span:nth-child(3n) { animation-duration: 1.15s; animation-delay: .22s; }
        .ww-eq span:nth-child(5n) { animation-duration: .75s; animation-delay: .05s; }
      `}</style>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-[.18em] text-[#95fe7c] border border-[#95fe7c]/45 rounded-full px-4 py-1.5 bg-[#95fe7c]/[.08] shadow-[0_0_22px_rgba(149,254,124,.25)]">
          <span className="relative w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-[#95fe7c]" />
            <span className="absolute inset-0 rounded-full bg-[#95fe7c] animate-ping" />
          </span>
          LIVE {typeLabel}
        </span>
        <span className="font-mono text-xs text-muted-foreground tracking-wide">
          round settles onchain &middot; program 9TUf&hellip;2fYo
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          <b className="text-white">{data.settledCount.toLocaleString()}</b> battles settled
        </span>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-10 items-center rounded-[26px] border border-[#7ec1fb]/[.14] bg-gradient-to-b from-[#111a2c]/85 to-[#0d1321]/60 p-6 md:p-10 shadow-[0_30px_90px_rgba(0,0,0,.5)] overflow-hidden">
        <div className="pointer-events-none absolute -top-[60%] left-[30%] w-2/5 h-[220%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/[.05] to-transparent" />

        {/* Side A */}
        <div className="flex flex-col gap-3 min-w-0 group">
          <div className="relative w-full max-w-[340px] aspect-square rounded-[20px] overflow-hidden border border-[#7ec1fb]/30 shadow-[0_24px_60px_rgba(0,0,0,.55)] -rotate-[2.2deg] group-hover:rotate-0 transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]">
            <span className="absolute top-3 left-3 z-10 font-mono text-[.62rem] font-bold tracking-[.2em] bg-[#0d1321]/85 border border-[#7ec1fb]/40 text-[#7ec1fb] px-2.5 py-1 rounded-lg">SIDE A</span>
            {data.side1.artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.side1.artUrl} alt={`${data.side1.name} album art`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a2740] to-[#0f1826]" />
            )}
            {activeSide === 'side1' && (
              <div className="ww-eq absolute left-0 right-0 bottom-0 h-14 flex items-end gap-[3px] px-3.5 pb-2.5 bg-gradient-to-t from-[#08131700] to-[#080d17]/85">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="flex-1 bg-[#7ec1fb] rounded-t-sm" style={{ height: '18%', opacity: .9 }} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[.62rem] tracking-[.16em] text-[#7ec1fb]">
              {activeSide === 'side1' ? <>&#9836; NOW PLAYING</> : 'PLAYED'}
            </div>
            <div className="font-rajdhani font-bold uppercase text-lg md:text-xl text-white leading-tight">{data.side1.name}</div>
            {data.side1.handle && <div className="text-sm text-muted-foreground">by <b className="text-[#7ec1fb] font-semibold">@{data.side1.handle}</b></div>}
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-3 text-center order-first md:order-none">
          <div className="relative w-[132px] h-[132px]">
            <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
              <circle cx="66" cy="66" r={R} fill="none" strokeWidth="7" stroke="rgba(126,193,251,.15)" />
              <circle cx="66" cy="66" r={R} fill="none" strokeWidth="7" stroke="#95fe7c" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={dashoffset}
                style={{ filter: 'drop-shadow(0 0 6px rgba(149,254,124,.7))', transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="font-mono text-2xl font-bold text-white tabular-nums">{formatClock(remaining)}</b>
              <span className="font-mono text-[.56rem] tracking-[.24em] text-muted-foreground">REMAINING</span>
            </div>
          </div>
          <div className="font-rajdhani font-bold text-2xl text-white" style={{ textShadow: '0 0 18px rgba(218,236,253,.5)' }}>VS</div>
          <div className="w-full max-w-[260px]">
            <div className="h-3 rounded-full overflow-hidden flex border border-white/[.18] bg-[#080d17]">
              <div className="h-full bg-gradient-to-r from-[#4f97d8] to-[#7ec1fb] transition-all duration-1000" style={{ width: `${pct1}%` }} />
              <div className="h-full flex-1 bg-gradient-to-r from-[#95fe7c] to-[#5fdf49]" />
            </div>
            <div className="flex justify-between font-mono text-[.66rem] text-muted-foreground mt-2 tabular-nums">
              <span className="text-[#7ec1fb]">{data.side1.poolSol.toFixed(2)} SOL</span>
              <span>crowd meter</span>
              <span className="text-[#95fe7c]">{data.side2.poolSol.toFixed(2)} SOL</span>
            </div>
          </div>
          <OutboundLink href="https://wavewarz.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 font-bold rounded-2xl px-8 py-4 text-base bg-[#95fe7c] text-[#08110a] shadow-[0_0_26px_rgba(149,254,124,.35)] hover:scale-105 hover:shadow-[0_0_42px_rgba(149,254,124,.6)] transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]">
            Jump into Battle
          </OutboundLink>
          <span className="font-mono text-[.62rem] text-muted-foreground tracking-wide">verify every trade onchain</span>
        </div>

        {/* Side B */}
        <div className="flex flex-col gap-3 min-w-0 items-end text-right group">
          <div className="relative w-full max-w-[340px] aspect-square rounded-[20px] overflow-hidden border border-[#95fe7c]/35 shadow-[0_24px_60px_rgba(0,0,0,.55)] rotate-[2.2deg] group-hover:rotate-0 transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]">
            <span className="absolute top-3 right-3 z-10 font-mono text-[.62rem] font-bold tracking-[.2em] bg-[#0d1321]/85 border border-[#95fe7c]/40 text-[#95fe7c] px-2.5 py-1 rounded-lg">SIDE B</span>
            {data.side2.artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.side2.artUrl} alt={`${data.side2.name} album art`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a2740] to-[#0f1826]" />
            )}
            {activeSide === 'side2' && (
              <div className="ww-eq absolute left-0 right-0 bottom-0 h-14 flex items-end gap-[3px] px-3.5 pb-2.5 bg-gradient-to-t from-[#08131700] to-[#080d17]/85">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="flex-1 bg-[#95fe7c] rounded-t-sm" style={{ height: '18%', opacity: .9 }} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="font-mono text-[.62rem] tracking-[.16em] text-muted-foreground">
              {activeSide === 'side2' ? <span className="text-[#95fe7c]">&#9836; NOW PLAYING</span> : 'UP NEXT'}
            </div>
            <div className="font-rajdhani font-bold uppercase text-lg md:text-xl text-white leading-tight">{data.side2.name}</div>
            {data.side2.handle && <div className="text-sm text-muted-foreground">by <b className="text-[#95fe7c] font-semibold">@{data.side2.handle}</b></div>}
          </div>
        </div>
      </div>
    </section>
  )
}
