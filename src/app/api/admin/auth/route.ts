import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited, recordFailure, clientIp, timingSafeEqual } from '@/lib/rate-limit'

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
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_authed', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })
  return res
}
