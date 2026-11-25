'use client'

// Battle Stage: the one game area on a battle page. One feed (live trades off the
// vault, or the stored trade history for a replay) drives whichever view is
// picked: AttaBotty's fighter, the four WaveWarz Stream Battle 3D themes, or a
// plain pool chart. The page around it already shows the album art, names,
// pools, earnings and result, so the stage carries no copies of those; its only
// controls are the view chips, play/replay and full screen.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WwIcon, type WwIconName } from '@/components/ww-icon'
import type { Side } from '@/lib/games/battle-logic'
import { createEngineDriver, createFighterDriver, type StageDriver, type StageTrade, type StageView } from './drivers'
import { PoolChart, type ChartPoint } from './pool-chart'

const SIDE_A = '#7ec1fb'
const SIDE_B = '#95fe7c'

const VIEWS: Array<{ id: StageView; label: string; icon: WwIconName; by: string }> = [
  { id: 'fighter', label: 'Fighter', icon: 'vs-waveform', by: 'AttaBotty' },
  { id: 'dj', label: 'DJ Clash', icon: 'vinyl', by: 'Stream Battle' },
  { id: 'surf', label: 'Wave Surf', icon: 'equalizer', by: 'Stream Battle' },
  { id: 'racer', label: 'Racers', icon: 'launch', by: 'Stream Battle' },
  { id: 'dancer', label: 'Dancers', icon: 'microphone', by: 'Stream Battle' },
  { id: 'chart', label: 'Pool chart', icon: 'chart', by: 'WaveWarZ' },
]

const POLL_MS = 3500
const SETTLE_REFRESH_MS = 7000

type FeedEvent = { side: Side; kind: 'buy' | 'sell'; sol: number; at: string }

export type BattleStageProps = {
  battleId: number
  nameA: string
  nameB: string
  photoA: string | null
  photoB: string | null
  live: boolean
  endsAtIso: string | null
  startPoolA: number
  startPoolB: number
  // Stored result only (winner_decided). null = not decided yet.
  winner: Side | null
  quick: boolean
}

function isView(v: string | null): v is StageView {
  return !!v && VIEWS.some((x) => x.id === v)
}

