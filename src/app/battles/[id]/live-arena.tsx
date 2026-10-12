'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { OnchainTrade } from '@/lib/solana/hydrate'
import { FullBleed } from '@/components/full-bleed'

// Public API exposed by the embedded fighter arena (public/battle-arena/index.html,
// which is AttaBotty's wavewarz_fighter_v23_traderview.html byte-for-byte; a newer
// version of his file is a drop-in replacement as long as this API holds),
// same-origin so we can reach it straight off contentWindow — no postMessage needed.
// See WAVEWARZ-LIVE-INTEGRATION.md for the full contract.
type WaveWarzArena = {
  buy: (side: 'A' | 'B', sol: number) => void
  sell: (side: 'A' | 'B', sol: number) => void
  setPool: (side: 'A' | 'B', sol: number) => void
  setRoundDuration: (seconds: number) => void
  setArtistPhoto: (side: 'A' | 'B', url: string) => void
  setArtistName: (side: 'A' | 'B', name: string) => void
  reset: () => void
  getState: () => { poolA: number; poolB: number; gameOver: boolean; msRemaining: number; viewMode: 'fight' | 'trader' }
  // v23+: a second, terminal-style skin (per-side price graphs, manual buy
  // inputs, a countdown clock) alongside the default fight view. Not wired
  // into wavewarz.info yet — flagging in the type so it's visible/available
  // if we decide to expose a toggle to viewers.
  setViewMode: (mode: 'fight' | 'trader') => void
  toggleView: () => void
}

// Individual trades are read straight off the WaveWarz program's own vault
// PDA history (via /api/battles/[id]/live-trades -> fetchRecentBattleTradesFromChain),
// deliberately NOT off wavewarz.com's webhook — that webhook syncs whole
// `battles` rows between wavewarz.com's Supabase and this one, on whatever
// cadence they choose, not per trade. Reading the chain ourselves means this
// stays genuinely per-trade regardless of what that webhook does, and keeps
// working even before/without Hurricane wiring anything into wavewarz.com.
const TRADE_POLL_INTERVAL_MS = 3500

// The arena's own round timer decides the local winner and plays the coin
// shower when it hits zero. There's no bridge method yet to force it to end
// in exact lockstep with the real on-chain `endBattle` (see integration doc
// §4) — so instead, once Realtime reports winner_decided flipping true on the
// `battles` row, we let the arena's own clock (seeded from the real end_time,
// so it should be within a second or two of the real thing) finish its
// animation, then hand off to the authoritative server-rendered settlement view.
const SETTLEMENT_HANDOFF_DELAY_MS = 7000

