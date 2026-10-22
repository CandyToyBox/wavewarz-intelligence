'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { setModuleStatus, setModuleChecklistItem } from '@/app/hub/actions'
import type { HubModuleSpec, ModuleState, ModuleStatus } from '@/lib/hub-modules'

// One list of modules for a subject (league, an artist, or an event).
// - The first unfinished module is open; the rest are collapsed.
// - Finished modules are tucked into "Completed" (hidden until asked for), so the
//   page only shows what is still to do. Their saved links stay inside them.

type Props = {
  subject: string
  modules: HubModuleSpec[]
  states: Record<string, ModuleState>
  nodes: Record<string, ReactNode>
  // Progress that comes from somewhere else (e.g. the promo runway), per module key.
  autoProgress?: Record<string, { done: number; total: number }>
}

export function ModuleGroup({ subject, modules, states, nodes, autoProgress }: Props) {
  const [showDone, setShowDone] = useState(false)
  const stateOf = (k: string): ModuleState => states[k] ?? { status: 'not_started', checklist: {} }

  const open = modules.filter(m => stateOf(m.key).status !== 'done')
  const done = modules.filter(m => stateOf(m.key).status === 'done')
  const nextKey = open[0]?.key

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {done.length} of {modules.length} modules complete
          {open.length > 0 && <> · up next: <span className="text-white">{open[0].title}</span></>}
        </p>
        <div className="h-1.5 w-40 rounded-full bg-[#0d1321] overflow-hidden">
          <div className="h-full rounded-full bg-[#95fe7c]" style={{ width: `${Math.round((done.length / Math.max(modules.length, 1)) * 100)}%` }} />
        </div>
      </div>

      {open.length === 0 && (
        <p className="rounded-xl border border-[#95fe7c]/30 bg-[#95fe7c]/5 p-4 text-sm text-[#95fe7c]">
          Every module here is complete. Open Completed below to revisit any of them.
        </p>
      )}

      {open.map(m => (
        <ModuleCard
          key={m.key}
          subject={subject}
          spec={m}
          state={stateOf(m.key)}
          progress={autoProgress?.[m.key]}
          defaultOpen={m.key === nextKey}
        >
          {nodes[m.key]}
        </ModuleCard>
      ))}

      {done.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowDone(v => !v)}
            className="text-xs text-[#7ec1fb] hover:underline"
          >
            {showDone ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showDone && (
            <div className="space-y-3 mt-3">
              {done.map(m => (
                <ModuleCard
                  key={m.key}
                  subject={subject}
                  spec={m}
                  state={stateOf(m.key)}
                  progress={autoProgress?.[m.key]}
                  defaultOpen={false}
                >
                  {nodes[m.key]}
                </ModuleCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<ModuleStatus, string> = {
  not_started: 'NOT STARTED',
  in_progress: 'IN PROGRESS',
  done: 'COMPLETE',
}

function ModuleCard({ subject, spec, state, progress, defaultOpen, children }: {
  subject: string
  spec: HubModuleSpec
  state: ModuleState
  progress?: { done: number; total: number }
  defaultOpen: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [checks, setChecks] = useState<Record<string, boolean>>(state.checklist)
  const [pending, startTransition] = useTransition()

  const items = spec.checklist ?? []
  const checked = items.filter(i => checks[i.key]).length
  const doneCount = progress ? progress.done : checked
  const totalCount = progress ? progress.total : items.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
  const isDone = state.status === 'done'

  function toggle(key: string) {
    const next = !checks[key]
    setChecks(c => ({ ...c, [key]: next }))
    startTransition(async () => {
      await setModuleChecklistItem(subject, spec.key, key, next)
      router.refresh()
    })
  }

  function setStatus(status: ModuleStatus) {
    startTransition(async () => {
      await setModuleStatus(subject, spec.key, status)
      router.refresh()
    })
  }

  return (
    <div className={`rounded-xl border bg-[#111827] ${isDone ? 'border-[#95fe7c]/30' : 'border-border'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-[#7ec1fb]">MODULE {spec.order}</span>
            <h3 className="font-rajdhani font-bold text-white tracking-wide">{spec.title}</h3>
            {spec.minutes ? <span className="text-[10px] text-muted-foreground">about {spec.minutes} min</span> : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{spec.blurb}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {totalCount > 0 && <span className="text-xs text-muted-foreground">{doneCount}/{totalCount}</span>}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            isDone
              ? 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10'
              : state.status === 'in_progress'
                ? 'text-[#7ec1fb] border-[#7ec1fb]/40 bg-[#7ec1fb]/10'
                : 'text-muted-foreground border-border'
          }`}>
            {STATUS_LABEL[state.status]}
          </span>
          <span className="text-muted-foreground text-xs">{open ? '−' : '+'}</span>
        </div>
      </button>
      {totalCount > 0 && (
        <div className="h-0.5 w-full bg-[#0d1321]">
          <div className="h-full bg-[#95fe7c] transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {open && (
        <div className="p-4 space-y-4 border-t border-border">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Why this module exists</p>
              <p className="text-sm text-white/90">{spec.why}</p>
            </div>
            {spec.familyTie && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Family tie-in (WavID, WaveZStation, The ZAO, ZAO Festivals)</p>
                <p className="text-sm text-white/90">{spec.familyTie}</p>
              </div>
            )}
          </div>

          {items.length > 0 && !progress && (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {items.map(i => (
                <li key={i.key}>
                  <button
                    onClick={() => toggle(i.key)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checks[i.key] ? 'bg-[#95fe7c] border-[#95fe7c] text-[#0d1321]' : 'border-border'
                    }`}>
                      {checks[i.key] && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-6" /></svg>
                      )}
                    </span>
                    <span className={`text-sm ${checks[i.key] ? 'text-muted-foreground line-through' : 'text-white'}`}>{i.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {children}

          <div className="flex items-center gap-3 pt-1">
            {isDone ? (
              <button
                onClick={() => setStatus('in_progress')}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-white border border-border rounded px-3 py-1.5"
              >
                Reopen this module
              </button>
            ) : (
              <>
                <button
                  onClick={() => setStatus('done')}
                  disabled={pending}
                  className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] hover:bg-[#95fe7c]/90 disabled:opacity-50 px-3 py-1.5 rounded"
                >
                  Complete and archive
                </button>
                {state.status === 'not_started' && (
                  <button
                    onClick={() => setStatus('in_progress')}
                    disabled={pending}
                    className="text-xs text-[#7ec1fb] hover:underline"
                  >
                    Mark in progress
                  </button>
                )}
                <span className="text-[11px] text-muted-foreground">Links stay saved. The module moves to Completed.</span>
              </>
            )}
            {pending && <span className="text-xs text-muted-foreground">saving…</span>}
          </div>
        </div>
      )}
    </div>
  )
}
