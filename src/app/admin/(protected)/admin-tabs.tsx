'use client'

import { useState } from 'react'

type Tab = 'judging' | 'artists' | 'media'

export function AdminTabs({ judgingPanel, artistPanel, mediaPanel, pendingCount, artistCount }: {
  judgingPanel: React.ReactNode
  artistPanel: React.ReactNode
  mediaPanel: React.ReactNode
  pendingCount: number
  artistCount: number
}) {
  const [tab, setTab] = useState<Tab>('judging')

  const tabs: { id: Tab; label: string; badge?: string; badgeColor?: string }[] = [
    {
      id: 'judging',
      label: 'Main Event Judging',
      badge: pendingCount > 0 ? `${pendingCount} pending` : undefined,
      badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    },
    {
      id: 'artists',
      label: 'Artist Profiles',
      badge: artistCount > 0 ? `${artistCount} profiles` : 'No profiles',
      badgeColor: 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10',
    },
    {
      id: 'media',
      label: 'Battle Media',
      badge: 'YouTube · Images',
      badgeColor: 'text-[#7ec1fb] border-[#7ec1fb]/40 bg-[#7ec1fb]/10',
    },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-6 pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-white bg-[#111827] border border-b-0 border-border -mb-px'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <span className="font-rajdhani font-bold tracking-wide">{t.label}</span>
            {t.badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${t.badgeColor}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'judging' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Enter X Poll results and Human Judge decision. Winner = 2 of 3 (Human Judge · X Poll · SOL Vote).
            SOL Vote is determined automatically by pool comparison.
          </p>
          {judgingPanel}
        </div>
      )}
      {tab === 'artists' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Create and manage Artist Profiles. Link multiple wallets to one UUID. The Player Card at <code className="text-[#7ec1fb] text-xs">/artist/[wallet-or-uuid]</code> pulls from here.
          </p>
          {artistPanel}
        </div>
      )}
      {tab === 'media' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Add YouTube replay links, stream links, and battle artwork. Green dot = already set. Filter by type or show only battles missing media.
          </p>
          {mediaPanel}
        </div>
      )}
    </div>
  )
}
