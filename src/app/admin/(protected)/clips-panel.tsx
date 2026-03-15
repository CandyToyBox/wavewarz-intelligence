'use client'

import { useState } from 'react'

type ClipStatus = 'voting' | 'pending_approval' | 'approved' | 'rejected' | 'posted'
type Platform = 'youtube' | 'twitter' | 'instagram' | 'tiktok'

export type ClipRow = {
  id: number
  created_at: string
  caption: string | null
  submitter_name: string | null
  submitter_id: number
  status: ClipStatus
  upvotes: number
  downvotes: number
  net_votes: number
  pending_platforms: Platform[] | null
  scheduled_at: string | null
  postiz_post_id: string | null
  captions: Record<string, string> | null
  submitter_context: string | null
}

type StatusFilter = 'all' | ClipStatus

const STATUS_LABELS: Record<ClipStatus, string> = {
  voting:           'Voting',
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  rejected:         'Rejected',
  posted:           'Posted',
}

const STATUS_COLORS: Record<ClipStatus, string> = {
  voting:           'text-amber-400 border-amber-500/40 bg-amber-500/10',
  pending_approval: 'text-[#7ec1fb] border-[#7ec1fb]/40 bg-[#7ec1fb]/10',
  approved:         'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10',
  rejected:         'text-red-400 border-red-500/40 bg-red-500/10',
  posted:           'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube:   'YT',
  twitter:   'X',
  instagram: 'IG',
  tiktok:    'TT',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  youtube:   'text-red-400 border-red-500/30 bg-red-500/5',
  twitter:   'text-white border-white/20 bg-white/5',
  instagram: 'text-pink-400 border-pink-500/30 bg-pink-500/5',
  tiktok:    'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
}

export function ClipsPanel({ clips }: { clips: ClipRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>('all')

  const counts: Record<ClipStatus, number> = {
    voting:           clips.filter(c => c.status === 'voting').length,
    pending_approval: clips.filter(c => c.status === 'pending_approval').length,
    approved:         clips.filter(c => c.status === 'approved').length,
    rejected:         clips.filter(c => c.status === 'rejected').length,
    posted:           clips.filter(c => c.status === 'posted').length,
  }

  const displayed = filter === 'all' ? clips : clips.filter(c => c.status === filter)

  return (
    <div>

      {/* ── Pipeline summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {(Object.keys(STATUS_LABELS) as ClipStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`rounded-xl border bg-[#111827] p-4 text-left transition-all hover:border-white/20 ${
              filter === s ? 'ring-1 ring-white/20 border-white/20' : 'border-border'
            }`}
          >
            <p className={`text-2xl font-rajdhani font-bold ${STATUS_COLORS[s].split(' ')[0]}`}>
              {counts[s]}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 leading-tight">
              {STATUS_LABELS[s]}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'
          }`}
        >
          All ({clips.length})
        </button>
        {(Object.keys(STATUS_LABELS) as ClipStatus[]).map(s =>
          counts[s] > 0 && (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === s ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          )
        )}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {displayed.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-8 text-center text-muted-foreground text-sm">
          {filter === 'all' ? 'No clips submitted yet.' : `No clips with status "${STATUS_LABELS[filter as ClipStatus]}".`}
        </div>
      )}

      {/* ── Clip rows ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {displayed.map(clip => {
          const platforms = clip.pending_platforms ?? []
          const date = new Date(clip.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })
          const scheduledLabel = clip.scheduled_at
            ? new Date(clip.scheduled_at).toLocaleString('en-US', {
                timeZone: 'America/New_York',
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true,
              }) + ' EST'
            : null

          return (
            <div
              key={clip.id}
              className={`rounded-xl border bg-[#111827] px-5 py-4 ${
                clip.status === 'pending_approval'
                  ? 'border-[#7ec1fb]/30'
                  : clip.status === 'approved'
                  ? 'border-[#95fe7c]/20'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">

                {/* Left: meta + caption + platforms */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">#{clip.id}</span>
                    <span className="text-white text-sm font-semibold">
                      {clip.submitter_name ?? `User ${clip.submitter_id}`}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[clip.status]}`}>
                      {STATUS_LABELS[clip.status]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{date}</span>
                  </div>

                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {(clip.caption ?? '(no caption)').slice(0, 140)}
                  </p>

                  {clip.submitter_context && (
                    <p className="text-xs text-[#7ec1fb]/70 italic mb-2 truncate">
                      Context: {clip.submitter_context.slice(0, 100)}
                    </p>
                  )}

                  {platforms.length > 0 && (
                    <div className="flex gap-1">
                      {platforms.map(p => (
                        <span
                          key={p}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PLATFORM_COLORS[p]}`}
                        >
                          {PLATFORM_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: votes + schedule */}
                <div className="shrink-0 text-right space-y-1">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-[#95fe7c] text-sm font-bold font-rajdhani">+{clip.net_votes}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({clip.upvotes}↑ {clip.downvotes}↓)
                    </span>
                  </div>
                  {scheduledLabel && (
                    <p className="text-[10px] text-[#95fe7c]">📅 {scheduledLabel}</p>
                  )}
                  {clip.postiz_post_id && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Postiz ✓
                    </p>
                  )}
                </div>
              </div>

              {/* AI Captions — collapsible */}
              {clip.captions && clip.status !== 'voting' && clip.status !== 'rejected' && (
                <details className="mt-3">
                  <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-white transition-colors uppercase tracking-widest select-none">
                    View AI Captions ▸
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(['youtube', 'twitter', 'instagram', 'tiktok'] as Platform[]).map(p =>
                      clip.captions?.[p] ? (
                        <div key={p} className="bg-[#0d1321] rounded-lg p-3">
                          <p className={`text-[10px] font-bold mb-1 ${PLATFORM_COLORS[p].split(' ')[0]}`}>
                            {PLATFORM_LABELS[p]}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-4">{clip.captions[p]}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
