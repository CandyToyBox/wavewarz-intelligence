'use client'

// A driver puts the shared battle feed onto one game view. Every view gets the
// same calls in the same order, so switching views never changes the data.
import type { Side } from '@/lib/games/battle-logic'
import { classifyTradeActionForTheme } from '@/lib/games/battle-logic'
import type { ArenaEngine } from './engines/arenaTypes'

export type StageView = 'fighter' | 'dj' | 'surf' | 'racer' | 'dancer' | 'chart'
export type StageTrade = { side: Side; kind: 'buy' | 'sell'; sol: number }

export interface StageDriver {
  pools(a: number, b: number): void
  trade(t: StageTrade, a: number, b: number): void
  // Only ever called with the STORED winner. The games never pick one.
  finale(winner: Side): void
  reset(): void
  dispose(): void
}

export type DriverArt = { a: string | null; b: string | null }

// ---------- 3D themes (WaveWarz Stream Battle engines) ----------
export async function createEngineDriver(view: 'dj' | 'surf' | 'racer' | 'dancer', mount: HTMLElement, art: DriverArt): Promise<StageDriver> {
  const mod =
    view === 'dj' ? await import('./engines/djScene')
    : view === 'racer' ? await import('./engines/racerScene')
    : view === 'dancer' ? await import('./engines/dancerScene')
    : await import('./engines/surfScene')
  const Ctor =
    'DjArenaEngine' in mod ? mod.DjArenaEngine
    : 'RacerArenaEngine' in mod ? mod.RacerArenaEngine
    : 'DancerArenaEngine' in mod ? mod.DancerArenaEngine
    : (mod as typeof import('./engines/surfScene')).SurfArenaEngine
  const { createDefaultAlbumCanvas } = await import('./engines/proceduralArt')
  const engine: ArenaEngine = new Ctor(mount, art.a ?? createDefaultAlbumCanvas('A') ?? '', art.b ?? createDefaultAlbumCanvas('B') ?? '', 'pro', 'pro')
  return {
    pools: (a, b) => engine.syncSurferPools(a, b),
    trade: (t, a, b) => {
      engine.syncSurferPools(a, b)
      const p = classifyTradeActionForTheme(t.sol, t.kind, view)
      engine.triggerTrick({ side: t.side, trick: p.trick, power01: p.power01, waveSurge: p.waveSurge, durationMs: p.durationMs })
    },
    finale: (w) => {
      engine.triggerGrandFinale(w)
      engine.triggerCoinSplit(w)
    },
    reset: () => engine.reset(),
    dispose: () => engine.dispose(),
  }
}

// ---------- AttaBotty's fighter (public/battle-arena/index.html) ----------
type FighterApi = {
  buy: (side: Side, sol: number) => void
  sell: (side: Side, sol: number) => void
  setPool: (side: Side, sol: number) => void
  setRoundDuration: (seconds: number) => void
  setArtistPhoto: (side: Side, url: string) => void
  setArtistName: (side: Side, name: string) => void
  reset: () => void
}

// The page owns the album art, names, pools, view switch, trade buttons and the
// result, so the fighter's own copies are hidden here, from the outside: his
// file stays byte-for-byte his and a new version stays a drop-in replacement.
const FIGHTER_EMBED_CSS = `
  html, body { background: transparent !important; min-height: 0 !important; overflow: hidden !important; }
  .wrap { max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .wrap > header, .view-switcher-wrap, #traderViewCard, .controls, .footer-row, .art-panel-wrap, #matchClock, .round-len { display: none !important; }
  .arena-card { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; background: transparent !important; }
`

export function createFighterDriver(frame: HTMLIFrameElement, names: { a: string; b: string }, photos: DriverArt, onHeight: (px: number) => void): Promise<StageDriver> {
  return new Promise((resolve) => {
    let done = false
    const tryInit = () => {
      if (done) return
      const win = frame.contentWindow as (Window & { WaveWarzArena?: FighterApi }) | null
      const doc = frame.contentDocument
      const api = win?.WaveWarzArena
      if (!api || !doc?.body) return
      done = true
      clearInterval(poll)
      const style = doc.createElement('style')
      style.textContent = FIGHTER_EMBED_CSS
      doc.head.appendChild(style)
      // Its own round timer would end the fight by pool size. A result is never
      // decided by pool size, so the round is made long and the page ends it.
      api.setRoundDuration(24 * 3600)
      api.reset()
      api.setArtistName('A', names.a)
      api.setArtistName('B', names.b)
      if (photos.a) api.setArtistPhoto('A', photos.a)
      if (photos.b) api.setArtistPhoto('B', photos.b)
      const card = doc.getElementById('arenaCard') ?? doc.body
      const ro = new ResizeObserver(() => onHeight(card.getBoundingClientRect().height))
      ro.observe(card)
      onHeight(card.getBoundingClientRect().height)
      resolve({
        pools: (a, b) => { api.setPool('A', a); api.setPool('B', b) },
        trade: (t) => { if (t.kind === 'buy') api.buy(t.side, t.sol); else api.sell(t.side, t.sol) },
        finale: () => { /* the page shows the stored result over the stage */ },
        reset: () => api.reset(),
        dispose: () => ro.disconnect(),
      })
    }
    frame.addEventListener('load', tryInit)
    const poll = setInterval(tryInit, 120)
    tryInit()
  })
}
