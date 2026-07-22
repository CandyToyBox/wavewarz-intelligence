import { createAdminClient } from '@/lib/supabase/admin'

// Failure-based brute-force lockout, backed by Postgres rather than in-memory
// state — Vercel serverless functions don't share memory across invocations,
// so an in-process counter would reset on every cold start. Only failed
// attempts are recorded, so legitimate high-frequency callers (e.g. the
// webhook, once authenticated with the correct secret) are never throttled.

export async function isRateLimited(
  bucket: string,
  opts?: { max?: number; windowSeconds?: number }
): Promise<boolean> {
  const max = opts?.max ?? 5
  const windowSeconds = opts?.windowSeconds ?? 15 * 60
  const supabase = await createAdminClient()
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()
  const { count } = await supabase
    .from('auth_failures')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('created_at', since)
  return (count ?? 0) >= max
}

export async function recordFailure(bucket: string): Promise<void> {
  const supabase = await createAdminClient()
  await supabase.from('auth_failures').insert({ bucket })
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

// Constant-time comparison so response timing doesn't leak how many leading
// characters of a guessed secret were correct.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
