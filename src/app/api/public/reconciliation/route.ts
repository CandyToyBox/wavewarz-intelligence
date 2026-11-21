import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Public chain-versus-index reconciliation.
 *
 * GET https://wavewarz.info/api/public/reconciliation
 *
 * The WaveWarZ program on Solana holds a battle account for every battle ever
 * launched, including test battles and launches nobody traded. This index lists
 * real battles only. This endpoint publishes both counts and accounts for every
 * battle between them, so the two numbers never have to be guessed at.
 *
 * Refreshed once a day by the nightly integrity job (scripts/chain-census.ts).
 * No auth, read-only, aggregate chain facts only.
 */

export const dynamic = 'force-dynamic'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET() {
  try {
    const supabase = await createClient()
    const [latestRes, historyRes] = await Promise.all([
      supabase.from('chain_census').select('*').order('census_at', { ascending: false }).limit(1),
      supabase.from('chain_census').select('census_at, on_chain, listed, test_excluded, not_indexed').order('census_at', { ascending: false }).limit(30),
    ])
    const c = latestRes.data?.[0]
    if (!c) {
      return NextResponse.json({ error: 'No census has run yet' }, { status: 503, headers: corsHeaders() })
    }

    const notIndexed = (c.not_indexed_ids ?? []) as { battleId: number; startedAt: string; holdingSol: number; ended: boolean }[]
    const body = {
      asOf: c.census_at,
      onChainAccounts: c.on_chain,
      listed: c.listed,
      testBattlesExcluded: c.test_excluded,
      notIndexed: {
        count: c.not_indexed,
        stillHoldingSol: { count: c.not_indexed_holding, sol: Number(c.not_indexed_holding_sol) },
        battles: notIndexed,
      },
      realBattlesMissingFromChain: c.db_only,
      newlyNotIndexedSinceLastCensus: c.newly_not_indexed_ids ?? [],
      history: (historyRes.data ?? []).map(h => ({
        asOf: h.census_at, onChainAccounts: h.on_chain, listed: h.listed,
        testBattlesExcluded: h.test_excluded, notIndexed: h.not_indexed,
      })),
      explanation: {
        onChainAccounts: 'Every battle account the WaveWarZ program holds on Solana mainnet, including test battles and launches that never traded.',
        listed: 'Real battles this index lists. This is the count every other /api/public endpoint uses (stats.battles.total).',
        testBattlesExcluded: 'Test battles the index holds but leaves out of every public number, on purpose.',
        notIndexed: 'Battle accounts on chain that never reached this index. Nearly all are abandoned launches that hold no SOL; any that still hold SOL are named under notIndexed.battles with the amount.',
        identity: 'onChainAccounts = listed + testBattlesExcluded + notIndexed, all read at asOf.',
        realBattlesMissingFromChain: 'Real battles held here with no matching account on chain. Should always be 0.',
        source: 'One getProgramAccounts call on the program, filtered to 353-byte accounts, compared with this index. Method and history: docs/CHAIN-CENSUS.md in the repository.',
      },
    }
    return NextResponse.json(body, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/reconciliation] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
