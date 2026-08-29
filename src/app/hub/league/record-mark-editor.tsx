'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setRecordMark } from '@/app/hub/actions'
import type { ManualMark } from '@/lib/record-book'

export function RecordMarkEditor({
  marks,
  artists,
}: {
  marks: ManualMark[]
  artists: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ artistId: string; value: string; note: string; battleId: string }>({
    artistId: '', value: '', note: '', battleId: '',
  })

  function begin(m: ManualMark) {
    setEditing(m.mark_key)
    setDraft({
      artistId: m.artist_id ?? '',
      value: m.value_text ?? '',
      note: m.note ?? '',
      battleId: m.battle_id ? String(m.battle_id) : '',
    })
  }

  function save(m: ManualMark) {
    startTransition(async () => {
      await setRecordMark({
        markKey: m.mark_key,
        label: m.label,
        artistId: draft.artistId || null,
        valueText: draft.value.trim() || null,
        battleId: draft.battleId ? Number(draft.battleId) : null,
        note: draft.note.trim() || null,
      })
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-[#111827] divide-y divide-border">
      {marks.map(m => {
        const isEditing = editing === m.mark_key
        return (
          <div key={m.mark_key} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{m.label}</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
                  <button onClick={() => save(m)} disabled={pending} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-2.5 py-1 rounded">
                    {pending ? '…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => begin(m)} className="text-xs text-[#7ec1fb] hover:underline">Edit</button>
              )}
            </div>

            {!isEditing ? (
              <p className="text-sm mt-1">
                <span className={m.artist_name ? 'text-white font-rajdhani font-bold' : 'text-muted-foreground/40 italic'}>
                  {m.artist_name ?? m.value_text ?? 'not set'}
                </span>
                {m.artist_name && m.value_text && <span className="text-muted-foreground"> — {m.value_text}</span>}
                {m.note && <span className="text-xs text-muted-foreground block mt-0.5">{m.note}</span>}
              </p>
            ) : (
              <div className="grid gap-2 mt-2 md:grid-cols-2">
                <select
                  value={draft.artistId}
                  onChange={e => setDraft(d => ({ ...d, artistId: e.target.value }))}
                  className="rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
                >
                  <option value="">— no artist —</option>
                  {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input
                  value={draft.value}
                  onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                  placeholder="value (e.g. 'came back from 0–2')"
                  className="rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
                />
                <input
                  value={draft.battleId}
                  onChange={e => setDraft(d => ({ ...d, battleId: e.target.value.replace(/\D/g, '') }))}
                  placeholder="battle id (optional)"
                  className="rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
                />
                <input
                  value={draft.note}
                  onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                  placeholder="note (optional)"
                  className="rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
