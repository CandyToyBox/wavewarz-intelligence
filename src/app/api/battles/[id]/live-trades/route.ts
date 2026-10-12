import { NextRequest, NextResponse } from 'next/server'
import { fetchRecentBattleTradesFromChain } from '@/lib/solana/hydrate'

// Polled by the live arena (see src/app/battles/[id]/live-arena.tsx) every
// few seconds while a battle is active. Reads the WaveWarz program's own
// buyShares/sellShares instructions straight off the vault PDA's transaction
// history via Helius — independent of wavewarz.com's webhook/Supabase, so it
// keeps working even if that feed is slow, missing, or per-battle-only.
// Server-side only: this is what keeps the Helius key out of the browser.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const battleId = Number(id)
  if (!Number.isSafeInteger(battleId) || battleId <= 0) {
    return NextResponse.json({ error: 'Invalid battle id' }, { status: 400 })
  }

  // A transaction signature is base58, 80-90 chars. Anything else is not ours.
  const since = request.nextUrl.searchParams.get('since')
  if (since !== null && !/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(since)) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400 })
  }
  const result = await fetchRecentBattleTradesFromChain(battleId, { sinceSignature: since })

  if (!result) {
    return NextResponse.json({ error: 'Failed to fetch trades from chain' }, { status: 502 })
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
