# Fight sim: which file is which

Last updated 2026-10-12.

| Copy | Where | Status |
|---|---|---|
| **v23 traderview** (AttaBotty, 2026-09-18) | `public/battle-arena/index.html` | **Live on battle pages, connected.** Driven by `src/app/battles/[id]/live-arena.tsx` and `/api/battles/[id]/live-trades`. The one to build on. |
| Stream overlay | `~/wavewarz-fighter-overlay/` (Samantha's Mac, not in this repo) | **Not connected to the site.** `arena.html` is v23 plus a script hardcoded to Stormi vs Geek Myth (2026-09-20 finals) that polls the public API; kept for reference. |
| v14 / v15 | Samantha's Downloads | Older, superseded by v23. |

**How the connected version works.** The page embeds the arena in a same-origin iframe and calls
`window.WaveWarzArena` (`buy`, `sell`, `setPool`, `setRoundDuration`, `setArtistPhoto`, `setArtistName`,
`reset`, `getState`, `setViewMode`, `toggleView`). New trades come from the chain through
`/api/battles/[id]/live-trades` (about every 3.5 s, about 3 s behind wavewarz.com); winner settlement comes from
Supabase Realtime. The arena only shows while a battle is live. A newer version of AttaBotty's file is a
drop-in replacement as long as that `WaveWarzArena` interface holds.

**Open asks for AttaBotty.** A `forceEnd(winnerSide)` method so the round ends when the chain settles, and a
decision on whether viewers get the Trader/Fight view toggle.
