import Link from 'next/link'
import type { Metadata } from 'next'
import { Code, Endpoint } from '../docs-parts'
import { GAME_THEMES, THEME_INFO } from '@/lib/games/feed'

export const metadata: Metadata = {
  title: 'Games API and MCP',
  description: 'Build reactive games on live WaveWarz music battles: battle state, trade events with game cues, themes, and a read-only MCP server for AI agents.',
}

const TOC = [
  { id: 'state', label: 'GET /api/public/games/battles/:id' },
  { id: 'events', label: 'GET /api/public/games/battles/:id/events' },
  { id: 'themes', label: 'GET /api/public/games/themes' },
  { id: 'mcp', label: 'POST /api/mcp/games (MCP)' },
  { id: 'client', label: 'A small client' },
]

const CLIENT = `// Plays a WaveWarz battle into any game: Three.js, Phaser, Pixi, canvas, a stream overlay.
const BASE = 'https://wavewarz.info/api/public/games/battles'

export async function followBattle(battleId, theme, onEvent) {
  const state = await fetch(\`\${BASE}/\${battleId}?theme=\${theme}\`).then(r => r.json())

  if (state.status === 'ended') {
    // Finished battle: replay every stored trade, then show the stored result.
    const { events, outcome } = await fetch(\`\${BASE}/\${battleId}/events?history=1&theme=\${theme}\`).then(r => r.json())
    for (const e of events) onEvent(e)
    return outcome // { winner: 'A' | 'B', factors } or null
  }

  // Live battle: get a cursor, then poll for new trades every few seconds.
  let { cursor } = await fetch(\`\${BASE}/\${battleId}/events?theme=\${theme}\`).then(r => r.json())
  let net = { A: state.sides.A.settledPoolSol, B: state.sides.B.settledPoolSol }
  const timer = setInterval(async () => {
    const q = \`since=\${cursor}&theme=\${theme}&netA=\${net.A}&netB=\${net.B}\`
    const res = await fetch(\`\${BASE}/\${battleId}/events?\${q}\`).then(r => r.json())
    for (const e of res.events) { net = { A: e.netA, B: e.netB }; onEvent(e) }
    if (res.cursor) cursor = res.cursor
  }, 4000)
  return () => clearInterval(timer)
}

// Each event: { side, kind, sol, at, netA, netB, cue: { action, trick, power, durationMs, tier, levelUp } }
// e.g. onEvent = e => arena.play(e.side, e.cue.trick, e.cue.power)`

const MCP_CONFIG = `{
  "mcpServers": {
    "wavewarz-games": {
      "type": "http",
      "url": "https://wavewarz.info/api/mcp/games"
    }
  }
}`

