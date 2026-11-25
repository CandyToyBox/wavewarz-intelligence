'use client'

// A Main / Community / Benefit / Spotlight event: the flyer, both fighters with their Wave IDs, the event result,
// each artist's earnings totalled across rounds, and every round's full numbers and receipts behind "View rounds".
// Round winners come from page.tsx (judging panel result) unchanged. Styles: .bt-* in site-shell.css.
import { useState, type CSSProperties } from 'react'
import { BattleImage } from './battle-image'
import { Tip } from '@/components/tip'
import { IdMark, Ledger, Receipts, Rcpt, solscan, SIDE_A, SIDE_B, PLATFORM } from './battle-parts'

export type RoundData = {
  battle_id: number
  roundNumber: number
  dateFormatted: string
  artist1Name: string
  artist2Name: string
  // Pool values
  a1PoolSol: string
  a2PoolSol: string
  a1PoolUsd: string
  a2PoolUsd: string
  // Volumes
  a1VolSol: string
  a2VolSol: string
  a1VolUsd: string
  a2VolUsd: string
  totalVolSol: string
  totalVolUsd: string
  streamEquivalent: string
  // Winner
  winner: string
  loser: string
  winnerIsA: boolean
  marginSol: string
  marginPct: string
  pct1: number
  pct2: number
  rawA1Earn: number
  rawA2Earn: number
  rawPlatEarn: number
  // Earnings
  a1EarnSol: string
  a1EarnUsd: string
  a1EarnStreams: string
  a1TradeFeesSol: string
  a1TradeFeesUsd: string
  a1SettleSol: string
  a1SettleUsd: string
  a1SettleLabel: string
  a2EarnSol: string
  a2EarnUsd: string
  a2EarnStreams: string
  a2TradeFeesSol: string
  a2TradeFeesUsd: string
  a2SettleSol: string
  a2SettleUsd: string
  a2SettleLabel: string
  platformEarnSol: string
  platformEarnUsd: string
  platformTradeFeesSol: string
  platformTradeFeesUsd: string
  platformSettleSol: string
  platformSettleUsd: string
  // Links
  youtubeLink: string | null
  streamLink: string | null
  // Wallets
  a1Wallet: string | null
  a2Wallet: string | null
  wavewarzWallet: string | null
  vaultAddress: string
  battleAddress: string
}

export type EventGroupCardData = {
  groupKey: string
  eventType: 'main' | 'community' | 'charity' | 'spotlight'
  artist1Name: string
  artist2Name: string
  artist1PfpUrl: string | null
  artist2PfpUrl: string | null
  artist1Wavid: string | null
  artist2Wavid: string | null
  imageUrl: string | null
  latestDateFormatted: string
  totalRounds: number
  totalVolSol: string
  totalVolUsd: string
  streamEquivalent: string
  overallWinner: string | null
  overallWinnerIsA: boolean | null
  a1Wins: number
  a2Wins: number
  a1EarnSol: string
  a1EarnUsd: string
  a2EarnSol: string
  a2EarnUsd: string
  platformEarnSol: string
  platformEarnUsd: string
  rounds: RoundData[]
}

const TYPE_LABEL = { main: 'Main Event', community: 'Community', charity: 'Benefit', spotlight: 'Spotlight' } as const
const TYPE_COLOR = { main: '#95fe7c', community: '#f2a74b', charity: '#76f3df', spotlight: '#e5c25a' } as const
const settleNote = (label: string) => label.startsWith('Winner') ? '5% winner bonus' : '2% consolation'

