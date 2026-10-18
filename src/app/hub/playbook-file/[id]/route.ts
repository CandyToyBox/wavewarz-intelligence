import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { createAdminClient } from '@/lib/supabase/server'
import { PLAYBOOK_BUCKET } from '@/lib/playbook/data'

// Admin-only link to a file an artist uploaded in the Playbook. The Assets rows
// point here instead of at a storage URL, because the bucket is private and a
// signed URL expires. src/proxy.ts already gates /hub; this checks again.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  if (!(await verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value))) {
    return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  }
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 })

  const supabase = createAdminClient()
  const { data: file } = await supabase.from('playbook_files').select('storage_path').eq('id', id).maybeSingle()
  if (!file) return new NextResponse('Not found', { status: 404 })

  const { data } = await supabase.storage.from(PLAYBOOK_BUCKET).createSignedUrl(file.storage_path, 120)
  if (!data?.signedUrl) return new NextResponse('File unavailable', { status: 502 })

  const res = NextResponse.redirect(data.signedUrl, 302)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}
