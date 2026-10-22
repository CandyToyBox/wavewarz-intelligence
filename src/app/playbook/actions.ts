'use server'

import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { requireArtist } from '@/lib/playbook/session'
import { PLAYBOOK_BUCKET, filesOf, loadPlaybook, signFileUrls } from '@/lib/playbook/data'
import {
  cleanValue,
  fileAllowed,
  isUrl,
  mimeFromName,
  moduleHash,
  normUrl,
  type FileItem,
} from '@/lib/playbook/logic'
import { HELP_KEYS, MAX_UPLOAD_BYTES, MODULE_BY_KEY, NAME_KEY, PARTS } from '@/lib/playbook/spec'

// Everything the artist's page can do. Each action starts with requireArtist():
// the artist id comes from the signed cookie, never from the arguments.

type Result = { ok: boolean; error?: string }

const MAX_TEXT = 10_000
const MAX_NOTE = 2_000
const MAX_NAME = 120

export type SavePayload = {
  /** field id -> new value. Upload fields are not accepted here (they have their own actions). */
  values?: Record<string, unknown>
  name?: string
  /** question key -> wants help */
  help?: Record<string, boolean>
  /** module key -> note */
  notes?: Record<string, string>
}

export async function saveProgress(payload: SavePayload): Promise<Result & { savedAt?: string }> {
  const { artistId } = await requireArtist()
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const upserts: { artist_id: string; field_key: string; value: unknown; updated_at: string; updated_by: string }[] = []
  const deletes: string[] = []

  for (const [id, raw] of Object.entries(payload.values ?? {})) {
    const ref = PARTS[id]
    if (!ref || ref.part.t === 'files') continue // unknown field, or an upload field (own actions)
    if (ref.part.t === 'text' && typeof raw === 'string' && raw.length > MAX_TEXT) {
      return { ok: false, error: 'One of your answers is too long.' }
    }
    const v = cleanValue(ref.part, raw)
    if (v === null || v === undefined) deletes.push(id)
    else upserts.push({ artist_id: artistId, field_key: id, value: v, updated_at: now, updated_by: 'artist' })
  }

  if (typeof payload.name === 'string') {
    const name = payload.name.trim().slice(0, MAX_NAME)
    if (name) upserts.push({ artist_id: artistId, field_key: NAME_KEY, value: name, updated_at: now, updated_by: 'artist' })
    else deletes.push(NAME_KEY)
  }

  if (upserts.length) {
    const { error } = await supabase.from('playbook_answers').upsert(upserts, { onConflict: 'artist_id,field_key' })
    if (error) return { ok: false, error: error.message }
  }
  if (deletes.length) {
    const { error } = await supabase.from('playbook_answers').delete().eq('artist_id', artistId).in('field_key', deletes)
    if (error) return { ok: false, error: error.message }
  }

  // "I want help with this one"
  for (const [key, wants] of Object.entries(payload.help ?? {})) {
    const info = HELP_KEYS[key]
    if (!info) continue
    if (wants) {
      // Turning it on again after it was resolved reopens it.
      const { data: existing } = await supabase
        .from('playbook_help').select('id').eq('artist_id', artistId).eq('field_key', key).maybeSingle()
      if (!existing) {
        const { error } = await supabase.from('playbook_help').insert({ artist_id: artistId, module_key: info.module, field_key: key })
        if (error) return { ok: false, error: error.message }
      }
    } else {
      await supabase.from('playbook_help').delete().eq('artist_id', artistId).eq('field_key', key)
    }
  }

  // Per-module "anything else you want help with"
  for (const [moduleKey, rawNote] of Object.entries(payload.notes ?? {})) {
    if (!MODULE_BY_KEY[moduleKey]) continue
    const note = String(rawNote ?? '').trim().slice(0, MAX_NOTE)
    if (!note) {
      await supabase.from('playbook_help').delete().eq('artist_id', artistId).eq('module_key', moduleKey).is('field_key', null)
      continue
    }
    const { data: existing } = await supabase
      .from('playbook_help').select('id,note').eq('artist_id', artistId).eq('module_key', moduleKey).is('field_key', null).maybeSingle()
    if (!existing) {
      const { error } = await supabase.from('playbook_help').insert({ artist_id: artistId, module_key: moduleKey, note })
      if (error) return { ok: false, error: error.message }
    } else if (existing.note !== note) {
      // A changed note is new information: reopen it.
      await supabase.from('playbook_help').update({
        note, resolved: false, resolved_by: null, resolved_at: null, updated_at: now,
      }).eq('id', existing.id)
    }
  }

  return { ok: true, savedAt: now }
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
// Files go from the browser straight to Supabase Storage on a one-time signed
// URL (a serverless function cannot take a 20 MB body), then registerUpload
// confirms the object is really there and records it.

function safeName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-80)
  return cleaned || 'file'
}

