'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest First' },
  { value: 'oldest',  label: 'Oldest First' },
  { value: 'volume',  label: 'Highest Volume' },
]

const FILTER_OPTIONS = [
  { value: 'all',       label: 'All Battles' },
  { value: 'main',      label: 'Main Events' },
  { value: 'quick',     label: 'Quick Battles' },
  { value: 'community', label: 'Community' },
]

export function BattlesControls({
  sort,
  filter,
}: {
  sort: string
  filter: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    params.set(key, value)
    params.set('page', '1')  // reset to page 1 on sort/filter change
    router.push(`/battles?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Sort</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {SORT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => navigate('sort', o.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                sort === o.value
                  ? 'bg-[#95fe7c]/10 text-[#95fe7c]'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Show</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {FILTER_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => navigate('filter', o.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                filter === o.value
                  ? 'bg-[#7ec1fb]/10 text-[#7ec1fb]'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
