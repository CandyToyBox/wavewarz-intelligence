'use client'

// A Quick Battle as a two-side scoreboard: song A (green) on the left, song B (blue) on the right, the decided
// result and its three factors in the middle, then every money number in one ledger and the onchain receipts.
// Winner logic is unchanged (decided 2-of-3 from page.tsx); this file only presents it. Styles: .bt-* in site-shell.css.
import { useState, type CSSProperties } from 'react'
import { Tip } from '@/components/tip'
import { Pfp } from '@/components/wavid/pfp'
import { Ledger, Receipts, Rcpt, solscan, SIDE_A, SIDE_B, PLATFORM } from './battle-parts'

export type QuickBattleCardData = {
  battle_id: number
  dateFormatted: string
  isV2?: boolean  // true = Poll + Charts + DJ Wavy; false/absent = Charts Only
  // Factor breakdown: which side each factor went to (null = no data or a tie)
  chartsA: boolean
  pollA: boolean | null
  djA: boolean | null
  scoreFor: number
  scoreAgainst: number
  pollWinnerTitle: string | null
  pollIsTie: boolean
  pollVotesA: number | null
  pollVotesB: number | null
  chartsWinnerTitle: string
  djWavyWinnerTitle: string | null
  // Songs and the artists behind them
  song1Title: string
  song2Title: string
  song1Link: string | null
  song2Link: string | null
  song1Handle: string | null
  song2Handle: string | null
  song1ArtUrl: string | null
  song2ArtUrl: string | null
  song1PfpUrl: string | null
  song2PfpUrl: string | null
  song1Wavid: string | null
  song2Wavid: string | null
  // Pools (final)
  song1PoolSol: string
  song1PoolUsd: string
  song2PoolSol: string
  song2PoolUsd: string
  // Volumes
  song1VolSol: string
  song1VolUsd: string
  song2VolSol: string
  song2VolUsd: string
  // Totals
  totalVolSol: string
  totalVolUsd: string
  streamEquivalent: string
  // Winner
  winnerTitle: string
  loserTitle: string
  winnerIsA: boolean
  marginSol: string
  marginPct: string
  // Artist earnings
  song1EarnSol: string
  song1EarnUsd: string
  song1EarnStreams: string
  song1TradeFeesSol: string
  song1TradeFeesUsd: string
  song1SettleSol: string
  song1SettleUsd: string
  song1SettleLabel: string
  song2EarnSol: string
  song2EarnUsd: string
  song2EarnStreams: string
  song2TradeFeesSol: string
  song2TradeFeesUsd: string
  song2SettleSol: string
  song2SettleUsd: string
  song2SettleLabel: string
  // Platform
  platformEarnSol: string
  platformEarnUsd: string
  platformTradeFeesSol: string
  platformTradeFeesUsd: string
  platformSettleSol: string
  platformSettleUsd: string
  // Wallets
  song1Wallet: string | null
  song2Wallet: string | null
  wavewarzWallet: string | null
  vaultAddress: string
  battleAddress: string
}

const settleNote = (label: string) => label.startsWith('Winner') ? '5% winner bonus' : '2% consolation'

