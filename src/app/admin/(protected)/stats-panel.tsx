'use client'

import { useState, useTransition } from 'react'
import { updatePlatformStats } from './actions'

type PlatformStats = {
  spotify_monthly_streams: number
  spotify_total_streams: number
  spotify_profile_url: string | null
}

export function StatsPanel({ stats: initial }: { stats: PlatformStats }) {
  const [stats, setStats] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updatePlatformStats(fd)
      if (res.error) { setError(res.error); return }
      if (res.stats) { setStats(res.stats) }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <SpotifyIcon />
          <h3 className="font-rajdhani font-bold text-white tracking-wide">Spotify Stats</h3>
        </div>

        {/* Current values */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-[#0d1321] rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Monthly Listeners (current)</p>
            <p className="font-rajdhani font-bold text-xl text-[#1DB954]">
              {stats.spotify_monthly_streams > 0 ? stats.spotify_monthly_streams.toLocaleString() : '—'}
            </p>
          </div>
          <div className="bg-[#0d1321] rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Total Streams (current)</p>
            <p className="font-rajdhani font-bold text-xl text-[#1DB954]">
              {stats.spotify_total_streams > 0 ? stats.spotify_total_streams.toLocaleString() : '—'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                Monthly Listeners
              </label>
              <input
                type="number"
                name="spotify_monthly_streams"
                defaultValue={stats.spotify_monthly_streams || ''}
                min={0}
                className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#1DB954]"
                placeholder="e.g. 45000"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                Total Streams (all-time)
              </label>
              <input
                type="number"
                name="spotify_total_streams"
                defaultValue={stats.spotify_total_streams || ''}
                min={0}
                className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#1DB954]"
                placeholder="e.g. 250000"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                Spotify Profile URL
              </label>
              <input
                type="url"
                name="spotify_profile_url"
                defaultValue={stats.spotify_profile_url ?? ''}
                className="w-full bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#1DB954]"
                placeholder="https://open.spotify.com/artist/..."
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white font-bold text-xs rounded-lg disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Update Stats'}
            </button>
            {saved && <span className="text-xs text-[#1DB954]">Saved!</span>}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-[#111827] p-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Homepage Display Logic</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The Spotify section on the homepage only shows when at least one stream count is &gt; 0.
          Setting both to 0 hides the section completely. Update these manually whenever you have fresh data from Spotify for Artists.
        </p>
      </div>
    </div>
  )
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.519-.973c3.632-1.102 8.147-.568 11.234 1.329a.78.78 0 01.257 1.072zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.935.935 0 01-.954 1.608z"/>
    </svg>
  )
}