export async function createUpload(input: {
  fieldKey: string
  fileName: string
  size: number
  type: string
}): Promise<Result & { path?: string; token?: string; contentType?: string }> {
  const { artistId } = await requireArtist()
  const ref = PARTS[input.fieldKey]
  if (!ref || ref.part.t !== 'files') return { ok: false, error: 'That question does not take files.' }
  if (!(input.size > 0)) return { ok: false, error: 'That file is empty.' }
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false, error: `${input.fileName} is over 20 MB. Paste a link to it instead.` }
  if (!fileAllowed(ref.part.accept, input.type, input.fileName)) {
    return { ok: false, error: `${input.fileName}: that file type cannot be uploaded here. Paste a link instead.` }
  }

  const current = await currentFiles(artistId, input.fieldKey)
  if (current.length >= (ref.part.max ?? 1)) return { ok: false, error: `You can add ${ref.part.max ?? 1} here.` }

  const contentType = input.type || mimeFromName(input.fileName)
  const path = `${artistId}/${input.fieldKey}/${randomUUID()}-${safeName(input.fileName)}`
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(PLAYBOOK_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { ok: false, error: 'Upload is not available right now. Paste a link instead.' }
  return { ok: true, path: data.path, token: data.token, contentType }
}

export async function registerUpload(input: {
  fieldKey: string
  path: string
  fileName: string
}): Promise<Result & { items?: FileItem[]; urls?: Record<string, string> }> {
  const { artistId } = await requireArtist()
  const ref = PARTS[input.fieldKey]
  if (!ref || ref.part.t !== 'files') return { ok: false, error: 'That question does not take files.' }
  // Only objects under this artist's own folder for this question.
  const prefix = `${artistId}/${input.fieldKey}/`
  if (!input.path.startsWith(prefix) || input.path.includes('..')) return { ok: false, error: 'Bad file path.' }

  const supabase = createAdminClient()
  const base = input.path.slice(prefix.length)
  const { data: found } = await supabase.storage.from(PLAYBOOK_BUCKET).list(`${artistId}/${input.fieldKey}`, { search: base, limit: 5 })
  const obj = (found ?? []).find(o => o.name === base)
  if (!obj) return { ok: false, error: 'The upload did not finish. Try again or paste a link.' }

  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string }
  const size = Number(meta.size ?? 0)
  const type = String(meta.mimetype ?? '') || mimeFromName(input.fileName)

  const current = await currentFiles(artistId, input.fieldKey)
  if (current.length >= (ref.part.max ?? 1)) {
    await supabase.storage.from(PLAYBOOK_BUCKET).remove([input.path])
    return { ok: false, error: `You can add ${ref.part.max ?? 1} here.` }
  }

  const { data: row, error } = await supabase
    .from('playbook_files')
    .insert({
      artist_id: artistId,
      field_key: input.fieldKey,
      storage_path: input.path,
      file_name: input.fileName.slice(0, 200),
      size_bytes: size,
      content_type: type,
    })
    .select('id')
    .single()
  if (error || !row) return { ok: false, error: 'Could not record the file. Try again.' }

  const item: FileItem = { kind: 'file', id: row.id, name: input.fileName.slice(0, 200), size, type }
  return writeFiles(artistId, input.fieldKey, [...current, item])
}

