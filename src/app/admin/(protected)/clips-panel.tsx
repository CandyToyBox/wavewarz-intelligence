'use client'

import { useState, useTransition } from 'react'
import { approveClip, rejectClip, saveClipEdits } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PLATFORMS: Platform[] = ['youtube', 'twitter', 'instagram', 'tiktok']

const STATUS_LABELS: Record<ClipStatus, string> = {
  voting:           'Voting',
  pending_approval: 'Pending',
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
  youtube:   'YouTube',
  twitter:   'X',
  instagram: 'Instagram',
  tiktok:    'TikTok',
}

const PLATFORM_SHORT: Record<Platform, string> = {
  youtube:   'YT',
  twitter:   'X',
  instagram: 'IG',
  tiktok:    'TT',
}

const PLATFORM_BADGE: Record<Platform, string> = {
  youtube:   'text-red-400 border-red-500/30',
  twitter:   'text-white border-white/20',
  instagram: 'text-pink-400 border-pink-500/30',
  tiktok:    'text-cyan-400 border-cyan-500/30',
}

const PLATFORM_ACTIVE: Record<Platform, string> = {
  youtube:   'bg-red-500/20 border-red-500/50 text-red-300',
  twitter:   'bg-white/15 border-white/40 text-white',
  instagram: 'bg-pink-500/20 border-pink-500/50 text-pink-300',
  tiktok:    'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
}

const CHAR_LIMITS: Record<Platform, number> = {
  youtube:   5000,
  twitter:   280,
  instagram: 2200,
  tiktok:    2200,
}

// ── ClipsPanel ────────────────────────────────────────────────────────────────

