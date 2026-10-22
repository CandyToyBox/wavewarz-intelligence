import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  PLAYBOOK_COOKIE,
  PLAYBOOK_SESSION_SECONDS,
  createPlaybookSessionToken,
  sha256Hex,
} from '@/lib/playbook/session'

// The private link an artist opens: /playbook/enter/<token>. A valid token sets
// the signed session cookie and sends them to their own playbook. The token is
// not used up, so a link preview bot or a second device does not break it; the
// admin revokes or replaces it from the Hub when needed.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const back = (path: string) => {
    const res = NextResponse.redirect(new URL(path, req.url), 303)
    res.headers.set('Cache-Control', 'private, no-store')
    res.headers.set('Referrer-Policy', 'no-referrer')
    return res
  }

  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return back('/playbook?link=invalid')

  const supabase = createAdminClient()
  const { data: invite } = await supabase
    .from('playbook_invites')
    .select('id,artist_id,revoked_at')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle()
  if (!invite || invite.revoked_at) return back('/playbook?link=invalid')

  const session = await createPlaybookSessionToken(invite.artist_id, invite.id)
  if (!session) return back('/playbook?link=unavailable')

  await supabase.from('playbook_invites').update({ last_used_at: new Date().toISOString() }).eq('id', invite.id)

  const res = back('/playbook')
  res.cookies.set(PLAYBOOK_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/playbook',
    maxAge: PLAYBOOK_SESSION_SECONDS,
  })
  return res
}
