import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  kind: string
  name: string | null
  email: string | null
  phone: string | null
  sms_consent: boolean
  fields: Record<string, string> | null
  source: string | null
  created_at: string
}

const KINDS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'featured_application', label: 'Featured Battle applications' },
  { id: 'sponsorship', label: 'Sponsorship' },
  { id: 'support', label: 'Support' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'notify', label: 'Sunday reminders' },
]
const FIELD_LABELS: Record<string, string> = {
  artistName: 'Artist name', audius: 'Audius', socials: 'Socials', listen: 'Listen', bio: 'Style and bio',
  company: 'Company', website: 'Website', message: 'Message', topic: 'Topic', wallet: 'Wallet',
  battleLink: 'Battle link', channel: 'Reminder by',
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = 'all' } = await searchParams
  const supabase = await createAdminClient()
  let query = supabase
    .from('form_submissions')
    .select('id, kind, name, email, phone, sms_consent, fields, source, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (kind !== 'all') query = query.eq('kind', kind)
  const { data, error } = await query
  const rows = (data ?? []) as Row[]

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
          <p className="text-sm text-muted-foreground">Everything sent through the site forms. Newest first, latest 200.</p>
        </div>
        <Link href="/admin" className="text-sm text-[#7ec1fb] hover:text-[#95fe7c]">Back to admin</Link>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter by form">
        {KINDS.map(k => (
          <Link
            key={k.id}
            href={k.id === 'all' ? '/admin/inbox' : `/admin/inbox?kind=${k.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${kind === k.id ? 'border-[#95fe7c]/60 bg-[#95fe7c]/10 text-[#95fe7c]' : 'border-border text-muted-foreground hover:text-white'}`}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">The inbox did not load: {error.message}</p>}
      {!error && rows.length === 0 && <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Nothing here yet.</p>}

      <ul className="space-y-3">
        {rows.map(r => (
          <li key={r.id} className="rounded-xl border border-border bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-[#7ec1fb]/40 bg-[#7ec1fb]/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-[#7ec1fb]">
                {KINDS.find(k => k.id === r.kind)?.label ?? r.kind}
              </span>
              <time className="text-xs text-muted-foreground" dateTime={r.created_at}>{when(r.created_at)}</time>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white">
              {r.name && <span>{r.name}</span>}
              {r.email && <a className="text-[#95fe7c] hover:underline" href={`mailto:${r.email}`}>{r.email}</a>}
              {r.phone && <span>{r.phone}{r.sms_consent ? ' (agreed to texts)' : ''}</span>}
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              {Object.entries(r.fields ?? {}).map(([k, v]) => (
                <div key={k} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{FIELD_LABELS[k] ?? k}</dt>
                  <dd className="whitespace-pre-wrap break-words text-white/90">{v}</dd>
                </div>
              ))}
            </dl>
            {r.source && <p className="mt-3 text-[11px] text-muted-foreground">Sent from {r.source}</p>}
          </li>
        ))}
      </ul>
    </main>
  )
}
