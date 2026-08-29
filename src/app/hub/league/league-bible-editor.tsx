'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertLeagueBible } from '@/app/hub/actions'

export type LeagueBible = {
  mission: string | null
  one_liner: string | null
  ten_sec: string | null
  thirty_sec: string | null
  long_form: string | null
  tagline: string | null
  positioning: string | null
  rules_md: string | null
  scoring_md: string | null
  guardrails_md: string | null
  glossary: { term: string; definition: string }[]
}

type Field = { name: keyof LeagueBible; label: string; ta?: boolean; hint?: string }

const SECTIONS: { title: string; blurb: string; fields: Field[] }[] = [
  {
    title: 'Core Identity',
    blurb: 'Phase 1 — most of this already exists in your head; the task is writing it down once.',
    fields: [
      { name: 'mission', label: 'Official mission', ta: true },
      { name: 'one_liner', label: 'One-sentence description' },
      { name: 'ten_sec', label: '10-second explanation', ta: true },
      { name: 'thirty_sec', label: '30-second explanation', ta: true },
      { name: 'tagline', label: 'Official tagline' },
      { name: 'positioning', label: 'Positioning statement', ta: true },
      { name: 'long_form', label: 'Long-form explanation', ta: true },
    ],
  },
  {
    title: 'Rules & Scoring',
    blurb: 'Official battle rules and winner methodology in plain English.',
    fields: [
      { name: 'rules_md', label: 'Official battle rules', ta: true },
      { name: 'scoring_md', label: 'Scoring / winner methodology', ta: true, hint: 'Main: Human judge + X poll + SOL vote (2 of 3). Quick: Poll + Charts + DJ Wavy (2 of 3).' },
    ],
  },
  {
    title: 'Guardrails',
    blurb: 'The lines that keep credibility intact while borrowing polished storytelling craft.',
    fields: [
      { name: 'guardrails_md', label: 'Guardrails', ta: true, hint: 'Never script the winner. Script framing + two aftermath branches only.' },
    ],
  },
]

export function LeagueBibleEditor({ bible }: { bible: LeagueBible }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    for (const s of SECTIONS) for (const f of s.fields) d[f.name] = (bible[f.name] as string | null) ?? ''
    d.glossary = (bible.glossary ?? []).map(g => `${g.term} — ${g.definition}`).join('\n')
    return d
  })
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(sectionFields: string[], withGlossary = false) {
    setErr(null)
    startTransition(async () => {
      const payload: Record<string, unknown> = {}
      for (const name of sectionFields) payload[name] = draft[name]?.trim() || null
      if (withGlossary) {
        payload.glossary = (draft.glossary ?? '').split('\n').map(line => {
          const [term, ...rest] = line.split('—')
          return { term: term?.trim() ?? '', definition: rest.join('—').trim() }
        }).filter(g => g.term)
      }
      const res = await upsertLeagueBible(payload)
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(section => {
        const isEditing = editing === section.title
        return (
          <Group
            key={section.title}
            title={section.title}
            blurb={section.blurb}
            editing={isEditing}
            pending={pending}
            err={isEditing ? err : null}
            onEdit={() => setEditing(section.title)}
            onCancel={() => { setEditing(null); setErr(null) }}
            onSave={() => save(section.fields.map(f => f.name))}
          >
            {section.fields.map(f => (
              <FieldRow
                key={f.name}
                label={f.label}
                hint={isEditing ? f.hint : undefined}
                value={isEditing ? (draft[f.name] ?? '') : ((bible[f.name] as string | null) ?? '')}
                editing={isEditing}
                ta={f.ta}
                onChange={v => setDraft(d => ({ ...d, [f.name]: v }))}
              />
            ))}
          </Group>
        )
      })}

      {/* Glossary */}
      <Group
        title="Glossary"
        blurb="Your own terms, defined once — THE WALK, TRACK LOCK, Main Event, Benefit Battle…"
        editing={editing === 'Glossary'}
        pending={pending}
        err={editing === 'Glossary' ? err : null}
        onEdit={() => setEditing('Glossary')}
        onCancel={() => { setEditing(null); setErr(null) }}
        onSave={() => save([], true)}
      >
        {editing === 'Glossary' ? (
          <div className="md:col-span-2">
            <textarea
              value={draft.glossary ?? ''}
              onChange={e => setDraft(d => ({ ...d, glossary: e.target.value }))}
              rows={8}
              placeholder="THE WALK — a short personalized entrance moment before an artist's first song"
              className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1">One term per line: <code>term — definition</code></p>
          </div>
        ) : (bible.glossary ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground/40 italic md:col-span-2">not set</p>
        ) : (
          <dl className="md:col-span-2 space-y-1.5">
            {bible.glossary.map((g, i) => (
              <div key={i} className="text-sm">
                <dt className="inline font-bold text-white">{g.term}</dt>
                <dd className="inline text-muted-foreground"> — {g.definition}</dd>
              </div>
            ))}
          </dl>
        )}
      </Group>
    </div>
  )
}

function Group({ title, blurb, editing, pending, err, onEdit, onCancel, onSave, children }: {
  title: string; blurb: string; editing: boolean; pending: boolean; err: string | null
  onEdit: () => void; onCancel: () => void; onSave: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-[#111827]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="font-rajdhani font-bold text-white tracking-wide text-sm">{title}</h3>
          <p className="text-[10px] text-muted-foreground/70">{blurb}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            {err && <span className="text-xs text-red-400">{err}</span>}
            <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-white px-2 py-1">Cancel</button>
            <button onClick={onSave} disabled={pending} className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] disabled:opacity-50 px-3 py-1 rounded">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button onClick={onEdit} className="text-xs text-[#7ec1fb] hover:underline px-2 py-1 shrink-0">Edit</button>
        )}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

function FieldRow({ label, value, editing, ta, hint, onChange }: {
  label: string; value: string; editing: boolean; ta?: boolean; hint?: string; onChange: (v: string) => void
}) {
  return (
    <div className={ta ? 'md:col-span-2' : ''}>
      <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
      {!editing ? (
        <p className={`text-sm whitespace-pre-wrap ${value ? 'text-white' : 'text-muted-foreground/40 italic'}`}>{value || 'not set'}</p>
      ) : ta ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]" />
      )}
      {hint && editing && <p className="text-[10px] text-muted-foreground/60 mt-1">{hint}</p>}
    </div>
  )
}
