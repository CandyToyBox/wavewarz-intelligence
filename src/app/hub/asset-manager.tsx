'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addContentAsset, deleteContentAsset } from '@/app/hub/actions'

export type Asset = {
  id: string
  category: string
  franchise: string | null
  title: string
  url: string | null
  asset_type: string
  notes: string | null
}

const ASSET_TYPES = ['link', 'image', 'video', 'audio', 'doc']
const FRANCHISES = [
  '', 'WARZ COUNTDOWN', 'WARZ EMBEDDED', 'FACE THE WAVE', 'TALE OF THE TRACK',
  'TRACK LOCK', 'THE WALK', 'WAR ROOM', 'AFTERMATH', 'NEXT ON WAVEWARZ',
]

export function AssetManager({
  scope,
  artistId,
  eventSlug,
  categories,
  assets,
  revalidate,
}: {
  scope: 'league' | 'artist' | 'event'
  artistId?: string
  eventSlug?: string
  categories: string[]
  assets: Asset[]
  revalidate: string
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: categories[0], franchise: '', title: '', url: '', asset_type: 'link', notes: '',
  })

  const byCategory = new Map<string, Asset[]>()
  for (const c of categories) byCategory.set(c, [])
  for (const a of assets) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  }

  function submit() {
    setErr(null)
    if (!form.title.trim()) { setErr('Title is required'); return }
    startTransition(async () => {
      const res = await addContentAsset({
        scope,
        artistId: artistId ?? null,
        eventSlug: eventSlug ?? null,
        category: form.category,
        franchise: form.franchise || null,
        title: form.title.trim(),
        url: form.url.trim() || null,
        assetType: form.asset_type,
        notes: form.notes.trim() || null,
      })
      if (!res.ok) { setErr(res.error ?? 'Failed'); return }
      setForm({ category: form.category, franchise: '', title: '', url: '', asset_type: 'link', notes: '' })
      setAdding(false)
      router.refresh()
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteContentAsset(id, revalidate)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">Assets</h2>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] hover:bg-[#95fe7c]/90 px-3 py-1.5 rounded"
        >
          {adding ? 'Close' : '+ Add asset'}
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-[#7ec1fb]/30 bg-[#111827] p-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Category
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Franchise (optional)
            <select
              value={form.franchise}
              onChange={e => setForm(f => ({ ...f, franchise: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            >
              {FRANCHISES.map(c => <option key={c} value={c}>{c || '—'}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground md:col-span-2">
            Title
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-muted-foreground md:col-span-2">
            URL (paste a link — Drive, YouTube, Supabase, etc.)
            <input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Type
            <select
              value={form.asset_type}
              onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            >
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Notes
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={pending}
              className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-3 py-1.5 rounded"
            >
              {pending ? 'Saving…' : 'Save asset'}
            </button>
            {err && <span className="text-xs text-red-400">{err}</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {[...byCategory.entries()].map(([cat, items]) => (
          <div key={cat} className="rounded-xl border border-border bg-[#111827] p-3">
            <p className="font-mono text-xs text-[#7ec1fb] mb-2">{cat}</p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 italic">empty</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map(a => (
                  <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-white hover:text-[#7ec1fb] break-words">
                          {a.title} ↗
                        </a>
                      ) : (
                        <span className="text-white">{a.title}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-2">{a.asset_type}</span>
                      {a.franchise && <span className="text-[10px] text-[#95fe7c] ml-1">· {a.franchise}</span>}
                      {a.notes && <p className="text-[11px] text-muted-foreground">{a.notes}</p>}
                    </div>
                    <button
                      onClick={() => remove(a.id)}
                      className="text-[10px] text-muted-foreground hover:text-red-400 shrink-0"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
