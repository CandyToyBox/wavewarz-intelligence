import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WEEKLY_SHOWS } from '@/lib/weekly-schedule'

/**
 * Public calendar API: the same schedule shown at wavewarz.info/calendar.
 *
 * GET https://wavewarz.info/api/public/calendar
 * Query params:
 *   limit - max one-off events to return (default 50, max 200)
 *
 * Returns the standing weekly shows (src/lib/weekly-schedule.ts) and the dated,
 * active calendar events from today (Eastern) onward, soonest first. Weekly shows
 * are returned once each with their weekdays, not expanded into dates.
 *
 * No auth required. Read-only; every field is already public on /calendar.
 */

export const dynamic = 'force-dynamic'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

function easternToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)
    const today = easternToday()

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id,title,description,event_date,event_time,event_type,location_or_link,flyer_url,is_featured')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(limit)
    if (error) throw error

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      today,
      timezone: 'America/New_York',
      weekly: WEEKLY_SHOWS,
      count: data?.length ?? 0,
      events: data ?? [],
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/calendar] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: corsHeaders() })
  }
}
