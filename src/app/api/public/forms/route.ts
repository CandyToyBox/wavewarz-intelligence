import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public forms API — the site's own forms (replaces the Tally form).
 *
 * POST https://wavewarz.info/api/public/forms
 * Body (JSON): { kind, name?, email?, phone?, smsConsent?, fields?, source?, website? }
 *
 * kind: featured_application | sponsorship | feedback | support | notify
 * `fields` holds the form-specific answers; only the keys listed in FIELD_KEYS
 * are kept. `website` is a honeypot: real people never fill it in.
 *
 * Write-only: nothing can be read back through this route. Submissions are
 * stored in form_submissions (service-role only) and read at /admin/inbox.
 * Limited to 5 submissions per hour per visitor.
 */

export const dynamic = 'force-dynamic'

const KINDS = ['featured_application', 'sponsorship', 'feedback', 'support', 'notify'] as const
type Kind = (typeof KINDS)[number]

const FIELD_KEYS: Record<Kind, string[]> = {
  featured_application: ['artistName', 'audius', 'socials', 'listen', 'bio'],
  sponsorship: ['company', 'website', 'message'],
  feedback: ['message'],
  support: ['topic', 'wallet', 'battleLink', 'message'],
  notify: ['channel'],
}
const REQUIRED: Record<Kind, string[]> = {
  featured_application: ['artistName', 'listen', 'bio'],
  sponsorship: ['company', 'message'],
  feedback: ['message'],
  support: ['message'],
  notify: [],
}
/** Which contact detail each form cannot be answered without. */
const NEEDS_EMAIL: Kind[] = ['featured_application', 'sponsorship', 'support']

const MAX_PER_HOUR = 5
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
}
function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders() })
}
function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : ''
}
/** Digits only, with an optional leading +. Empty when it cannot be a phone number. */
function cleanPhone(v: unknown): string {
  const raw = clean(v, 32)
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length < 10 || digits.length > 15) return ''
  return (raw.startsWith('+') ? '+' : '') + digits
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > 20_000) return reply({ ok: false, error: 'too_large' }, 413)
    body = JSON.parse(text)
  } catch {
    return reply({ ok: false, error: 'bad_json' }, 400)
  }
  if (!body || typeof body !== 'object') return reply({ ok: false, error: 'bad_json' }, 400)

  // Honeypot: accept quietly so a bot learns nothing, store nothing.
  if (clean(body.website, 200)) return reply({ ok: true }, 200)

  const kind = body.kind as Kind
  if (!KINDS.includes(kind)) return reply({ ok: false, error: 'unknown_kind' }, 400)

  const name = clean(body.name, 120)
  const email = clean(body.email, 320).toLowerCase()
  const phone = cleanPhone(body.phone)
  const smsConsent = body.smsConsent === true
  const rawFields = (body.fields && typeof body.fields === 'object' ? body.fields : {}) as Record<string, unknown>
  const fields: Record<string, string> = {}
  for (const key of FIELD_KEYS[kind]) {
    const v = clean(rawFields[key], key === 'message' || key === 'bio' ? 2000 : 400)
    if (v) fields[key] = v
  }

  const missing = REQUIRED[kind].filter(k => !fields[k])
  if (email && !EMAIL_RE.test(email)) missing.push('email')
  if (NEEDS_EMAIL.includes(kind) && !email) missing.push('email')
  if (kind === 'notify') {
    if (!email && !phone) missing.push('email_or_phone')
    // A phone number is only kept with explicit consent to be texted.
    if (clean(body.phone, 32) && !phone) missing.push('phone')
    if (phone && !smsConsent) missing.push('smsConsent')
  }
  if (missing.length) return reply({ ok: false, error: 'missing_fields', fields: [...new Set(missing)] }, 400)

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const ipHash = createHash('sha256').update(`${ip}|${process.env.ADMIN_SECRET || ''}`).digest('hex').slice(0, 32)

  try {
    const supabase = await createAdminClient()
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since)
    if ((count ?? 0) >= MAX_PER_HOUR) return reply({ ok: false, error: 'rate_limited' }, 429)

    const { error } = await supabase.from('form_submissions').insert({
      kind,
      name: name || null,
      email: email || null,
      phone: kind === 'notify' && smsConsent ? phone || null : null,
      sms_consent: kind === 'notify' && smsConsent && !!phone,
      fields,
      source: clean(body.source, 200) || null,
      ip_hash: ipHash,
    })
    if (error) throw error
    return reply({ ok: true }, 200)
  } catch (err) {
    console.error('[forms] insert failed', err)
    return reply({ ok: false, error: 'server_error' }, 500)
  }
}