export function ClipsPanel({ clips }: { clips: ClipRow[] }) {
  const [filter, setFilter] = useState<'all' | ClipStatus>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const counts: Record<ClipStatus, number> = {
    voting:           clips.filter(c => c.status === 'voting').length,
    pending_approval: clips.filter(c => c.status === 'pending_approval').length,
    approved:         clips.filter(c => c.status === 'approved').length,
    rejected:         clips.filter(c => c.status === 'rejected').length,
    posted:           clips.filter(c => c.status === 'posted').length,
  }

  const displayed = filter === 'all' ? clips : clips.filter(c => c.status === filter)

  return (
    <div className="space-y-5">

      {/* Pipeline summary cards */}
      <div className="grid grid-cols-5 gap-3">
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

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'
          }`}
        >
          All ({clips.length})
        </button>
        {(Object.keys(STATUS_LABELS) as ClipStatus[]).map(s =>
          counts[s] > 0 ? (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === s ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ) : null
        )}
        {expandedId !== null && (
          <button
            onClick={() => setExpandedId(null)}
            className="ml-auto text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Close all ×
          </button>
        )}
      </div>

      {/* Empty state */}
      {displayed.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-8 text-center text-muted-foreground text-sm">
          {filter === 'all'
            ? 'No clips submitted yet.'
            : `No ${STATUS_LABELS[filter as ClipStatus].toLowerCase()} clips.`}
        </div>
      )}

      {/* Clip rows */}
      <div className="space-y-2">
        {displayed.map(clip => (
          <ClipCard
            key={clip.id}
            clip={clip}
            expanded={expandedId === clip.id}
            onToggle={() => setExpandedId(expandedId === clip.id ? null : clip.id)}
          />
        ))}
      </div>

    </div>
  )
}

// ── ClipCard ──────────────────────────────────────────────────────────────────

function ClipCard({
  clip,
  expanded,
  onToggle,
}: {
  clip: ClipRow
  expanded: boolean
  onToggle: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [localCaptions, setLocalCaptions] = useState<Record<string, string>>(clip.captions ?? {})
  const [localPlatforms, setLocalPlatforms] = useState<Platform[]>(
    clip.pending_platforms ?? ALL_PLATFORMS
  )
  const [localSchedule, setLocalSchedule] = useState<string>(
    clip.scheduled_at ? toDatetimeLocal(clip.scheduled_at) : ''
  )
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const canManage = clip.status === 'pending_approval' || clip.status === 'approved'

  const dateLabel = new Date(clip.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const scheduledLabel = clip.scheduled_at
    ? new Date(clip.scheduled_at).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      }) + ' EST'
    : null

  function togglePlatform(p: Platform) {
    setLocalPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function handleApprove() {
    if (localPlatforms.length === 0) {
      setFeedback({ type: 'err', msg: 'Select at least one platform.' })
      return
    }
    startTransition(async () => {
      const scheduledAt = localSchedule
        ? new Date(localSchedule).toISOString()
        : new Date(Date.now() + 3_600_000).toISOString()
      const result = await approveClip({
        clipId: clip.id,
        platforms: localPlatforms,
        scheduledAt,
        captions: Object.keys(localCaptions).length > 0 ? localCaptions : undefined,
      })
      if (!result.ok) {
        setFeedback({ type: 'err', msg: result.error ?? 'Failed to approve.' })
      } else if (result.postizId) {
        setFeedback({ type: 'ok', msg: `Approved + scheduled to Postiz (ID: ${result.postizId}).` })
      } else if (result.postizError) {
        setFeedback({ type: 'ok', msg: `Approved in Supabase. Postiz: ${result.postizError}. Sir Clipz bot will retry.` })
      } else {
        setFeedback({ type: 'ok', msg: 'Approved and queued. Sir Clipz will schedule to Postiz.' })
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectClip(clip.id)
      setFeedback(
        result.ok
          ? { type: 'ok', msg: 'Clip rejected.' }
          : { type: 'err', msg: result.error ?? 'Failed to reject.' }
      )
    })
  }

  function handleSaveEdits() {
    startTransition(async () => {
      const result = await saveClipEdits({
        clipId: clip.id,
        captions: Object.keys(localCaptions).length > 0 ? localCaptions : undefined,
        platforms: localPlatforms,
        scheduledAt: localSchedule ? new Date(localSchedule).toISOString() : undefined,
      })
      setFeedback(
        result.ok
          ? { type: 'ok', msg: 'Changes saved.' }
          : { type: 'err', msg: result.error ?? 'Save failed.' }
      )
    })
  }

  const borderClass =
    clip.status === 'pending_approval'
      ? 'border-[#7ec1fb]/30'
      : clip.status === 'approved'
      ? 'border-[#95fe7c]/20'
      : 'border-border'

  return (
    <div className={`rounded-xl border bg-[#111827] transition-all ${borderClass}`}>

      {/* ── Collapsed header (always visible) ── */}
      <div className="flex items-start gap-4 px-5 py-4">

        {/* Left: meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-mono text-xs text-muted-foreground">#{clip.id}</span>
            <span className="text-white text-sm font-semibold">
              {clip.submitter_name ?? `User ${clip.submitter_id}`}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[clip.status]}`}>
              {STATUS_LABELS[clip.status]}
            </span>
            <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate mb-2">
            {(clip.caption ?? '(no caption)').slice(0, 120)}
          </p>
          {clip.submitter_context && (
            <p className="text-xs text-[#7ec1fb]/70 italic mb-2 truncate">
              {clip.submitter_context.slice(0, 90)}
            </p>
          )}
          <div className="flex gap-1 flex-wrap">
            {(clip.pending_platforms ?? []).map(p => (
              <span
                key={p}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border bg-transparent ${PLATFORM_BADGE[p]}`}
              >
                {PLATFORM_SHORT[p]}
              </span>
            ))}
          </div>
        </div>

        {/* Right: votes + manage button */}
        <div className="shrink-0 text-right space-y-1.5">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[#95fe7c] text-sm font-bold font-rajdhani">
              +{clip.net_votes}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({clip.upvotes}↑ {clip.downvotes}↓)
            </span>
          </div>
          {scheduledLabel && (
            <p className="text-[10px] text-[#95fe7c]">{scheduledLabel}</p>
          )}
          {clip.postiz_post_id && (
            <p className="text-[10px] text-muted-foreground font-mono">Postiz ✓</p>
          )}
          {canManage && (
            <button
              onClick={onToggle}
              className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors mt-1 ${
                expanded
                  ? 'text-white border-white/20 bg-white/10'
                  : 'text-muted-foreground border-border hover:text-white hover:border-white/20'
              }`}
            >
              {expanded ? '▾ Close' : '▸ Manage'}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded management section ── */}
      {expanded && (
        <div className="border-t border-border px-5 pb-6 pt-5 space-y-6">

          {/* Feedback */}
          {feedback && (
            <div
              className={`text-sm px-4 py-2.5 rounded-lg border font-medium ${
                feedback.type === 'ok'
                  ? 'text-[#95fe7c] border-[#95fe7c]/30 bg-[#95fe7c]/8'
                  : 'text-red-400 border-red-500/30 bg-red-500/8'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {/* Caption editor */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
              AI Captions — edit before posting
            </p>
            <div className="space-y-3">
              {ALL_PLATFORMS.map(p => {
                const val = localCaptions[p] ?? ''
                const limit = CHAR_LIMITS[p]
                const over = val.length > limit
                return (
                  <div key={p} className="grid grid-cols-[80px_1fr] gap-3 items-start">
                    <div className="pt-2 text-right">
                      <span className={`text-[10px] font-bold ${PLATFORM_BADGE[p].split(' ')[0]}`}>
                        {PLATFORM_LABELS[p]}
                      </span>
                    </div>
                    <div>
                      <textarea
                        value={val}
                        onChange={e =>
                          setLocalCaptions(prev => ({ ...prev, [p]: e.target.value }))
                        }
                        rows={p === 'twitter' ? 3 : 4}
                        placeholder={`${PLATFORM_LABELS[p]} caption…`}
                        className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#7ec1fb]/40 resize-none transition-colors font-mono leading-relaxed"
                      />
                      <div className="flex justify-end mt-0.5">
                        <span
                          className={`text-[10px] font-mono ${
                            over ? 'text-red-400' : 'text-muted-foreground/40'
                          }`}
                        >
                          {val.length.toLocaleString()} / {limit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Platforms + Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Platform toggles */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
                Platforms
              </p>
              <div className="flex gap-2 flex-wrap">
                {ALL_PLATFORMS.map(p => {
                  const active = localPlatforms.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-all ${
                        active
                          ? PLATFORM_ACTIVE[p]
                          : 'text-muted-foreground border-border bg-transparent hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {active ? '✓ ' : ''}{PLATFORM_SHORT[p]}
                    </button>
                  )
                })}
              </div>
              {localPlatforms.length === 0 && (
                <p className="text-[10px] text-red-400 mt-2">Select at least one platform.</p>
              )}
            </div>

            {/* Schedule picker */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
                Schedule (your local time)
              </p>
              <input
                type="datetime-local"
                value={localSchedule}
                onChange={e => setLocalSchedule(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7ec1fb]/40 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                Leave empty to schedule 1 hour from now.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1 border-t border-border">
            {clip.status === 'pending_approval' ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isPending || localPlatforms.length === 0}
                  className="flex-1 bg-[#95fe7c] hover:bg-[#7de066] disabled:opacity-40 text-[#0d1321] font-bold text-sm rounded-lg py-2.5 transition-colors font-rajdhani tracking-wide"
                >
                  {isPending ? 'Processing…' : '✓ Approve & Schedule'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 text-sm font-bold font-rajdhani tracking-wide transition-colors"
                >
                  ✗ Reject
                </button>
              </>
            ) : clip.status === 'approved' ? (
              <>
                <button
                  onClick={handleSaveEdits}
                  disabled={isPending}
                  className="flex-1 bg-[#7ec1fb]/10 hover:bg-[#7ec1fb]/20 border border-[#7ec1fb]/40 text-[#7ec1fb] font-bold text-sm rounded-lg py-2.5 transition-colors font-rajdhani tracking-wide disabled:opacity-40"
                >
                  {isPending ? 'Saving…' : '↻ Save Edits'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 text-sm font-bold font-rajdhani tracking-wide transition-colors"
                >
                  ✗ Reject
                </button>
              </>
            ) : null}
          </div>

          <p className="text-[10px] text-muted-foreground/35 italic">
            Approval updates Supabase. Sir Clipz bot handles the actual Postiz post automatically.
          </p>

        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocal(utcString: string): string {
  const d = new Date(utcString)
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}
