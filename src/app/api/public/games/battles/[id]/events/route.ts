import { NextRequest, NextResponse } from 'next/server'
import { enrichTrades, getBattleTradeHistory, getGameBattleState, getLiveTrades, isGameTheme } from '@/lib/games/feed'
import { gameCors } from '../../../cors'

/**
 * Trade events for a battle, each with a ready-made game cue.
 *
 * GET /api/public/games/battles/:id/events?history=1&theme=surf
 *   Every stored trade, oldest first. For replays and for rebuilding a battle.
 * GET /api/public/games/battles/:id/events?theme=surf
 *   Live: no trades, just a cursor. Then poll with &since=<cursor> every 3 to 5
 *   seconds for new trades read straight off the vault's onchain history.
 *   Pass the last netA / netB you hold as &netA=&netB= so running totals continue.
 * Docs: /api-docs/games
 */
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: gameCors() })
}

const SIG = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const battleId = Number(id)
  if (!Number.isSafeInteger(battleId) || battleId <= 0) {
    return NextResponse.json({ error: 'Invalid battle id' }, { status: 400, headers: gameCors() })
  }
  const q = req.nextUrl.searchParams
  const t = q.get('theme')
  const theme = isGameTheme(t) ? t : 'dj'

  if (q.get('history') === '1') {
    const state = await getGameBattleState(battleId, req.nextUrl.origin)
    if (!state) return NextResponse.json({ error: 'Battle not found' }, { status: 404, headers: gameCors() })
    const raw = await getBattleTradeHistory(battleId)
    return NextResponse.json(
      { battleId, theme, mode: 'history', count: raw.length, events: enrichTrades(raw, theme), outcome: state.outcome },
      { headers: gameCors(state.status === 'live' ? 'no-store' : 'public, s-maxage=120, stale-while-revalidate=60') },
    )
  }

  const since = q.get('since')
  if (since !== null && !SIG.test(since)) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400, headers: gameCors() })
  }
  const live = await getLiveTrades(battleId, since)
  if (!live) return NextResponse.json({ error: 'Could not read trades from chain' }, { status: 502, headers: gameCors() })
  const startNet = { A: Number(q.get('netA')) || 0, B: Number(q.get('netB')) || 0 }
  return NextResponse.json(
    { battleId, theme, mode: 'live', cursor: live.cursor, events: since ? enrichTrades(live.trades, theme, startNet) : [] },
    { headers: gameCors() },
  )
}
