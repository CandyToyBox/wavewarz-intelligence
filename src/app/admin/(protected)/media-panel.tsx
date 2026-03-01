'use client'

import { useState, useTransition } from 'react'
import { updateBattleMedia } from './actions'

export type BattleMedia = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist2_name: string
  is_main_battle: boolean
  is_quick_battle: boolean
  is_community_battle: boolean
  youtube_replay_link: string | null
  stream_link: string | null
  image_url: string | null
}

export function MediaPanel({ battles }: { battles: BattleMedia[] }) {
  const [edits, setEdits] = useState<Record<number, {
    youtube: string; stream: string; image: string
  }>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'main' | 'quick' | 'community'>('all')
  const [mediaFilter, setMediaFilter] = useState<'all' | 'missing'>('missing')

  function getEdit(b: BattleMedia) {
    return edits[b.battle_id] ?? {
      youtube: b.youtube_replay_link ?? '',
      stream: b.stream_link ?? '',
      image: b.image_url ?? '',
    }
  }

  function setField(battleId: number, field: 'youtube' | 'stream' | 'image', val: string, battle: BattleMedia) {
    setEdits(prev => ({
      ...prev,
      [battleId]: { ...getEdit(battle), [field]: val },
    }))
    setSaved(prev => ({ ...prev, [battleId]: false }))
  }

  function handleSave(b: BattleMedia) {
    const edit = getEdit(b)
    startTransition(async () => {
      const result = await updateBattleMedia({
        battleId: b.battle_id,
        youtubeReplayLink: edit.youtube || null,
        streamLink: edit.stream || null,
        imageUrl: edit.image || null,
      })
      if (result.ok) {
        setSaved(prev => ({ ...prev, [b.battle_id]: true }))
        setErrors(prev => ({ ...prev, [b.battle_id]: '' }))
      } else {
        setErrors(prev => ({ ...prev, [b.battle_id]: result.error ?? 'Save failed.' }))
      }
    })
  }

  const filtered = battles.filter(b => {
    const name = `${b.artist1_name} ${b.artist2_name}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase()) && !String(b.battle_id).includes(search)) return false
    if (typeFilter === 'main' && !b.is_main_battle) return false
    if (typeFilter === 'quick' && !b.is_quick_battle) return false
    if (typeFilter === 'community' && !b.is_community_battle) return false
    if (mediaFilter === 'missing' && (b.youtube_replay_link || b.stream_link)) return false
    return true
  })

  const missingCount = battles.filter(b => !b.youtube_replay_link && !b.stream_link).length

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search battle or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#0d1321] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#95fe7c]/50 w-52"
        />
        <div className="flex gap-1">
          {(['all', 'main', 'quick', 'community'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? 'bg-[#95fe7c]/10 text-[#95fe7c]' : 'text-muted-foreground hover:text-white'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'missing'] as const).map(f => (
            <button key={f} onClick={() => setMediaFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mediaFilter === f ? 'bg-amber-500/10 text-amber-400' : 'text-muted-foreground hover:text-white'}`}>
              {f === 'missing' ? `Missing Media (${missingCount})` : 'All Battles'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">{filtered.length} battles shown</p>

      <div className="space-y-2">
        {filtered.map(b => {
          const edit = getEdit(b)
          const type = b.is_quick_battle ? 'Quick' : b.is_main_battle ? 'Main' : 'Community'
          const typeColor = b.is_quick_battle ? 'text-[#7ec1fb]' : b.is_main_battle ? 'text-[#95fe7c]' : 'text-amber-400'
          const date = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
          const isDirty = edits[b.battle_id] !== undefined

          return (
            <div key={b.battle_id} className={`rounded-xl border bg-[#111827] overflow-hidden ${saved[b.battle_id] ? 'border-[#95fe7c]/20' : isDirty ? 'border-[#7ec1fb]/30' : 'border-border'}`}>
              <div className="px-4 py-3 flex items-center gap-4">
                {/* Battle info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>{type}</span>
                    <span className="text-[10px] text-muted-foreground">#{b.battle_id} · {date}</span>
                  </div>
                  <p className="font-rajdhani font-bold text-white text-sm truncate">
                    {b.artist1_name} <span className="text-muted-foreground font-normal">vs</span> {b.artist2_name}
                  </p>
                </div>

                {/* Media inputs */}
                <div className="flex gap-2 items-center flex-1">
                  <MediaInput
                    label="YouTube Replay"
                    value={edit.youtube}
                    onChange={v => setField(b.battle_id, 'youtube', v, b)}
                    placeholder="https://youtube.com/watch?v=…"
                    hasValue={!!b.youtube_replay_link}
                  />
                  <MediaInput
                    label="Stream Link"
                    value={edit.stream}
                    onChange={v => setField(b.battle_id, 'stream', v, b)}
                    placeholder="https://…"
                    hasValue={!!b.stream_link}
                  />
                  <MediaInput
                    label="Image URL"
                    value={edit.image}
                    onChange={v => setField(b.battle_id, 'image', v, b)}
                    placeholder="https://…"
                    hasValue={!!b.image_url}
                  />
                </div>

                {/* Save */}
                <div className="shrink-0 w-24 text-right">
                  {saved[b.battle_id] ? (
                    <span className="text-[10px] text-[#95fe7c] font-bold">Saved ✓</span>
                  ) : (
                    <button
                      onClick={() => handleSave(b)}
                      disabled={isPending || !isDirty}
                      className="bg-[#95fe7c]/10 hover:bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/30 disabled:opacity-30 text-xs px-3 py-1.5 rounded-lg transition-colors font-rajdhani font-bold"
                    >
                      Save
                    </button>
                  )}
                  {errors[b.battle_id] && (
                    <p className="text-[10px] text-red-400 mt-1">{errors[b.battle_id]}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-[#111827] p-8 text-center text-muted-foreground text-sm">
            No battles match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}

function MediaInput({ label, value, onChange, placeholder, hasValue }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; hasValue: boolean
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
        {label}
        <span className={`w-1.5 h-1.5 rounded-full ${hasValue ? 'bg-[#95fe7c]' : 'bg-muted-foreground/30'}`} />
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0d1321] border border-border rounded px-2 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#95fe7c]/40 transition-colors font-mono"
      />
    </div>
  )
}
