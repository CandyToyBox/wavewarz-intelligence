import { createAdminClient } from '@/lib/supabase/server'
import { getArtistBible, type ArtistBible } from '@/lib/booker-card'
import { loadPlaybook, type PlaybookSnapshot } from '@/lib/playbook/data'
import { CATEGORY_MODULE, HUB_MAP, type Target } from '@/lib/playbook/hub-map'
import { cleanValue, describeValue, normHex, partCount, type Answers, type AnswerValue, type FileItem, type Palette } from '@/lib/playbook/logic'
import { MODULES, PARTS, PALETTE_SLOTS, type PartType } from '@/lib/playbook/spec'

// Turns an artist's draft answers into a reviewable plan: what each answer would
// change in the Hub, what the Hub holds today, and whether those two disagree.
// Pure decisions live here; the writes are in src/app/hub/playbook-actions.ts.

export type ReviewStatus = 'new' | 'accepted' | 'changed' | 'skipped'

export type AssetItem = {
  kind: 'file' | 'link'
  /** Stable URL stored on the Assets row. Uploaded files point at the admin-only file route. */
  url: string
  title: string
  assetType: string
  fileType?: string
  fileId?: string
}

export type AssetRow = {
  category: string
  title: string
  url: string
  assetType: string
  notes: string
  whyAdded: string
  moduleKey: string | null
}

export type Plan = {
  target: Target
  /** Text the admin can edit before accepting (text-like targets only). */
  proposed: string
  editable: boolean
  /** What the Hub holds today for this destination, for display. */
  current: string | null
  /** The Hub already has a different value here, so accepting replaces it. */
  conflict: boolean
  /** Writes to make on accept. */
  bibleSet: Record<string, unknown>
  extrasSet: Record<string, string> | null
  assetRows: AssetRow[]
}

export const FILE_ROUTE = '/hub/playbook-file/'

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().replace(/\s+/g, ' ') === (b ?? '').trim().replace(/\s+/g, ' ')

export function answerItems(fieldKey: string, value: AnswerValue): AssetItem[] {
  const ref = PARTS[fieldKey]
  if (!ref) return []
  const out: AssetItem[] = []
  if (ref.part.t === 'urls' && Array.isArray(value)) {
    for (const u of value as string[]) out.push({ kind: 'link', url: u, title: linkTitle(u), assetType: 'link' })
  } else if (ref.part.t === 'files' && Array.isArray(value)) {
    for (const it of value as FileItem[]) {
      if (it.kind === 'link') out.push({ kind: 'link', url: it.url, title: linkTitle(it.url), assetType: 'link' })
      else {
        out.push({
          kind: 'file',
          url: FILE_ROUTE + it.id,
          title: it.name,
          assetType: it.type.startsWith('image/') ? 'image' : it.type.startsWith('video/') ? 'video' : it.type === 'application/pdf' ? 'doc' : 'link',
          fileType: it.type,
          fileId: it.id,
        })
      }
    }
  }
  return out
}

function linkTitle(u: string): string {
  try {
    const x = new URL(u)
    const path = x.pathname === '/' ? '' : x.pathname
    return (x.hostname.replace(/^www\./, '') + path).slice(0, 90)
  } catch {
    return u.slice(0, 90)
  }
}

/** A stable fingerprint of an answer, for "has it changed since it was reviewed". */
export function valueKey(fieldKey: string, value: AnswerValue): string {
  const ref = PARTS[fieldKey]
  if (!ref) return ''
  const v = cleanValue(ref.part, value)
  if (v === null || v === undefined) return ''
  if (ref.part.t === 'files') return JSON.stringify((v as FileItem[]).map(i => (i.kind === 'file' ? `f:${i.id}` : `l:${i.url}`)))
  if (ref.part.t === 'palette') {
    const p = v as Palette
    return JSON.stringify([p.sig ?? null, p.second ?? null, p.accent ?? null])
  }
  return JSON.stringify(v)
}

