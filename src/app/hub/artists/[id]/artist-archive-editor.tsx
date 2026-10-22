'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ArtistBible } from '@/lib/booker-card'
import { upsertArtistBible, setArtistRollout } from '@/app/hub/actions'

const ARCHETYPES = [
  'Champion', 'Challenger', 'Underdog', 'Prodigy', 'Veteran', 'Rebel', 'Technician',
  'Showman', 'Monster', 'Visionary', 'Outsider', 'Wildcard', 'Trickster', "People's Champion",
  'Founder', 'Hitmaker', 'Machine', 'Melodist', 'Destroyer',
]
const HERO_HEEL = ['hero', 'heel', 'antihero', 'wildcard']

type FieldDef = { label: string; ta?: boolean; select?: string[]; hint?: string }

// Every field of the Artist Archive. Modules (src/lib/hub-modules.json) decide
// which of these appear together; this file only knows how to edit them.
const FIELD_DEFS: Record<string, FieldDef> = {
  nickname: { label: 'Battle nickname' },
  archetype_primary: { label: 'Primary archetype', select: ARCHETYPES },
  archetype_secondary: { label: 'Secondary archetype', select: ARCHETYPES },
  hero_heel: { label: 'Hero / heel tendency', select: HERO_HEEL },
  one_line_identity: { label: 'One-line identity', ta: true, hint: 'A stranger should get this artist in one sentence.' },
  want: { label: 'What they want right now', ta: true },
  motivation: { label: 'Motivation' },
  core_belief: { label: 'Core belief' },
  greatest_strength: { label: 'Greatest strength' },
  vulnerability: { label: 'Vulnerability', hint: 'Internal only. Never asked of the artist in the playbook.' },
  whats_proving: { label: "What they're trying to prove", ta: true },
  short_bio: { label: 'Short bio', ta: true },
  long_bio: { label: 'Long bio', ta: true },
  color_signature: { label: 'Signature color', hint: 'hex or name' },
  color_secondary: { label: 'Secondary color' },
  color_accent: { label: 'Accent color' },
  symbol: { label: 'Symbol / monogram' },
  typography: { label: 'Typography' },
  logo_url: { label: 'Logo URL' },
  visual_effect: { label: 'Signature graphic effect' },
  stage_character: { label: 'Full character: look, costume, stage presence', ta: true },
  do_not_use: { label: 'Do-not-use visual guidance', ta: true },
  entrance_sting_url: { label: 'Entrance sting URL' },
  catchphrase: { label: 'Primary catchphrase' },
  victory_phrase: { label: 'Victory phrase' },
  challenge_phrase: { label: 'Challenge phrase' },
  signoff: { label: 'Sign-off' },
  announcer_intro: { label: 'Announcer introduction', ta: true },
  voice_tone: { label: 'Voice / tone description' },
  trashtalk_boundaries: { label: 'Rivalry boundaries (what is fair game, what is off limits)', ta: true },
  signature_weapon: { label: 'Signature weapon', hint: 'bars, melody, production, storytelling, genre fusion…' },
  memeable_phrase: { label: 'Memeable phrase' },
  artist_emoji: { label: 'Artist emoji' },
  community_name: { label: 'Community / fan name' },
  walk_cue_url: { label: 'THE WALK cue URL' },
  walk_script_md: { label: 'THE WALK script / beats', ta: true },
  sponsor_fit: { label: 'Sponsor fit (one per line)', ta: true, hint: 'A wish list of genres, brands or causes that genuinely fit. Nothing is promised.' },
}

function valueOf(b: ArtistBible, name: string): string {
  if (name.startsWith('color_')) return b.colors?.[name.replace('color_', '')] ?? ''
  if (name === 'sponsor_fit') return (b.sponsor_fit ?? []).join('\n')
  return (b[name as keyof ArtistBible] as string | null) ?? ''
}

