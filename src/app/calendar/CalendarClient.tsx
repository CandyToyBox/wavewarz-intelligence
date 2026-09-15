'use client'

import { useMemo, useState } from 'react'

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  event_date: string // YYYY-MM-DD
  event_time: string | null
  event_type: string
  location_or_link: string | null
  flyer_url: string | null
  is_featured: boolean
}

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  BATTLE:    { color: '#95fe7c', label: 'Battle' },
  SPACES:    { color: '#7ec1fb', label: 'X Spaces' },
  COMMUNITY: { color: '#f59e0b', label: 'Community' },
  OTHER:     { color: '#989898', label: 'Event' },
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayYmd(): string {
  return ymd(new Date())
}

export default function CalendarClient({ events }: { events: CalendarEvent[] }) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const evt of events) {
      const list = map.get(evt.event_date) ?? []
      list.push(evt)
      map.set(evt.event_date, list)
    }
    return map
  }, [events])

  const upcoming = useMemo(() => {
    const now = todayYmd()
    return events.filter(e => e.event_date >= now).slice(0, 8)
  }, [events])

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const startOffset = firstOfMonth.getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const out: { date: Date | null; dateStr: string | null }[] = []
    for (let i = 0; i < startOffset; i++) out.push({ date: null, dateStr: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      out.push({ date, dateStr: ymd(date) })
    }
    while (out.length % 7 !== 0) out.push({ date: null, dateStr: null })
    return out
  }, [cursor])

  function goToMonth(offset: number) {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + offset, 1))
    setSelectedDate(null)
  }

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayYmd())
  }

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
          Events <span className="text-[#7ec1fb]">Calendar</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Main Events, Quick Battle streams, community battles, and X Spaces — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* Month grid */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-xl font-rajdhani font-bold text-white">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={goToday}
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-white hover:border-white/40 transition-colors">
                Today
              </button>
              <button onClick={() => goToMonth(-1)} aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-white hover:border-white/40 transition-colors">
                ‹
              </button>
              <button onClick={() => goToMonth(1)} aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-white hover:border-white/40 transition-colors">
                ›
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-[10px]">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell.date || !cell.dateStr) return <div key={i} className="aspect-square sm:aspect-[4/3]" />
              const dayEvents = eventsByDate.get(cell.dateStr) ?? []
              const isToday = cell.dateStr === todayYmd()
              const isSelected = cell.dateStr === selectedDate
              const dayLabel = cell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  aria-label={dayEvents.length ? `${dayLabel} — ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : dayLabel}
                  aria-pressed={isSelected}
                  className={`aspect-square sm:aspect-[4/3] rounded-lg border p-1.5 text-left flex flex-col transition-colors ${
                    isSelected ? 'border-[#95fe7c] bg-[#95fe7c]/10' : isToday ? 'border-[#7ec1fb]/50 bg-[#7ec1fb]/5' : 'border-border/60 hover:border-white/30'
                  }`}
                >
                  <span className={`text-[11px] font-mono ${isToday ? 'text-[#7ec1fb] font-bold' : 'text-muted-foreground'}`}>
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 4).map(e => (
                      <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_CONFIG[e.event_type]?.color ?? TYPE_CONFIG.OTHER.color }} />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Side panel: selected day or upcoming list */}
        <div className="space-y-4">
          {selectedDate ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-rajdhani font-bold text-white">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
                <button onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-white">Clear</button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing scheduled this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map(evt => <EventCard key={evt.id} evt={evt} />)}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Up Next</p>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming events posted yet — check back soon.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(evt => <EventCard key={evt.id} evt={evt} compact />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCard({ evt, compact = false }: { evt: CalendarEvent; compact?: boolean }) {
  const cfg = TYPE_CONFIG[evt.event_type] ?? TYPE_CONFIG.OTHER
  const dateObj = new Date(evt.event_date + 'T12:00:00')
  const dateFmt = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className={`rounded-lg border border-border/60 p-3 ${evt.is_featured ? 'bg-[#95fe7c]/5 border-[#95fe7c]/25' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
          style={{ color: cfg.color, borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}10` }}>
          {cfg.label}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{dateFmt}{evt.event_time ? ` · ${evt.event_time}` : ''}</span>
      </div>
      <p className="text-sm font-bold text-white leading-tight">{evt.title}</p>
      {!compact && evt.description && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{evt.description}</p>
      )}
      {evt.location_or_link && (
        evt.location_or_link.startsWith('http') ? (
          <a href={evt.location_or_link} target="_blank" rel="noreferrer" className="text-[10px] text-[#7ec1fb] hover:underline mt-1.5 inline-block">
            Join / Details ↗
          </a>
        ) : (
          <p className="text-[10px] text-muted-foreground mt-1.5">{evt.location_or_link}</p>
        )
      )}
    </div>
  )
}
