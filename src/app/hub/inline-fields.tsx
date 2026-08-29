'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type FieldDef = {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'select'
  options?: string[]
  placeholder?: string
  hint?: string
  full?: boolean
}

type Result = { ok: boolean; error?: string }

/**
 * Generic "view + edit" panel for a group of DB fields. The parent (a server
 * component) binds the correct server action and passes it as `onSave`.
 */
export function InlineFields({
  title,
  fields,
  values,
  onSave,
}: {
  title?: string
  fields: FieldDef[]
  values: Record<string, string>
  onSave: (values: Record<string, string>) => Promise<Result>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(values)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setErr(null)
    startTransition(async () => {
      const res = await onSave(draft)
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-[#111827]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {title && <h3 className="font-rajdhani font-bold text-white tracking-wide text-sm">{title}</h3>}
        {editing ? (
          <div className="flex items-center gap-2">
            {err && <span className="text-xs text-red-400">{err}</span>}
            <button
              onClick={() => { setDraft(values); setEditing(false); setErr(null) }}
              className="text-xs text-muted-foreground hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] hover:bg-[#95fe7c]/90 disabled:opacity-50 px-3 py-1 rounded"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[#7ec1fb] hover:underline px-2 py-1"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {fields.map(f => {
          const val = editing ? (draft[f.name] ?? '') : (values[f.name] ?? '')
          return (
            <div key={f.name} className={f.full || f.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                {f.label}
              </label>
              {!editing ? (
                <p className={`text-sm ${val ? 'text-white' : 'text-muted-foreground/50 italic'} whitespace-pre-wrap`}>
                  {val || 'not set'}
                </p>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={val}
                  onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={4}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
                />
              ) : f.type === 'select' ? (
                <select
                  value={val}
                  onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
                >
                  <option value="">—</option>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  value={val}
                  onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
                />
              )}
              {f.hint && editing && <p className="text-[10px] text-muted-foreground/60 mt-1">{f.hint}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