export function ArtistArchiveEditor({ artistId, bible, fields }: {
  artistId: string
  bible: ArtistBible
  fields: string[]
}) {
  const router = useRouter()
  const names = fields.filter(f => FIELD_DEFS[f])
  const initial = () => Object.fromEntries(names.map(n => [n, valueOf(bible, n)]))
  const [flat, setFlat] = useState<Record<string, string>>(initial)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (names.length === 0) return null

  function save() {
    setErr(null)
    // Only the fields shown in THIS module are written, so saving one module
    // can never blank out another.
    const payload: Record<string, unknown> = {}
    const colorFields = names.filter(n => n.startsWith('color_'))
    for (const n of names) {
      const v = (flat[n] ?? '').trim()
      if (n.startsWith('color_')) continue
      if (n === 'sponsor_fit') payload.sponsor_fit = v.split('\n').map(x => x.trim()).filter(Boolean)
      else payload[n] = v || null
    }
    if (colorFields.length) {
      const colors: Record<string, string> = { ...(bible.colors ?? {}) }
      for (const n of colorFields) {
        const key = n.replace('color_', '')
        const v = (flat[n] ?? '').trim()
        if (v) colors[key] = v
        else delete colors[key]
      }
      payload.colors = colors
    }
    startTransition(async () => {
      const res = await upsertArtistBible(artistId, payload)
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-[#0d1321]/40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h4 className="font-rajdhani font-bold text-white tracking-wide text-sm">Artist Archive fields</h4>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            {err && <span className="text-xs text-red-400">{err}</span>}
            <button
              onClick={() => { setFlat(initial()); setEditing(false); setErr(null) }}
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
          <button onClick={() => setEditing(true)} className="text-xs text-[#7ec1fb] hover:underline px-2 py-1 shrink-0">Edit</button>
        )}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {names.map(name => {
          const f = FIELD_DEFS[name]
          const val = flat[name] ?? ''
          const cls = 'w-full rounded-md bg-[#0d1321] border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7ec1fb]'
          return (
            <div key={name} className={f.ta ? 'md:col-span-2' : ''}>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{f.label}</label>
              {!editing ? (
                <p className={`text-sm whitespace-pre-wrap ${val ? 'text-white' : 'text-muted-foreground/40 italic'}`}>{val || 'not set'}</p>
              ) : f.ta ? (
                <textarea value={val} onChange={e => setFlat(s => ({ ...s, [name]: e.target.value }))} rows={3} className={cls} />
              ) : f.select ? (
                <select value={val} onChange={e => setFlat(s => ({ ...s, [name]: e.target.value }))} className={cls}>
                  <option value="">—</option>
                  {f.select.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={val} onChange={e => setFlat(s => ({ ...s, [name]: e.target.value }))} className={cls} />
              )}
              {f.hint && editing && <p className="text-[10px] text-muted-foreground/60 mt-1">{f.hint}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function NeedsReviewToggle({ artistId, needsReview }: { artistId: string; needsReview: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(async () => { await upsertArtistBible(artistId, { needs_review: !needsReview }); router.refresh() })}
      disabled={pending}
      className={`text-[10px] font-bold rounded px-2 py-1 border transition-colors ${
        needsReview
          ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
          : 'text-muted-foreground border-border hover:text-white'
      }`}
    >
      {needsReview ? 'NEEDS REVIEW. Click to clear' : 'Mark needs review'}
    </button>
  )
}

export function RolloutControl({ artistId, founding, batch }: { artistId: string; founding: boolean; batch: number | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [b, setB] = useState(batch ? String(batch) : '')
  function save(nextFounding: boolean, nextBatch: string) {
    const n = parseInt(nextBatch, 10)
    startTransition(async () => {
      await setArtistRollout(artistId, nextFounding, Number.isFinite(n) && n > 0 ? n : null)
      router.refresh()
    })
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={() => save(!founding, b)}
        disabled={pending}
        className={`font-bold rounded px-2 py-1 border transition-colors ${
          founding ? 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10' : 'text-muted-foreground border-border hover:text-white'
        }`}
      >
        {founding ? 'FOUNDING ARTIST' : 'Mark as founding artist'}
      </button>
      <label className="text-muted-foreground flex items-center gap-1">
        Batch
        <input
          value={b}
          onChange={e => setB(e.target.value.replace(/\D/g, ''))}
          onBlur={() => save(founding, b)}
          className="w-10 rounded bg-[#0d1321] border border-border px-1.5 py-0.5 text-white"
        />
      </label>
    </div>
  )
}
