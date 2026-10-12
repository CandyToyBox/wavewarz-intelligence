import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

// Gate for the internal areas. This runs BEFORE any page renders, so an anonymous
// request never reaches the admin or hub code that loads data.
//
// Why it exists: the earlier check lived only in the layouts. Pages render in
// parallel with their layout, so an anonymous request got a redirect AND the
// dashboard data in the same response (found 2026-10-12). Server actions repeat
// the check themselves as a second line (they can be called directly).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // The login page must stay reachable.
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return NextResponse.next()

  const ok = await verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (ok) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  // Server action calls and other non-page requests: refuse outright.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const login = req.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  const res = NextResponse.redirect(login, 307)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

export const config = {
  matcher: ['/admin/:path*', '/hub/:path*'],
}
