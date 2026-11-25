import { NextResponse } from 'next/server'
import { GAME_THEMES, THEME_INFO, themeAction, themeTierTitle } from '@/lib/games/feed'
import { SURFER_TIERS } from '@/lib/games/battle-logic'
import { gameCors } from '../cors'

/** GET /api/public/games/themes: every game theme, its trade actions and tier names. Docs: /api-docs/games */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: gameCors() })
}

const SAMPLES: Array<{ sol: number; kind: 'buy' | 'sell'; key: string }> = [
  { sol: 0.05, kind: 'buy', key: 'buySmall' },
  { sol: 0.3, kind: 'buy', key: 'buyMedium' },
  { sol: 1, kind: 'buy', key: 'buyLarge' },
  { sol: 3, kind: 'buy', key: 'buyMega' },
  { sol: 0.3, kind: 'sell', key: 'sell' },
]

export function GET() {
  const themes = GAME_THEMES.map((id) => {
    return {
      id,
      ...THEME_INFO[id],
      actions: Object.fromEntries(SAMPLES.map((s) => [s.key, themeAction(id, s.sol, s.kind).label])),
      tiers: SURFER_TIERS.map((t) => ({ level: t.level, minSol: t.minSol, title: themeTierTitle(id, t) })),
    }
  })
  return NextResponse.json({ themes }, { headers: gameCors('public, s-maxage=3600') })
}
