export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Simple cookie-based gate — checked on every admin render
  const hdrs = await headers()
  const cookie = hdrs.get('cookie') ?? ''
  const authed = cookie.includes('admin_authed=1')
  if (!authed) redirect('/admin/login')
  return <>{children}</>
}
