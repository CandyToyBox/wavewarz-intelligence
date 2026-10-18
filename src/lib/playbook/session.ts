import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

// Artist sign-in for the Playbook.
//
// Artists have no account. Candy (or an editor) creates a private link for an
// artist in the Hub; opening it sets a signed cookie that names exactly ONE
// artist. Every playbook read and write takes artist_id from this cookie, never
// from anything the browser sends, which is what keeps one artist away from
// another's answers.
//
// Only the SHA-256 of the link token is stored, so a database leak does not leak
// working links. Revoking or replacing a link signs that artist out on their next
// request: the cookie is re-checked against the invite row every time.
//
// The cookie is HMAC-SHA256(ADMIN_SECRET, "playbook-session:v1:<artist>:<invite>:<exp>").
// The message prefix differs from the admin session's, so one can never stand in
// for the other. Rotating ADMIN_SECRET signs everyone out of both.

export const PLAYBOOK_COOKIE = 'wwz_playbook'
export const PLAYBOOK_SESSION_SECONDS = 60 * 60 * 24 * 30 // 30 days

const enc = new TextEncoder()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function importKey(usage: 'sign' | 'verify'): Promise<CryptoKey | null> {
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) return null
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

function message(artistId: string, inviteId: string, exp: number): Uint8Array {
  return enc.encode(`playbook-session:v1:${artistId}:${inviteId}:${exp}`)
}

export async function createPlaybookSessionToken(
  artistId: string,
  inviteId: string,
  now: number = Date.now(),
): Promise<string | null> {
  const key = await importKey('sign')
  if (!key) return null
  const exp = Math.floor(now / 1000) + PLAYBOOK_SESSION_SECONDS
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, message(artistId, inviteId, exp) as BufferSource))
  return `v1.${artistId}.${inviteId}.${exp}.${toBase64Url(sig)}`
}

type Claim = { artistId: string; inviteId: string }

async function verifyToken(token: string | null | undefined, now: number = Date.now()): Promise<Claim | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') return null
  const [, artistId, inviteId, expRaw, sigRaw] = parts
  if (!UUID.test(artistId) || !UUID.test(inviteId)) return null
  const exp = Number(expRaw)
  if (!Number.isInteger(exp)) return null
  const nowSec = Math.floor(now / 1000)
  if (exp < nowSec) return null
  if (exp > nowSec + PLAYBOOK_SESSION_SECONDS + 60) return null
  const sig = fromBase64Url(sigRaw)
  if (!sig) return null
  const key = await importKey('verify')
  if (!key) return null
  const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, message(artistId, inviteId, exp) as BufferSource)
  return ok ? { artistId, inviteId } : null
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')
}

/** A fresh unguessable link token (256 bits). */
export function newInviteToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export type PlaybookArtist = { artistId: string; inviteId: string; displayName: string }

/**
 * The artist signed in on this request, or null. Checks the signature, then that
 * the invite is still live and still belongs to this artist.
 */
export async function getPlaybookArtist(): Promise<PlaybookArtist | null> {
  const store = await cookies()
  const claim = await verifyToken(store.get(PLAYBOOK_COOKIE)?.value)
  if (!claim) return null
  const supabase = createAdminClient()
  const { data: invite } = await supabase
    .from('playbook_invites')
    .select('id,artist_id,revoked_at')
    .eq('id', claim.inviteId)
    .maybeSingle()
  if (!invite || invite.revoked_at || invite.artist_id !== claim.artistId) return null
  const { data: artist } = await supabase
    .from('artist_profiles')
    .select('display_name')
    .eq('artist_id', claim.artistId)
    .maybeSingle()
  if (!artist) return null
  return { artistId: claim.artistId, inviteId: claim.inviteId, displayName: artist.display_name ?? '' }
}

/** For server actions: throws unless an artist is signed in. */
export async function requireArtist(): Promise<PlaybookArtist> {
  const a = await getPlaybookArtist()
  if (!a) throw new Error('Not signed in')
  return a
}
