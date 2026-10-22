import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

// Same check the Hub's other server actions make (see src/app/hub/actions.ts):
// a server action can be called directly once its id is known, so each one
// re-verifies the signed admin cookie itself.
export async function requireAdmin(): Promise<void> {
  const store = await cookies()
  if (!(await verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value))) throw new Error('Unauthorized')
}
