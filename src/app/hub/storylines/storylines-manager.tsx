'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertStoryline, deleteStoryline } from '@/app/hub/actions'

export type Storyline = {
  id: string
  type: string | null
  title: string
  artist_a_id: string | null
  artist_b_id: string | null
  status: string
  summary: string | null
  what_happened: string | null
  unresolved_tension: string | null
  relevant_battle_id: number | null
  rematch_possible: boolean
  needs_review: boolean
}

const TYPES = [
  'rivalry', 'rematch', 'redemption', 'revenge', 'founder_challenge', 'undefeated',
  'underdog', 'veteran_defense', 'giant_killer', 'tournament_run', 'ai_vs_human',
  'faction', 'genre_rivalry', 'betrayal', 'community_vs_community',
]

const BLANK: Omit<Storyline, 'id'> = {
  type: 'rivalry', title: '', artist_a_id: null, artist_b_id: null, status: 'open',
  summary: null, what_happened: null, unresolved_tension: null, relevant_battle_id: null,
  rematch_possible: false, needs_review: false,
}

export function StorylinesManager({
  storylines,
  artists,
}: {
  storylines: Storyline[]
  artists: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Omit<Storyline, 'id'> & { id?: string }>(BLANK)
  const nameById = new Map(artists.map(a => [a.id, a.name]))

  function begin(s?: Storyline) {
    if (s) { setDraft(s); setEditing(s.id) }
    else { setDraft(BLANK); setEditing('new') }
  }

  function save() {
    startTransition(async () => {
      await upsertStoryline({
        id: draft.id ?? null,
        type: draft.type,
        title: draft.title.trim(),
        artist_a_id: draft.artist_a_id || null,
        artist_b_id: draft.artist_b_id || null,
        status: draft.status,
        summary: draft.summary?.trim() || null,
        what_happened: draft.what_happened?.trim() || null,
        unresolved_tension: draft.unresolved_tension?.trim() || null,
        relevant_battle_id: draft.relevant_battle_id || null,
        rematch_possible: draft.rematch_possible,
        needs_review: draft.needs_review,
      })
      setEditing(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => { await deleteStoryline(id); router.refresh() })
  }

  const open = storylines.filter(s => s.status === 'open')
  const resolved = storylines.filter(s => s.status === 'resolved')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => begin()} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] px-3 py-1.5 rounded">+ New storyline</button>
      </div>

      {editing && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          artists={artists}
          types={TYPES}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      {[{ label: 'Open', items: open }, { label: 'Resolved', items: resolved }].map(group => (
        <section key={group.label}>
          <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide mb-2">{group.label} ({group.items.length})</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {group.items.map(s => (
              <div key={s.id} className="rounded-xl border border-border bg-[#111827] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-rajdhani font-bold text-white">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {s.type}
                      {s.artist_a_id && ` · ${nameById.get(s.artist_a_id) ?? '?'}`}
                      {s.artist_b_id && ` vs ${nameById.get(s.artist_b_id) ?? '?'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.needs_review && <span className="text-[9px] font-bold text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1">REVIEW</span>}
                    <button onClick={() => begin(s)} className="text-[10px] text-[#7ec1fb] hover:underline">edit</button>
                    <button onClick={() => remove(s.id)} className="text-[10px] text-muted-foreground hover:text-red-400">delete</button>
                  </div>
                </div>
                {s.summary && <p className="text-xs text-muted-foreground mt-1.5">{s.summary}</p>}
                {s.unresolved_tension && (
                  <p className="text-xs text-[#7ec1fb] mt-1">Unresolved: {s.unresolved_tension}</p>
                )}
              </div>
            ))}
            {group.items.length === 0 && <p className="text-xs text-muted-foreground/40 italic">none</p>}
          </div>
        </section>
      ))}
    </div>
  )
}

function Editor({ draft, setDraft, artists, types, pending, onCancel, onSave }: {
  draft: Omit<Storyline, 'id'> & { id?: string }
  setDraft: React.Dispatch<React.SetStateAction<Omit<Storyline, 'id'> & { id?: string }>>
  artists: { id: string; name: string }[]
  types: string[]
  pending: boolean
  onCancel: () => void
  onSave: () => void
}) {
  const set = (patch: Partial<Storyline>) => setDraft(d => ({ ...d, ...patch }))
  const input = 'w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]'
  return (
    <div className="rounded-xl border border-[#7ec1fb]/30 bg-[#111827] p-4 grid gap-3 md:grid-cols-2">
      <input placeholder="Title" value={draft.title} onChange={e => set({ title: e.target.value })} className={`${input} md:col-span-2`} />
      <select value={draft.type ?? ''} onChange={e => set({ type: e.target.value })} className={input}>
        {types.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={draft.status} onChange={e => set({ status: e.target.value })} className={input}>
        <option value="open">open</option>
        <option value="resolved">resolved</option>
      </select>
      <select value={draft.artist_a_id ?? ''} onChange={e => set({ artist_a_id: e.target.value || null })} className={input}>
        <option value="">— artist A —</option>
        {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select value={draft.artist_b_id ?? ''} onChange={e => set({ artist_b_id: e.target.value || null })} className={input}>
        <option value="">— artist B —</option>
        {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <textarea placeholder="Summary" value={draft.summary ?? ''} onChange={e => set({ summary: e.target.value })} rows={2} className={`${input} md:col-span-2`} />
      <textarea placeholder="What happened (and when)" value={draft.what_happened ?? ''} onChange={e => set({ what_happened: e.target.value })} rows={2} className={`${input} md:col-span-2`} />
      <textarea placeholder="Unresolved tension" value={draft.unresolved_tension ?? ''} onChange={e => set({ unresolved_tension: e.target.value })} rows={2} className={`${input} md:col-span-2`} />
      <input placeholder="Relevant battle id" value={draft.relevant_battle_id ?? ''} onChange={e => set({ relevant_battle_id: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} className={input} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={draft.rematch_possible} onChange={e => set({ rematch_possible: e.target.checked })} />
        Rematch possible
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={draft.needs_review} onChange={e => set({ needs_review: e.target.checked })} />
        Needs review
      </label>
      <div className="md:col-span-2 flex items-center gap-3">
        <button onClick={onSave} disabled={pending || !draft.title.trim()} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-3 py-1.5 rounded">
          {pending ? 'Saving…' : 'Save storyline'}
        </button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
      </div>
    </div>
  )
}
