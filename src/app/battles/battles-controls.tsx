'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { WwIcon, type WwIconName } from '@/components/ww-icon'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'volume', label: 'Most traded' },
]

const FILTER_OPTIONS: { value: string; label: string; icon: WwIconName }[] = [
  { value: 'all',       label: 'All Battles',   icon: 'vs-waveform' },
  { value: 'main',      label: 'Main Events',   icon: 'main-event' },
  { value: 'quick',     label: 'Quick Battles', icon: 'quick-battlez' },
  { value: 'community', label: 'Community',     icon: 'community-battlez' },
]

// Same pill chips as the Statz menu and the leaderboard tabs; the selected one uses the chip's green state.
export function BattlesControls({ sort, filter }: { sort: string; filter: string }) {
  const router = useRouter()
  const sp = useSearchParams()

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(sp?.toString() ?? '')
    params.set(key, value)
    params.set('page', '1') // reset to page 1 on sort/filter change
    router.push(`/battles?${params.toString()}`)
  }

  return (
    <div className="bt-controls">
      <div role="group" aria-label="Show" className="bt-chipset">
        {FILTER_OPTIONS.map(o => (
          <button key={o.value} type="button" className="ww-chip" aria-pressed={filter === o.value} onClick={() => navigate('filter', o.value)}>
            <WwIcon name={o.icon} size={18} />{o.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Sort" className="bt-chipset">
        <span className="bt-set-k">Sort</span>
        {SORT_OPTIONS.map(o => (
          <button key={o.value} type="button" className="ww-chip sm" aria-pressed={sort === o.value} onClick={() => navigate('sort', o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
