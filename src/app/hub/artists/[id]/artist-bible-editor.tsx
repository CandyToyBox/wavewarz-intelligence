'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ArtistBible } from '@/lib/booker-card'
import { upsertArtistBible } from '@/app/hub/actions'

const ARCHETYPES = [
  'Champion', 'Challenger', 'Underdog', 'Prodigy', 'Veteran', 'Rebel', 'Technician',
  'Showman', 'Monster', 'Visionary', 'Outsider', 'Wildcard', 'Trickster', "People's Champion",
  'Founder', 'Hitmaker', 'Machine', 'Melodist', 'Destroyer',
]
const HERO_HEEL = ['hero', 'heel', 'antihero', 'wildcard']

type FieldDef = { name: string; label: string; ta?: boolean; select?: string[]; hint?: string }

const SECTIONS: { title: string; blurb: string; fields: FieldDef[] }[] = [
  {
    title: 'Character',
    blurb: 'Phases 9–11, 15, 19 — amplify the real person, do not manufacture drama.',
    fields: [
      { name: 'nickname', label: 'Battle nickname' },
      { name: 'archetype_primary', label: 'Primary archetype', select: ARCHETYPES },
      { name: 'archetype_secondary', label: 'Secondary archetype', select: ARCHETYPES },
      { name: 'hero_heel', label: 'Hero / heel tendency', select: HERO_HEEL },
      { name: 'one_line_identity', label: 'One-line identity', ta: true, hint: 'A stranger should get this artist in one sentence.' },
      { name: 'want', label: 'What they want right now', ta: true },
      { name: 'motivation', label: 'Motivation' },
      { name: 'core_belief', label: 'Core belief' },
      { name: 'greatest_strength', label: 'Greatest strength' },
      { name: 'vulnerability', label: 'Vulnerability' },
      { name: 'whats_proving', label: "What they're trying to prove", ta: true },
      { name: 'short_bio', label: 'Short bio', ta: true },
      { name: 'long_bio', label: 'Long bio', ta: true },
    ],
  },
  {
    title: 'Visual World',
    blurb: 'Phase 12 — the signals that must recur on every poster, entrance and clip.',
    fields: [
      { name: 'color_signature', label: 'Signature color', hint: 'hex or name' },
      { name: 'color_secondary', label: 'Secondary color' },
      { name: 'color_accent', label: 'Accent color' },
      { name: 'symbol', label: 'Symbol / monogram' },
      { name: 'typography', label: 'Typography' },
      { name: 'logo_url', label: 'Logo URL' },
      { name: 'visual_effect', label: 'Signature graphic effect' },
      { name: 'do_not_use', label: 'Do-not-use visual guidance', ta: true },
    ],
  },
  {
    title: 'Sonic & Verbal Identity',
    blurb: 'Phases 14–16 — sonic branding, not background music.',
    fields: [
      { name: 'entrance_sting_url', label: 'Entrance sting URL' },
      { name: 'catchphrase', label: 'Primary catchphrase' },
      { name: 'victory_phrase', label: 'Victory phrase' },
      { name: 'challenge_phrase', label: 'Challenge phrase' },
      { name: 'signoff', label: 'Sign-off' },
      { name: 'announcer_intro', label: 'Announcer introduction', ta: true },
      { name: 'voice_tone', label: 'Voice / tone description' },
      { name: 'trashtalk_boundaries', label: 'Trash-talk boundaries', ta: true },
      { name: 'signature_weapon', label: 'Signature weapon', hint: 'bars, melody, production, storytelling, genre fusion…' },
      { name: 'memeable_phrase', label: 'Memeable phrase' },
      { name: 'artist_emoji', label: 'Artist emoji' },
      { name: 'community_name', label: 'Community / fan name' },
    ],
  },
  {
    title: 'THE WALK',
    blurb: 'Phase 16 — the signature entrance, the most shareable clip of any event.',
    fields: [
      { name: 'walk_cue_url', label: 'THE WALK cue URL' },
      { name: 'walk_script_md', label: 'THE WALK script / beats', ta: true },
    ],
  },
  {
    title: 'Sponsor Fit',
    blurb: 'Phase 22 — genres, brands or causes this artist genuinely aligns with.',
    fields: [
      { name: 'sponsor_fit', label: 'Sponsor fit (one per line)', ta: true },
    ],
  },
]