export function EventGroupCard({ data: d }: { data: EventGroupCardData }) {
  const [open, setOpen] = useState(false)
  const multi = d.totalRounds > 1
  const first = d.rounds[0]
  const last = d.rounds[d.rounds.length - 1]
  const winColor = d.overallWinnerIsA === null ? '#daecfd' : d.overallWinnerIsA ? SIDE_A : SIDE_B
  const panelId = `rounds-${d.groupKey}`

  return (
    <article className="rounded-xl border border-border bg-card bt-card bt-event" aria-label={`${d.artist1Name} vs ${d.artist2Name}`}>
      <div className="bt-ev-top">
        <div className="bt-flyer">
          <BattleImage src={d.imageUrl} alt={`${d.artist1Name} vs ${d.artist2Name} battle flyer`} className="w-full h-full" fallbackText={d.artist1Name} />
        </div>

        <div className="bt-ev-body">
          <header className="bt-head">
            <span className="bt-type" style={{ '--side': TYPE_COLOR[d.eventType] } as CSSProperties}>{TYPE_LABEL[d.eventType]}</span>
            {multi && <span className="bt-soft">{d.totalRounds} rounds</span>}
            <time>{d.latestDateFormatted}</time>
          </header>

          <div className="bt-fighters">
            <Fighter name={d.artist1Name} pfp={d.artist1PfpUrl} wavid={d.artist1Wavid} color={SIDE_A}
              win={d.overallWinnerIsA === true} rounds={multi ? d.a1Wins : null} earned={[d.a1EarnSol, d.a1EarnUsd]} />
            <span className="bt-vs" aria-hidden="true">vs</span>
            <Fighter name={d.artist2Name} pfp={d.artist2PfpUrl} wavid={d.artist2Wavid} color={SIDE_B}
              win={d.overallWinnerIsA === false} rounds={multi ? d.a2Wins : null} earned={[d.a2EarnSol, d.a2EarnUsd]} />
          </div>

          <p className="bt-verdict ev">
            {d.overallWinner
              ? <><b style={{ color: winColor }}>{d.overallWinner}</b><span>{multi ? <>wins the event <em>{Math.max(d.a1Wins, d.a2Wins)}–{Math.min(d.a1Wins, d.a2Wins)}</em></> : 'wins'}</span></>
              : <><b>Event drawn</b><span><em>{d.a1Wins}–{d.a2Wins}</em></span></>}
          </p>

          {multi && (
            <ol className="bt-strip" aria-label="Round winners">
              {d.rounds.map(r => (
                <li key={r.battle_id} style={{ '--side': r.winnerIsA ? SIDE_A : SIDE_B } as CSSProperties}>
                  <span>R{r.roundNumber}</span><i aria-hidden="true" />{r.winner}
                </li>
              ))}
            </ol>
          )}

          <p className="bt-sum">
            <Tip text="Every buy and sell across all rounds, from the vaults' real transaction history. Trader claims happen separately after settlement." wide>
              <span>Traded</span>
            </Tip>
            <b>◎{d.totalVolSol}</b><small>{d.totalVolUsd}</small>
            <span className="bt-dot" aria-hidden="true" />
            <span>Spotify equivalent</span><b>≈ {d.streamEquivalent}</b>
            <span className="bt-dot" aria-hidden="true" />
            <span>Platform earned</span><b style={{ color: PLATFORM }}>◎{d.platformEarnSol}</b><small>{d.platformEarnUsd}</small>
          </p>

          <div className="bt-actions">
            <button type="button" className="ww-chip sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
              {open ? 'Hide' : 'Show'} {multi ? `all ${d.totalRounds} rounds` : 'the full numbers'}
            </button>
            {first?.youtubeLink && <a className="bt-link" href={first.youtubeLink} target="_blank" rel="noreferrer">Watch replay</a>}
            {first?.streamLink && <a className="bt-link" href={first.streamLink} target="_blank" rel="noreferrer">Stream</a>}
          </div>
        </div>
      </div>

      {!open && first && (
        <Receipts>
          <Rcpt href={solscan(first.vaultAddress)}>Verify Onchain{multi ? ' (round 1)' : ''}</Rcpt>
          <Rcpt href={solscan(first.battleAddress)}>Battle account{multi ? ' (round 1)' : ''}</Rcpt>
          <Rcpt href={`/battles/${first.battle_id}`} internal>Battle #{first.battle_id}{multi ? `–#${last.battle_id}` : ''}</Rcpt>
        </Receipts>
      )}

      <div id={panelId} hidden={!open}>
        {open && d.rounds.map(r => <Round key={r.battle_id} r={r} multi={multi} />)}
      </div>
    </article>
  )
}

