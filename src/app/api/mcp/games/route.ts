import { NextRequest, NextResponse } from 'next/server'
import { GAME_THEMES, THEME_INFO, enrichTrades, getBattleTradeHistory, getGameBattleState, getLiveTrades, isGameTheme, themeAction, themeTierTitle, type GameTheme } from '@/lib/games/feed'
import { SURFER_TIERS, getSurferTier } from '@/lib/games/battle-logic'

/**
 * WaveWarz Games MCP server (Model Context Protocol, streamable HTTP, stateless).
 * POST https://wavewarz.info/api/mcp/games  with JSON-RPC 2.0 messages.
 * Read-only: it reads public battle data and never trades or signs anything.
 * Docs: /api-docs/games
 */
export const dynamic = 'force-dynamic'

const PROTOCOL = '2025-06-18'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
  'Cache-Control': 'no-store',
}

const themeProp = { type: 'string', enum: [...GAME_THEMES], description: 'Game theme. Default dj.' }
const TOOLS = [
  {
    name: 'get_battle_state',
    description: 'Current game state of one WaveWarz battle: both sides, live or ended, time left, and the stored result once WaveWarz has decided it (null before that).',
    inputSchema: { type: 'object', properties: { battle_id: { type: 'integer' }, theme: themeProp }, required: ['battle_id'] },
  },
  {
    name: 'get_battle_events',
    description: 'Trade events with a game cue each. history=true returns every stored trade oldest first. Otherwise it reads new trades off the vault onchain: call once without since to get a cursor, then pass since=<cursor>.',
    inputSchema: {
      type: 'object',
      properties: { battle_id: { type: 'integer' }, theme: themeProp, history: { type: 'boolean' }, since: { type: 'string', description: 'Cursor (transaction signature) from the previous call.' } },
      required: ['battle_id'],
    },
  },
  {
    name: 'classify_trade',
    description: 'Turn one trade into a game cue (action name, trick, power, duration) for a theme. Pure calculation, no battle data.',
    inputSchema: { type: 'object', properties: { sol: { type: 'number' }, kind: { type: 'string', enum: ['buy', 'sell'] }, theme: themeProp }, required: ['sol', 'kind'] },
  },
  {
    name: 'get_tier',
    description: 'The level (1 to 5) and title a side reaches at a given pool size in SOL.',
    inputSchema: { type: 'object', properties: { pool_sol: { type: 'number' }, theme: themeProp }, required: ['pool_sol'] },
  },
  {
    name: 'list_game_themes',
    description: 'Every WaveWarz game theme with its description and level titles.',
    inputSchema: { type: 'object', properties: {} },
  },
]

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

function th(v: unknown): GameTheme {
  return typeof v === 'string' && isGameTheme(v) ? v : 'dj'
}

async function callTool(name: string, a: Record<string, unknown>, origin: string): Promise<unknown> {
  switch (name) {
    case 'get_battle_state': {
      const id = Number(a.battle_id)
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('battle_id must be a positive integer')
      const s = await getGameBattleState(id, origin)
      if (!s) throw new Error(`Battle ${id} not found`)
      return { ...s, theme: th(a.theme) }
    }
    case 'get_battle_events': {
      const id = Number(a.battle_id)
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('battle_id must be a positive integer')
      const theme = th(a.theme)
      if (a.history === true) {
        const raw = await getBattleTradeHistory(id)
        return { battleId: id, mode: 'history', count: raw.length, events: enrichTrades(raw, theme) }
      }
      const since = typeof a.since === 'string' && /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(a.since) ? a.since : null
      const live = await getLiveTrades(id, since)
      if (!live) throw new Error('Could not read trades from chain right now; try again')
      return { battleId: id, mode: 'live', cursor: live.cursor, events: since ? enrichTrades(live.trades, theme) : [] }
    }
    case 'classify_trade': {
      const sol = Math.max(0, Number(a.sol) || 0)
      const kind = a.kind === 'sell' ? 'sell' : 'buy'
      const theme = th(a.theme)
      const p = themeAction(theme, sol, kind)
      return { theme, sol, kind, action: p.label, trick: p.trick, power: p.power01, waveSurge: p.waveSurge, durationMs: p.durationMs }
    }
    case 'get_tier': {
      const theme = th(a.theme)
      const t = getSurferTier(Math.max(0, Number(a.pool_sol) || 0))
      return { level: t.level, title: themeTierTitle(theme, t), minSol: t.minSol, scale: t.scale, wearables: t.wearables }
    }
    case 'list_game_themes':
      return GAME_THEMES.map((id) => ({ id, ...THEME_INFO[id], tiers: SURFER_TIERS.map((t) => ({ level: t.level, minSol: t.minSol, title: themeTierTitle(id, t) })) }))
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 })
  }
}

async function handle(msg: Rpc, origin: string) {
  const id = msg.id ?? null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })
  switch (msg.method) {
    case 'initialize':
      return ok({
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'wavewarz-games', title: 'WaveWarz Games', version: '1.0.0' },
        instructions: 'Read-only WaveWarz battle data for reactive games. Results are the stored WaveWarz results; never present a pool size as the reason a side won.',
      })
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>
      try {
        const data = await callTool(name, args, origin)
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: Array.isArray(data) ? { items: data } : data, isError: false })
      } catch (e) {
        const err = e as Error & { code?: number }
        if (err.code === -32602) return fail(-32602, err.message)
        return ok({ content: [{ type: 'text', text: err.message }], isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors })
}

export async function GET() {
  // No server-to-client stream on this stateless server.
  return NextResponse.json({ name: 'wavewarz-games', transport: 'streamable-http', post: 'JSON-RPC 2.0', docs: '/api-docs/games' }, { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: cors })
  }
  const origin = req.nextUrl.origin
  const batch = Array.isArray(body) ? (body as Rpc[]) : [body as Rpc]
  const replies = []
  for (const m of batch) {
    if (!m || typeof m !== 'object') continue
    if (m.id === undefined || m.id === null) continue // notification: no reply
    replies.push(await handle(m, origin))
  }
  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: cors })
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers: { ...cors, 'Mcp-Protocol-Version': PROTOCOL } })
}
