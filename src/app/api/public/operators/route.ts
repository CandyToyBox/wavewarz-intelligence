import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Public operator list: the arenas that run WaveWarZ battles.
 *
 * GET https://wavewarz.info/api/public/operators
 *
 * Mirrors the shared operator registry (spec/operators.json in the protocol repo).
 * Use an id here with GET /api/public/battles?operator=<id> to show only that
 * arena's battles. A battle's operator is resolved from the chain's own fee wallet
 * and launcher against the registry, never from anything a caller says. Battles no
 * registered operator matches are reported as null, not guessed.
 *
 * No auth required, read-only.
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
    const { data: ops, error } = await supabase
      .from('operators')
      .select('operator_id, name, home, registered, status')
      .order('registered', { ascending: true })
    if (error) throw error

    const operators = await Promise.all((ops ?? []).map(async o => {
      const { count } = await supabase
        .from('battles')
        .select('*', { count: 'exact', head: true })
        .eq('operator_id', o.operator_id)
        .eq('is_test_battle', false)
      return {
        id: o.operator_id,
        name: o.name,
        home: o.home,
        registered: o.registered,
        status: o.status,
        listedBattles: count ?? 0,
        battlesUrl: `https://wavewarz.info/api/public/battles?operator=${encodeURIComponent(o.operator_id)}`,
      }
    }))

    const { count: unattributed } = await supabase
      .from('battles').select('*', { count: 'exact', head: true })
      .eq('operator_basis', 'unattributed').eq('is_test_battle', false)

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      operators,
      unattributedListedBattles: unattributed ?? 0,
      note: 'Attribution rules, in order: explicit claim, fee wallet, declared redirect plus registered launcher, otherwise unattributed.',
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/operators] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
