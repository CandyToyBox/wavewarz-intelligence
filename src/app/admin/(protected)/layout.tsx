export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Second line of defence: src/proxy.ts already refuses unauthenticated requests
  // before anything renders. The cookie is a signed session, not a fixed value.
  const cookieStore = await cookies()
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE)?.value))) redirect('/admin/login')
  return <>{children}</>
}
