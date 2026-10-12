import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited, recordFailure, clientIp, timingSafeEqual } from '@/lib/rate-limit'
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSessionToken } from '@/lib/admin-session'

export async function POST(req: NextRequest) {
  const bucket = `admin_auth:${clientIp(req)}`
  if (await isRateLimited(bucket)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { secret } = await req.json()
  if (typeof secret !== 'string' || !timingSafeEqual(secret, process.env.ADMIN_SECRET ?? '')) {
    await recordFailure(bucket)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = await createAdminSessionToken()
  if (!token) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 503 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_SECONDS,
    path: '/',
  })
  // Retire the old forgeable cookie if a browser still has it.
  res.cookies.set('admin_authed', '', { maxAge: 0, path: '/' })
  return res
}
