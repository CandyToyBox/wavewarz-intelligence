import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Public API — WaveWarZ Intelligence',
  description: 'Free, no-auth JSON API for querying WaveWarZ battle, artist, trader, and song data — built for AI agents and developers.',
}

function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-border bg-[#0a0f1a] p-4 overflow-x-auto text-xs leading-relaxed">
      <code className="text-[#95fe7c] font-mono whitespace-pre">{children}</code>
    </pre>
  )
}

function Param({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-4 font-mono text-xs text-[#7ec1fb] whitespace-nowrap">{name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{type}</td>
      <td className="py-2 text-xs text-gray-300">{desc}</td>
    </tr>
  )
}

function Endpoint({
  id, method, path, summary, params, example, response,
}: {
  id: string
  method: string
  path: string
  summary: string
  params?: { name: string; type: string; desc: string }[]
  example: string
  response: string
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3">
        <span className="px-2 py-0.5 rounded bg-actiongreen/20 text-actiongreen text-[10px] font-bold tracking-widest border border-actiongreen/40">
          {method}
        </span>
        <code className="font-mono text-sm text-white">{path}</code>
      </div>
      <p className="text-sm text-gray-300">{summary}</p>

      {params && params.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 text-[10px] uppercase tracking-widest text-muted-foreground">Param</th>
              <th className="py-2 pr-4 text-[10px] uppercase tracking-widest text-muted-foreground">Type</th>
              <th className="py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => <Param key={p.name} {...p} />)}
          </tbody>
        </table>
      )}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Example request</p>
        <Code>{example}</Code>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Example response (trimmed)</p>
        <Code>{response}</Code>
      </div>
    </section>
  )
}