export async function addFileLink(fieldKey: string, url: string): Promise<Result & { items?: FileItem[]; urls?: Record<string, string> }> {
  const { artistId } = await requireArtist()
  const ref = PARTS[fieldKey]
  if (!ref || ref.part.t !== 'files') return { ok: false, error: 'That question does not take files.' }
  const clean = normUrl(url)
  if (!isUrl(clean)) return { ok: false, error: 'That does not look like a web link.' }
  const current = await currentFiles(artistId, fieldKey)
  if (current.length >= (ref.part.max ?? 1)) return { ok: false, error: `You can add ${ref.part.max ?? 1} here.` }
  return writeFiles(artistId, fieldKey, [...current, { kind: 'link', url: clean }])
}

export async function removeFileItem(fieldKey: string, index: number): Promise<Result & { items?: FileItem[]; urls?: Record<string, string> }> {
  const { artistId } = await requireArtist()
  const ref = PARTS[fieldKey]
  if (!ref || ref.part.t !== 'files') return { ok: false, error: 'That question does not take files.' }
  const current = await currentFiles(artistId, fieldKey)
  const gone = current[index]
  if (!gone) return { ok: true, items: current, urls: await urlsFor(artistId, current) }

  const supabase = createAdminClient()
  if (gone.kind === 'file') {
    const { data: row } = await supabase
      .from('playbook_files').select('storage_path').eq('id', gone.id).eq('artist_id', artistId).maybeSingle()
    if (row) {
      await supabase.storage.from(PLAYBOOK_BUCKET).remove([row.storage_path])
      await supabase.from('playbook_files').delete().eq('id', gone.id).eq('artist_id', artistId)
    }
  }
  return writeFiles(artistId, fieldKey, current.filter((_, i) => i !== index))
}

async function currentFiles(artistId: string, fieldKey: string): Promise<FileItem[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('playbook_answers').select('value').eq('artist_id', artistId).eq('field_key', fieldKey).maybeSingle()
  return filesOf(data?.value)
}

async function writeFiles(artistId: string, fieldKey: string, items: FileItem[]) {
  const supabase = createAdminClient()
  if (items.length) {
    const { error } = await supabase.from('playbook_answers').upsert(
      { artist_id: artistId, field_key: fieldKey, value: items, updated_at: new Date().toISOString(), updated_by: 'artist' },
      { onConflict: 'artist_id,field_key' },
    )
    if (error) return { ok: false as const, error: error.message }
  } else {
    await supabase.from('playbook_answers').delete().eq('artist_id', artistId).eq('field_key', fieldKey)
  }
  return { ok: true as const, items, urls: await urlsFor(artistId, items) }
}

async function urlsFor(artistId: string, items: FileItem[]): Promise<Record<string, string>> {
  const ids = items.filter((i): i is Extract<FileItem, { kind: 'file' }> => i.kind === 'file').map(i => i.id)
  if (!ids.length) return {}
  const supabase = createAdminClient()
  const { data } = await supabase.from('playbook_files').select('id,storage_path').eq('artist_id', artistId).in('id', ids)
  return signFileUrls(data ?? [])
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export async function submitModule(moduleKey: string): Promise<Result & { at?: string; hash?: string }> {
  const { artistId } = await requireArtist()
  const mod = MODULE_BY_KEY[moduleKey]
  if (!mod) return { ok: false, error: 'Unknown module.' }

  // Hash what is stored, not what the browser says, so the status cannot be faked.
  const snap = await loadPlaybook(artistId)
  if (!snap.name.trim()) return { ok: false, error: 'Add your artist name at the top of the page first.' }
  const hash = moduleHash(mod, snap.answers, snap.help)

  const supabase = createAdminClient()
  const at = new Date().toISOString()
  const { error } = await supabase.from('playbook_submissions').upsert(
    {
      artist_id: artistId,
      module_key: moduleKey,
      submitted_at: at,
      content_hash: hash,
      submit_count: (snap.submissions[moduleKey]?.count ?? 0) + 1,
    },
    { onConflict: 'artist_id,module_key' },
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true, at, hash }
}
