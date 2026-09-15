import { createClient } from '@/lib/supabase/server'
import CalendarClient, { type CalendarEvent } from './CalendarClient'
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
  const events = await getEvents()
  return <CalendarClient events={events} />
}
