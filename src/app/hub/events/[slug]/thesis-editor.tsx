'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertBattleThesis } from '@/app/hub/actions'

export type Thesis = {
  event_slug: string
  thesis: string | null
  headline: string | null
  why_these_two: string | null
  why_now: string | null
  stakes: string | null
  contrast: string | null
  who_has_more_to_prove: string | null
  angle: string | null
  storyline_1: string | null
  storyline_2: string | null
  storyline_3: string | null
  winner_consequence: string | null
  loser_consequence: string | null
  needs_review: boolean
}

const ANGLES = ['champion vs challenger', 'old guard vs new blood', 'revenge', 'redemption', 'rematch', 'upset bid', 'legacy', 'founder challenge', 'undefeated clash', 'giant killer']

type F = { name: keyof Thesis; label: string; ta?: boolean; select?: string[]; hint?: string }
const FIELDS: F[] = [
  { name: 'thesis', label: 'Battle thesis (one sentence)', ta: true, hint: 'Must fit on a poster and inside a six-second hook.' },
  { name: 'headline', label: 'Headline / tagline' },
  { name: 'angle', label: 'Angle', select: ANGLES },
  { name: 'why_these_two', label: 'Why these two?', ta: true },
  { name: 'why_now', label: 'Why now?', ta: true },
  { name: 'stakes', label: 'What are the stakes?', ta: true },
  { name: 'contrast', label: 'What is the contrast?', ta: true },
  { name: 'who_has_more_to_prove', label: 'Who has more to prove?', ta: true },
  { name: 'storyline_1', label: 'Supporting storyline 1' },
  { name: 'storyline_2', label: 'Supporting storyline 2' },
  { name: 'storyline_3', label: 'Supporting storyline 3' },
  { name: 'winner_consequence', label: 'What happens to the winner?', ta: true },
  { name: 'loser_consequence', label: 'What happens to the loser?', ta: true },
]

export function ThesisEditor({
  slug,
  thesis,
  eventMeta,
}: {
  slug: string
  thesis: Thesis | null
  eventMeta: { artistAId: string | null; artistBId: string | null; label: string; date: string }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!thesis)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    for (const f of FIELDS) d[f.name] = (thesis?.[f.name] as string | null) ?? ''
    return d
  })

  function save() {
    setErr(null)
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        event_label: eventMeta.label,
        artist_a_id: eventMeta.artistAId,
        artist_b_id: eventMeta.artistBId,
        event_date: eventMeta.date,
      }
      for (const f of FIELDS) payload[f.name] = draft[f.name]?.trim() || null
      const res = await upsertBattleThesis(slug, payload)
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setEditing(false)
      router.refresh()
    })
  }

  function toggleReview() {
    startTransition(async () => {
      await upsertBattleThesis(slug, {
        event_label: eventMeta.label,
        needs_review: !thesis?.needs_review,
      })
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-[#111827]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="font-rajdhani font-bold text-white tracking-wide text-sm">Battle Thesis</h3>
          <p className="text-[10px] text-muted-foreground/70">Phase 25 — write this before any promo asset is made.</p>
        </div>
        <div className="flex items-center gap-2">
          {thesis && (
            <button
              onClick={toggleReview}
              disabled={pending}
              className={`text-[10px] font-bold rounded px-2 py-1 border ${
                thesis.needs_review
                  ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                  : 'text-muted-foreground border-border hover:text-white'
              }`}
            >
              {thesis.needs_review ? 'NEEDS REVIEW' : 'flag review'}
            </button>
          )}
          {editing ? (
            <>
              {err && <span className="text-xs text-red-400">{err}</span>}
              {thesis && <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-white px-2 py-1">Cancel</button>}
              <button onClick={save} disabled={pending} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-3 py-1 rounded">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-[#7ec1fb] hover:underline px-2 py-1">Edit</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {FIELDS.map(f => {
          const val = editing ? (draft[f.name] ?? '') : ((thesis?.[f.name] as string | null) ?? '')
          return (
            <div key={f.name} className={f.ta ? 'md:col-span-2' : ''}>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{f.label}</label>
              {!editing ? (
                <p className={`text-sm whitespace-pre-wrap ${val ? 'text-white' : 'text-muted-foreground/40 italic'}`}>{val || 'not set'}</p>
              ) : f.ta ? (
                <textarea value={val} onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))} rows={2}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]" />
              ) : f.select ? (
                <select value={val} onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]">
                  <option value="">—</option>
                  {f.select.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={val} onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]" />
              )}
              {f.hint && editing && <p className="text-[10px] text-muted-foreground/60 mt-1">{f.hint}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
