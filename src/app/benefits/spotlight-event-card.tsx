'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

// All display strings are pre-formatted server-side — no functions passed as props.

type ArtistStat = {
  name: string
  volFormatted: string
  wins: number
  losses: number
}

type RoundData = {
  battle_id: number
  dateFormatted: string
  artist1_name: string
  artist2_name: string
  v1Formatted: string
  v2Formatted: string
  totalVolFormatted: string
  totalVolUsd: string
  pct1: number
  pct2: number
  aWon: boolean
  youtube_replay_link: string | null
}

export type SpotlightGroup = {
  eventName: string
  totalRounds: number
  firstDateFormatted: string
  lastDateFormatted: string | null
  youtubeReplay: string | null
  imageUrl: string | null
  // Aggregated display strings
  totalVolumeFormatted: string
  totalVolumeUsd: string
  avgRoundVolumeFormatted: string
  // Artist breakdown
  artists: ArtistStat[]
  // Round-by-round
  rounds: RoundData[]
}

export function SpotlightEventCard({ group }: { group: SpotlightGroup }) {
  const [expanded, setExpanded] = useState(false)

  // Build avatar initials for the two main artists (first two in sorted list)
  const [a1, a2] = group.artists
  const initials = (name: string) => name.trim().charAt(0).toUpperCase()

  return (
    <div className="rounded-xl border border-[#7ec1fb]/20 bg-[#111827] overflow-hidden">

      {/* ── VISUAL HEADER — battle art or artist avatars ── */}
      {group.imageUrl ? (
        // Battle artwork from DB
        <div className="relative h-36 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.imageUrl}
            alt={group.eventName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/40 to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest backdrop-blur-sm">
              ARTIST SPOTLIGHT
            </Badge>
          </div>
        </div>
      ) : (
        // Fallback: VS-style avatar strip
        <div className="flex items-center justify-center gap-4 py-5 bg-gradient-to-r from-[#7ec1fb]/5 via-[#0d1321] to-[#95fe7c]/5 border-b border-[#7ec1fb]/10">
          {a1 && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-[#7ec1fb]/15 border-2 border-[#7ec1fb]/40 flex items-center justify-center">
                <span className="font-rajdhani font-bold text-xl text-[#7ec1fb]">{initials(a1.name)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[72px] text-center">{a1.name}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-rajdhani font-bold text-muted-foreground/60 uppercase tracking-widest">vs</span>
          </div>
          {a2 && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-[#95fe7c]/15 border-2 border-[#95fe7c]/40 flex items-center justify-center">
                <span className="font-rajdhani font-bold text-xl text-[#95fe7c]">{initials(a2.name)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[72px] text-center">{a2.name}</span>
            </div>
          )}
          {group.artists.length > 2 && (
            <span className="text-[10px] text-muted-foreground ml-1">+{group.artists.length - 2} more</span>
          )}
        </div>
      )}

      {/* ── FRONT / SUMMARY ── */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {!group.imageUrl && (
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest">
                  ARTIST SPOTLIGHT
                </Badge>
                <span className="text-xs text-muted-foreground">Excluded from rankings</span>
              </div>
            )}
            {group.imageUrl && (
              <span className="text-xs text-muted-foreground block mb-1">Excluded from rankings</span>
            )}
            <h3 className="text-xl font-rajdhani font-bold text-white tracking-wide leading-tight">
              {group.eventName}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {group.firstDateFormatted}
              {group.lastDateFormatted ? ` — ${group.lastDateFormatted}` : ''}
              {' · '}{group.totalRounds} round{group.totalRounds !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {group.youtubeReplay && (
              <a href={group.youtubeReplay} target="_blank" rel="noreferrer"
                className="text-xs text-[#7ec1fb] hover:underline">
                Watch ↗
              </a>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs font-rajdhani font-bold px-3 py-1.5 rounded-lg border border-[#7ec1fb]/30 text-[#7ec1fb] hover:bg-[#7ec1fb]/10 transition-colors"
            >
              {expanded ? 'Hide Rounds ↑' : 'View Rounds ↓'}
            </button>
          </div>
        </div>

        {/* Aggregated stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <AggregateStat label="Total Volume" value={`${group.totalVolumeFormatted} SOL`} sub={group.totalVolumeUsd} />
          <AggregateStat label="Rounds" value={String(group.totalRounds)} sub="battles in this event" />
          <AggregateStat label="Artists" value={String(group.artists.length)} sub="competitors featured" />
          <AggregateStat label="Avg Round Volume" value={`${group.avgRoundVolumeFormatted} SOL`} sub="per round" />
        </div>

        {/* Artist breakdown mini-table */}
        <div className="rounded-lg bg-[#0d1321] overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-border">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest col-span-2">Artist</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest text-right">Volume</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest text-right">W–L</span>
          </div>
          {group.artists.map(a => (
            <div key={a.name} className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-border/50 last:border-0">
              <span className="text-xs text-white font-medium col-span-2 truncate">{a.name}</span>
              <span className="text-xs font-mono text-[#7ec1fb] text-right">{a.volFormatted}</span>
              <span className="text-xs font-rajdhani font-bold text-right">
                <span className="text-[#95fe7c]">{a.wins}W</span>
                <span className="text-muted-foreground mx-1">–</span>
                <span className="text-red-400">{a.losses}L</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── EXPANDED ROUNDS ── */}
      {expanded && (
        <div className="border-t border-[#7ec1fb]/20">
          <div className="px-6 py-3 bg-[#7ec1fb]/5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Round-by-Round Breakdown</p>
          </div>
          <div className="divide-y divide-border">
            {group.rounds.map((r, i) => (
              <div key={r.battle_id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#7ec1fb]/10 border border-[#7ec1fb]/30 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-rajdhani font-bold text-[#7ec1fb]">{i + 1}</span>
                    </span>
                    <div>
                      <p className="text-sm font-rajdhani font-bold text-white leading-tight">
                        {r.artist1_name}
                        <span className="text-muted-foreground mx-2 font-normal text-xs">vs</span>
                        {r.artist2_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{r.dateFormatted} · Battle #{r.battle_id}</p>
                    </div>
                  </div>
                  {r.youtube_replay_link && (
                    <a href={r.youtube_replay_link} target="_blank" rel="noreferrer"
                      className="text-[10px] text-[#7ec1fb] hover:underline shrink-0">
                      Watch ↗
                    </a>
                  )}
                </div>

                {/* Pool bars */}
                <div className="space-y-1.5 mb-3">
                  <RoundBar name={r.artist1_name} volFormatted={r.v1Formatted} pct={r.pct1} won={r.aWon} />
                  <RoundBar name={r.artist2_name} volFormatted={r.v2Formatted} pct={r.pct2} won={!r.aWon} />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Round volume: <span className="text-white font-mono">{r.totalVolFormatted} SOL</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">({r.totalVolUsd})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AggregateStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-[#0d1321] p-3">
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-rajdhani font-bold text-[#7ec1fb]">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function RoundBar({ name, volFormatted, pct, won }: {
  name: string; volFormatted: string; pct: number; won: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-28 shrink-0 truncate">{name}</span>
      <div className="flex-1 h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${won ? 'bg-[#95fe7c]' : 'bg-[#7ec1fb]/50'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono w-14 text-right ${won ? 'text-[#95fe7c]' : 'text-muted-foreground'}`}>
        {volFormatted} SOL
      </span>
      <span className={`text-[9px] font-bold tracking-widest w-4 ${won ? 'text-[#95fe7c]' : 'text-muted-foreground'}`}>
        {won ? 'W' : ''}
      </span>
    </div>
  )
}
