import { createAdminClient } from '@/lib/supabase/server'
import type { Answers, FileItem, HelpState } from './logic'
import { NAME_KEY } from './spec'

// Reads shared by the artist's page and the admin review screen. Service-role
// client, so callers must already have decided who is allowed to see this artist.

export const PLAYBOOK_BUCKET = 'playbook'

export type PlaybookSnapshot = {
  name: string
  answers: Answers
  help: HelpState
  /** module key -> latest submit */
  submissions: Record<string, { at: string; hash: string; count: number }>
  /** file id -> short-lived URL for thumbnails and links */
  fileUrls: Record<string, string>
  updatedAt: string | null
}

export async function loadPlaybook(artistId: string, opts: { signUrls?: boolean } = {}): Promise<PlaybookSnapshot> {
  const supabase = createAdminClient()
  const [answersRes, helpRes, subsRes, filesRes] = await Promise.all([
    supabase.from('playbook_answers').select('field_key,value,updated_at').eq('artist_id', artistId),
    supabase.from('playbook_help').select('field_key,module_key,note').eq('artist_id', artistId),
    supabase.from('playbook_submissions').select('module_key,submitted_at,content_hash,submit_count').eq('artist_id', artistId),
    supabase.from('playbook_files').select('id,storage_path').eq('artist_id', artistId),
  ])

  const answers: Answers = {}
  let name = ''
  let updatedAt: string | null = null
  for (const r of answersRes.data ?? []) {
    if (r.field_key === NAME_KEY) name = typeof r.value === 'string' ? r.value : ''
    else answers[r.field_key] = r.value as Answers[string]
    if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at
  }

  const help: HelpState = { fields: {}, notes: {} }
  for (const h of helpRes.data ?? []) {
    if (h.field_key) help.fields[h.field_key] = true
    else if (h.note) help.notes[h.module_key] = h.note
  }

  const submissions: PlaybookSnapshot['submissions'] = {}
  for (const s of subsRes.data ?? []) {
    submissions[s.module_key] = { at: s.submitted_at, hash: s.content_hash, count: s.submit_count }
  }

  const fileUrls = opts.signUrls === false ? {} : await signFileUrls(filesRes.data ?? [])
  return { name, answers, help, submissions, fileUrls, updatedAt }
}

export async function signFileUrls(files: { id: string; storage_path: string }[], seconds = 60 * 60): Promise<Record<string, string>> {
  if (!files.length) return {}
  const supabase = createAdminClient()
  const { data } = await supabase.storage.from(PLAYBOOK_BUCKET).createSignedUrls(files.map(f => f.storage_path), seconds)
  const byPath = new Map((data ?? []).map(d => [d.path, d.signedUrl]))
  const out: Record<string, string> = {}
  for (const f of files) {
    const u = byPath.get(f.storage_path)
    if (u) out[f.id] = u
  }
  return out
}

export function filesOf(v: unknown): FileItem[] {
  return Array.isArray(v) ? (v as FileItem[]) : []
}
