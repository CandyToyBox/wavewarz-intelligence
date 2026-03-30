'use client'

import { useState, useTransition } from 'react'
import { submitJudging } from './actions'

type Battle = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist2_name: string
  artist1_pool: number
  artist2_pool: number
  winner_decided: boolean
  status: string
}

type JudgingState = {
  humanJudge: 'a' | 'b' | null
  xPoll: 'a' | 'b' | null
}

function deriveWinner(state: JudgingState, solVote: 'a' | 'b'): 'a' | 'b' | null {
  const votes = { a: 0, b: 0 }
  if (state.humanJudge) votes[state.humanJudge]++
  if (state.xPoll) votes[state.xPoll]++
  votes[solVote]++
  if (votes.a >= 2) return 'a'
  if (votes.b >= 2) return 'b'
  return null
}

export function JudgingPanel({ battles }: { battles: Battle[] }) {
  const [judging, setJudging] = useState<Record<number, JudgingState>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const displayed = filter === 'pending'
    ? battles.filter(b => !b.winner_decided)
    : battles

  function getState(id: number): JudgingState {
    return judging[id] ?? { humanJudge: null, xPoll: null }
  }

  function setVote(battleId: number, field: 'humanJudge' | 'xPoll', val: 'a' | 'b') {
    setJudging(prev => ({
      ...prev,
      [battleId]: { ...getState(battleId), [field]: val },
    }))
    setSaved(prev => ({ ...prev, [battleId]: false }))
    setErrors(prev => ({ ...prev, [battleId]: '' }))
  }

  function toggleOverride(battleId: number) {
    setOverrides(prev => ({ ...prev, [battleId]: !prev[battleId] }))
    setSaved(prev => ({ ...prev, [battleId]: false }))
    setErrors(prev => ({ ...prev, [battleId]: '' }))
    setJudging(prev => ({ ...prev, [battleId]: { humanJudge: null, xPoll: null } }))
  }

  function handleSubmit(battle: Battle) {
    const state = getState(battle.battle_id)
    if (!state.humanJudge || !state.xPoll) {
      setErrors(prev => ({ ...prev, [battle.battle_id]: 'Set both Human Judge and X Poll before saving.' }))
      return
    }
    const solVote: 'a' | 'b' = (battle.artist1_pool ?? 0) >= (battle.artist2_pool ?? 0) ? 'a' : 'b'
    const winner = deriveWinner(state, solVote)
    if (!winner) {
      setErrors(prev => ({ ...prev, [battle.battle_id]: 'No 2-of-3 majority reached. Check votes.' }))
      return
    }

    startTransition(async () => {
      const result = await submitJudging({
        battleId: battle.battle_id,
        humanJudge: state.humanJudge!,
        xPoll: state.xPoll!,
        solVote,
        winner,
      })
      if (result.ok) {
        setSaved(prev => ({ ...prev, [battle.battle_id]: true }))
      } else {
        setErrors(prev => ({ ...prev, [battle.battle_id]: result.error ?? 'Save failed.' }))
      }
    })
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#95fe7c]/10 text-[#95fe7c]'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {f === 'pending' ? 'Pending Judging' : 'All Main Events'}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-8 text-center text-muted-foreground text-sm">
          {filter === 'pending' ? 'No battles pending judging.' : 'No main events found.'}
        </div>
      )}

      <div className="space-y-3">
        {displayed.map(battle => {
          const state = getState(battle.battle_id)
          const solVote: 'a' | 'b' = (battle.artist1_pool ?? 0) >= (battle.artist2_pool ?? 0) ? 'a' : 'b'
          const projectedWinner = state.humanJudge && state.xPoll
            ? deriveWinner(state, solVote)
            : null
          const isSettled = battle.winner_decided
          const isOverride = !!overrides[battle.battle_id]
          const isLive = battle.status === 'ACTIVE'
          const date = new Date(battle.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })
          const time = new Date(battle.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
          })

          return (
            <div
              key={battle.battle_id}
              className={`rounded-xl border bg-[#111827] overflow-hidden ${
                isSettled && !isOverride ? 'border-[#95fe7c]/20 opacity-60' : isOverride ? 'border-amber-400/40' : isLive ? 'border-amber-500/30' : 'border-border'
              }`}
            >
              {/* Battle header */}
              <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-rajdhani font-bold text-white text-lg">
                      {battle.artist1_name}
                    </span>
                    <span className="text-muted-foreground text-sm">vs</span>
                    <span className="font-rajdhani font-bold text-white text-lg">
                      {battle.artist2_name}
                    </span>
                    {isSettled && !isOverride && (
                      <span className="text-[10px] font-bold text-[#95fe7c] border border-[#95fe7c]/40 px-2 py-0.5 rounded">JUDGED</span>
                    )}
                    {isOverride && (
                      <span className="text-[10px] font-bold text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded animate-pulse">RE-JUDGING</span>
                    )}
                    {isLive && (
                      <span className="text-[10px] font-bold text-amber-400 border border-amber-400/40 px-2 py-0.5 rounded animate-pulse">LIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">#{battle.battle_id} · {date} · {time} EST</p>
                </div>
                {/* SOL Vote (automatic) */}
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">SOL Vote (auto)</p>
                  <p className="text-sm font-rajdhani font-bold text-[#7ec1fb]">
                    {solVote === 'a' ? battle.artist1_name : battle.artist2_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {solVote === 'a'
                      ? `${(battle.artist1_pool ?? 0).toFixed(4)} vs ${(battle.artist2_pool ?? 0).toFixed(4)} SOL`
                      : `${(battle.artist2_pool ?? 0).toFixed(4)} vs ${(battle.artist1_pool ?? 0).toFixed(4)} SOL`}
                  </p>
                </div>
              </div>

              {/* Judging inputs — shown for unsettled battles OR settled battles in override mode */}
              {(!isSettled || isOverride) && (
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <JudgeInput
                      label="Human Judge"
                      battleId={battle.battle_id}
                      field="humanJudge"
                      current={state.humanJudge}
                      nameA={battle.artist1_name}
                      nameB={battle.artist2_name}
                      onChange={setVote}
                    />
                    <JudgeInput
                      label="X Poll Winner"
                      battleId={battle.battle_id}
                      field="xPoll"
                      current={state.xPoll}
                      nameA={battle.artist1_name}
                      nameB={battle.artist2_name}
                      onChange={setVote}
                    />
                  </div>

                  {projectedWinner && (
                    <div className="rounded-lg bg-[#95fe7c]/5 border border-[#95fe7c]/20 px-4 py-2 mb-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">2-of-3 Winner:</span>
                      <span className="font-rajdhani font-bold text-[#95fe7c] text-sm">
                        {projectedWinner === 'a' ? battle.artist1_name : battle.artist2_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        HJ:{state.humanJudge?.toUpperCase()} · XP:{state.xPoll?.toUpperCase()} · SOL:{solVote.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {errors[battle.battle_id] && (
                    <p className="text-xs text-red-400 mb-3">{errors[battle.battle_id]}</p>
                  )}

                  <div className="flex items-center gap-3">
                    {saved[battle.battle_id] ? (
                      <p className="text-xs text-[#95fe7c] font-bold">
                        {isOverride ? 'Result updated.' : 'Saved to database.'}
                      </p>
                    ) : (
                      <button
                        onClick={() => handleSubmit(battle)}
                        disabled={isPending || !state.humanJudge || !state.xPoll}
                        className="bg-[#95fe7c] hover:bg-[#7de066] disabled:opacity-40 text-[#0d1321] font-bold text-xs px-5 py-2 rounded-lg transition-colors font-rajdhani tracking-wide"
                      >
                        {isPending ? 'Saving…' : isOverride ? 'Update Result' : 'Save Judging Result'}
                      </button>
                    )}
                    {isOverride && (
                      <button
                        onClick={() => toggleOverride(battle.battle_id)}
                        className="text-xs text-muted-foreground hover:text-white border border-border px-3 py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isSettled && !isOverride && (
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Winner recorded in database.</span>
                  <button
                    onClick={() => toggleOverride(battle.battle_id)}
                    className="text-[10px] font-bold text-amber-400 border border-amber-400/30 hover:bg-amber-400/10 px-3 py-1 rounded transition-colors font-rajdhani tracking-wide"
                  >
                    Re-judge
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JudgeInput({ label, battleId, field, current, nameA, nameB, onChange }: {
  label: string
  battleId: number
  field: 'humanJudge' | 'xPoll'
  current: 'a' | 'b' | null
  nameA: string
  nameB: string
  onChange: (id: number, field: 'humanJudge' | 'xPoll', val: 'a' | 'b') => void
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <div className="flex gap-2">
        {(['a', 'b'] as const).map(side => (
          <button
            key={side}
            onClick={() => onChange(battleId, field, side)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-rajdhani border transition-colors ${
              current === side
                ? 'bg-[#95fe7c]/20 border-[#95fe7c]/60 text-[#95fe7c]'
                : 'bg-[#0d1321] border-border text-muted-foreground hover:text-white hover:border-border/80'
            }`}
          >
            {side === 'a' ? nameA : nameB}
          </button>
        ))}
      </div>
    </div>
  )
}