const TOC = [
  { id: 'stats', label: 'GET /api/public/stats' },
  { id: 'battles-list', label: 'GET /api/public/battles' },
  { id: 'battles-detail', label: 'GET /api/public/battles/:id' },
  { id: 'events', label: 'GET /api/public/events' },
  { id: 'lb-artists', label: 'GET /api/public/leaderboards/artists' },
  { id: 'lb-traders', label: 'GET /api/public/leaderboards/traders' },
  { id: 'lb-songs', label: 'GET /api/public/leaderboards/songs' },
]

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-14 font-inter">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-rajdhani text-4xl font-bold text-white tracking-tight">
            Public <span className="text-actiongreen">API</span>
          </h1>
          <span className="px-2 py-0.5 rounded bg-actiongreen/20 text-actiongreen text-[10px] font-bold tracking-widest border border-actiongreen/40">
            NO AUTH REQUIRED
          </span>
        </div>
        <p className="text-gray-300 text-sm max-w-2xl">
          Every trade, battle, and payout on WaveWarZ happens on Solana mainnet — it&apos;s already public.
          This API just makes it easy to query without running your own RPC indexer. Built for AI agents,
          dashboards, bots, and anyone who wants live WaveWarZ data in JSON. Free, read-only, no API key.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Base URL: <code className="text-white">https://wavewarz.info</code></span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Format: JSON</span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">CORS: open (*)</span>
          <span className="px-2 py-1 rounded bg-white/5 border border-border">Cache: 30–60s</span>
        </div>
      </div>

      {/* Quick start */}
      <section className="space-y-3">
        <h2 className="font-rajdhani text-2xl font-bold text-white">Quick Start</h2>
        <p className="text-sm text-gray-300">No API key, no auth header, no rate-limit token — just call the endpoint.</p>
        <Code>{`curl https://wavewarz.info/api/public/stats`}</Code>
      </section>

      {/* Contents */}
      <section className="space-y-3">
        <h2 className="font-rajdhani text-2xl font-bold text-white">Endpoints</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {TOC.map(t => (
            <Link key={t.id} href={`#${t.id}`}
              className="px-3 py-2 rounded-lg border border-border bg-white/[0.02] hover:bg-white/5 transition-colors font-mono text-xs text-[#7ec1fb]">
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <Endpoint
        id="stats"
        method="GET"
        path="/api/public/stats"
        summary="Platform-wide totals: volume, live battle, artist payouts, trader claims, platform revenue, battle counts. The same numbers shown on the wavewarz.info homepage."
        example={`curl https://wavewarz.info/api/public/stats`}
        response={`{
  "updatedAt": "2026-07-18T11:32:05.023Z",
  "solPriceUsd": 74.95,
  "volume": { "totalSol": 41230.9, "totalUsd": 3090257.4, "last24hSol": 812.3, "last7dSol": 5104.1 },
  "liveBattle": null,
  "artistPayouts": { "totalSol": 412.3, "totalUsd": 30902.5, "note": "..." },
  "traderClaims": { "totalSol": 8210.1, "totalUsd": ..., "withdrawalCount": 3140, "note": "..." },
  "platformRevenue": { "totalSol": 1236.9, "totalUsd": ... },
  "battles": { "total": 1904, "mainEvents": 88, "mainBattles": 264, "quickBattles": 1580, "communityBattles": 60 }
}`}
      />

      <Endpoint
        id="battles-list"
        method="GET"
        path="/api/public/battles"
        summary="Flat, paginated feed of every battle — Main Events, Quick Battles, and Community Battles. Filter by type or fetch the single currently-live battle."
        params={[
          { name: 'type', type: 'string', desc: `"main" | "quick" | "community" — omit for all types` },
          { name: 'live', type: 'boolean', desc: '"true" to return only the currently live battle (if any)' },
          { name: 'limit', type: 'number', desc: 'default 50, max 200' },
          { name: 'offset', type: 'number', desc: 'default 0, for pagination' },
        ]}
        example={`curl "https://wavewarz.info/api/public/battles?type=quick&limit=5"`}
        response={`{
  "updatedAt": "2026-07-18T11:32:08.026Z",
  "count": 5,
  "battles": [
    {
      "battleId": 1784343368,
      "type": "quick",
      "live": false,
      "winnerDecided": false,
      "winnerSide": null,
      "artist1": { "name": "STILL DEGEN", "wallet": "HqHj...vvS", "musicLink": "https://audius.co/...", "profilePictureUrl": null, "twitterHandle": null, "albumArtUrl": "https://...", "poolSol": 0.0004, "volumeSol": 0.0393 },
      "artist2": { "name": "I'm a Giant", "wallet": "JtcZ...7X", "musicLink": "https://audius.co/...", "profilePictureUrl": null, "twitterHandle": null, "albumArtUrl": "https://...", "poolSol": 0.0131, "volumeSol": 0.0246 },
      "factors": { "pollWinner": "artist2", "djWavyWinner": null, "djWavyReasoning": null },
      "imageUrl": "https://...",
      "createdAt": "2026-07-18T02:56:21.761769+00:00",
      "endsAt": "2026-07-18T03:05:02.761Z",
      "url": "https://wavewarz.info/battles/1784343368"
    }
  ]
}`}
      />

      <Endpoint
        id="battles-detail"
        method="GET"
        path="/api/public/battles/:id"
        summary={`Full detail for a single battle by battle_id, including computed artist earnings once a winner is decided (1% trading fee + settlement bonus split, per the immutable fee schedule). "factors" holds the breakdown behind the winner: for Quick Battles, the Poll + DJ Wavy (AI judge) picks; for Main/Community Events, the Human Judge + X Poll + SOL vote picks entered through the admin judging panel. Any factor can be null if it hasn't been recorded yet (or was a tie) — winnerSide is always the authoritative final result.`}
        example={`curl https://wavewarz.info/api/public/battles/1784343368`}
        response={`{
  "battleId": 1784343368,
  "type": "quick",
  "live": false,
  "winnerDecided": true,
  "winnerSide": "artist1",
  "factors": { "pollWinner": "artist1", "djWavyWinner": "artist1", "djWavyReasoning": "Stronger hook and better mix clarity in the second verse." },
  "artist1": { "name": "STILL DEGEN", "wallet": "...", "musicLink": "...", "poolSol": 1.2, "volumeSol": 3.4, "profilePictureUrl": null, "twitterHandle": "r3plic4nt206", "albumArtUrl": "https://..." },
  "artist2": { "name": "I'm a Giant", "wallet": "...", "musicLink": "...", "poolSol": 0.6, "volumeSol": 1.1, "profilePictureUrl": null, "twitterHandle": null, "albumArtUrl": "https://..." },
  "artistEarnings": {
    "artist1": { "tradingFeesSol": 0.034, "settlementBonusSol": 0.03, "totalSol": 0.064 },
    "artist2": { "tradingFeesSol": 0.011, "settlementBonusSol": 0.012, "totalSol": 0.023 }
  },
  "battleDurationSeconds": 521,
  "streamLink": null,
  "url": "https://wavewarz.info/battles/1784343368"
}`}
      />

      <Endpoint
        id="events"
        method="GET"
        path="/api/public/events"
        summary="Main Events grouped from individual rounds. A Main Event is typically 3 rounds (each its own battle_id from /api/public/battles) between the same two artists. Each round's winner is decided 2-of-3 (Human Judge + X Poll + SOL/Chart vote, entered by the WaveWarZ team through the admin judging panel). The EVENT winner is best-of-3: whoever wins the majority of rounds. Use this endpoint for the real event result — don't infer it from a single round's pool or volume."
        params={[
          { name: 'subtype', type: 'string', desc: `"standard" | "charity" | "spotlight" | "prediction" — omit for all` },
          { name: 'live', type: 'boolean', desc: '"true" to return only events with a round currently live' },
          { name: 'limit', type: 'number', desc: 'default 50, max 200' },
        ]}
        example={`curl "https://wavewarz.info/api/public/events?limit=1"`}
        response={`{
  "updatedAt": "2026-07-18T17:04:14.215Z",
  "count": 1,
  "events": [
    {
      "eventId": "event-1783899858",
      "eventSubtype": "standard",
      "live": false,
      "artist1": { "name": "R3plic4nT", "wallet": "HEB2...hVt", "profilePictureUrl": null, "twitterHandle": "r3plic4nt206" },
      "artist2": { "name": "Stormi", "wallet": "2J32...8bXp", "profilePictureUrl": null, "twitterHandle": "Stormiunleashed" },
      "roundsWon": { "artist1": 0, "artist2": 3 },
      "winnerSide": "artist2",
      "totalVolumeSol": 3.5622,
      "imageUrl": "https://...",
      "startedAt": "2026-07-12T23:44:53.15946+00:00",
      "endsAt": "2026-07-13T00:46:57.808Z",
      "rounds": [
        { "battleId": 1783899858, "roundNumber": 1, "winnerSide": "artist2", "artist1PoolSol": 0.0712, "artist2PoolSol": 0.3546, "artist1VolumeSol": 0.3655, "artist2VolumeSol": 0.36, "live": false, "url": "https://wavewarz.info/battles/1783899858", "humanJudgeWinner": "artist2", "xPollWinner": "artist1", "solVoteWinner": "artist2", "judgedAt": "2026-07-13T00:50:12.000Z" }
      ]
    }
  ]
}`}
      />

      <Endpoint
        id="lb-artists"
        method="GET"
        path="/api/public/leaderboards/artists"
        summary="Main Event artist rankings — wins/losses/draws counted per event (not per round), plus volume and automatic on-chain earnings. Same source of truth as the Artists leaderboard page."
        params={[{ name: 'limit', type: 'number', desc: 'default 100, max 500' }]}
        example={`curl "https://wavewarz.info/api/public/leaderboards/artists?limit=10"`}
        response={`{
  "updatedAt": "2026-07-18T11:32:05.023Z",
  "count": 51,
  "artists": [
    {
      "wallet": "23oq...GmG",
      "name": "Geek Myth",
      "wins": 3, "losses": 0, "draws": 0,
      "totalVolumeSol": "39.3387", "totalVolumeUsd": "$2,949.22",
      "totalEarningsSol": "0.4752", "totalEarningsUsd": "$35.63",
      "winRate": 100, "battles": 3,
      "pfpUrl": null, "twitterHandle": "GeEkMyTh_ETH"
    }
  ]
}`}
      />

      <Endpoint
        id="lb-traders"
        method="GET"
        path="/api/public/leaderboards/traders"
        summary="Trader rankings by total SOL volume, with win rate and net P&L. Net P&L includes both mid-battle sells and real settlement claims (claimShares), parsed directly from on-chain vault transactions — not just recorded trade rows."
        params={[{ name: 'limit', type: 'number', desc: 'default 100, max 500' }]}
        example={`curl "https://wavewarz.info/api/public/leaderboards/traders?limit=10"`}
        response={`{
  "updatedAt": "2026-07-18T11:32:06.854Z",
  "solPriceUsd": 74.95,
  "count": 130,
  "traders": [
    {
      "wallet": "B97z...TSA",
      "totalVolumeSol": 46.85, "totalVolumeSolFmt": "46.8508", "totalVolumeUsd": "$3,511.47",
      "tradeCount": 448, "battleCount": 102,
      "wins": 69, "losses": 16, "winRate": 81.18,
      "netPnlSol": 2.398, "netPnlFmt": "2.3983", "netPnlUsd": "$179.76", "netPnlPositive": true
    }
  ]
}`}
      />

      <Endpoint
        id="lb-songs"
        method="GET"
        path="/api/public/leaderboards/songs"
        summary="Quick Battle song rankings, one row per unique Audius track (keyed by permalink, not the hand-typed battle title) aggregated across every battle it has appeared in."
        params={[
          { name: 'limit', type: 'number', desc: 'default 100, max 500' },
          { name: 'sort', type: 'string', desc: `"volume" (default) | "battles" | "winRate"` },
        ]}
        example={`curl "https://wavewarz.info/api/public/leaderboards/songs?sort=battles&limit=10"`}
        response={`{
  "updatedAt": "2026-07-18T11:32:07.820Z",
  "count": 797,
  "songs": [
    {
      "songTitle": "Fuck yo feelingZ",
      "artistName": "GodclouD",
      "musicLink": "https://audius.co/GodclouD/fuck-yo-feelingz",
      "genre": "Electronic",
      "artUrl": "https://...",
      "battles": 22, "wins": 16, "losses": 6, "winRate": 73,
      "totalVolumeSol": 8.6312, "totalUniqueTraders": 30,
      "lastPlayed": "2026-07-17T01:50:56.696344+00:00"
    }
  ]
}`}
      />

      {/* Notes */}
      <section className="space-y-3">
        <h2 className="font-rajdhani text-2xl font-bold text-white">Notes for Agents & Developers</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-2">
          <li>All SOL amounts are plain numbers (not lamports). Multiply by <code className="text-[#7ec1fb]">solPriceUsd</code> where provided to convert to USD.</li>
          <li>&quot;Live&quot; means <code className="text-[#7ec1fb]">now &lt; created_at + battle_duration</code> — pure timer math, not a database status flag (status text is inconsistently cased across historical rows).</li>
          <li>WaveWarZ runs one battle at a time — expect at most one live battle across the whole platform.</li>
          <li>Don&apos;t confuse a <strong>round</strong> (one <code className="text-[#7ec1fb]">battle_id</code>, from <code className="text-[#7ec1fb]">/api/public/battles</code>) with a <strong>Main Event</strong> (best-of-3 rounds, from <code className="text-[#7ec1fb]">/api/public/events</code>) — an individual round&apos;s winner and the overall event winner are frequently different artists.</li>
          <li>In Quick Battles, <code className="text-[#7ec1fb]">artist1</code> / <code className="text-[#7ec1fb]">artist2</code> fields hold <strong>song titles</strong>, not artist names — check <code className="text-[#7ec1fb]">musicLink</code> for the Audius track and the song leaderboard&apos;s <code className="text-[#7ec1fb]">artistName</code> field for the actual performer.</li>
          <li>Traders do not receive automatic payouts — they must manually claim. <code className="text-[#7ec1fb]">netPnlSol</code> in the trader leaderboard already accounts for real on-chain claims, not just recorded buy/sell rows.</li>
          <li>Responses are cached 30–60s server-side (<code className="text-[#7ec1fb]">Cache-Control</code> header) — safe to poll every 30s from a live UI.</li>
          <li>No rate limit is currently enforced, but please cache client-side rather than polling faster than the cache TTL.</li>
        </ul>
      </section>

      <section className="space-y-2 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Questions or want a new field/endpoint added? Reach out to the WaveWarZ team on{' '}
          <a href="https://x.com/wavewarz_" target="_blank" rel="noopener noreferrer" className="text-[#7ec1fb] hover:text-white transition-colors">X</a>.
        </p>
      </section>
    </div>
  )
}
