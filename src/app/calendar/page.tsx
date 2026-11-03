import { createClient } from '@/lib/supabase/server'
import CalendarClient, { type CalendarEvent } from './CalendarClient'
import { expandWeeklyShows } from '@/lib/weekly-schedule'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Events Calendar — WaveWarZ Intelligence',
  description: 'Every upcoming Main Event, Quick Battle stream, community battle, and X Space on WaveWarZ — in one calendar.',
}

async function getEvents(): Promise<CalendarEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('calendar_events')
    .select('id,title,description,event_date,event_time,event_type,location_or_link,flyer_url,is_featured')
    .eq('is_active', true)
    .order('event_date', { ascending: true })
  return data ?? []
}

export default async function CalendarPage() {
  // One-off events first so they lead on any day they share with a weekly show.
  const events = [...(await getEvents()), ...expandWeeklyShows()].sort((a, b) =>
    a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0
  )
  return <CalendarClient events={events} />
}