function bibleToFlat(b: ArtistBible): Record<string, string> {
  const flat: Record<string, string> = {}
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (f.name.startsWith('color_')) {
        flat[f.name] = b.colors?.[f.name.replace('color_', '')] ?? ''
      } else if (f.name === 'sponsor_fit') {
        flat[f.name] = (b.sponsor_fit ?? []).join('\n')
      } else {
        flat[f.name] = (b[f.name as keyof ArtistBible] as string | null) ?? ''
      }
    }
  }
  return flat
}

function flatToPayload(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const colors: Record<string, string> = {}
  for (const [k, v] of Object.entries(flat)) {
    if (k.startsWith('color_')) {
      if (v.trim()) colors[k.replace('color_', '')] = v.trim()
    } else if (k === 'sponsor_fit') {
      out.sponsor_fit = v.split('\n').map(x => x.trim()).filter(Boolean)
    } else {
      out[k] = v.trim() || null
    }
  }
  out.colors = colors
  return out
}

export function ArtistBibleEditor({ artistId, bible }: { artistId: string; bible: ArtistBible }) {
  const router = useRouter()
  const [flat, setFlat] = useState(() => bibleToFlat(bible))
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function saveSection() {
    setErr(null)
    startTransition(async () => {
      const res = await upsertArtistBible(artistId, flatToPayload(flat))
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setEditingSection(null)
      router.refresh()
    })
  }

  function toggleReview() {
    startTransition(async () => {
      await upsertArtistBible(artistId, { needs_review: !bible.needs_review })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-rajdhani font-bold text-white tracking-wide">Identity Bible</h2>
        <button
          onClick={toggleReview}
          disabled={pending}
          className={`text-[10px] font-bold rounded px-2 py-1 border transition-colors ${
            bible.needs_review
              ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
              : 'text-muted-foreground border-border hover:text-white'
          }`}
        >
          {bible.needs_review ? 'NEEDS REVIEW — click to clear' : 'Mark needs review'}
        </button>
      </div>

      {SECTIONS.map(section => {
        const editing = editingSection === section.title
        return (
          <div key={section.title} className="rounded-xl border border-border bg-[#111827]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-rajdhani font-bold text-white tracking-wide text-sm">{section.title}</h3>
                <p className="text-[10px] text-muted-foreground/70">{section.blurb}</p>
              </div>
              {editing ? (
                <div className="flex items-center gap-2 shrink-0">
                  {err && <span className="text-xs text-red-400">{err}</span>}
                  <button
                    onClick={() => { setFlat(bibleToFlat(bible)); setEditingSection(null); setErr(null) }}
                    className="text-xs text-muted-foreground hover:text-white px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSection}
                    disabled={pending}
                    className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] hover:bg-[#95fe7c]/90 disabled:opacity-50 px-3 py-1 rounded"
                  >
                    {pending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingSection(section.title)}
                  className="text-xs text-[#7ec1fb] hover:underline px-2 py-1 shrink-0"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {section.fields.map(f => {
                const val = flat[f.name] ?? ''
                return (
                  <div key={f.name} className={f.ta ? 'md:col-span-2' : ''}>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      {f.label}
                    </label>
                    {!editing ? (
                      <p className={`text-sm whitespace-pre-wrap ${val ? 'text-white' : 'text-muted-foreground/40 italic'}`}>
                        {val || 'not set'}
                      </p>
                    ) : f.ta ? (
                      <textarea
                        value={val}
                        onChange={e => setFlat(s => ({ ...s, [f.name]: e.target.value }))}
                        rows={3}
                        className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
                      />
                    ) : f.select ? (
                      <select
                        value={val}
                        onChange={e => setFlat(s => ({ ...s, [f.name]: e.target.value }))}
                        className="w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]"
                      >
                        <option value="">—</option>
                        {f.select.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        value={val}
                        onChange={e => setFlat(s => ({ ...s, [f.name]: e.target.value }))}
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
      })}
    </div>
  )
}
