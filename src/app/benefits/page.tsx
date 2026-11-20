import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { groupIntoEvents } from '@/lib/event-grouping'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Benefit Battles',
  description: 'Battles played for a cause. WaveWarZ waives its own share of every trade and settlement and sends it to the cause, onchain where anyone can check it.',
}

// ─── Facts the database doesn't hold ──────────────────────────────────────────
// Keyed by the UTC date of an event's first round (YYYY-MM-DD).

const POLYRAIDERS = {
  name: 'PolyRaiders',
  url: 'https://twitter.com/PolyRaiders',
  about: 'PolyRaiders is a multichain art and impact project co-founded by Ryajala (age 10) and her sisters. Through the HuRya Empowerment Foundation they have given sanitary pads to more than 4,000 girls and school supplies to more than 4,500 children, one NFT at a time.',
}

const EVENTS: Record<string, { title: string; flyer: string; fiatUsd: number; partner: typeof POLYRAIDERS }> = {
  '2025-12-12': { title: 'Holiday Heat Benefit Battle', flyer: '/events/holiday-heat-flyer.png', fiatUsd: 270, partner: POLYRAIDERS },
  '2026-02-13': { title: 'Love Song Benefit Battle', flyer: '/events/love-song-flyer.jpg', fiatUsd: 1221, partner: POLYRAIDERS },
}
const FIAT_USD = Object.values(EVENTS).reduce((s, e) => s + e.fiatUsd, 0)

const SUPPORTERS = [
  { name: 'Community of Communities', logo: '/sponsors/coc-logo.png', url: null },
  { name: 'PolyRaiders', logo: '/sponsors/polyraiders-logo.png', url: POLYRAIDERS.url },
  { name: 'ZABAL', logo: '/sponsors/zabal-logo.png', url: null },
  { name: 'Web3Hub', logo: '/sponsors/web3hub-logo.png', url: null },
  { name: 'Crypto Magazine', logo: '/sponsors/crypto-magazine-logo.png', url: null },
]

// What a benefit battle sends to the cause instead of to WaveWarZ: the platform's 0.5% of every trade
// (0.495% as the earlier page computed it) and its 3% share of the losing pool at settlement.
const FEE_SHARE = 0.00495
const SETTLE_SHARE = 0.03

// ─── Data ─────────────────────────────────────────────────────────────────────

type Row = {
  battle_id: number
  created_at: string
  artist1_name: string | null
  artist2_name: string | null
  artist1_pool: number | null
  artist2_pool: number | null
  total_volume_a: number | null
  total_volume_b: number | null
  image_url: string | null
  youtube_replay_link: string | null
  fiat_donation_proof_link: string | null
  winner_decided: boolean | string | number | null
  winner_artist_a: boolean | string | number | null
  event_subtype: string
}

const yes = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'
const clean = (s: string | null) => (s ?? '').trim()

type Round = { id: number; a: string; b: string; winner: 'a' | 'b' | null; traded: number; toCause: number; replay: string | null; proof: string | null }

function toRound(r: Row): Round {
  const traded = (r.total_volume_a ?? 0) + (r.total_volume_b ?? 0)
  const loserPool = Math.min(r.artist1_pool ?? 0, r.artist2_pool ?? 0)
  return {
    id: r.battle_id,
    a: clean(r.artist1_name) || 'Side A',
    b: clean(r.artist2_name) || 'Side B',
    // stored onchain settlement result, never recomputed here
    winner: yes(r.winner_decided) ? (yes(r.winner_artist_a) ? 'a' : 'b') : null,
    traded,
    toCause: traded * FEE_SHARE + loserPool * SETTLE_SHARE,
    replay: r.youtube_replay_link,
    proof: r.fiat_donation_proof_link,
  }
}

