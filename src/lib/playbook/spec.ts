import raw from './spec.json'

// The Founding Artists Playbook: every module, question, field and checklist rule.
// spec.json was extracted unchanged from the claude.ai prototype (the MODS array),
// so the two can be diffed. Everything the app needs on top of it (module colors,
// where the family tie-in sits, which questions feed which checklist item) is
// derived here.

export type PartType = 'text' | 'urls' | 'files' | 'palette' | 'choice'

export type Part = {
  id: string
  t: PartType
  max?: number
  min?: number
  rows?: number
  accept?: string
  img?: boolean
  cap?: string
  multi?: boolean
  opts?: string[]
  ph?: string
}

export type Question = {
  label: string
  hint?: string
  opt?: boolean
  parts: Part[]
}

export type Check = {
  l: string
  all?: string[]
  any?: string[]
  /** Indexes of the questions that feed this item (derived). */
  qi: number[]
}

export type PlaybookModule = {
  key: string
  order: number
  title: string
  tier: 'start' | 'next' | 'later'
  tierLabel: string
  mins: string
  blurb: string
  why: string
  gather?: string[]
  link?: { t: string; u: string }
  qs: Question[]
  fam: string
  famQ: number
  checks: Check[]
  skip: string
  color: string
  rgb: string
}

// Module accent colors. Only the three WaveWarZ brand tones, in rotation (green, blue,
// ice), so the page reads as navy and green. The module number tells them apart. The
// prototype used a rainbow including two violets; no purple, and no off-brand hues.
// Change them in this one place.
export const MODULE_COLORS: Record<string, string> = {
  who: '#95fe7c',
  look: '#7ec1fb',
  story: '#daecfd',
  music: '#95fe7c',
  voice: '#7ec1fb',
  walk: '#daecfd',
  home: '#95fe7c',
  community: '#7ec1fb',
  archive: '#daecfd',
  merch: '#95fe7c',
}

// Which question (0-based) carries the "Family tie-in" callout, per module.
const FAM_Q: Record<string, number> = {
  who: 0, look: 0, story: 3, music: 4, voice: 0, walk: 2, home: 0, community: 2, archive: 0, merch: 5,
}

type RawModule = Omit<PlaybookModule, 'color' | 'rgb' | 'famQ' | 'checks'> & {
  checks: { l: string; all?: string[]; any?: string[] }[]
}

function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export const MODULES: PlaybookModule[] = (raw as unknown as RawModule[]).map(m => {
  const color = MODULE_COLORS[m.key]
  const checks: Check[] = m.checks.map(c => {
    const ids = [...(c.all ?? []), ...(c.any ?? [])]
    const qi: number[] = []
    m.qs.forEach((q, i) => { if (q.parts.some(p => ids.includes(p.id))) qi.push(i) })
    return { ...c, qi }
  })
  return { ...m, color, rgb: rgbOf(color), famQ: FAM_Q[m.key], checks }
})

export const MODULE_BY_KEY: Record<string, PlaybookModule> = Object.fromEntries(MODULES.map(m => [m.key, m]))

export type PartRef = { part: Part; module: PlaybookModule; qIndex: number; question: Question }

export const PARTS: Record<string, PartRef> = {}
for (const m of MODULES) {
  m.qs.forEach((q, qIndex) => {
    for (const p of q.parts) PARTS[p.id] = { part: p, module: m, qIndex, question: q }
  })
}

/** The field key that stands for a whole question (used for "I want help with this one"). */
export function questionKey(q: Question): string {
  return q.parts[0].id
}

/** Every question's help key, mapped back to its module. */
export const HELP_KEYS: Record<string, { module: string; qIndex: number }> = {}
for (const m of MODULES) m.qs.forEach((q, qIndex) => { HELP_KEYS[questionKey(q)] = { module: m.key, qIndex } })

export const NAME_KEY = '_artist_name'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export const PALETTE_SLOTS = [
  { k: 'sig', n: 'Signature color', d: 'Your main color. It leads on every card.' },
  { k: 'second', n: 'Second color', d: 'Supports the main one.' },
  { k: 'accent', n: 'Accent', d: 'The pop. Use it sparingly.' },
] as const

export type PaletteKey = (typeof PALETTE_SLOTS)[number]['k']
