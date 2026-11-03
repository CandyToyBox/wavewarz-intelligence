// Standing weekly shows for /calendar. The calendar_events table holds one row per
// date, so these repeat here instead and are expanded into dated entries on the server.
// Times are Eastern ("ET" stays correct across EST/EDT). No end time on purpose: the
// shows run for hours.

export type WeeklyShow = {
  key: string
  title: string
  description: string
  event_type: 'BATTLE' | 'SPACES'
  event_time: string
  days: number[] // 0 = Sunday ... 6 = Saturday
  daysLabel: string
  location_or_link: string
}

const X_PROFILE = 'https://x.com/wavewarz'

export const WEEKLY_SHOWS: WeeklyShow[] = [
  {
    key: 'daily-space',
    title: 'WaveWarZ X Space',
    description: 'Daily X Space. Runs live, usually for a few hours.',
    event_type: 'SPACES',
    event_time: '11:00 AM ET',
    days: [1, 2, 3, 4, 5],
    daysLabel: 'Mon-Fri',
    location_or_link: X_PROFILE,
  },
  {
    key: 'quick-battlez',
    title: 'Quick Battlez: X Space + Livestream',
    description: 'Quick Battlez live on X Spaces and the livestream. Runs for a few hours.',
    event_type: 'BATTLE',
    event_time: '9:00 PM ET',
    days: [1, 3, 5],
    daysLabel: 'Mon, Wed, Fri',
    location_or_link: X_PROFILE,
  },
  {
    key: 'mythicgodz-djcandy',
    title: 'MythicGodz & DJ Candy: X Space',
    description: 'Music and discussion on X Spaces. Runs for a few hours.',
    event_type: 'SPACES',
    event_time: '9:00 PM ET',
    days: [2, 4],
    daysLabel: 'Tue, Thu',
    location_or_link: X_PROFILE,
  },
]

type WeeklyEntry = {
  id: string
  title: string
  description: string
  event_date: string
  event_time: string
  event_type: string
  location_or_link: string
  flyer_url: null
  is_featured: false
  recurring: true
}

function easternToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

// Dated entries for the next `weeks` weeks, starting today (Eastern).
export function expandWeeklyShows(weeks = 26): WeeklyEntry[] {
  const [y, m, d] = easternToday().split('-').map(Number)
  const out: WeeklyEntry[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i))
    const weekday = day.getUTCDay()
    const date = day.toISOString().slice(0, 10)
    for (const show of WEEKLY_SHOWS) {
      if (!show.days.includes(weekday)) continue
      out.push({
        id: `weekly-${show.key}-${date}`,
        title: show.title,
        description: show.description,
        event_date: date,
        event_time: show.event_time,
        event_type: show.event_type,
        location_or_link: show.location_or_link,
        flyer_url: null,
        is_featured: false,
        recurring: true,
      })
    }
  }
  return out
}
