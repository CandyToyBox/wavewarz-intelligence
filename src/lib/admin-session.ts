// Signed admin session.
//
// The cookie value is `v1.<expiry>.<signature>`, where the signature is
// HMAC-SHA256(ADMIN_SECRET, "admin-session:v1:<expiry>"). A valid cookie cannot be
// produced without ADMIN_SECRET. The previous cookie was the fixed text
// "admin_authed=1", which anyone could send to be treated as logged in.
//
// Web Crypto only, so the same code runs in the proxy, in server components and in
// server actions. Rotating ADMIN_SECRET signs everyone out.

export const ADMIN_COOKIE = 'admin_session'
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8 // 8 hours, same as before

const enc = new TextEncoder()

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
  // Refuse to issue or accept sessions when the secret is missing or trivially short.
  if (!secret || secret.length < 16) return null
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])
}

function message(exp: number): Uint8Array {
  return enc.encode(`admin-session:v1:${exp}`)
}

/** Issue a session token, or null if ADMIN_SECRET is not configured. */
export async function createAdminSessionToken(now: number = Date.now()): Promise<string | null> {
  const key = await importKey('sign')
  if (!key) return null
  const exp = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, message(exp) as BufferSource))
  return `v1.${exp}.${toBase64Url(sig)}`
}

/** True only for an unexpired token signed with the current ADMIN_SECRET. */
export async function verifyAdminSessionToken(token: string | null | undefined, now: number = Date.now()): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const exp = Number(parts[1])
  if (!Number.isInteger(exp)) return false
  const nowSec = Math.floor(now / 1000)
  if (exp < nowSec) return false // expired
  if (exp > nowSec + ADMIN_SESSION_SECONDS + 60) return false // lifetime longer than we ever issue
  const sig = fromBase64Url(parts[2])
  if (!sig) return false
  const key = await importKey('verify')
  if (!key) return false
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', key, sig as BufferSource, message(exp) as BufferSource)
}