function tally(rounds: Round[]) {
  const wins = new Map<string, number>()
  for (const r of rounds) {
    for (const n of [r.a, r.b]) if (!wins.has(n)) wins.set(n, 0)
    if (r.winner) { const w = r.winner === 'a' ? r.a : r.b; wins.set(w, (wins.get(w) ?? 0) + 1) }
  }
  return [...wins.entries()]
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

// Spotlight rounds like "South of the City x Jango UU" vs "Wide Awake x Jango UU" are one artist's songs
// against each other: group those by the shared artist, everything else by the pair of names.
function featured(a: string, b: string): string | null {
  const m1 = a.match(/\sx\s(.+)$/i), m2 = b.match(/\sx\s(.+)$/i)
  return m1 && m2 && m1[1].trim().toLowerCase() === m2[1].trim().toLowerCase() ? m1[1].trim() : null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BenefitsPage() {
  const supabase = await createClient()
  const [{ data }, solPrice] = await Promise.all([
    supabase
      .from('battles')
      .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,image_url,youtube_replay_link,fiat_donation_proof_link,winner_decided,winner_artist_a,event_subtype')
      .in('event_subtype', ['charity', 'spotlight'])
      .eq('is_test_battle', false)
      .order('created_at', { ascending: true }),
    getLiveSolPrice(),
  ])
  const rows = (data ?? []) as Row[]
  const time = (r: Row) => new Date(r.created_at).getTime()

  // Benefit events: same two sides within a few hours = one event (src/lib/event-grouping.ts)
  const charity = groupIntoEvents(
    rows.filter(r => r.event_subtype === 'charity'),
    r => [clean(r.artist1_name).toLowerCase(), clean(r.artist2_name).toLowerCase()].sort().join('|'),
    time,
  ).map(group => {
    const key = group[0].created_at.slice(0, 10)
    const known = EVENTS[key]
    const rounds = group.map(toRound)
    return {
      key,
      date: group[0].created_at,
      title: known?.title ?? `${rounds[0].a} vs ${rounds[0].b}`,
      poster: known?.flyer ?? group.find(r => r.image_url)?.image_url ?? null,
      fiatUsd: known?.fiatUsd ?? 0,
      partner: known?.partner ?? null,
      rounds,
      score: tally(rounds),
      traded: rounds.reduce((s, r) => s + r.traded, 0),
      toCause: rounds.reduce((s, r) => s + r.toCause, 0),
    }
  }).reverse()

  const onchainSol = charity.reduce((s, e) => s + e.toCause, 0)
  const feesSol = charity.reduce((s, e) => s + e.rounds.reduce((t, r) => t + r.traded * FEE_SHARE, 0), 0)
  const onchainUsd = solPrice > 0 ? onchainSol * solPrice : 0

  const spotlights = groupIntoEvents(
    rows.filter(r => r.event_subtype === 'spotlight'),
    r => {
      const a = clean(r.artist1_name), b = clean(r.artist2_name)
      const f = featured(a, b)
      return f ? `feat:${f.toLowerCase()}` : [a.toLowerCase(), b.toLowerCase()].sort().join('|')
    },
    time,
  ).map(group => {
    const rounds = group.map(toRound)
    const feat = featured(rounds[0].a, rounds[0].b)
    return {
      id: group[0].battle_id,
      date: group[0].created_at,
      title: feat ?? `${rounds[0].a} vs ${rounds[0].b}`,
      sub: `${rounds.length} round${rounds.length === 1 ? '' : 's'}${feat ? `, ${feat}’s songs head to head` : ''}`,
      image: group.find(r => r.image_url)?.image_url ?? null,
      score: feat ? null : tally(rounds),
      traded: rounds.reduce((s, r) => s + r.traded, 0),
    }
  }).reverse()

  if (rows.length === 0) {
    return (
      <div className="wb">
        <header className="wb-head"><div className="wb-lede">
          <h1 className="font-rajdhani">Benefit Battles</h1>
          <p>The first benefit battle hasn’t played yet. When it does, every round and what it sent to the cause shows up here.</p>
        </div></header>
      </div>
    )
  }

  return (
    <div className="wb">
      <header className="wb-head">
        <div className="wb-lede">
          <h1 className="font-rajdhani">Benefit Battles</h1>
          <p>Some battles play for a cause. When they do, WaveWarZ gives up its own cut: the platform’s share of every trade and of the settlement goes to the cause’s wallet instead, on Solana where anyone can check it.</p>
        </div>

        <section className="ww-hl-panel wb-receipt" aria-labelledby="wb-raised">
          <h2 id="wb-raised">Raised for causes so far</h2>
          <dl>
            <div><dt>Trading fees waived</dt><dd>{formatSol(feesSol)} SOL</dd></div>
            <div><dt>Settlement share waived</dt><dd>{formatSol(onchainSol - feesSol)} SOL</dd></div>
            <div><dt>Card and PayPal gifts</dt><dd>~{usd(FIAT_USD)}</dd></div>
            <div className="sum"><dt>Total</dt><dd>~{usd(onchainUsd + FIAT_USD)}</dd></div>
          </dl>
          <p>{charity.length} events, {charity.reduce((s, e) => s + e.rounds.length, 0)} rounds. Waived fees are WaveWarZ’s own cut. Gifts are as reported by the causes. SOL counted at today’s price{solPrice > 0 ? `, ${usd(solPrice)}` : ''}.</p>
        </section>
      </header>

      <section className="wb-events" aria-labelledby="wb-events">
        <h2 id="wb-events" className="wb-h2">Every benefit battle</h2>
        {charity.map(e => <EventPlate key={e.key + e.rounds[0].id} e={e} />)}
      </section>

      <section className="wb-cause" aria-labelledby="wb-cause">
        <h2 id="wb-cause" className="wb-h2">Who it’s for</h2>
        <div className="wb-cause-grid">
          <div>
            <h3><a href={POLYRAIDERS.url} target="_blank" rel="noopener noreferrer">{POLYRAIDERS.name}</a></h3>
            <p>{POLYRAIDERS.about}</p>
          </div>
          <div>
            <h3>Giving without a crypto wallet</h3>
            <p>The Community of Communities asked a simple question: “Can I donate with a credit card?” So benefit battles also take card, PayPal, Apple Pay, Google Pay, Base Pay and x402. The swap to SOL happens with the payment provider, not in a WaveWarZ bank account, and each cause keeps its own receiving wallet and handles its own reporting.</p>
          </div>
        </div>
        <ul className="wb-logos" aria-label="Partners and community supporters">
          {SUPPORTERS.map(s => (
            <li key={s.name}>
              {s.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <a href={s.url} target="_blank" rel="noopener noreferrer"><img src={s.logo} alt={s.name} /></a>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={s.logo} alt={s.name} />}
            </li>
          ))}
        </ul>
      </section>

      <details className="ww-explain wb-explain">
        <summary>How the giving works, and how to check it</summary>
        <div>
          <p><b>The fee waiver.</b> In a normal battle WaveWarZ keeps 0.5% of every trade and 3% of the losing pool at settlement. In a benefit battle both go to the cause’s wallet instead.</p>
          <p><b>Giving directly.</b> Donation buttons on a benefit battle’s page send SOL straight to the cause’s wallet. WaveWarZ never holds the money.</p>
          <p><b>Checking it.</b> Every trade and transfer is a public Solana transaction that anyone can look up on Solscan, and the network fee on each is under a cent.</p>
          <p><b>Rankings.</b> Benefit battles and Artist Spotlights don’t count toward the leaderboards.</p>
        </div>
      </details>

      {spotlights.length > 0 && (
        <section className="wb-spot" aria-labelledby="wb-spot">
          <h2 id="wb-spot" className="wb-h2">Artist Spotlights</h2>
          <p className="wb-sub">Showcase battles for featured artists. They don’t count toward the rankings.</p>
          <ul className="wb-tiles">
            {spotlights.map(s => (
              <li key={s.id}>
                <Link href={`/battles/${s.id}`} className="wb-tile">
                  <span className="wb-tile-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.image && <img src={s.image} alt="" loading="lazy" />}
                  </span>
                  <span className="wb-tile-tx">
                    <b>{s.title}</b>
                    <span>{day(s.date)} · {s.sub}</span>
                    {s.score && s.score.length === 2 && (
                      <span className="wb-tile-score">{s.score[0][0]} <em>{s.score[0][1]}–{s.score[1][1]}</em> {s.score[1][0]}</span>
                    )}
                    <span className="wb-tile-n">{formatSol(s.traded)} SOL traded</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ─── One benefit event ────────────────────────────────────────────────────────

function EventPlate({ e }: { e: {
  key: string; date: string; title: string; poster: string | null; fiatUsd: number
  partner: typeof POLYRAIDERS | null; rounds: Round[]; score: [string, number][]; traded: number; toCause: number
} }) {
  const [x, y] = e.score
  return (
    <article className="ww-hl-panel wb-event">
      <div className="wb-poster">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.poster && <img src={e.poster} alt={`${e.title} flyer`} loading="lazy" />}
      </div>

      <div className="wb-body">
        <header>
          <h3>{e.title}</h3>
          <p>{day(e.date)} · {e.rounds.length} rounds{e.partner && <> · for <a href={e.partner.url} target="_blank" rel="noopener noreferrer">{e.partner.name}</a></>}</p>
        </header>

        {x && y && (
          <p className="wb-score" aria-label={`${x[0]} won ${x[1]} rounds, ${y[0]} won ${y[1]}`}>
            <span className={x[1] > y[1] ? 'w' : undefined}>{x[0]}</span>
            <b>{x[1]}<i>–</i>{y[1]}</b>
            <span className={y[1] > x[1] ? 'w' : undefined}>{y[0]}</span>
          </p>
        )}

        <table className="wb-rounds">
          <thead><tr><th scope="col">Round</th><th scope="col">Won by</th><th scope="col" className="n">Traded</th><th scope="col" className="n">To the cause</th></tr></thead>
          <tbody>
            {e.rounds.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/battles/${r.id}`}>Round {i + 1}</Link>
                  {r.replay && <a className="wb-x" href={r.replay} target="_blank" rel="noopener noreferrer">Replay</a>}
                  {r.proof && <a className="wb-x" href={r.proof} target="_blank" rel="noopener noreferrer">Donation proof</a>}
                </td>
                <td>{r.winner ? (r.winner === 'a' ? r.a : r.b) : 'Not settled'}</td>
                <td className="n">{formatSol(r.traded)}</td>
                <td className="n">{formatSol(r.toCause)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="wb-total">
          To the cause: <b>{formatSol(e.toCause)} SOL</b> waived onchain
          {e.fiatUsd > 0 && <> + <b>~{usd(e.fiatUsd)}</b> in card and PayPal gifts</>}
        </p>
      </div>
    </article>
  )
}