export function BattleStage(p: BattleStageProps) {
  const router = useRouter()
  const [view, setView] = useState<StageView>('fighter')
  const [running, setRunning] = useState(p.live) // finished battles wait for "Replay"
  const [paused, setPaused] = useState(false)
  const [ended, setEnded] = useState(false) // the feed has played out (replay) or the clock ran out (live)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState('')
  const [progress, setProgress] = useState(0)
  const [chart, setChart] = useState<ChartPoint[]>([])
  const [frameH, setFrameH] = useState<number | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const driverRef = useRef<StageDriver | null>(null)
  const poolsRef = useRef({ a: p.live ? p.startPoolA : 0, b: p.live ? p.startPoolB : 0 })
  const finaleRef = useRef(false)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  // Remember the viewer's view (a per-viewer convenience only).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('view')
    let saved: string | null = null
    try { saved = localStorage.getItem('ww-stage-view') } catch {}
    const pick = isView(q) ? q : isView(saved) ? saved : null
    if (pick) setView(pick)
  }, [])
  const choose = (v: StageView) => {
    setView(v)
    try { localStorage.setItem('ww-stage-view', v) } catch {}
  }

  const applyTrade = useCallback((t: StageTrade, at: string) => {
    const pools = poolsRef.current
    const cur = t.side === 'A' ? pools.a : pools.b
    const next = Math.max(0, t.kind === 'buy' ? cur + t.sol : cur - t.sol)
    if (t.side === 'A') pools.a = next
    else pools.b = next
    driverRef.current?.trade(t, pools.a, pools.b)
    setChart((c) => [...c.slice(-399), { t: at, a: pools.a, b: pools.b }])
  }, [])

  const playFinale = useCallback(() => {
    if (finaleRef.current || !p.winner) return
    finaleRef.current = true
    driverRef.current?.finale(p.winner)
  }, [p.winner])

  // ---------- mount the chosen view ----------
  useEffect(() => {
    if (!running) return
    let cancelled = false
    let driver: StageDriver | null = null
    setError(null)
    const ready = (d: StageDriver) => {
      if (cancelled) { d.dispose(); return }
      driver = d
      driverRef.current = d
      d.pools(poolsRef.current.a, poolsRef.current.b)
      if (finaleRef.current && p.winner) d.finale(p.winner)
    }
    const mountEl = mountRef.current
    if (view === 'fighter') {
      const f = frameRef.current
      if (f) createFighterDriver(f, { a: p.nameA, b: p.nameB }, { a: p.photoA, b: p.photoB }, (h) => setFrameH(Math.round(h))).then(ready)
    } else if (view !== 'chart') {
      if (mountEl) {
        createEngineDriver(view, mountEl, { a: p.photoA, b: p.photoB }).then(ready).catch(() => {
          if (!cancelled) setError('This view needs WebGL, which this browser has turned off. Try the Fighter or the Pool chart.')
        })
      }
    }
    return () => {
      cancelled = true
      driver?.dispose()
      if (driverRef.current === driver) driverRef.current = null
      mountEl?.replaceChildren()
    }
  }, [view, running, p.nameA, p.nameB, p.photoA, p.photoB, p.winner])

  // ---------- live feed: new trades off the vault, every few seconds ----------
  useEffect(() => {
    if (!p.live) return
    let cancelled = false
    let cursor: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    const tick = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const url = `/api/public/games/battles/${p.battleId}/events${cursor ? `?since=${encodeURIComponent(cursor)}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data: { cursor: string | null; events: FeedEvent[] } = await res.json()
          for (const e of data.events) applyTrade({ side: e.side, kind: e.kind, sol: e.sol }, e.at)
          if (data.cursor) cursor = data.cursor
        }
      } catch {
        // A network or RPC hiccup: try again on the next tick.
      } finally {
        inFlight = false
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS)
    }
    tick()
    const catchUp = () => {
      if (document.visibilityState === 'hidden' || inFlight) return
      if (timer) clearTimeout(timer)
      tick()
    }
    document.addEventListener('visibilitychange', catchUp)
    window.addEventListener('focus', catchUp)

    // The stored result lands on the battles row; refresh the page shortly after.
    const supabase = createClient()
    let refresh: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel(`battle-stage-${p.battleId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `battle_id=eq.${p.battleId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>
        if (row.winner_decided === true && !refresh) refresh = setTimeout(() => router.refresh(), SETTLE_REFRESH_MS)
      })
      .subscribe()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (refresh) clearTimeout(refresh)
      document.removeEventListener('visibilitychange', catchUp)
      window.removeEventListener('focus', catchUp)
      supabase.removeChannel(channel)
    }
  }, [p.live, p.battleId, applyTrade, router])

  // Live clock in the toolbar.
  useEffect(() => {
    if (!p.live || !p.endsAtIso) return
    const end = new Date(p.endsAtIso).getTime()
    const id = setInterval(() => {
      const left = Math.max(0, end - Date.now())
      const s = Math.ceil(left / 1000)
      setClock(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
      if (left <= 0) setEnded(true)
    }, 500)
    return () => clearInterval(id)
  }, [p.live, p.endsAtIso])

  // ---------- replay: the stored trade history, played back in under a minute ----------
  const replayRef = useRef<{ events: FeedEvent[]; offsets: number[]; total: number; t: number; i: number } | null>(null)

  const startReplay = useCallback(async () => {
    setError(null)
    setEnded(false)
    finaleRef.current = false
    poolsRef.current = { a: 0, b: 0 }
    setChart([])
    driverRef.current?.reset()
    driverRef.current?.pools(0, 0)
    if (!replayRef.current) {
      setLoading(true)
      try {
        const res = await fetch(`/api/public/games/battles/${p.battleId}/events?history=1`)
        if (!res.ok) throw new Error()
        const data: { events: FeedEvent[] } = await res.json()
        const ev = data.events
        const t0 = ev.length ? new Date(ev[0].at).getTime() : 0
        const span = ev.length > 1 ? Math.max(1, new Date(ev[ev.length - 1].at).getTime() - t0) : 1
        const total = Math.min(60_000, Math.max(15_000, ev.length * 350))
        replayRef.current = { events: ev, offsets: ev.map((e) => ((new Date(e.at).getTime() - t0) / span) * total), total, t: 0, i: 0 }
      } catch {
        setError('Could not load this battle’s trades. Try again in a moment.')
        setLoading(false)
        return
      }
      setLoading(false)
    }
    const r = replayRef.current
    r.t = 0
    r.i = 0
    setPaused(false)
    setRunning(true)
  }, [p.battleId])

  useEffect(() => {
    if (p.live || !running) return
    const STEP = 100
    const id = setInterval(() => {
      const r = replayRef.current
      if (!r || pausedRef.current) return
      if (!driverRef.current && view !== 'chart') return // wait for the view to load
      r.t += STEP
      while (r.i < r.events.length && r.offsets[r.i] <= r.t) {
        const e = r.events[r.i++]
        applyTrade({ side: e.side, kind: e.kind, sol: e.sol }, e.at)
      }
      setProgress(Math.min(1, r.t / r.total))
      if (r.i >= r.events.length && r.t >= r.total) {
        clearInterval(id)
        setEnded(true)
        playFinale()
      }
    }, STEP)
    return () => clearInterval(id)
  }, [p.live, running, view, applyTrade, playFinale])

  // A live battle whose result is already stored plays its finale once.
  useEffect(() => {
    if (p.live && ended && p.winner) playFinale()
  }, [p.live, ended, p.winner, playFinale])

  const fullScreen = () => {
    const el = stageRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) document.exitFullscreen()
      else el.requestFullscreen?.()
    } catch {}
  }

  const winnerName = p.winner === 'A' ? p.nameA : p.winner === 'B' ? p.nameB : null
  const showResult = ended && (p.winner || p.live)
  const current = VIEWS.find((v) => v.id === view)!

  return (
    <section className="bs-wrap" aria-label="Battle stage">
      <div className="bs-bar">
        <div className="bs-views" role="group" aria-label="Game view">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className="ww-chip sm" aria-pressed={view === v.id} onClick={() => choose(v.id)}>
              <WwIcon name={v.icon} size={16} />{v.label}
            </button>
          ))}
        </div>
        <div className="bs-ctl">
          {p.live ? (
            <span className="bs-live"><i aria-hidden="true" />Live{clock && <b>{clock}</b>}</span>
          ) : running ? (
            <>
              <span className="bs-prog" aria-label={`Replay ${Math.round(progress * 100)}% played`}><i style={{ width: `${progress * 100}%` }} /></span>
              <button type="button" className="ww-chip sm" onClick={() => setPaused((x) => !x)} disabled={ended}>{paused ? 'Resume' : 'Pause'}</button>
              <button type="button" className="ww-chip sm" onClick={startReplay}><WwIcon name="play" size={16} />Replay again</button>
            </>
          ) : null}
          <button type="button" className="ww-chip sm" onClick={fullScreen} aria-label="Full screen">Full screen</button>
        </div>
      </div>

      <div className="bs-stage" ref={stageRef} style={view === 'fighter' && frameH ? { aspectRatio: 'auto', height: frameH } : undefined}>
        {!running ? (
          <div className="bs-poster">
            <p className="bs-poster-k">Replay</p>
            <p className="bs-poster-t">Watch every trade of this battle play out as {current.label === 'Pool chart' ? 'a pool chart' : `the ${current.label}`}.</p>
            <button type="button" className="ww-cta" onClick={startReplay} disabled={loading}>
              <WwIcon name="play" size={18} />{loading ? 'Loading trades…' : 'Replay the battle'}
            </button>
            {error && <p className="bs-err" role="alert">{error}</p>}
          </div>
        ) : view === 'fighter' ? (
          <iframe key={`f-${running}`} ref={frameRef} src="/battle-arena/index.html" title="Fighter view of the battle" className="bs-frame" />
        ) : view === 'chart' ? (
          <PoolChart points={chart} nameA={p.nameA} nameB={p.nameB} />
        ) : (
          <div key={view} ref={mountRef} className="bs-mount" />
        )}
        {running && error && <p className="bs-err over" role="alert">{error}</p>}
        {running && showResult && (
          <div className="bs-result" aria-live="polite">
            {winnerName ? (
              <>
                <b style={{ '--side': p.winner === 'A' ? SIDE_A : SIDE_B } as CSSProperties}>{winnerName}</b>
                <span>wins{p.quick ? ', decided 2 of 3: Poll, Charts, DJ Wavy' : ''}</span>
              </>
            ) : (
              <span>Time. The result is being decided.</span>
            )}
          </div>
        )}
      </div>

      <p className="bs-note">
        {p.live ? 'Every trade on the vault plays here a few seconds after it lands.' : 'Replays the stored trades, sped up.'}{' '}
        {current.id === 'fighter' ? 'Fighter by AttaBotty.' : current.id === 'chart' ? 'Net SOL traded into each side.' : 'From WaveWarZ Stream Battle.'}{' '}
        The games animate trades; the result shown is the one WaveWarZ decided.
        {p.live && <> <a href={`https://www.wavewarz.com/v2/battles/${p.battleId}`} target="_blank" rel="noreferrer">Trade on wavewarz.com</a></>}
      </p>
    </section>
  )
}
