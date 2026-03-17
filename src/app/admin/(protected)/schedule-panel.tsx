'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'youtube' | 'twitter' | 'instagram' | 'tiktok'

export type ScheduleClip = {
  id: number
  caption: string | null
  submitter_name: string | null
  submitter_id: number
  status: string
  net_votes: number
  pending_platforms: Platform[] | null
  scheduled_at: string | null
  postiz_post_id: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_SHORT: Record<Platform, string> = {
  youtube: 'YT', twitter: 'X', instagram: 'IG', tiktok: 'TT',
}

const PLATFORM_COLOR: Record<Platform, string> = {
  youtube:   'text-red-400 border-red-500/30',
  twitter:   'text-white border-white/20',
  instagram: 'text-pink-400 border-pink-500/30',
  tiktok:    'text-cyan-400 border-cyan-500/30',
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SchedulePanel({ clips }: { clips: ScheduleClip[] }) {
  const now = Date.now()

  const upcoming = clips
    .filter(c => c.status === 'approved' && c.scheduled_at && new Date(c.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  const recentPosted = clips
    .filter(c => c.status === 'posted' && c.scheduled_at)
    .filter(c => {
      const t = new Date(c.scheduled_at!).getTime()
      return t < now && t > now - 48 * 3_600_000
    })
    .sort((a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime())
    .slice(0, 5)

  const nextClip = upcoming[0] ?? null
  const nextLabel = nextClip ? timeUntil(nextClip.scheduled_at!) : 'None queued'

  const dayBars = buildDayBars(upcoming)
  const byDay = groupByDay(upcoming)

  return (
    <div className="space-y-6">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Scheduled"
          value={String(upcoming.length)}
          sub="upcoming posts"
          color="green"
        />
        <StatCard
          label="Next Post"
          value={nextLabel}
          sub={nextClip ? fmtEst(nextClip.scheduled_at!) : '—'}
          color="blue"
        />
        <StatCard
          label="Posted (48h)"
          value={String(recentPosted.length)}
          sub="clips published"
          color="grey"
        />
      </div>

      {/* ── 7-day density bars ── */}
      {dayBars.length > 0 && <DensityBar bars={dayBars} />}

      {/* ── Empty state ── */}
      {upcoming.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-8 text-center space-y-2">
          <p className="text-white font-rajdhani font-bold text-xl">Queue is clear</p>
          <p className="text-sm text-muted-foreground">
            No approved clips with a future schedule. Approve clips from the Community Clips tab to populate the queue.
          </p>
        </div>
      )}

      {/* ── Timeline ── */}
      {byDay.map(({ label, isToday, clips: dayclips }) => (
        <DayGroup key={label} label={label} isToday={isToday} clips={dayclips} />
      ))}

      {/* ── Recently posted ── */}
      {recentPosted.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
            Recently Posted (last 48h)
          </p>
          <div className="space-y-2">
            {recentPosted.map(clip => (
              <ClipRow key={clip.id} clip={clip} dim />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── DensityBar ────────────────────────────────────────────────────────────────

function DensityBar({ bars }: { bars: { label: string; day: string; count: number; isToday: boolean }[] }) {
  const max = Math.max(...bars.map(b => b.count), 1)
  return (
    <div className="rounded-xl border border-border bg-[#111827] p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
        Next 7 Days — Post Density
      </p>
      <div className="flex items-end gap-2 h-16">
        {bars.map(bar => {
          const pct = (bar.count / max) * 100
          const barColor = bar.isToday
            ? 'bg-[#95fe7c]'
            : bar.count > 0
            ? 'bg-[#7ec1fb]/60'
            : 'bg-white/5'
          return (
            <div key={bar.day} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end h-10">
                <div
                  className={`w-full rounded-sm transition-all ${barColor}`}
                  style={{ height: bar.count === 0 ? '2px' : `${Math.max(pct, 8)}%` }}
                />
              </div>
              {bar.count > 0 && (
                <span className={`text-[9px] font-bold ${bar.isToday ? 'text-[#95fe7c]' : 'text-[#7ec1fb]'}`}>
                  {bar.count}
                </span>
              )}
              <span className={`text-[9px] ${bar.isToday ? 'text-white font-bold' : 'text-muted-foreground'}`}>
                {bar.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DayGroup ──────────────────────────────────────────────────────────────────

function DayGroup({
  label,
  isToday,
  clips,
}: {
  label: string
  isToday: boolean
  clips: ScheduleClip[]
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`text-xs font-bold font-rajdhani tracking-widest uppercase px-2.5 py-1 rounded-md ${
            isToday
              ? 'bg-[#95fe7c]/15 text-[#95fe7c] border border-[#95fe7c]/30'
              : 'bg-white/5 text-muted-foreground border border-border'
          }`}
        >
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {clips.length} {clips.length === 1 ? 'post' : 'posts'}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-2 pl-1">
        {clips.map(clip => (
          <ClipRow key={clip.id} clip={clip} dim={false} />
        ))}
      </div>
    </div>
  )
}

// ── ClipRow ───────────────────────────────────────────────────────────────────

function ClipRow({ clip, dim }: { clip: ScheduleClip; dim: boolean }) {
  const platforms = clip.pending_platforms ?? []
  const timeStr = clip.scheduled_at ? fmtTime(clip.scheduled_at) : '—'

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border bg-[#111827] px-4 py-3 ${
        dim ? 'border-border opacity-60' : 'border-border hover:border-white/10 transition-colors'
      }`}
    >
      {/* Time */}
      <div className="shrink-0 w-14 text-right">
        <p className={`text-xs font-mono font-bold ${dim ? 'text-muted-foreground' : 'text-[#95fe7c]'}`}>
          {timeStr}
        </p>
        <p className="text-[9px] text-muted-foreground/50">EST</p>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border shrink-0" />

      {/* Platforms */}
      <div className="flex gap-1 shrink-0">
        {platforms.length > 0
          ? platforms.map(p => (
              <span
                key={p}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PLATFORM_COLOR[p]}`}
              >
                {PLATFORM_SHORT[p]}
              </span>
            ))
          : <span className="text-[9px] text-muted-foreground/40">—</span>
        }
      </div>

      {/* Caption */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {clip.caption ? clip.caption.slice(0, 80) : '(no caption)'}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {clip.submitter_name ?? `User ${clip.submitter_id}`}
        </p>
      </div>

      {/* Right: votes + postiz */}
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-xs font-bold font-rajdhani text-[#95fe7c]">+{clip.net_votes}</p>
        {clip.postiz_post_id && (
          <p className="text-[9px] text-muted-foreground font-mono">Postiz ✓</p>
        )}
        {dim && (
          <p className="text-[9px] text-emerald-400 font-bold">POSTED</p>
        )}
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: 'green' | 'blue' | 'grey'
}) {
  const valColor = color === 'green' ? 'text-[#95fe7c]'
    : color === 'blue' ? 'text-[#7ec1fb]'
    : 'text-white'
  const border = color === 'green' ? 'border-[#95fe7c]/20'
    : color === 'blue' ? 'border-[#7ec1fb]/20'
    : 'border-border'
  return (
    <div className={`rounded-xl border bg-[#111827] p-4 ${border}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-rajdhani font-bold ${valColor}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEst(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' EST'
}

function fmtTime(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function timeUntil(utc: string): string {
  const diff = new Date(utc).getTime() - Date.now()
  if (diff < 0) return 'Now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return `${m}m`
  if (h < 24) return `${h}h ${m}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function dayKey(utc: string): string {
  return new Date(utc).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function dayLabel(utc: string): { label: string; isToday: boolean } {
  const now = new Date()
  const todayKey = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const tomorrowKey = new Date(now.getTime() + 86_400_000).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const key = dayKey(utc)
  if (key === todayKey) return { label: 'Today', isToday: true }
  if (key === tomorrowKey) return { label: 'Tomorrow', isToday: false }
  return {
    label: new Date(utc).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric',
    }),
    isToday: false,
  }
}

function groupByDay(clips: ScheduleClip[]) {
  const map = new Map<string, { label: string; isToday: boolean; clips: ScheduleClip[] }>()
  for (const clip of clips) {
    if (!clip.scheduled_at) continue
    const key = dayKey(clip.scheduled_at)
    if (!map.has(key)) {
      const { label, isToday } = dayLabel(clip.scheduled_at)
      map.set(key, { label, isToday, clips: [] })
    }
    map.get(key)!.clips.push(clip)
  }
  return Array.from(map.values())
}

function buildDayBars(clips: ScheduleClip[]) {
  const bars: { label: string; day: string; count: number; isToday: boolean }[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const key = d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tmrw'
      : d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    const count = clips.filter(c => c.scheduled_at && dayKey(c.scheduled_at) === key).length
    bars.push({ label, day: key, count, isToday: i === 0 })
  }
  return bars
}
