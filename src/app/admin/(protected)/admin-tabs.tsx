'use client'

import { useState } from 'react'

type Tab = 'clips' | 'schedule' | 'judging' | 'artists' | 'media' | 'events' | 'stats'

export function AdminTabs({
  clipsPanel, schedulePanel, judgingPanel, artistPanel, mediaPanel, eventsPanel, statsPanel,
  clipsPendingCount, scheduledCount, pendingCount, artistCount, eventCount,
}: {
  clipsPanel: React.ReactNode
  schedulePanel: React.ReactNode
  judgingPanel: React.ReactNode
  artistPanel: React.ReactNode
  mediaPanel: React.ReactNode
  eventsPanel: React.ReactNode
  statsPanel: React.ReactNode
  clipsPendingCount: number
  scheduledCount: number
  pendingCount: number
  artistCount: number
  eventCount: number
}) {
  const [tab, setTab] = useState<Tab>('clips')

  const tabs: { id: Tab; label: string; badge?: string; badgeColor?: string }[] = [
    {
      id: 'clips',
      label: 'Community Clips',
      badge: clipsPendingCount > 0 ? `${clipsPendingCount} pending` : 'Sir Clipz',
      badgeColor: clipsPendingCount > 0
        ? 'text-[#7ec1fb] border-[#7ec1fb]/40 bg-[#7ec1fb]/10'
        : 'text-orange-400 border-orange-500/40 bg-orange-500/10',
    },
    {
      id: 'schedule',
      label: 'Schedule Queue',
      badge: scheduledCount > 0 ? `${scheduledCount} queued` : 'empty',
      badgeColor: scheduledCount > 0
        ? 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10'
        : 'text-muted-foreground border-border bg-white/5',
    },
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
    {
      id: 'events',
      label: 'Events Calendar',
      badge: eventCount > 0 ? `${eventCount} events` : undefined,
      badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    },
    {
      id: 'stats',
      label: 'Platform Stats',
      badge: 'Spotify',
      badgeColor: 'text-[#1DB954] border-[#1DB954]/40 bg-[#1DB954]/10',
    },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-6 pb-1 flex-wrap">
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
      {tab === 'clips' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Clips submitted by the community via the WaveWarz Clips HQ Telegram group. Sir Clipz bot routes clips through voting → approval → Postiz scheduling.
            Click a status card to filter. Expand captions to review AI-generated copy before it posts.
          </p>
          {clipsPanel}
        </div>
      )}
      {tab === 'schedule' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Upcoming approved clips and their scheduled post times (EST). Clips are queued by Sir Clipz bot and posted via Postiz.
            Use the Community Clips tab to approve or reschedule individual clips.
          </p>
          {schedulePanel}
        </div>
      )}
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
      {tab === 'events' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Manage upcoming events shown on the homepage calendar. Add battles, X Spaces, community meetups, or any other event.
            Featured events get a green highlight. Hidden events are saved but not shown on the site.
          </p>
          {eventsPanel}
        </div>
      )}
      {tab === 'stats' && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Update platform stats shown on the homepage. Spotify numbers must be entered manually from Spotify for Artists.
            Set both stream counts to 0 to hide the Spotify section entirely.
          </p>
          {statsPanel}
        </div>
      )}
    </div>
  )
}
