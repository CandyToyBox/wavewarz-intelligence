'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import './playbook.css'
import { saveProgress, submitModule, type SavePayload } from './actions'
import { ChoicePart, FilesPart, PalettePart, TextPart, UrlsPart } from './fields'
import {
  STATUS_TEXT,
  buildBackupText,
  checksDone,
  moduleStatus,
  questionRef,
  questionStatus,
  type Answers,
  type FileItem,
  type HelpState,
  type ModuleStatus,
  type Palette,
} from '@/lib/playbook/logic'
import { MODULES, questionKey, type Part, type PlaybookModule, type Question } from '@/lib/playbook/spec'

type Initial = {
  name: string
  answers: Answers
  help: HelpState
  submissions: Record<string, { at: string; hash: string; count: number }>
  fileUrls: Record<string, string>
  hasSavedData: boolean
}

type Sync = 'idle' | 'saving' | 'saved' | 'error'
const SYNC_TEXT: Record<Sync, string> = {
  idle: 'Ready',
  saving: 'Saving',
  saved: 'Saved to the team',
  error: 'Not saved to team',
}

const SAVE_DELAY_MS = 1000
const RETRY_MS = 5000

function mergeDirty(older: SavePayload, newer: SavePayload): SavePayload {
  return {
    values: { ...older.values, ...newer.values },
    name: newer.name ?? older.name,
    help: { ...older.help, ...newer.help },
    notes: { ...older.notes, ...newer.notes },
  }
}

