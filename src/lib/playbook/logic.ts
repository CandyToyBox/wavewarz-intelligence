import { PALETTE_SLOTS, type Check, type Part, type PlaybookModule, questionKey } from './spec'

// Pure rules shared by the artist's browser and the server (so a hash computed in
// one place always matches the other). No imports from React, Next or Supabase.

export type FileItem =
  | { kind: 'file'; id: string; name: string; size: number; type: string }
  | { kind: 'link'; url: string }

export type Palette = { sig?: string; second?: string; accent?: string }

export type AnswerValue = string | string[] | FileItem[] | Palette | null | undefined
export type Answers = Record<string, AnswerValue>

export type HelpState = {
  /** question key -> wants help */
  fields: Record<string, boolean>
  /** module key -> note */
  notes: Record<string, string>
}

export type ModuleStatus = 'none' | 'progress' | 'ready' | 'submitted' | 'edited'

export const STATUS_TEXT: Record<ModuleStatus, string> = {
  none: 'Not started',
  progress: 'In progress',
  ready: 'Ready to submit',
  submitted: 'Submitted',
  edited: 'Edited since submitting',
}

// ---------- small helpers ----------

export function normUrl(s: string | null | undefined): string {
  s = (s ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(s) || /^www\./i.test(s)) return 'https://' + s
  return s
}

export function isUrl(s: string | null | undefined): boolean {
  return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s ?? '')
}

/** Accepts 3 or 6 hex digits, with or without '#'. Returns '#RRGGBB' uppercase, or ''. */
export function normHex(s: string | null | undefined): string {
  let h = (s ?? '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : ''
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}

/** Readable text color to put on top of this background. */
export function inkOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#0d1321' : '#ffffff'
}

export function formatBytes(n: number): string {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
}

// ---------- values ----------

/**
 * Normalizes one answer for storage and hashing. Blank text, empty lists and an
 * empty palette all become null. Never trusts the shape it is given.
 */
export function cleanValue(p: Part, v: unknown): AnswerValue {
  switch (p.t) {
    case 'text': {
      if (typeof v !== 'string') return null
      return v.trim() ? v : null
    }
    case 'urls': {
      if (!Array.isArray(v)) return null
      const out = v.filter((x): x is string => typeof x === 'string').map(normUrl).filter(Boolean)
      return out.length ? out.slice(0, p.max ?? 1) : null
    }
    case 'files': {
      if (!Array.isArray(v)) return null
      const out: FileItem[] = []
      for (const it of v) {
        if (!it || typeof it !== 'object') continue
        const o = it as Record<string, unknown>
        if (o.kind === 'link' && typeof o.url === 'string' && /^https?:\/\//i.test(o.url)) {
          out.push({ kind: 'link', url: o.url })
        } else if (o.kind === 'file' && typeof o.id === 'string' && typeof o.name === 'string') {
          out.push({
            kind: 'file',
            id: o.id,
            name: o.name,
            size: typeof o.size === 'number' ? o.size : 0,
            type: typeof o.type === 'string' ? o.type : '',
          })
        }
      }
      return out.length ? out.slice(0, p.max ?? 1) : null
    }
    case 'palette': {
      if (!v || typeof v !== 'object') return null
      const o = v as Record<string, unknown>
      const out: Palette = {}
      for (const s of PALETTE_SLOTS) {
        const hex = normHex(typeof o[s.k] === 'string' ? (o[s.k] as string) : '')
        if (hex) out[s.k] = hex
      }
      return Object.keys(out).length ? out : null
    }
    case 'choice': {
      const opts = p.opts ?? []
      if (p.multi) {
        if (!Array.isArray(v)) return null
        const out = opts.filter(o => v.includes(o))
        return out.length ? out : null
      }
      return typeof v === 'string' && opts.includes(v) ? v : null
    }
  }
}

/** How many "units" of this field are filled (for min/max rules). */
export function partCount(p: Part, v: AnswerValue): number {
  switch (p.t) {
    case 'text':
      return typeof v === 'string' && v.trim() ? 1 : 0
    case 'urls':
      return Array.isArray(v) ? (v as string[]).filter(x => isUrl(normUrl(x))).length : 0
    case 'files':
      return Array.isArray(v) ? v.length : 0
    case 'choice':
      return p.multi ? (Array.isArray(v) ? v.length : 0) : v ? 1 : 0
    case 'palette': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return 0
      return PALETTE_SLOTS.filter(s => normHex((v as Palette)[s.k])).length
    }
  }
}

export function need(p: Part): number {
  return p.t === 'palette' ? 3 : p.min ?? 1
}

export function isFilled(p: Part, v: AnswerValue): boolean {
  return partCount(p, v) >= need(p)
}

type PartLookup = (id: string) => Part | undefined

export function checkDone(c: Check, answers: Answers, part: PartLookup): boolean {
  const filled = (id: string) => {
    const p = part(id)
    return p ? isFilled(p, answers[id]) : false
  }
  let ok = true
  if (c.all) ok = c.all.every(filled)
  if (ok && c.any) ok = c.any.some(filled)
  return ok
}

export function moduleParts(m: PlaybookModule): Part[] {
  return m.qs.flatMap(q => q.parts)
}

export function checksDone(m: PlaybookModule, answers: Answers): boolean[] {
  const byId = new Map(moduleParts(m).map(p => [p.id, p]))
  return m.checks.map(c => checkDone(c, answers, id => byId.get(id)))
}

export type QStatus = 'done' | 'todo' | 'opt'

