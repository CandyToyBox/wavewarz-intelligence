import { NextRequest, NextResponse } from 'next/server'
import { getGameBattleState, gameDynamics, isGameTheme } from '@/lib/games/feed'
import { getSurferTier } from '@/lib/games/battle-logic'
import { gameCors } from '../../cors'

/**
 * Game state for one battle.
 * GET /api/public/games/battles/:id?theme=dj
 * Docs: /api-docs/games
 */
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: gameCors() })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const battleId = Number(id)
  if (!Number.isSafeInteger(battleId) || battleId <= 0) {
    return NextResponse.json({ error: 'Invalid battle id' }, { status: 400, headers: gameCors() })
  }
  const t = req.nextUrl.searchParams.get('theme')
  const theme = isGameTheme(t) ? t : 'dj'
  const state = await getGameBattleState(battleId, req.nextUrl.origin)
  if (!state) return NextResponse.json({ error: 'Battle not found' }, { status: 404, headers: gameCors() })
  const a = state.sides.A.settledPoolSol
  const b = state.sides.B.settledPoolSol
  return NextResponse.json(
    {
      ...state,
      theme,
      // Tiers and dynamics from the stored pool values. During a live battle,
      // follow /events and use netA / netB on each trade instead.
      tiers: { A: getSurferTier(a), B: getSurferTier(b) },
      dynamics: gameDynamics(theme, a, b),
    },
    { headers: gameCors(state.status === 'live' ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=30') },
  )
}