function Fighter({ name, pfp, wavid, color, win, rounds, earned }: {
  name: string; pfp: string | null; wavid: string | null; color: string; win: boolean; rounds: number | null; earned: [string, string]
}) {
  return (
    <div className={`bt-fighter${win ? ' win' : ''}`} style={{ '--side': color } as CSSProperties}>
      <IdMark name={name} pfpUrl={pfp} wavid={wavid} color={color} size={56} />
      <div className="min-w-0">
        {win && <span className="bt-win">Winner</span>}
        <h3 className="bt-name">{name}</h3>
        <p className="bt-fig"><span>Earned</span><b>◎{earned[0]}</b><small>{earned[1]}</small></p>
        {rounds !== null && <p className="bt-soft">{rounds} {rounds === 1 ? 'round' : 'rounds'} won</p>}
      </div>
    </div>
  )
}

function Round({ r, multi }: { r: RoundData; multi: boolean }) {
  return (
    <section className="bt-round" aria-label={`Round ${r.roundNumber}`}>
      <header className="bt-round-head">
        {multi && <b>Round {r.roundNumber}</b>}
        <time>{r.dateFormatted}</time>
        <span><b style={{ color: r.winnerIsA ? SIDE_A : SIDE_B }}>{r.winner}</b> won{multi ? ' the round' : ''}</span>
      </header>

      <div className="bt-pools" aria-label="Final pools">
        {[
          { name: r.artist1Name, sol: r.a1PoolSol, usd: r.a1PoolUsd, pct: r.pct1, color: SIDE_A, win: r.winnerIsA },
          { name: r.artist2Name, sol: r.a2PoolSol, usd: r.a2PoolUsd, pct: r.pct2, color: SIDE_B, win: !r.winnerIsA },
        ].map(p => (
          <div key={p.name} className="bt-pool-row" style={{ '--side': p.color } as CSSProperties}>
            <span className="bt-pool-n">{p.name}{p.win && <span className="sr-only"> (round winner)</span>}</span>
            <span className="bt-bar" aria-hidden="true"><i style={{ width: `${p.pct}%` }} /></span>
            <b>◎{p.sol}</b><small>{p.usd}</small>
          </div>
        ))}
        <p className="bt-soft">Final pools. Gap ◎{r.marginSol} ({r.marginPct}%). The round winner comes from the judging, not the pool size.</p>
      </div>

      <Ledger caption={`Round ${r.roundNumber} earnings`} parties={[
        {
          name: r.artist1Name, color: SIDE_A, wallet: r.a1Wallet, streams: r.a1EarnStreams,
          traded: { sol: r.a1VolSol, usd: r.a1VolUsd },
          fee: { sol: r.a1TradeFeesSol, usd: r.a1TradeFeesUsd, note: '1%' },
          settle: { sol: r.a1SettleSol, usd: r.a1SettleUsd, note: settleNote(r.a1SettleLabel) },
          earned: { sol: r.a1EarnSol, usd: r.a1EarnUsd },
        },
        {
          name: r.artist2Name, color: SIDE_B, wallet: r.a2Wallet, streams: r.a2EarnStreams,
          traded: { sol: r.a2VolSol, usd: r.a2VolUsd },
          fee: { sol: r.a2TradeFeesSol, usd: r.a2TradeFeesUsd, note: '1%' },
          settle: { sol: r.a2SettleSol, usd: r.a2SettleUsd, note: settleNote(r.a2SettleLabel) },
          earned: { sol: r.a2EarnSol, usd: r.a2EarnUsd },
        },
        {
          name: 'WaveWarZ platform', color: PLATFORM, wallet: r.wavewarzWallet, streams: null,
          traded: { sol: r.totalVolSol, usd: r.totalVolUsd, note: `both sides · ≈ ${r.streamEquivalent}` },
          fee: { sol: r.platformTradeFeesSol, usd: r.platformTradeFeesUsd, note: '0.5%' },
          settle: { sol: r.platformSettleSol, usd: r.platformSettleUsd, note: '3% of losing pool' },
          earned: { sol: r.platformEarnSol, usd: r.platformEarnUsd },
        },
      ]} />

      <Receipts>
        {r.youtubeLink && <Rcpt href={r.youtubeLink}>Watch</Rcpt>}
        <Rcpt href={solscan(r.vaultAddress)}>Verify Onchain</Rcpt>
        <Rcpt href={solscan(r.battleAddress)}>Battle account</Rcpt>
        <Rcpt href={`/battles/${r.battle_id}`} internal>Battle #{r.battle_id}</Rcpt>
      </Receipts>
    </section>
  )
}