export function LiveArena({
  battleId,
  artist1Name,
  artist2Name,
  artist1Pool,
  artist2Pool,
  artist1AvatarUrl,
  artist2AvatarUrl,
  battleDurationSec,
  createdAtIso,
}: {
  battleId: number
  artist1Name: string
  artist2Name: string
  artist1Pool: number
  artist2Pool: number
  artist1AvatarUrl: string | null
  artist2AvatarUrl: string | null
  battleDurationSec: number | null
  createdAtIso: string | null
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const arenaRef = useRef<WaveWarzArena | null>(null)
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let lastSignature: string | null = null

    // A same-origin iframe can finish loading (and run its inline scripts,
    // including the one that sets window.WaveWarzArena) before this effect
    // gets a chance to attach a 'load' listener — especially once the browser
    // has battle-arena/index.html cached, so it loads almost instantly. A
    // listener attached after 'load' already fired never runs, silently
    // skipping the whole backfill (artist photo/name, round duration, pool)
    // and leaving the arena on its own internal defaults. So: try to grab
    // WaveWarzArena immediately, keep the 'load' listener as the normal path,
    // and poll briefly as a fallback for whichever way it actually loaded.
    let arenaInitialized = false
    let initPoll: ReturnType<typeof setInterval> | null = null

    function initializeArena() {
      if (arenaInitialized) return
      const win = iframeRef.current?.contentWindow as (Window & { WaveWarzArena?: WaveWarzArena }) | null | undefined
      const arena = win?.WaveWarzArena
      if (!arena) return
      arenaInitialized = true
      if (initPoll) { clearInterval(initPoll); initPoll = null }
      arenaRef.current = arena

      if (artist1AvatarUrl) arena.setArtistPhoto('A', artist1AvatarUrl)
      if (artist2AvatarUrl) arena.setArtistPhoto('B', artist2AvatarUrl)
      arena.setArtistName('A', artist1Name)
      arena.setArtistName('B', artist2Name)

      // battles has no start_time/end_time columns — battle_duration + created_at
      // (battle creation, our best proxy for start) is what's actually stored.
      const secondsRemaining = battleDurationSec && createdAtIso
        ? Math.max(1, Math.round(battleDurationSec - (Date.now() - new Date(createdAtIso).getTime()) / 1000))
        : 120
      arena.setRoundDuration(secondsRemaining)

      arena.reset()
      arena.setPool('A', artist1Pool)
      arena.setPool('B', artist2Pool)
    }

    const iframeEl = iframeRef.current
    iframeEl?.addEventListener('load', initializeArena)
    initPoll = setInterval(initializeArena, 100)
    initializeArena()

    // Poll the chain for new trades. First tick just establishes a baseline
    // signature (no replay flood of the battle's whole history) since
    // setPool above already backfilled current totals; every tick after
    // that plays only genuinely new trades.
    let inFlight = false
    async function pollTrades() {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const url = `/api/battles/${battleId}/live-trades${lastSignature ? `?since=${encodeURIComponent(lastSignature)}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data: { trades: OnchainTrade[]; latestSignature: string | null } = await res.json()
          const arena = arenaRef.current
          for (const trade of data.trades) {
            if (!arena) continue
            const side: 'A' | 'B' = trade.trade_type.endsWith('_a') ? 'A' : 'B'
            if (trade.trade_type.startsWith('buy')) arena.buy(side, trade.amount_sol)
            else if (trade.trade_type.startsWith('sell')) arena.sell(side, trade.amount_sol)
          }
          if (data.latestSignature) lastSignature = data.latestSignature
        }
      } catch {
        // Transient network/RPC hiccup — just retry on the next tick.
      } finally {
        inFlight = false
      }
      if (!cancelled) pollTimer = setTimeout(pollTrades, TRADE_POLL_INTERVAL_MS)
    }
    pollTrades()

    // Browsers throttle timers in backgrounded tabs, so a viewer who switches
    // away and back would otherwise wait out a stale timer (and the server has to
    // fill the gap). Poll the moment the tab is visible/focused again.
    function catchUp() {
      if (cancelled || inFlight || document.visibilityState === 'hidden') return
      if (pollTimer) clearTimeout(pollTimer)
      pollTrades()
    }
    document.addEventListener('visibilitychange', catchUp)
    window.addEventListener('focus', catchUp)

    // The chain poll above drives the actual trade animations. Realtime on
    // the `battles` row is only used here as the settlement signal, since
    // winner_decided isn't something vault trade history tells us directly.
    const channel = supabase
      .channel(`battle-arena-${battleId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battles', filter: `battle_id=eq.${battleId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.winner_decided === true && handoffTimerRef.current === null) {
            handoffTimerRef.current = setTimeout(() => router.refresh(), SETTLEMENT_HANDOFF_DELAY_MS)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
      if (initPoll) clearInterval(initPoll)
      iframeEl?.removeEventListener('load', initializeArena)
      document.removeEventListener('visibilitychange', catchUp)
      window.removeEventListener('focus', catchUp)
      supabase.removeChannel(channel)
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current)
    }
    // Initial props seed the arena once on mount; live updates come through
    // the trade poll and the Realtime channel from here on, not prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId])

  return (
    <FullBleed>
      <iframe
        ref={iframeRef}
        src="/battle-arena/index.html"
        title="WaveWarZ live battle arena"
        className="w-full block"
        style={{ height: 'min(calc(100vw * 620 / 900), calc(100vh - 5rem))', border: 0 }}
      />
    </FullBleed>
  )
}
