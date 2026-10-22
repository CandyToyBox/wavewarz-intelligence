'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  acceptPlaybookField,
  acceptPlaybookModuleSafe,
  createPlaybookInvite,
  resetPlaybookReview,
  resolvePlaybookHelp,
  revokePlaybookInvite,
  skipPlaybookField,
} from '@/app/hub/playbook-actions'
import type { ReviewField } from '@/lib/playbook/review'
import type { Palette } from '@/lib/playbook/logic'
import type { ModuleStatus } from '@/lib/playbook/logic'

export type InviteInfo = { exists: boolean; active: boolean; createdAt: string | null; lastUsedAt: string | null }
export type ModuleRow = {
  key: string; order: number; title: string; color: string
  status: ModuleStatus; statusText: string; submittedAt: string | null; toReview: number
}
export type HelpRow = { id: string; moduleKey: string; fieldKey: string | null; note: string | null; resolved: boolean }

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null

export function PlaybookReview({ artistId, artistName, artistNameTyped, invite, modules, fields, help }: {
  artistId: string
  artistName: string
  artistNameTyped: string
  invite: InviteInfo
  modules: ModuleRow[]
  fields: ReviewField[]
  help: HelpRow[]
}) {
  return (
    <div className="space-y-5">
      <InvitePanel artistId={artistId} artistName={artistName} invite={invite} />
      {artistNameTyped && artistNameTyped !== artistName && (
        <p className="text-xs text-muted-foreground">
          The artist typed their name as <span className="text-white">{artistNameTyped}</span>; the Hub lists them as {artistName}.
        </p>
      )}
      <div className="space-y-3">
        {modules.map(m => (
          <ModuleBlock
            key={m.key}
            artistId={artistId}
            m={m}
            fields={fields.filter(f => f.moduleKey === m.key)}
            help={help.filter(h => h.moduleKey === m.key)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Private link ─────────────────────────────────────────────────────────────

function InvitePanel({ artistId, artistName, invite }: { artistId: string; artistName: string; invite: InviteInfo }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [link, setLink] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function create() {
    if (invite.active && !window.confirm(`Create a new link for ${artistName}? Their current link will stop working.`)) return
    setErr(null)
    start(async () => {
      const res = await createPlaybookInvite(artistId)
      if (!res.ok || !res.token) { setErr(res.error ?? 'Could not create the link'); return }
      setLink(`${window.location.origin}/playbook/enter/${res.token}`)
      setCopied(false)
      router.refresh()
    })
  }

  function revoke() {
    if (!window.confirm(`Turn off ${artistName}'s link? They will be signed out of the playbook.`)) return
    setErr(null)
    start(async () => {
      const res = await revokePlaybookInvite(artistId)
      if (!res.ok) { setErr(res.error ?? 'Could not revoke'); return }
      setLink(null)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-[#7ec1fb]/30 bg-[#111827] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-rajdhani font-bold text-white tracking-wide">Artist link</h3>
          <p className="text-xs text-muted-foreground">
            {invite.active
              ? `Active. Created ${fmt(invite.createdAt)}${invite.lastUsedAt ? `, last opened ${fmt(invite.lastUsedAt)}` : ', not opened yet'}.`
              : invite.exists
                ? `Turned off. Created ${fmt(invite.createdAt)}.`
                : `No link yet. Create one and send it to ${artistName}. It signs them in to their own playbook only.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={create} disabled={pending} className="text-xs font-bold px-3 py-1.5 rounded-md bg-[#95fe7c] text-[#0d1321] hover:brightness-95 disabled:opacity-50">
            {invite.active ? 'Create a new link' : 'Create link'}
          </button>
          {invite.active && (
            <button onClick={revoke} disabled={pending} className="text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50">
              Turn off
            </button>
          )}
        </div>
      </div>
      {link && (
        <div className="rounded-lg border border-[#95fe7c]/40 bg-[#0d1321] p-3 space-y-2">
          <p className="text-xs text-[#95fe7c]">Copy it now. For safety the full link is shown only once; make a new one if it gets lost.</p>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 bg-[#111827] border border-border rounded px-2 py-1.5 text-xs text-white font-mono" aria-label="Private playbook link" />
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setCopied(false) } }}
              className="text-xs font-bold px-3 py-1.5 rounded-md border border-[#7ec1fb] text-[#7ec1fb] hover:bg-[#7ec1fb]/10"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}

// ─── One module ───────────────────────────────────────────────────────────────

function ModuleBlock({ artistId, m, fields, help }: { artistId: string; m: ModuleRow; fields: ReviewField[]; help: HelpRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const moduleNote = help.find(h => !h.fieldKey && h.note)
  const helpByField = new Map(help.filter(h => h.fieldKey).map(h => [h.fieldKey as string, h]))

  function acceptSafe() {
    setMsg(null)
    start(async () => {
      const res = await acceptPlaybookModuleSafe(artistId, m.key)
      if (!res.ok) { setMsg(res.error ?? 'Failed'); return }
      setMsg(`Accepted ${res.accepted ?? 0}${res.left ? `, ${res.left} left to look at` : ''}.`)
      router.refresh()
    })
  }

  const statusTone =
    m.status === 'submitted' ? 'text-[#95fe7c]' : m.status === 'edited' ? 'text-amber-400' : m.status === 'none' ? 'text-muted-foreground' : 'text-[#7ec1fb]'

  return (
    <details className="rounded-lg border border-border bg-[#0d1321]/40" style={{ borderLeft: `4px solid ${m.color}` }} open={m.toReview > 0 && fields.length > 0 && m.status !== 'none'}>
      <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap px-4 py-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md font-rajdhani font-bold text-[#0d1321]" style={{ background: m.color }}>{m.order}</span>
        <span className="font-rajdhani font-bold text-white tracking-wide uppercase text-lg">{m.title}</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${statusTone}`}>{m.statusText}</span>
        {m.submittedAt && <span className="text-[11px] text-muted-foreground">sent {fmt(m.submittedAt)}</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {fields.length === 0 ? 'no answers yet' : m.toReview > 0 ? `${m.toReview} to review` : 'all reviewed'}
        </span>
      </summary>
      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
        {moduleNote && (
          <div className="rounded border border-[#7ec1fb]/40 bg-[#7ec1fb]/10 px-3 py-2 text-xs text-[#7ec1fb] flex items-start justify-between gap-3">
            <span><b>Help wanted in this module{moduleNote.resolved ? ' (resolved)' : ''}:</b> {moduleNote.note}</span>
            <ResolveButton id={moduleNote.id} resolved={moduleNote.resolved} />
          </div>
        )}
        {m.toReview > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={acceptSafe} disabled={pending} className="text-xs font-bold px-3 py-1.5 rounded-md border border-[#95fe7c] text-[#95fe7c] hover:bg-[#95fe7c]/10 disabled:opacity-50">
              Accept all that have no conflict
            </button>
            <span className="text-[11px] text-muted-foreground">Skips anything where the Hub already holds a different value.</span>
          </div>
        )}
        {msg && <p className="text-xs text-[#95fe7c]">{msg}</p>}
        {fields.map(f => (
          <FieldCard key={f.fieldKey} artistId={artistId} f={f} help={helpByField.get(f.fieldKey)} />
        ))}
        {fields.length === 0 && <p className="text-xs text-muted-foreground">Nothing answered in this module yet.</p>}
      </div>
    </details>
  )
}

export function ResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await resolvePlaybookHelp(id, !resolved); router.refresh() })}
      className="shrink-0 text-[11px] font-bold px-2 py-1 rounded border border-current hover:bg-white/5 disabled:opacity-50"
    >
      {resolved ? 'Reopen' : 'Mark resolved'}
    </button>
  )
}

// ─── One answer ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<ReviewField['status'], string> = {
  new: 'text-[#7ec1fb] border-[#7ec1fb]/50',
  changed: 'text-amber-400 border-amber-400/50',
  accepted: 'text-[#95fe7c] border-[#95fe7c]/50',
  skipped: 'text-muted-foreground border-border',
}
const STATUS_LABEL: Record<ReviewField['status'], string> = {
  new: 'Needs review', changed: 'Changed since reviewed', accepted: 'Accepted', skipped: 'Skipped',
}

function FieldCard({ artistId, f, help }: { artistId: string; f: ReviewField; help?: HelpRow }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(f.proposed)
  const [err, setErr] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const open = f.status === 'new' || f.status === 'changed'
  const isAssets = f.targetKind === 'assets' || f.targetKind === 'logo' || f.targetKind === 'sting'

  function run(fn: () => Promise<{ ok: boolean; error?: string; conflict?: boolean }>) {
    setErr(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) { setErr(res.error ?? 'Failed'); if (res.conflict) setConfirmReplace(true); return }
      setEditing(false)
      setConfirmReplace(false)
      router.refresh()
    })
  }

  const accept = (edited?: string) =>
    run(() => acceptPlaybookField(artistId, f.fieldKey, { edited, replace: f.conflict && confirmReplace }))

  return (
    <article className="rounded-lg border border-border bg-[#111827] p-3 space-y-2" id={`f-${f.fieldKey}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Q{f.qNum}{f.caption ? ` · ${f.caption}` : ''}</p>
          <p className="text-sm text-white font-medium">{f.question}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest border rounded-full px-2 py-0.5 ${STATUS_STYLE[f.status]}`}>{STATUS_LABEL[f.status]}</span>
      </div>

      {help && (
        <p className="text-[11px] text-[#7ec1fb] flex items-center gap-2">
          <span>The artist asked for help with this question{help.resolved ? ' (resolved)' : ''}.</span>
          <ResolveButton id={help.id} resolved={help.resolved} />
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Submitted</p>
          <AnswerView f={f} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Goes to: {f.dest}</p>
          <p className={`text-sm whitespace-pre-wrap break-words ${f.current ? 'text-white' : 'text-muted-foreground/50 italic'}`}>
            {f.current ?? (isAssets ? 'nothing there yet' : 'not set')}
          </p>
        </div>
      </div>

      {f.conflict && open && (
        <p className="text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded px-2 py-1.5">
          The Hub already has a different value here. Compare the two above. Accepting will replace it.
        </p>
      )}

      {editing && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={Math.min(8, Math.max(3, text.split('\n').length + 1))}
            className="w-full bg-[#0d1321] border border-border rounded px-2 py-1.5 text-sm text-white"
            aria-label="Edit before accepting"
          />
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {open && !editing && (
          <>
            {f.conflict ? (
              confirmReplace ? (
                <button onClick={() => accept()} disabled={pending} className="text-xs font-bold px-3 py-1.5 rounded-md bg-amber-400 text-[#0d1321] hover:brightness-95 disabled:opacity-50">
                  Yes, replace the Hub value
                </button>
              ) : (
                <button onClick={() => setConfirmReplace(true)} disabled={pending} className="text-xs font-bold px-3 py-1.5 rounded-md border border-amber-400 text-amber-400 hover:bg-amber-400/10 disabled:opacity-50">
                  Replace Hub value...
                </button>
              )
            ) : (
              <button onClick={() => accept()} disabled={pending} className="text-xs font-bold px-3 py-1.5 rounded-md bg-[#95fe7c] text-[#0d1321] hover:brightness-95 disabled:opacity-50">
                {isAssets ? (f.assetsToAdd > 0 ? `Accept (add ${f.assetsToAdd} to Assets)` : 'Accept') : 'Accept'}
              </button>
            )}
            {f.editable && (
              <button onClick={() => { setText(f.proposed); setEditing(true) }} disabled={pending} className="text-xs px-3 py-1.5 rounded-md border border-[#7ec1fb] text-[#7ec1fb] hover:bg-[#7ec1fb]/10 disabled:opacity-50">
                Edit then accept
              </button>
            )}
            <button onClick={() => run(() => skipPlaybookField(artistId, f.fieldKey))} disabled={pending} className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-white disabled:opacity-50">
              Skip
            </button>
          </>
        )}
        {open && editing && (
          <>
            <button
              onClick={() => (f.conflict && !confirmReplace ? setConfirmReplace(true) : accept(text))}
              disabled={pending}
              className={`text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50 ${f.conflict ? 'bg-amber-400 text-[#0d1321]' : 'bg-[#95fe7c] text-[#0d1321]'}`}
            >
              {f.conflict ? (confirmReplace ? 'Yes, save and replace' : 'Save and replace...') : 'Save and accept'}
            </button>
            <button onClick={() => { setEditing(false); setConfirmReplace(false) }} className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-white">Cancel</button>
          </>
        )}
        {!open && (
          <button onClick={() => run(() => resetPlaybookReview(artistId, f.fieldKey))} disabled={pending} className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-white disabled:opacity-50">
            Reopen for review
          </button>
        )}
        {f.reviewedAt && !open && <span className="text-[11px] text-muted-foreground">{fmt(f.reviewedAt)}</span>}
      </div>
    </article>
  )
}

function AnswerView({ f }: { f: ReviewField }) {
  if (f.type === 'palette') {
    const p = (f.value ?? {}) as Palette
    return (
      <div className="flex flex-wrap gap-3">
        {([['Signature', p.sig], ['Second', p.second], ['Accent', p.accent]] as const).map(([label, hex]) => (
          <span key={label} className="inline-flex items-center gap-2 text-xs text-white font-mono">
            <i className="inline-block w-5 h-5 rounded border border-border" style={{ background: hex || 'transparent' }} />
            {label} {hex ?? 'not chosen'}
          </span>
        ))}
      </div>
    )
  }
  if (f.type === 'files' || f.type === 'urls') {
    return (
      <ul className="space-y-1.5">
        {f.items.map((it, i) => (
          <li key={`${it.url}-${i}`} className="flex items-center gap-2 min-w-0">
            {it.previewUrl && it.fileType?.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.previewUrl} alt="" className="w-10 h-10 rounded object-cover border border-border shrink-0" />
            ) : (
              <span className="w-10 h-10 rounded border border-border shrink-0 flex items-center justify-center text-[10px] uppercase text-muted-foreground">
                {it.kind === 'link' ? 'link' : (it.title.split('.').pop() ?? 'file').slice(0, 4)}
              </span>
            )}
            <a href={it.url} target="_blank" rel="noreferrer noopener" className="text-sm text-[#7ec1fb] hover:underline break-all">
              {it.title}
            </a>
          </li>
        ))}
      </ul>
    )
  }
  return <p className="text-sm text-white whitespace-pre-wrap break-words">{f.text}</p>
}
