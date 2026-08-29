'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertSponsorProperty, deleteSponsorProperty } from '@/app/hub/actions'

export type SponsorProperty = {
  id: string
  property_name: string
  property_type: string
  tier: string | null
  status: string
  partner_name: string | null
  deliverables: string[]
  value_notes: string | null
  sort_order: number
}

const TYPES = ['presenting', 'franchise', 'ritual', 'surface', 'artist', 'season']
const STATUSES = ['available', 'pitched', 'sold']
const COLUMNS: { status: string; label: string; accent: string }[] = [
  { status: 'available', label: 'Available', accent: 'border-border' },
  { status: 'pitched', label: 'Pitched', accent: 'border-amber-500/40' },
  { status: 'sold', label: 'Sold', accent: 'border-[#95fe7c]/40' },
]

const BLANK: Omit<SponsorProperty, 'id'> = {
  property_name: '', property_type: 'ritual', tier: null, status: 'available',
  partner_name: null, deliverables: [], value_notes: null, sort_order: 999,
}

export function SponsorsManager({ properties }: { properties: SponsorProperty[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Omit<SponsorProperty, 'id'> & { id?: string; deliverablesText?: string }>(BLANK)

  function begin(p?: SponsorProperty) {
    if (p) { setDraft({ ...p, deliverablesText: (p.deliverables ?? []).join('\n') }); setEditing(p.id) }
    else { setDraft({ ...BLANK, deliverablesText: '' }); setEditing('new') }
  }

  function save() {
    startTransition(async () => {
      await upsertSponsorProperty({
        id: draft.id ?? null,
        property_name: draft.property_name.trim(),
        property_type: draft.property_type,
        tier: draft.tier?.trim() || null,
        status: draft.status,
        partner_name: draft.partner_name?.trim() || null,
        deliverables: (draft.deliverablesText ?? '').split('\n').map(x => x.trim()).filter(Boolean),
        value_notes: draft.value_notes?.trim() || null,
        sort_order: draft.sort_order,
      })
      setEditing(null)
      router.refresh()
    })
  }

  function quickStatus(p: SponsorProperty, status: string) {
    startTransition(async () => {
      await upsertSponsorProperty({ id: p.id, status })
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => { await deleteSponsorProperty(id); router.refresh() })
  }

  const input = 'w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]'

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => begin()} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] px-3 py-1.5 rounded">+ New property</button>
      </div>

      {editing && (
        <div className="rounded-xl border border-[#7ec1fb]/30 bg-[#111827] p-4 grid gap-3 md:grid-cols-2">
          <input placeholder="Property name" value={draft.property_name} onChange={e => setDraft(d => ({ ...d, property_name: e.target.value }))} className={`${input} md:col-span-2`} />
          <select value={draft.property_type} onChange={e => setDraft(d => ({ ...d, property_type: e.target.value }))} className={input}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} className={input}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="Tier (optional)" value={draft.tier ?? ''} onChange={e => setDraft(d => ({ ...d, tier: e.target.value }))} className={input} />
          <input placeholder="Partner name (optional)" value={draft.partner_name ?? ''} onChange={e => setDraft(d => ({ ...d, partner_name: e.target.value }))} className={input} />
          <textarea placeholder="Deliverables (one per line)" value={draft.deliverablesText ?? ''} onChange={e => setDraft(d => ({ ...d, deliverablesText: e.target.value }))} rows={3} className={`${input} md:col-span-2`} />
          <textarea placeholder="Value notes — what recurring behavior this sponsor owns" value={draft.value_notes ?? ''} onChange={e => setDraft(d => ({ ...d, value_notes: e.target.value }))} rows={2} className={`${input} md:col-span-2`} />
          <div className="md:col-span-2 flex items-center gap-3">
            <button onClick={save} disabled={pending || !draft.property_name.trim()} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-3 py-1.5 rounded">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(col => {
          const items = properties.filter(p => p.status === col.status)
          return (
            <div key={col.status} className={`rounded-xl border ${col.accent} bg-[#0d1321]/40 p-3`}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{col.label} ({items.length})</p>
              <div className="space-y-2">
                {items.map(p => (
                  <div key={p.id} className="rounded-lg border border-border bg-[#111827] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-rajdhani font-bold text-white">{p.property_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{p.property_type}{p.partner_name && ` · ${p.partner_name}`}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button onClick={() => begin(p)} className="text-[10px] text-[#7ec1fb] hover:underline">edit</button>
                        <button onClick={() => remove(p.id)} className="text-[10px] text-muted-foreground hover:text-red-400">delete</button>
                      </div>
                    </div>
                    {p.value_notes && <p className="text-xs text-muted-foreground mt-1.5">{p.value_notes}</p>}
                    {p.deliverables?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {p.deliverables.map((d, i) => <li key={i} className="text-[11px] text-muted-foreground">• {d}</li>)}
                      </ul>
                    )}
                    <div className="flex gap-1 mt-2">
                      {STATUSES.filter(s => s !== p.status).map(s => (
                        <button
                          key={s}
                          onClick={() => quickStatus(p, s)}
                          className="text-[10px] text-muted-foreground hover:text-white border border-border rounded px-1.5 py-0.5"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground/40 italic">none</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
