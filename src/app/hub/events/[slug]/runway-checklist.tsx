'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setRunwayItem } from '@/app/hub/actions'

// The 21-day hybrid promotion cadence (WWE/UFC playbook, Master Checklist Phase 27).
export const RUNWAY_ITEMS: { key: string; when: string; label: string }[] = [
  { key: 'announce', when: 'T-21', label: 'Battle announcement + hero poster + one-line thesis' },
  { key: 'identity_cards', when: 'T-21', label: 'Artist A & B identity cards' },
  { key: 'origins', when: 'T-14', label: 'Origin / character clips for both artists' },
  { key: 'records', when: 'T-13', label: 'Record + stat card + previous battle receipts' },
  { key: 'rivalry_promo', when: 'T-11', label: 'Rivalry history / 30-sec rivalry promo' },
  { key: 'sponsor_intro', when: 'T-9', label: 'Sponsor introduction / activation' },
  { key: 'countdown', when: 'T-7', label: 'WARZ COUNTDOWN premiere' },
  { key: 'embedded', when: 'T-6', label: 'Daily WARZ EMBEDDED clips' },
  { key: 'face_the_wave', when: 'T-3', label: 'FACE THE WAVE live faceoff + clip' },
  { key: 'tale_of_track', when: 'T-2', label: 'TALE OF THE TRACK + community predictions' },
  { key: 'track_lock', when: 'T-1', label: 'TRACK LOCK + entrance teasers + how to participate' },
  { key: 'event_day_trailer', when: 'Event AM', label: 'Final trailer + "tonight" graphic + reminders' },
  { key: 'the_walk', when: 'Live', label: 'THE WALK entrances + live data rituals' },
  { key: 'winner_card', when: '+15m', label: 'Winner card + decisive stat' },
  { key: 'aftermath', when: '+1h', label: 'AFTERMATH interview / callout' },
  { key: 'recap', when: '+1 day', label: 'Recap + stats + clips + NEXT ON WAVEWARZ seed' },
]

export function RunwayChecklist({ slug, runway }: { slug: string; runway: Record<string, boolean> }) {
  const router = useRouter()
  const [state, setState] = useState<Record<string, boolean>>(runway)
  const [pending, startTransition] = useTransition()

  const done = RUNWAY_ITEMS.filter(i => state[i.key]).length
  const pct = Math.round((done / RUNWAY_ITEMS.length) * 100)

  function toggle(key: string) {
    const next = { ...state, [key]: !state[key] }
    setState(next)
    startTransition(async () => {
      await setRunwayItem(slug, next)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-[#111827]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-rajdhani font-bold text-white tracking-wide text-sm">Promotion Runway</h3>
        <span className="text-xs text-muted-foreground">{done}/{RUNWAY_ITEMS.length} · {pct}%{pending ? ' · saving…' : ''}</span>
      </div>
      <div className="h-1 w-full bg-[#0d1321]">
        <div className="h-full bg-[#95fe7c] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="divide-y divide-border">
        {RUNWAY_ITEMS.map(item => (
          <li key={item.key}>
            <button
              onClick={() => toggle(item.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                state[item.key] ? 'bg-[#95fe7c] border-[#95fe7c] text-[#0d1321]' : 'border-border'
              }`}>
                {state[item.key] && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M2 6l3 3 5-6" />
                  </svg>
                )}
              </span>
              <span className="text-[10px] font-mono text-[#7ec1fb] w-14 shrink-0">{item.when}</span>
              <span className={`text-sm ${state[item.key] ? 'text-muted-foreground line-through' : 'text-white'}`}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