export function paletteSummary(p: Palette | null | undefined): string {
  if (!p) return ''
  return PALETTE_SLOTS.filter(s => normHex(p[s.k])).map(s => `${s.n} ${normHex(p[s.k])}`).join(' · ')
}

type PlanInput = {
  fieldKey: string
  value: AnswerValue
  bible: ArtistBible
  extras: Record<string, string>
  existingAssetUrls: Set<string>
  /** Edited text from the admin ("Edit then accept"). */
  edited?: string
  question: string
  moduleOrder: number
  qNum: number
}

export function planAccept(inp: PlanInput): Plan | null {
  const target = HUB_MAP[inp.fieldKey]
  const ref = PARTS[inp.fieldKey]
  if (!target || !ref) return null
  const text = describeValue(ref.part, inp.value)
  const plan: Plan = { target, proposed: text, editable: false, current: null, conflict: false, bibleSet: {}, extrasSet: null, assetRows: [] }
  const finalText = (inp.edited ?? text).trim()

  switch (target.kind) {
    case 'bible': {
      const cur = (inp.bible[target.col] as string | null) ?? ''
      plan.editable = true
      plan.current = cur || null
      plan.conflict = !!cur.trim() && !same(cur, finalText)
      plan.bibleSet = { [target.col]: finalText || null }
      return plan
    }
    case 'extra': {
      const cur = inp.extras[inp.fieldKey] ?? ''
      plan.editable = true
      plan.current = cur || null
      plan.conflict = !!cur.trim() && !same(cur, finalText)
      plan.extrasSet = { [inp.fieldKey]: finalText }
      return plan
    }
    case 'sponsor_fit': {
      const cur = (inp.bible.sponsor_fit ?? []).join('\n')
      plan.editable = true
      plan.current = cur || null
      plan.conflict = !!cur.trim() && !same(cur, finalText)
      plan.bibleSet = { sponsor_fit: finalText.split('\n').map(x => x.trim()).filter(Boolean) }
      return plan
    }
    case 'palette': {
      const pal = (inp.value && typeof inp.value === 'object' && !Array.isArray(inp.value) ? inp.value : {}) as Palette
      const map = { sig: 'signature', second: 'secondary', accent: 'accent' } as const
      const existing = inp.bible.colors ?? {}
      const next: Record<string, string> = { ...existing }
      let conflict = false
      for (const s of PALETTE_SLOTS) {
        const hex = normHex(pal[s.k])
        if (!hex) continue
        const old = existing[map[s.k]]
        if (old && old.trim() && old.trim().toUpperCase() !== hex) conflict = true
        next[map[s.k]] = hex
      }
      plan.proposed = paletteSummary(pal)
      plan.current = Object.entries(existing).map(([k, v]) => `${k} ${v}`).join(' · ') || null
      plan.conflict = conflict
      plan.bibleSet = { colors: next }
      return plan
    }
    case 'logo':
    case 'sting':
    case 'assets': {
      const items = answerItems(inp.fieldKey, inp.value)
      const category = target.kind === 'logo' ? 'Logos' : target.kind === 'sting' ? 'THE WALK' : target.category
      const note = target.kind === 'assets' ? target.note : undefined
      const rowItems = target.kind === 'sting' ? items.slice(1) : items
      for (const it of rowItems) {
        if (inp.existingAssetUrls.has(it.url)) continue
        const cat = target.kind === 'assets' && target.pdfCategory && it.fileType === 'application/pdf' ? target.pdfCategory : category
        plan.assetRows.push({
          category: cat,
          title: it.title,
          url: it.url,
          assetType: it.assetType,
          notes: `${note ? `${note}. ` : ''}From the artist Playbook, question ${inp.qNum}.`,
          whyAdded: `From the Founding Artists Playbook, module ${inp.moduleOrder}: "${inp.question}"`,
          moduleKey: CATEGORY_MODULE[cat] ?? null,
        })
      }
      if (target.kind === 'logo' && items[0]) {
        const cur = inp.bible.logo_url ?? ''
        plan.current = cur || null
        plan.conflict = !!cur.trim() && cur.trim() !== items[0].url
        plan.bibleSet = { logo_url: items[0].url }
      } else if (target.kind === 'sting' && items[0]) {
        const a = inp.bible.entrance_sting_url ?? ''
        const b = inp.bible.walk_cue_url ?? ''
        plan.current = [a, b].filter(Boolean).join(' · ') || null
        plan.conflict = (!!a.trim() && a.trim() !== items[0].url) || (!!b.trim() && b.trim() !== items[0].url)
        plan.bibleSet = { entrance_sting_url: items[0].url, walk_cue_url: items[0].url }
      } else {
        const have = items.filter(it => inp.existingAssetUrls.has(it.url)).length
        plan.current = items.length ? `${have} of ${items.length} already in Assets` : null
      }
      plan.proposed = items.map(i => i.title).join('\n')
      return plan
    }
  }
}

