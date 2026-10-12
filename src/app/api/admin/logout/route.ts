import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin-session'

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  const res = NextResponse.redirect(url, 303)
  res.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' })
  res.cookies.set('admin_authed', '', { maxAge: 0, path: '/' }) // old cookie, if present
  return res
}