/** Done when the checklist items it feeds are met; To do when it feeds an unmet one; else Optional. */
export function questionStatus(m: PlaybookModule, qIndex: number, answers: Answers): QStatus {
  const q = m.qs[qIndex]
  const ids = q.parts.map(p => p.id)
  const byId = new Map(moduleParts(m).map(p => [p.id, p]))
  const filled = (id: string) => {
    const p = byId.get(id)
    return p ? isFilled(p, answers[id]) : false
  }
  let referenced = false
  let ok = true
  for (const c of m.checks) {
    const a = (c.all ?? []).filter(i => ids.includes(i))
    const n = (c.any ?? []).filter(i => ids.includes(i))
    if (a.length) {
      referenced = true
      if (!a.every(filled)) ok = false
    }
    if (n.length) {
      referenced = true
      if (!n.some(filled)) ok = false
    }
  }
  if (referenced) return ok ? 'done' : 'todo'
  return q.parts.some(p => partCount(p, answers[p.id]) > 0) ? 'done' : 'opt'
}

/** "Question 3" or "Questions 1, 2 and 4" */
export function questionRef(c: Check): string {
  const n = c.qi.map(i => i + 1)
  return n.length > 1 ? `Questions ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : `Question ${n[0]}`
}

// ---------- hashing (detects "edited since submitting") ----------

/** Stable snapshot of everything the artist can change in a module. */
export function moduleSnapshot(m: PlaybookModule, answers: Answers, help: HelpState): string {
  const o: Record<string, unknown> = {}
  for (const q of m.qs) {
    for (const p of q.parts) {
      const v = cleanValue(p, answers[p.id])
      if (p.t === 'palette' && v) {
        const pal = v as Palette
        o[p.id] = [pal.sig ?? null, pal.second ?? null, pal.accent ?? null]
      } else if (p.t === 'files' && v) {
        // Only what identifies each item, so size/type metadata drift cannot flip the status.
        o[p.id] = (v as FileItem[]).map(it => (it.kind === 'file' ? `f:${it.id}` : `l:${it.url}`))
      } else {
        o[p.id] = v ?? null
      }
    }
    o['h:' + questionKey(q)] = !!help.fields[questionKey(q)]
  }
  o.note = (help.notes[m.key] ?? '').trim()
  return JSON.stringify(o)
}

/** cyrb53: small, fast, good spread. Same result in the browser and on the server. */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function moduleHash(m: PlaybookModule, answers: Answers, help: HelpState): string {
  return hashString(moduleSnapshot(m, answers, help))
}

export function moduleStatus(
  m: PlaybookModule,
  answers: Answers,
  help: HelpState,
  submittedHash: string | null | undefined,
): ModuleStatus {
  if (submittedHash) return submittedHash === moduleHash(m, answers, help) ? 'submitted' : 'edited'
  const any = moduleParts(m).some(p => partCount(p, answers[p.id]) > 0)
  if (checksDone(m, answers).every(Boolean)) return 'ready'
  return any ? 'progress' : 'none'
}

// ---------- plain-text backup ----------

export function describeValue(p: Part, v: AnswerValue): string {
  switch (p.t) {
    case 'text':
      return typeof v === 'string' ? v.trim() : ''
    case 'urls':
      return Array.isArray(v) ? (v as string[]).map(normUrl).filter(isUrl).join('\n') : ''
    case 'files':
      return Array.isArray(v)
        ? (v as FileItem[]).map(it => (it.kind === 'link' ? it.url : `${it.name} (uploaded to the playbook)`)).join('\n')
        : ''
    case 'choice':
      return Array.isArray(v) ? (v as string[]).join(', ') : typeof v === 'string' ? v : ''
    case 'palette': {
      if (!v || typeof v !== 'object' || Array.isArray(v) || !partCount(p, v)) return ''
      return PALETTE_SLOTS.map(s => `${s.n}: ${normHex((v as Palette)[s.k]) || 'not chosen'}`).join('\n')
    }
  }
}

export function buildBackupText(
  modules: PlaybookModule[],
  name: string,
  answers: Answers,
  help: HelpState,
  submitted: Record<string, string | null | undefined>,
): string {
  const out = ['WaveWarZ Founding Artists and Repertoire Playbook', `Artist: ${name.trim() || '(not entered)'}`, '']
  for (const m of modules) {
    out.push(`MODULE ${m.order}: ${m.title} (${STATUS_TEXT[moduleStatus(m, answers, help, submitted[m.key])].toLowerCase()})`)
    for (const q of m.qs) {
      const parts = q.parts.map(p => describeValue(p, answers[p.id])).filter(Boolean)
      const wants = help.fields[questionKey(q)]
      if (parts.length || wants) {
        out.push(`Q: ${q.label}`)
        if (parts.length) out.push(`A: ${parts.join('\n')}`)
        if (wants) out.push('WANTS HELP WITH THIS')
      }
    }
    const note = (help.notes[m.key] ?? '').trim()
    if (note) out.push(`Help wanted: ${note}`)
    out.push('')
  }
  return out.join('\n')
}

// ---------- uploads ----------

/** Does a file (by MIME type, falling back to extension) match a part's `accept` string? */
export function fileAllowed(accept: string | undefined, mime: string, fileName: string): boolean {
  const tokens = (accept ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  if (!tokens.length) return true
  const type = mime.toLowerCase() || mimeFromName(fileName)
  const ext = '.' + (fileName.split('.').pop() ?? '').toLowerCase()
  return tokens.some(t => {
    if (t.startsWith('.')) return ext === t
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1))
    return type === t
  })
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf',
}

export function mimeFromName(fileName: string): string {
  return EXT_MIME[(fileName.split('.').pop() ?? '').toLowerCase()] ?? ''
}