export default function GamesApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-14 font-inter">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          <Link href="/api-docs" className="hover:text-white transition-colors">← Public API</Link>
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-4xl font-bold text-white tracking-tight">
            Games <span className="text-actiongreen">API</span>
          </h1>
          <span className="px-2 py-0.5 rounded bg-actiongreen/20 text-actiongreen text-[10px] font-bold tracking-widest border border-actiongreen/40">
            READ ONLY · NO AUTH
          </span>
        </div>
        <p className="text-gray-300 text-sm max-w-2xl">
          Build a game that reacts to a WaveWarz battle. Every trade on a battle&apos;s vault becomes an event with a
          ready-made game cue: which side, buy or sell, how big, the move to play and the level each side has reached.
          The same feed drives the Battle Stage on every wavewarz.info battle page: AttaBotty&apos;s Fighter and the
          DJ Clash, Wave Surf, Racers and Dancers views.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Base URL: <code className="text-white">https://wavewarz.info</code></span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Format: JSON</span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">CORS: open (*)</span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Poll live events every 3 to 5 s</span>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold text-white">Three rules for game builders</h2>
        <ul className="text-sm text-gray-300 space-y-2 list-disc pl-5 max-w-2xl">
          <li>
            <b className="text-white">The result is the stored result.</b> <code className="text-[#7ec1fb]">outcome</code> is null until
            WaveWarz decides the battle. Quick Battlez are decided 2 of 3 from Poll, Charts and DJ Wavy, so never end your game
            by pool size or show a pool as the reason a side won.
          </li>
          <li>
            <b className="text-white">netA and netB are for animation.</b> They are a running total of buys minus sells. They are not the
            settled pool and not anyone&apos;s earnings.
          </li>
          <li>
            <b className="text-white">Side A is wave blue (#7ec1fb), side B action green (#95fe7c).</b> Keep the sides in those colors so
            your game matches wavewarz.com and wavewarz.info.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold text-white">Endpoints</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {TOC.map((t) => (
            <Link key={t.id} href={`#${t.id}`} className="px-3 py-2 rounded-lg border border-border bg-white/[0.02] hover:bg-white/5 transition-colors font-mono text-xs text-[#7ec1fb]">
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <Endpoint
        id="state"
        method="GET"
        path="/api/public/games/battles/:id"
        summary="One battle's game state: the two sides, live or ended, time left, the stored result once decided, and each side's level and the scene dynamics for a theme."
        params={[
          { name: 'id', type: 'integer', desc: 'Battle id (the same id as wavewarz.info/battles/:id).' },
          { name: 'theme', type: 'string', desc: `Optional. One of ${GAME_THEMES.join(', ')}. Default dj.` },
        ]}
        example={`curl "https://wavewarz.info/api/public/games/battles/1794453124?theme=surf"`}
        response={`{
  "battleId": 1794453124,
  "type": "quick_battle",
  "status": "ended",              // "live" while the battle clock runs
  "msRemaining": 0,
  "sides": {
    "A": { "name": "$PEPEWavez x Hurric4n3Ike", "settledPoolSol": 0.0526, ... },
    "B": { "name": "WaveWarZ, the electric vibez", "settledPoolSol": 0.6222, ... }
  },
  "outcome": { "winner": "B", "factors": { "poll": "B", "djWavy": "B" } },   // null until decided
  "tiers": { "A": { "level": 1, ... }, "B": { "level": 1, ... } },
  "dynamics": { "poolDiff": 0.57, "amplitudeMultiplier": 1.04, ... },
  "links": { "page": "...", "trade": "https://www.wavewarz.com/v2/battles/1794453124", "events": "..." }
}`}
      />

      <Endpoint
        id="events"
        method="GET"
        path="/api/public/games/battles/:id/events"
        summary="Trade events, each with a game cue for the theme you ask for. history=1 returns every stored trade oldest first. Without it, the first call returns a cursor and no events; pass since=<cursor> on each poll to get the trades that landed on the vault since."
        params={[
          { name: 'history', type: '1', desc: 'Every stored trade, oldest first. Use it for replays and finished battles.' },
          { name: 'since', type: 'string', desc: 'Live only. The cursor (a transaction signature) from your previous call.' },
          { name: 'netA, netB', type: 'number', desc: 'Live only. The last running totals you hold, so new events continue from them.' },
          { name: 'theme', type: 'string', desc: `Optional. ${GAME_THEMES.join(', ')}. Sets the move names and level titles.` },
        ]}
        example={`curl "https://wavewarz.info/api/public/games/battles/1794453124/events?history=1&theme=racer"`}
        response={`{
  "mode": "history",
  "count": 41,
  "events": [
    {
      "side": "B", "kind": "buy", "sol": 0.01, "at": "2026-11-12T03:13:23+00:00",
      "netA": 0, "netB": 0.01,
      "cue": {
        "theme": "racer", "action": "Drafting Slalom", "trick": "carve",
        "power": 0.15, "waveSurge": 0.68, "durationMs": 650,
        "tier": { "level": 1, "title": "Sleek Pod" }, "levelUp": false
      }
    }
  ],
  "outcome": { "winner": "B", ... }
}`}
      />

      <Endpoint
        id="themes"
        method="GET"
        path="/api/public/games/themes"
        summary="Every theme with its description, the move a small, medium, large and very large buy and a sell plays, and the five level titles with the pool size each starts at."
        example={`curl https://wavewarz.info/api/public/games/themes`}
        response={`{ "themes": [ { "id": "fighter", "name": "Fighter", "by": "AttaBotty",
  "actions": { "buySmall": "Jab", "buyLarge": "Spin kick", "buyMega": "Jump punch", "sell": "Stagger", ... },
  "tiers": [ { "level": 1, "minSol": 0, "title": "Rookie" }, ... ] }, ... ] }`}
      />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-white">Themes</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {GAME_THEMES.map((id) => (
            <div key={id} className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-1">
              <p className="font-display font-bold text-white">{THEME_INFO[id].name} <code className="text-[11px] text-muted-foreground font-mono ml-1">{id}</code></p>
              <p className="text-xs text-gray-300">{THEME_INFO[id].description}</p>
              <p className="text-[11px] text-muted-foreground">By {THEME_INFO[id].by}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="mcp" className="space-y-4 scroll-mt-24">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-[#7ec1fb]/20 text-[#7ec1fb] text-[10px] font-bold tracking-widest border border-[#7ec1fb]/40">MCP</span>
          <code className="font-mono text-sm text-white">POST /api/mcp/games</code>
        </div>
        <p className="text-sm text-gray-300 max-w-2xl">
          A Model Context Protocol server for AI agents and tools, over streamable HTTP. It is read-only: it reads public
          battle data and never trades, signs or holds anything. Add it to an MCP client with this config:
        </p>
        <Code>{MCP_CONFIG}</Code>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 text-[10px] uppercase tracking-widest text-muted-foreground">Tool</th>
              <th className="py-2 text-[10px] uppercase tracking-widest text-muted-foreground">What it returns</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {[
              ['get_battle_state', 'battle_id, theme? → the same state as GET /games/battles/:id'],
              ['get_battle_events', 'battle_id, theme?, history?, since? → trade events with game cues'],
              ['classify_trade', 'sol, kind, theme? → the move a trade of that size plays'],
              ['get_tier', 'pool_sol, theme? → the level and title at that pool size'],
              ['list_game_themes', '→ every theme with its level titles'],
            ].map(([n, d]) => (
              <tr key={n} className="border-b border-border/50">
                <td className="py-2 pr-4 font-mono text-[#7ec1fb] whitespace-nowrap">{n}</td>
                <td className="py-2 text-gray-300">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Example call</p>
        <Code>{`curl -X POST https://wavewarz.info/api/mcp/games \\
  -H "content-type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_battle_state","arguments":{"battle_id":1794453124}}}'`}</Code>
      </section>

      <section id="client" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-2xl font-bold text-white">A small client</h2>
        <p className="text-sm text-gray-300 max-w-2xl">
          No SDK to install. This is the whole loop the Battle Stage runs: replay a finished battle, or follow a live one.
        </p>
        <Code>{CLIENT}</Code>
      </section>

      <p className="text-xs text-muted-foreground">
        Changes to these endpoints are logged in the <Link href="/api-docs/changelog" className="text-actiongreen underline decoration-actiongreen/40">changelog</Link>.
      </p>
    </div>
  )
}