export function QuickBattleCard({ data: d }: { data: QuickBattleCardData }) {
  const winColor = d.winnerIsA ? SIDE_A : SIDE_B
  const sideOf = (a: boolean | null) => a === null ? null : a ? { name: d.song1Title, color: SIDE_A } : { name: d.song2Title, color: SIDE_B }
  const charts = sideOf(d.chartsA)
  const poll = sideOf(d.pollA)
  const dj = sideOf(d.djA)
  const hasScore = d.isV2 && d.scoreFor + d.scoreAgainst > 0

  return (
    <article className="rounded-xl border border-border bg-card bt-card" aria-label={`${d.song1Title} vs ${d.song2Title}`}>
      <header className="bt-head">
        <span className="bt-type" style={{ '--side': SIDE_B } as CSSProperties}>Quick Battle</span>
        <time>{d.dateFormatted}</time>
        {d.isV2 === true && (
          <Tip text="V2 winner system: Poll (live listener vote) + Charts (bigger SOL pool) + DJ Wavy (AI judge). 2 out of 3 wins. Launched March 10, 2026.">
            <span className="bt-sys">Poll + Charts + DJ Wavy · 2 of 3</span>
          </Tip>
        )}
        {d.isV2 === false && (
          <Tip text="V1 winner system: Charts only. Whichever song had the bigger SOL pool when time ran out. Replaced March 10, 2026.">
            <span className="bt-sys">V1 · Charts only</span>
          </Tip>
        )}
      </header>

      <div className="bt-board">
        <Side side="a" title={d.song1Title} art={d.song1ArtUrl} wavid={d.song1Wavid} pfp={d.song1PfpUrl}
          handle={d.song1Handle} link={d.song1Link} win={d.winnerIsA}
          pool={[d.song1PoolSol, d.song1PoolUsd]} earned={[d.song1EarnSol, d.song1EarnUsd]} />

        <div className="bt-result">
          <p className="bt-verdict">
            <b style={{ color: winColor }}>{d.winnerTitle}</b>
            <span>{hasScore ? <>wins <em>{d.scoreFor}–{d.scoreAgainst}</em></> : d.isV2 ? 'wins' : 'wins on Charts'}</span>
          </p>
          <ul className="bt-factors" aria-label="How the result was decided">
            <Factor k="Charts" who={charts} detail={Number(d.marginSol) === 0 ? 'Pools level' : `Pool led by ◎${d.marginSol} (${d.marginPct}%)`} />
            {d.isV2 && (
              <Factor k="Poll" who={poll}
                detail={d.pollIsTie ? 'Tied' : d.pollVotesA !== null && d.pollVotesB !== null ? `Votes ${d.pollVotesA}–${d.pollVotesB}` : poll ? undefined : 'No poll data'} />
            )}
            {d.isV2 && <Factor k="DJ Wavy" who={dj} detail={dj ? 'AI judge pick' : 'No pick recorded'} />}
          </ul>
        </div>

        <Side side="b" title={d.song2Title} art={d.song2ArtUrl} wavid={d.song2Wavid} pfp={d.song2PfpUrl}
          handle={d.song2Handle} link={d.song2Link} win={!d.winnerIsA}
          pool={[d.song2PoolSol, d.song2PoolUsd]} earned={[d.song2EarnSol, d.song2EarnUsd]} />
      </div>

      <p className="bt-sum">
        <Tip text="Total SOL traded by fans on both sides: buys and sells from the vault's real transaction history. Trader claims happen separately after settlement; Verify Onchain shows the vault's full activity." wide>
          <span>Traded</span>
        </Tip>
        <b>◎{d.totalVolSol}</b><small>{d.totalVolUsd}</small>
        <span className="bt-dot" aria-hidden="true" />
        <span>Spotify equivalent</span><b>≈ {d.streamEquivalent}</b>
      </p>

      <Ledger caption={`Earnings for ${d.song1Title} vs ${d.song2Title}`} parties={[
        {
          name: d.song1Title, color: SIDE_A, wallet: d.song1Wallet, streams: d.song1EarnStreams,
          traded: { sol: d.song1VolSol, usd: d.song1VolUsd },
          fee: { sol: d.song1TradeFeesSol, usd: d.song1TradeFeesUsd, note: '1%' },
          settle: { sol: d.song1SettleSol, usd: d.song1SettleUsd, note: settleNote(d.song1SettleLabel) },
          earned: { sol: d.song1EarnSol, usd: d.song1EarnUsd },
        },
        {
          name: d.song2Title, color: SIDE_B, wallet: d.song2Wallet, streams: d.song2EarnStreams,
          traded: { sol: d.song2VolSol, usd: d.song2VolUsd },
          fee: { sol: d.song2TradeFeesSol, usd: d.song2TradeFeesUsd, note: '1%' },
          settle: { sol: d.song2SettleSol, usd: d.song2SettleUsd, note: settleNote(d.song2SettleLabel) },
          earned: { sol: d.song2EarnSol, usd: d.song2EarnUsd },
        },
        {
          name: 'WaveWarZ platform', color: PLATFORM, wallet: d.wavewarzWallet, streams: null,
          traded: { sol: d.totalVolSol, usd: d.totalVolUsd, note: 'both sides' },
          fee: { sol: d.platformTradeFeesSol, usd: d.platformTradeFeesUsd, note: '0.5%' },
          settle: { sol: d.platformSettleSol, usd: d.platformSettleUsd, note: '3% of losing pool' },
          earned: { sol: d.platformEarnSol, usd: d.platformEarnUsd },
        },
      ]} />

      <Receipts>
        <Rcpt href={solscan(d.vaultAddress)}>Verify Onchain</Rcpt>
        <Rcpt href={solscan(d.battleAddress)}>Battle account</Rcpt>
        <Rcpt href={`/battles/${d.battle_id}`} internal>Battle #{d.battle_id}</Rcpt>
      </Receipts>
    </article>
  )
}

function Factor({ k, who, detail }: { k: string; who: { name: string; color: string } | null; detail?: string }) {
  return (
    <li style={{ '--side': who?.color ?? 'rgba(216,235,252,.35)' } as CSSProperties} className={who ? undefined : 'none'}>
      <span className="bt-f-k"><i aria-hidden="true" />{k}</span>
      <span className="bt-f-v">{who ? who.name : 'No result'}</span>
      {detail && <span className="bt-f-d">{detail}</span>}
    </li>
  )
}

function Side({ side, title, art, wavid, pfp, handle, link, win, pool, earned }: {
  side: 'a' | 'b'; title: string; art: string | null; wavid: string | null; pfp: string | null
  handle: string | null; link: string | null; win: boolean; pool: [string, string]; earned: [string, string]
}) {
  const color = side === 'a' ? SIDE_A : SIDE_B
  const [bad, setBad] = useState(false)
  return (
    <section className={`bt-side ${side}${win ? ' win' : ''}`} style={{ '--side': color } as CSSProperties} aria-label={`${title}${win ? ', winner' : ''}`}>
      <div className="bt-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art && !bad ? <img src={art} alt={`${title} cover art`} loading="lazy" onError={() => setBad(true)} /> : <b aria-hidden="true">{title.charAt(0).toUpperCase()}</b>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {wavid && <img className="bt-cover-wid" src={wavid} alt={handle ? `@${handle}'s Wave ID` : 'Wave ID'} loading="lazy" />}
      </div>
      <div className="bt-side-txt">
        {win && <span className="bt-win">Winner</span>}
        <h3 className="bt-name">{title}</h3>
        {handle && link && (
          <a className="bt-by" href={link} target="_blank" rel="noreferrer">
            <Pfp className="bt-by-pfp" src={pfp} name={handle} />@{handle} on Audius
          </a>
        )}
        <dl className="bt-nums">
          <div><dt>Final pool</dt><dd><b>◎{pool[0]}</b><small>{pool[1]}</small></dd></div>
          <div><dt>Artist earned</dt><dd><b>◎{earned[0]}</b><small>{earned[1]}</small></dd></div>
        </dl>
      </div>
    </section>
  )
}
