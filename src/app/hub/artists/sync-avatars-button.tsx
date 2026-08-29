'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncRoster, syncArtistAvatars } from '@/app/hub/actions'

// Reconciles the Hub roster with the live Artist Leaderboard: adds any missing
// artists (the DB trigger creates their Identity Bible), then persists avatars.
// Everything else in the Hub already tracks the app + API live.
export function SyncAvatarsButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function run() {
    setMsg(null)
    startTransition(async () => {
      const roster = await syncRoster()
      if (!roster.ok) { setMsg(roster.error ?? 'Roster sync failed'); router.refresh(); return }
      const avatars = await syncArtistAvatars()
      const parts: string[] = []
      if (roster.added) parts.push(`+${roster.added} artist${roster.added === 1 ? '' : 's'}`)
      if (avatars.ok && avatars.updated) parts.push(`${avatars.updated} avatar${avatars.updated === 1 ? '' : 's'} saved`)
      setMsg(parts.length ? parts.join(' · ') : 'Roster already in sync')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <button
        onClick={run}
        disabled={pending}
        className="text-xs font-bold text-[#0d1321] bg-[#95fe7c] hover:bg-[#95fe7c]/90 disabled:opacity-50 px-3 py-1.5 rounded"
      >
        {pending ? 'Syncing…' : 'Sync from leaderboard'}
      </button>
    </div>
  )
}