function isEmptyDirty(d: SavePayload): boolean {
  return !Object.keys(d.values ?? {}).length && d.name === undefined && !Object.keys(d.help ?? {}).length && !Object.keys(d.notes ?? {}).length
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export function PlaybookApp({ artistId, displayName, initial }: { artistId: string; displayName: string; initial: Initial }) {
  const storageKey = `wwz-playbook:${artistId}`

  const [name, setNameState] = useState(initial.name || displayName)
  const [v, setV] = useState<Answers>(initial.answers)
  const [help, setHelp] = useState<HelpState>(initial.help)
  const [sub, setSub] = useState(initial.submissions)
  const [fileUrls, setFileUrls] = useState(initial.fileUrls)
  const [sync, setSync] = useState<Sync>(initial.hasSavedData ? 'saved' : 'idle')
  const [open, setOpen] = useState<Record<string, boolean>>({ [MODULES[0].key]: true })
  const [subNotes, setSubNotes] = useState<Record<string, { text: string; tone?: 'warn' | 'ok' }>>({})
  const [copyMsg, setCopyMsg] = useState('')

  const dirty = useRef<SavePayload>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef(false)
  const nameRef = useRef<HTMLInputElement | null>(null)

  const persistLocal = useCallback(() => {
    try {
      if (isEmptyDirty(dirty.current)) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify({ dirty: dirty.current, at: Date.now() }))
    } catch { /* private mode or full: saving to the team still works */ }
  }, [storageKey])

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inflight.current) return false
    if (isEmptyDirty(dirty.current)) return true
    const payload = dirty.current
    dirty.current = {}
    inflight.current = true
    let ok = false
    try {
      ok = (await saveProgress(payload)).ok
    } catch {
      ok = false
    }
    inflight.current = false
    if (!ok) {
      // Keep everything; anything typed meanwhile wins over the failed payload.
      dirty.current = mergeDirty(payload, dirty.current)
      persistLocal()
      setSync('error')
      timer.current = setTimeout(() => { void flush() }, RETRY_MS)
      return false
    }
    persistLocal()
    if (!isEmptyDirty(dirty.current)) return flush()
    setSync('saved')
    return true
  }, [persistLocal])

  const mark = useCallback((patch: SavePayload) => {
    dirty.current = mergeDirty(dirty.current, patch)
    persistLocal()
    setSync('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, SAVE_DELAY_MS)
  }, [flush, persistLocal])

  /** Waits for any save in flight, then sends whatever is left. */
  const flushAll = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < 150 && inflight.current; i++) await sleep(80)
    return flush()
  }, [flush])

  // On load: put back anything that was typed but never reached the team.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const stored = JSON.parse(raw) as { dirty?: SavePayload }
        const d = stored.dirty
        if (d && !isEmptyDirty(d)) {
          setV(prev => ({ ...prev, ...(d.values as Answers | undefined) }))
          if (typeof d.name === 'string') setNameState(d.name)
          setHelp(prev => ({
            fields: { ...prev.fields, ...(d.help ?? {}) },
            notes: { ...prev.notes, ...(d.notes ?? {}) },
          }))
          dirty.current = d
          setSync('saving')
          timer.current = setTimeout(() => { void flush() }, SAVE_DELAY_MS)
          return
        }
      }
    } catch { /* ignore */ }
    // First visit: save the profile name so "name before first submit" is satisfied.
    if (!initial.name && displayName.trim()) mark({ name: displayName.trim() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Send pending edits when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  const setValue = (id: string, value: unknown) => {
    setV(prev => ({ ...prev, [id]: value as Answers[string] }))
    mark({ values: { [id]: value } })
  }

  const setName = (value: string) => {
    setNameState(value)
    mark({ name: value })
  }

  const toggleHelp = (key: string, on: boolean) => {
    setHelp(prev => ({ ...prev, fields: { ...prev.fields, [key]: on } }))
    mark({ help: { [key]: on } })
  }

  const setNote = (moduleKey: string, text: string) => {
    setHelp(prev => ({ ...prev, notes: { ...prev.notes, [moduleKey]: text } }))
    mark({ notes: { [moduleKey]: text } })
  }

  const onFiles = (id: string, items: FileItem[], urls: Record<string, string>) => {
    setV(prev => ({ ...prev, [id]: items }))
    setFileUrls(prev => ({ ...prev, ...urls }))
  }

  const submittedHash = useMemo(
    () => Object.fromEntries(MODULES.map(m => [m.key, sub[m.key]?.hash ?? null])) as Record<string, string | null>,
    [sub],
  )
  const statuses = useMemo(
    () => Object.fromEntries(MODULES.map(m => [m.key, moduleStatus(m, v, help, submittedHash[m.key])])) as Record<string, ModuleStatus>,
    [v, help, submittedHash],
  )
  const submittedCount = MODULES.filter(m => statuses[m.key] === 'submitted' || statuses[m.key] === 'edited').length

  const imageSources = useMemo(() => {
    const out: { url: string; label: string }[] = []
    const take = (id: string, label: (i: number) => string) => {
      const items = Array.isArray(v[id]) ? (v[id] as FileItem[]) : []
      items.forEach((it, i) => {
        if (it.kind === 'file' && /^image\//.test(it.type) && it.type !== 'image/svg+xml' && fileUrls[it.id]) {
          out.push({ url: fileUrls[it.id], label: label(i) })
        }
      })
    }
    take('look_logo', () => 'my logo')
    take('look_photos', i => `photo ${i + 1}`)
    take('look_ref', i => `reference ${i + 1}`)
    return out
  }, [v, fileUrls])

  async function submit(m: PlaybookModule) {
    if (!name.trim()) {
      setSubNotes(n => ({ ...n, [m.key]: { text: 'Add your artist name at the top of the page first.', tone: 'warn' } }))
      nameRef.current?.focus()
      nameRef.current?.scrollIntoView({ block: 'center' })
      return
    }
    setSubNotes(n => ({ ...n, [m.key]: { text: 'Sending...' } }))
    mark({ name })
    const saved = await flushAll()
    if (!saved) {
      setSubNotes(n => ({ ...n, [m.key]: { text: 'Could not send. Your answers are safe on this device. Try again in a moment.', tone: 'warn' } }))
      return
    }
    const res = await submitModule(m.key)
    if (!res.ok || !res.at || !res.hash) {
      setSubNotes(n => ({ ...n, [m.key]: { text: res.error ?? 'Could not send. Try again in a moment.', tone: 'warn' } }))
      return
    }
    setSub(prev => ({ ...prev, [m.key]: { at: res.at!, hash: res.hash!, count: (prev[m.key]?.count ?? 0) + 1 } }))
    setSubNotes(n => { const { [m.key]: _drop, ...rest } = n; void _drop; return rest })
  }

  const backup = useMemo(
    () => buildBackupText(MODULES, name, v, help, submittedHash),
    [name, v, help, submittedHash],
  )

  async function copyBackup() {
    try {
      await navigator.clipboard.writeText(backup)
      setCopyMsg('Copied.')
    } catch {
      setCopyMsg('Could not copy automatically. Tap inside the box, select all and copy.')
    }
    setTimeout(() => setCopyMsg(''), 4000)
  }

  return (
    <div className="pb">
      <div className="bar">
        <div className="bar-in">
          <Image src="/wavewarz-logo.png" alt="WaveWarZ" width={700} height={326} priority />
          <div className="track" aria-hidden="true"><i style={{ width: `${Math.round((submittedCount / MODULES.length) * 100)}%` }} /></div>
          <small>{submittedCount} of {MODULES.length} modules submitted</small>
          <span className="sync" data-s={sync} role="status">{SYNC_TEXT[sync]}</span>
        </div>
      </div>

      <div className="wrap">
        <header className="hero">
          <p className="eyebrow">WaveWarZ founding artists</p>
          <h1>Artists and Repertoire Playbook</h1>
          <p className="lead">
            You are one of the artists this league is built around. This playbook is how we get to know you,
            polish how you show up, and tell your story one piece at a time.
          </p>
          <div className="who">
            <label className="lbl" htmlFor="artist_name">Your artist name</label>
            <input
              ref={nameRef}
              type="text"
              id="artist_name"
              autoComplete="off"
              placeholder="How you want to be introduced"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          {sync === 'error' && (
            <div className="banner" role="status">
              The last save did not reach the team. Your answers are safe on this device. Check your connection and keep
              editing; it will try again.
            </div>
          )}
          <p className="howto">
            Nothing here has to be perfect. Rough notes are fine, and you can skip anything you do not have yet. Type your
            answers, paste links and add files right inside each module. Everything saves as you go. Press Submit at the
            bottom of a module when you are happy with it. You can come back and edit any time, then resubmit. Stuck on
            something? Tick <strong>I want help with this one</strong> under any question and we will pick it up with you.
          </p>
        </header>

        <section className="modules" id="modules">
          <h2>The 10 modules</h2>
          {MODULES.map(m => (
            <ModuleCard
              key={m.key}
              m={m}
              status={statuses[m.key]}
              isOpen={!!open[m.key]}
              onToggle={o => setOpen(prev => ({ ...prev, [m.key]: o }))}
              answers={v}
              help={help}
              fileUrls={fileUrls}
              name={name}
              imageSources={imageSources}
              submittedAt={sub[m.key]?.at}
              subNote={subNotes[m.key]}
              setValue={setValue}
              toggleHelp={toggleHelp}
              setNote={setNote}
              onFiles={onFiles}
              onSubmit={() => void submit(m)}
            />
          ))}
        </section>

        <section id="send" className="modules">
          <h2>Backup copy</h2>
          <div className="out">
            <p>
              Your submissions go to the team automatically. If you would rather keep a copy, or something is not saving,
              copy your answers here and paste them into a message.
            </p>
            <div className="row">
              <button className="btn" type="button" onClick={() => void copyBackup()}>Copy my answers</button>
              <span className="note ok" role="status">{copyMsg}</span>
            </div>
            <label className="lbl" htmlFor="export">Your answers</label>
            <textarea id="export" readOnly value={backup} onFocus={e => e.currentTarget.select()} />
          </div>
        </section>

        <footer>
          <p>You choose what the world sees. Anything you leave blank stays out. Third-party footage is always credited with simple text.</p>
        </footer>
      </div>
    </div>
  )
}

// ─── One module ───────────────────────────────────────────────────────────────

function ModuleCard(props: {
  m: PlaybookModule
  status: ModuleStatus
  isOpen: boolean
  onToggle: (open: boolean) => void
  answers: Answers
  help: HelpState
  fileUrls: Record<string, string>
  name: string
  imageSources: { url: string; label: string }[]
  submittedAt?: string
  subNote?: { text: string; tone?: 'warn' | 'ok' }
  setValue: (id: string, value: unknown) => void
  toggleHelp: (key: string, on: boolean) => void
  setNote: (moduleKey: string, text: string) => void
  onFiles: (id: string, items: FileItem[], urls: Record<string, string>) => void
  onSubmit: () => void
}) {
  const { m, status, isOpen, answers, help } = props
  const done = isOpen ? checksDone(m, answers) : []
  const ndone = done.filter(Boolean).length
  const stateClass = status === 'submitted' ? ' sub' : status === 'edited' ? ' edited' : status === 'progress' || status === 'ready' ? ' on' : ''

  return (
    <details
      className="mod"
      id={`m-${m.key}`}
      data-done={status === 'submitted' ? '1' : undefined}
      open={isOpen}
      style={{ ['--mc' as string]: m.color, ['--mc-rgb' as string]: m.rgb }}
      onToggle={e => props.onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="num">{m.order}</span>
        <span className="mt">
          <span className="mtitle">{m.title}</span>
          <span className="mblurb">{m.blurb}</span>
        </span>
        <span className="meta">
          <span className={`tier t-${m.tier}`}>{m.tierLabel}</span>
          <span className="mins">{m.mins}</span>
          <span className={`state${stateClass}`}>{STATUS_TEXT[status]}</span>
        </span>
      </summary>

      {isOpen && (
        <div className="body">
          <div className="why">
            <h4>Why we ask</h4>
            <p>{m.why}</p>
            {m.link && <p><a href={m.link.u} target="_blank" rel="noopener noreferrer">{m.link.t}</a></p>}
          </div>

          {m.gather && (
            <div className="gather">
              <h4>Have these ready</h4>
              <ul className="chips">{m.gather.map(g => <li key={g}>{g}</li>)}</ul>
            </div>
          )}

          <div className="chk-card">
            <h4>Your checklist</h4>
            <p className="hint">These tick by themselves as you fill in the questions below. Tap one to jump to its question.</p>
            <ul className="checks">
              {m.checks.map((c, i) => (
                <li key={c.l} data-on={done[i] ? '1' : '0'}>
                  <span className="ck" aria-hidden="true" />
                  <a
                    className="cklink"
                    href={`#qc__${m.key}__${c.qi[0]}`}
                    onClick={e => {
                      e.preventDefault()
                      const el = document.getElementById(`qc__${m.key}__${c.qi[0]}`)
                      el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                      el?.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true })
                    }}
                  >
                    <span className="lbl2">{c.l}<span className="sr">{done[i] ? ' (done)' : ' (not done)'}</span></span>
                    <span className="qref">{questionRef(c)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="bartrack" aria-hidden="true"><i style={{ width: `${Math.round((ndone / m.checks.length) * 100)}%` }} /></div>
            <p className="note" role="status">
              {ndone === m.checks.length ? `All ${ndone} done. Nice. Submit when you are happy with it.` : `${ndone} of ${m.checks.length} done`}
            </p>
            <p className="skip"><span className="tg t-skip">OK to skip</span> {m.skip}</p>
          </div>

          <div className="qs">
            {m.qs.map((q, qi) => (
              <QuestionCard key={qi} {...props} q={q} qi={qi} />
            ))}
          </div>

          <div className="helpmod">
            <label className="qlabel" htmlFor={`hn__${m.key}`}>Anything else you want help with in this module?</label>
            <p className="hint">Tell us what is hard, what you are missing, or what you would like us to take off your plate.</p>
            <textarea
              id={`hn__${m.key}`}
              rows={2}
              placeholder="Optional"
              value={help.notes[m.key] ?? ''}
              onChange={e => props.setNote(m.key, e.target.value)}
            />
          </div>

          <SubmitRow {...props} done={done} />
        </div>
      )}
    </details>
  )
}

function SubmitRow({ m, status, submittedAt, subNote, onSubmit, done }: {
  m: PlaybookModule
  status: ModuleStatus
  submittedAt?: string
  subNote?: { text: string; tone?: 'warn' | 'ok' }
  onSubmit: () => void
  done: boolean[]
}) {
  const missing = m.checks.filter((_, i) => !done[i])
  const label =
    status === 'submitted' ? 'Submitted'
    : status === 'edited' ? 'Resubmit this module'
    : missing.length ? 'Submit what I have'
    : 'Submit this module'

  let note: { text: string; cls: string }
  if (subNote) note = { text: subNote.text, cls: subNote.tone === 'warn' ? ' warn' : subNote.tone === 'ok' ? ' ok' : '' }
  else if (status === 'submitted' && submittedAt) {
    note = {
      text: `Sent to the team ${new Date(submittedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. Edit anything to resubmit.`,
      cls: ' ok',
    }
  } else if (status === 'edited') note = { text: 'You changed this module after submitting. Resubmit to send the latest.', cls: ' warn' }
  else if (missing.length) {
    note = {
      text: `Still to do: ${missing.map(c => `${c.l} (${questionRef(c)})`).join('; ')}. You can submit now and add the rest later.`,
      cls: '',
    }
  } else note = { text: 'Everything on the checklist is done. Submit when you are happy.', cls: '' }

  return (
    <div className="submit">
      <div className="row">
        <button className="btn" type="button" disabled={status === 'submitted'} onClick={onSubmit}>{label}</button>
        <span className={`note${note.cls}`} role="status">{note.text}</span>
      </div>
    </div>
  )
}

// ─── One question ─────────────────────────────────────────────────────────────

function QuestionCard({ m, q, qi, answers, help, fileUrls, name, imageSources, setValue, toggleHelp, onFiles }: {
  m: PlaybookModule
  q: Question
  qi: number
  answers: Answers
  help: HelpState
  fileUrls: Record<string, string>
  name: string
  imageSources: { url: string; label: string }[]
  setValue: (id: string, value: unknown) => void
  toggleHelp: (key: string, on: boolean) => void
  onFiles: (id: string, items: FileItem[], urls: Record<string, string>) => void
}) {
  const st = questionStatus(m, qi, answers)
  const hk = questionKey(q)
  const types = new Set(q.parts.map(p => p.t))
  const labelId = `q__${m.key}__${qi}`

  return (
    <section className="qc" id={`qc__${m.key}__${qi}`} data-q={st} aria-labelledby={labelId}>
      <div className="qh">
        <span className="qn">Q{qi + 1}</span>
        <span className="qtags">
          {types.has('palette') && <span className="tg t-colors">Pick colors</span>}
          {types.has('choice') && <span className="tg t-pick">{q.parts.find(p => p.t === 'choice')?.multi ? 'Pick any' : 'Pick one'}</span>}
          {types.has('text') && <span className="tg t-write">Write</span>}
          {types.has('urls') && <span className="tg t-links">Paste links</span>}
          {types.has('files') && <span className="tg t-upload">Upload</span>}
        </span>
        <span className="qstat" data-s={st}>{st === 'done' ? 'Done' : st === 'todo' ? 'To do' : 'Optional'}</span>
      </div>
      <p className="qlabel" id={labelId}>{q.label}{q.opt && <> <span className="opt">(optional)</span></>}</p>
      {q.hint && <p className="hint">{q.hint}</p>}
      <div className="parts" role="group" aria-labelledby={labelId}>
        {q.parts.map(p => (
          <div className="part" key={p.id}>
            {p.cap && <p className="cap">{p.cap}</p>}
            <PartInput
              p={p}
              label={q.label}
              answers={answers}
              fileUrls={fileUrls}
              name={name}
              imageSources={imageSources}
              setValue={setValue}
              onFiles={onFiles}
            />
          </div>
        ))}
      </div>
      {m.famQ === qi && (
        <div className="famq"><h5>Family tie-in</h5><p>{m.fam}</p></div>
      )}
      <label className="helpq">
        <input type="checkbox" checked={!!help.fields[hk]} onChange={e => toggleHelp(hk, e.target.checked)} />
        I want help with this one
      </label>
    </section>
  )
}

function PartInput({ p, label, answers, fileUrls, name, imageSources, setValue, onFiles }: {
  p: Part
  label: string
  answers: Answers
  fileUrls: Record<string, string>
  name: string
  imageSources: { url: string; label: string }[]
  setValue: (id: string, value: unknown) => void
  onFiles: (id: string, items: FileItem[], urls: Record<string, string>) => void
}) {
  const val = answers[p.id]
  switch (p.t) {
    case 'text':
      return <TextPart id={p.id} label={label} value={typeof val === 'string' ? val : ''} onChange={x => setValue(p.id, x)} />
    case 'urls':
      return <UrlsPart part={p} label={label} value={Array.isArray(val) ? (val as string[]) : []} onChange={x => setValue(p.id, x)} />
    case 'files':
      return (
        <FilesPart
          part={p}
          label={label}
          items={Array.isArray(val) ? (val as FileItem[]) : []}
          fileUrls={fileUrls}
          onChange={(items, urls) => onFiles(p.id, items, urls)}
        />
      )
    case 'choice':
      return (
        <ChoicePart
          part={p}
          label={label}
          value={(val as string | string[] | null | undefined) ?? null}
          onChange={x => setValue(p.id, x)}
        />
      )
    case 'palette':
      return (
        <PalettePart
          value={val && typeof val === 'object' && !Array.isArray(val) ? (val as Palette) : {}}
          onChange={x => setValue(p.id, x)}
          name={name}
          imageSources={imageSources}
        />
      )
  }
}