// ─── Loading everything for one artist ───────────────────────────────────────

export type ReviewField = {
  fieldKey: string
  moduleKey: string
  qNum: number
  question: string
  caption?: string
  type: PartType
  value: AnswerValue
  items: (AssetItem & { previewUrl?: string })[]
  text: string
  dest: string
  targetKind: Target['kind']
  proposed: string
  current: string | null
  conflict: boolean
  editable: boolean
  status: ReviewStatus
  assetsToAdd: number
  reviewedAt: string | null
}

export type ArtistReview = {
  snapshot: PlaybookSnapshot
  bible: ArtistBible
  extras: Record<string, string>
  fields: ReviewField[]
}

export async function loadArtistReview(artistId: string, opts: { signUrls?: boolean } = {}): Promise<ArtistReview> {
  const supabase = createAdminClient()
  const [snapshot, bible, bibleRow, assetsRes, reviewsRes] = await Promise.all([
    loadPlaybook(artistId, opts),
    getArtistBible(artistId),
    supabase.from('artist_bibles').select('playbook_extras').eq('artist_id', artistId).maybeSingle(),
    supabase.from('content_assets').select('url').eq('artist_id', artistId),
    supabase.from('playbook_reviews').select('field_key,status,answer_snapshot,reviewed_at').eq('artist_id', artistId),
  ])
  const extras = ((bibleRow.data?.playbook_extras as Record<string, string> | null) ?? {})
  const existing = new Set((assetsRes.data ?? []).map(a => a.url as string).filter(Boolean))
  const reviews = new Map((reviewsRes.data ?? []).map(r => [r.field_key as string, r]))

  const fields: ReviewField[] = []
  for (const m of MODULES) {
    for (let qi = 0; qi < m.qs.length; qi++) {
      const q = m.qs[qi]
      for (const p of q.parts) {
        const value = snapshot.answers[p.id]
        if (partCount(p, value) === 0) continue
        const plan = planAccept({
          fieldKey: p.id, value, bible, extras, existingAssetUrls: existing,
          question: q.label, moduleOrder: m.order, qNum: qi + 1,
        })
        if (!plan) continue
        const rev = reviews.get(p.id)
        const status: ReviewStatus = !rev
          ? 'new'
          : valueKey(p.id, rev.answer_snapshot as AnswerValue) === valueKey(p.id, value)
            ? (rev.status as 'accepted' | 'skipped')
            : 'changed'
        const items = answerItems(p.id, cleanValue(p, value)).map(it => ({
          ...it,
          previewUrl: it.fileId ? snapshot.fileUrls[it.fileId] : undefined,
        }))
        fields.push({
          fieldKey: p.id,
          moduleKey: m.key,
          qNum: qi + 1,
          question: q.label,
          caption: p.cap,
          type: p.t,
          value,
          items,
          text: describeValue(p, value),
          dest: plan.target.dest,
          targetKind: plan.target.kind,
          proposed: plan.proposed,
          current: plan.current,
          conflict: plan.conflict,
          editable: plan.editable,
          status,
          assetsToAdd: plan.assetRows.length,
          reviewedAt: rev?.reviewed_at ?? null,
        })
      }
    }
  }
  return { snapshot, bible, extras, fields }
}

export type { Answers }
