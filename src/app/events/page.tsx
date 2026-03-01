import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { SpotlightEventCard } from './spotlight-event-card'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Events & Philanthropy — WaveWarZ Intelligence',
  description: 'Every SOL raised moves directly from the arena to the cause. No overhead. No middlemen. Verifiable onchain.',
}

// ─── Sponsor / Partner Config ─────────────────────────────────────────────────
// Drop logo files in /public/sponsors/ and update these paths.

const SPONSORS = [
  {
    name: 'Community of Communities',
    short: 'C.O.C.',
    logo: '/sponsors/coc-logo.png',
    url: null,
  },
  {
    name: 'PolyRaiders',
    short: 'PolyRaiders',
    logo: '/sponsors/polyraiders-logo.png',
    url: 'https://twitter.com/PolyRaiders',
  },
  {
    name: 'ZABAL',
    short: 'ZABAL',
    logo: '/sponsors/zabal-logo.png',
    url: null,
  },
  {
    name: 'Web3Hub',
    short: 'Web3Hub',
    logo: '/sponsors/web3hub-logo.png',
    url: null,
  },
  {
    name: 'Crypto Magazine',
    short: 'Crypto Magazine',
    logo: '/sponsors/crypto-magazine-logo.png',
    url: null,
  },
]

// ─── Hardcoded Event Config ────────────────────────────────────────────────────
// Event-specific metadata that isn't in the DB (flyers, fiat stats, partner socials)

const POLYRAIDERS_SOCIALS = {
  twitter: 'https://twitter.com/PolyRaiders',
  youtube: null as string | null,
  instagram: null as string | null,
}

const CHARITY_EVENTS: Record<string, {
  title: string
  subtitle: string
  date: string
  flyer: string | null
  fiatUsd: number
  fiatSolscanUrl: string | null
  partnerName: string
  partnerDescription: string
  partnerSocials: typeof POLYRAIDERS_SOCIALS
}> = {
  // Key = battle_id (as string) OR match by event name convention
  holiday: {
    title: 'Holiday Heat Benefit Battle',
    subtitle: 'Indiez vs Classicz — Round 1',
    date: 'December 12, 2024',
    flyer: '/events/holiday-heat-flyer.png',
    fiatUsd: 270,
    fiatSolscanUrl: null, // Add Solscan link when available
    partnerName: 'PolyRaiders',
    partnerDescription: 'PolyRaiders is a multichain art & impact project co-founded by Ryajala (age 10) and her sisters. Through the HuRya Empowerment Foundation, they\'ve donated sanitary pads to 4,000+ girls and school supplies to 4,500+ children — one NFT at a time.',
    partnerSocials: POLYRAIDERS_SOCIALS,
  },
  lovesong: {
    title: 'Love Song Benefit Battle',
    subtitle: 'Indiez vs Classicz — Round 2',
    date: 'February 13, 2025',
    flyer: '/events/love-song-flyer.jpg',
    fiatUsd: 1221,
    fiatSolscanUrl: null, // Add Solscan link when available
    partnerName: 'PolyRaiders',
    partnerDescription: 'PolyRaiders is a multichain art & impact project co-founded by Ryajala (age 10) and her sisters. Through the HuRya Empowerment Foundation, they\'ve donated sanitary pads to 4,000+ girls and school supplies to 4,500+ children — one NFT at a time.',
    partnerSocials: POLYRAIDERS_SOCIALS,
  },
}

// Total fiat raised across all events
const TOTAL_FIAT_USD = Object.values(CHARITY_EVENTS).reduce((s, e) => s + e.fiatUsd, 0)

// ─── Types ────────────────────────────────────────────────────────────────────

type BenefitBattle = {
  battle_id: number
  created_at: string
  artist1_name: string
  artist2_name: string
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  charity_name: string | null
  fiat_donation_proof_link: string | null
  image_url: string | null
  stream_link: string | null
  youtube_replay_link: string | null
  event_subtype: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getSpecialBattles(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('battles')
    .select('battle_id,created_at,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,charity_name,fiat_donation_proof_link,image_url,stream_link,youtube_replay_link,event_subtype')
    .in('event_subtype', ['charity', 'spotlight'])
    .eq('is_test_battle', false)
    .order('created_at', { ascending: false })

  return (data ?? []) as BenefitBattle[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventsPage() {
  const supabase = await createClient()
  const [battles, solPrice] = await Promise.all([
    getSpecialBattles(supabase),
    getLiveSolPrice(),
  ])

  const charityBattles = battles.filter(b => b.event_subtype === 'charity')
  const spotlightBattles = battles.filter(b => b.event_subtype === 'spotlight')

  // Aggregate impact across all benefit battles
  const totalVolume = charityBattles.reduce(
    (s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0
  )
  const totalLoserPools = charityBattles.reduce((s, b) => {
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0
    return s + Math.min(p1, p2)
  }, 0)

  // Platform redirects 100% of its fees to charity
  const redirectedTradingFees = totalVolume * 0.005
  const redirectedSettlement = totalLoserPools * 0.03
  const totalOnchainRedirected = redirectedTradingFees + redirectedSettlement

  // Grand total: onchain SOL (converted to USD) + all fiat donations
  const totalOnchainUsd = solPrice > 0 ? totalOnchainRedirected * solPrice : 0
  const grandTotalUsd = totalOnchainUsd + TOTAL_FIAT_USD

  // Compute event winners from battle pool data
  function getEventWinner(eventBattles: BenefitBattle[]): string | null {
    const wins: Record<string, number> = {}
    for (const b of eventBattles) {
      const a1Won = (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
      const winner = a1Won ? b.artist1_name : b.artist2_name
      wins[winner] = (wins[winner] ?? 0) + 1
    }
    const entries = Object.entries(wins).sort((a, b) => b[1] - a[1])
    return entries[0]?.[0] ?? null
  }

  const holidayBattles = charityBattles.filter(b =>
    b.artist1_name?.toLowerCase().includes('indiez') ||
    b.artist2_name?.toLowerCase().includes('classicz') ||
    new Date(b.created_at).getMonth() === 11
  )
  const lovesongBattles = charityBattles.filter(b => new Date(b.created_at).getMonth() === 1)

  const holidayWinner = getEventWinner(holidayBattles)
  const lovesongWinner = getEventWinner(lovesongBattles)

  return (
    <div className="space-y-12">

      {/* ── HERO ── */}
      <header className="relative rounded-2xl overflow-hidden border border-[#95fe7c]/20 bg-gradient-to-br from-[#0d1321] via-[#0a1a0a] to-[#0d1321] p-10">
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, #95fe7c 0%, transparent 60%), radial-gradient(circle at 80% 50%, #7ec1fb 0%, transparent 60%)',
          }}
        />
        <div className="relative">
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest mb-4">
            BENEFIT BATTLES & SPOTLIGHTS
          </Badge>
          <h1 className="text-5xl font-rajdhani font-bold tracking-tight text-white mb-3">
            Charity Events Like{' '}
            <span className="text-[#95fe7c]">Never Before</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            The crowd is the fundraiser. Every trade, every vote, every SOL moves directly from the arena to the cause.
            No administrative overhead. No middlemen. Every transaction verifiable onchain.
          </p>
        </div>
      </header>

      {/* ── FRICTIONLESS GIVING TRACKER ── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">
            Frictionless Giving Tracker
          </h2>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest animate-pulse">
            LIVE TALLY
          </Badge>
        </div>

        {/* Impact numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <ImpactCard
            label="Total Onchain Redirected"
            value={`${formatSol(totalOnchainRedirected)} SOL`}
            sub={solToUsd(totalOnchainRedirected, solPrice)}
            note="Platform fees waived — 100% to charity"
            color="green"
          />
          <ImpactCard
            label="Trading Fees Redirected"
            value={`${formatSol(redirectedTradingFees)} SOL`}
            sub={`${formatSol(totalVolume)} SOL total volume`}
            note="0.5% platform share → charity wallet"
            color="blue"
          />
          <ImpactCard
            label="Settlement Bonuses Redirected"
            value={`${formatSol(redirectedSettlement)} SOL`}
            sub={`${charityBattles.length} benefit battles`}
            note="3% settlement bonus → charity wallet"
            color="green"
          />
          <ImpactCard
            label="Fiat Donations Raised"
            value={`~$${TOTAL_FIAT_USD.toLocaleString()} USD`}
            sub="TradFi + platform fees combined"
            note="cc / debit / PayPal / Apple Pay / Google Pay"
            color="blue"
            fiatSolscanUrl={null}
          />
        </div>

        {/* Grand Total Banner */}
        <div className="rounded-xl border border-[#95fe7c]/40 bg-gradient-to-r from-[#95fe7c]/10 via-[#0d1321] to-[#7ec1fb]/10 p-5 mb-6">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 text-center">
            Grand Total — WaveWarZ Benefit Battles Has Raised for Charity
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">SOL Donations (onchain)</p>
              <p className="font-mono font-bold text-lg text-white">{formatSol(totalOnchainRedirected)} SOL</p>
              <p className="text-xs text-muted-foreground">≈ ${totalOnchainUsd.toFixed(2)} USD</p>
            </div>
            <span className="text-2xl font-rajdhani font-bold text-muted-foreground">+</span>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Fiat Donations</p>
              <p className="font-rajdhani font-bold text-lg text-[#7ec1fb]">~${TOTAL_FIAT_USD.toLocaleString()} USD</p>
              <p className="text-xs text-muted-foreground">cc / PayPal / Apple Pay</p>
            </div>
            <span className="text-2xl font-rajdhani font-bold text-muted-foreground">=</span>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Grand Total</p>
              <p className="text-3xl font-rajdhani font-bold text-[#95fe7c]">~${grandTotalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</p>
              <p className="text-xs text-[#95fe7c]/70 font-bold uppercase tracking-widest">For the Cause</p>
            </div>
          </div>
        </div>

      </section>

      {/* ── FIAT BRIDGE ── */}
      <section className="rounded-xl border border-[#7ec1fb]/20 bg-[#111827] p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-[#7ec1fb]/10 border border-[#7ec1fb]/30 flex items-center justify-center">
            <span className="text-[#7ec1fb] text-lg font-bold font-rajdhani">$</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-rajdhani font-bold text-white mb-2 tracking-wide">
              Bright Ideas Lead to More Donations
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              When communities work together, fundamental questions get answered. The C.O.C. asked: <span className="text-white italic">"Can I donate with a credit card?"</span> — and we built the answer. By offering traditional payment methods (credit/debit, PayPal, Apple Pay, Google Pay, BasePay, Agent Pay X402) alongside crypto, WaveWarZ unlocked an entirely new donor base.
            </p>
            <div className="rounded-lg bg-[#95fe7c]/5 border border-[#95fe7c]/20 px-4 py-3 mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">PolyRaiders Holiday Music Battle — Case Study</p>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xl font-rajdhani font-bold text-[#95fe7c]">~$270 USD</p>
                  <p className="text-xs text-muted-foreground">TradFi payments (cc/debit/PayPal)</p>
                </div>
                <div className="border-l border-border pl-6">
                  <p className="text-xl font-rajdhani font-bold text-[#7ec1fb]">$1,221 USD</p>
                  <p className="text-xs text-muted-foreground">Fiat raised + WaveWarZ platform fees</p>
                </div>
                <div className="border-l border-border pl-6">
                  <p className="text-xl font-rajdhani font-bold text-white">$1,491 USD</p>
                  <p className="text-xs text-muted-foreground">Total raised combined</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              The fiat swap happens at the network layer — not through WaveWarZ bank accounts — maintaining full regulatory clarity and avoiding tax complications for the platform.
            </p>
            <p className="text-xs text-muted-foreground border-l-2 border-[#7ec1fb]/40 pl-3 italic mb-6">
              WaveWarZ provides the technology and donation infrastructure. Each community maintains its own receiving wallet and is responsible for their own fiat conversion and reporting.
            </p>

            {/* ── SPONSOR LOGOS ── */}
            <div className="pt-4 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Partners & Community Supporters</p>
              <div className="flex flex-wrap items-center gap-6">
                {SPONSORS.map(s => (
                  s.url ? (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      title={s.name}
                      className="opacity-70 hover:opacity-100 transition-opacity"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.logo} alt={s.name} className="h-10 w-auto object-contain" />
                    </a>
                  ) : (
                    <div key={s.name} title={s.name} className="opacity-70">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.logo} alt={s.name} className="h-10 w-auto object-contain" />
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EVENT #1: HOLIDAY HEAT BENEFIT BATTLE ── */}
      <section>
        <EventSectionHeader
          number="01"
          title={CHARITY_EVENTS.holiday.title}
          subtitle={CHARITY_EVENTS.holiday.subtitle}
          date={CHARITY_EVENTS.holiday.date}
          winner={holidayWinner}
        />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
          {/* Flyer + fiat total */}
          <div className="lg:col-span-2 space-y-3">
            <FlyerCard src={CHARITY_EVENTS.holiday.flyer} alt={CHARITY_EVENTS.holiday.title} />
            <FiatTotalCard fiatUsd={CHARITY_EVENTS.holiday.fiatUsd} solscanUrl={CHARITY_EVENTS.holiday.fiatSolscanUrl} solPrice={solPrice} />
          </div>
          {/* Battle cards + partner */}
          <div className="lg:col-span-3 space-y-4">
            {holidayBattles.slice(0, 3).map(b => (
              <BenefitBattleCard key={b.battle_id} battle={b} solPrice={solPrice} />
            ))}
            {holidayBattles.length === 0 && (
              <StaticBenefitCard
                title={CHARITY_EVENTS.holiday.title}
                subtitle={CHARITY_EVENTS.holiday.subtitle}
                date={CHARITY_EVENTS.holiday.date}
                fiatUsd={CHARITY_EVENTS.holiday.fiatUsd}
                fiatSolscanUrl={CHARITY_EVENTS.holiday.fiatSolscanUrl}
              />
            )}
            <PartnerCard
              name={CHARITY_EVENTS.holiday.partnerName}
              description={CHARITY_EVENTS.holiday.partnerDescription}
              socials={CHARITY_EVENTS.holiday.partnerSocials}
            />
          </div>
        </div>
      </section>

      {/* ── EVENT #2: LOVE SONG BENEFIT BATTLE ── */}
      <section>
        <EventSectionHeader
          number="02"
          title={CHARITY_EVENTS.lovesong.title}
          subtitle={CHARITY_EVENTS.lovesong.subtitle}
          date={CHARITY_EVENTS.lovesong.date}
          winner={lovesongWinner}
        />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
          {/* Flyer + fiat total */}
          <div className="lg:col-span-2 space-y-3">
            <FlyerCard src={CHARITY_EVENTS.lovesong.flyer} alt={CHARITY_EVENTS.lovesong.title} />
            <FiatTotalCard fiatUsd={CHARITY_EVENTS.lovesong.fiatUsd} solscanUrl={CHARITY_EVENTS.lovesong.fiatSolscanUrl} solPrice={solPrice} />
          </div>
          {/* Battle cards + partner */}
          <div className="lg:col-span-3 space-y-4">
            {lovesongBattles.slice(0, 3).map(b => (
              <BenefitBattleCard key={b.battle_id} battle={b} solPrice={solPrice} />
            ))}
            {lovesongBattles.length === 0 && (
              <StaticBenefitCard
                title={CHARITY_EVENTS.lovesong.title}
                subtitle={CHARITY_EVENTS.lovesong.subtitle}
                date={CHARITY_EVENTS.lovesong.date}
                fiatUsd={CHARITY_EVENTS.lovesong.fiatUsd}
                fiatSolscanUrl={CHARITY_EVENTS.lovesong.fiatSolscanUrl}
              />
            )}
            <PartnerCard
              name={CHARITY_EVENTS.lovesong.partnerName}
              description={CHARITY_EVENTS.lovesong.partnerDescription}
              socials={CHARITY_EVENTS.lovesong.partnerSocials}
            />
          </div>
        </div>
      </section>

      {/* ── THE OVERHEAD TRAP ── */}
      <section>
        <div className="rounded-xl border border-border bg-[#111827] p-6">
          <h3 className="text-lg font-rajdhani font-bold text-white mb-5 tracking-wide">
            The Overhead Trap — Bypassed
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OverheadCompare
              label="Traditional Charity"
              reach="&lt;10¢ per $1"
              desc="Administrative layers, fundraising overhead, and banking fees can consume 90%+ of donations before they reach the cause."
              bad
            />
            <OverheadCompare
              label="Credit Card Processor"
              reach="95–97¢ per $1"
              desc="Standard payment rails charge 3–5% per transaction. On a $10,000 raise, that's $300–$500 gone before it arrives."
              bad
            />
            <OverheadCompare
              label="WaveWarZ Benefit Battle"
              reach="~$1.00 per $1"
              desc="Solana network fees are <$0.01 per transaction. Platform fees are fully waived and redirected. $1 given = $1 received."
              good
            />
          </div>

          {/* Visual bar */}
          <div className="mt-6 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Impact per $1.00 donated</p>
            <div className="space-y-2">
              <EfficiencyBar label="Traditional Charity" pct={10} color="red" />
              <EfficiencyBar label="Credit Card (best case)" pct={97} color="amber" />
              <EfficiencyBar label="WaveWarZ on Solana" pct={100} color="green" />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HowItWorksCard
          step="01"
          title="Platform Fee Waiver"
          desc="WaveWarZ's 0.5% trading fee and 3% settlement bonus — normally platform revenue — are fully redirected to the designated charity wallet during Benefit Battles."
        />
        <HowItWorksCard
          step="02"
          title="Blockchain Transparency"
          desc="Every SOL transfer is recorded on Solana Mainnet. Anyone can audit the full ledger via Solscan. No trust required — verify it yourself."
        />
        <HowItWorksCard
          step="03"
          title="Direct Giving Zone"
          desc="Donation buttons on each battle page route SOL peer-to-peer, directly to the charity or artist wallet. WaveWarZ never touches the funds."
        />
      </section>

      {/* ── ALL OTHER BENEFIT BATTLES (DB-driven, not manually categorized above) ── */}
      {charityBattles.filter(b => {
        const mo = new Date(b.created_at).getMonth()
        return mo !== 11 && mo !== 1
      }).length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">
              More Benefit Battles
            </h2>
            <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest">
              EXCLUDED FROM RANKINGS
            </Badge>
          </div>
          <div className="space-y-4">
            {charityBattles
              .filter(b => {
                const mo = new Date(b.created_at).getMonth()
                return mo !== 11 && mo !== 1
              })
              .map(b => (
                <BenefitBattleCard key={b.battle_id} battle={b} solPrice={solPrice} />
              ))}
          </div>
        </section>
      )}

      {/* ── ARTIST SPOTLIGHTS ── */}
      {spotlightBattles.length > 0 && (() => {
        // Group by charity_name if set.
        // Otherwise normalize the artist pair (sorted alphabetically) so that
        // battles where the same two artists appear in any order collapse together.
        const groups: Record<string, typeof spotlightBattles> = {}
        for (const b of spotlightBattles) {
          let key: string
          if (b.charity_name?.trim()) {
            key = b.charity_name.trim()
          } else {
            // Sort names so "A vs B" and "B vs A" share the same bucket
            const pair = [b.artist1_name.trim(), b.artist2_name.trim()].sort()
            key = `${pair[0]} vs ${pair[1]}`
          }
          if (!groups[key]) groups[key] = []
          groups[key].push(b)
        }

        const groupList = Object.entries(groups).map(([eventName, battles]) => {
          const sorted = [...battles].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const totalVolume = battles.reduce((s, b) => s + (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0), 0)
          const avgVol = battles.length > 0 ? totalVolume / battles.length : 0
          const youtubeReplay = battles.find(b => b.youtube_replay_link)?.youtube_replay_link ?? null

          // Aggregate artist stats
          const artistTotals: Record<string, { vol: number; wins: number; losses: number }> = {}
          for (const b of sorted) {
            const p1 = b.artist1_pool ?? 0
            const p2 = b.artist2_pool ?? 0
            const v1 = b.total_volume_a ?? 0
            const v2 = b.total_volume_b ?? 0
            const aWon = p1 >= p2
            if (!artistTotals[b.artist1_name]) artistTotals[b.artist1_name] = { vol: 0, wins: 0, losses: 0 }
            if (!artistTotals[b.artist2_name]) artistTotals[b.artist2_name] = { vol: 0, wins: 0, losses: 0 }
            artistTotals[b.artist1_name].vol += v1
            artistTotals[b.artist1_name].wins += aWon ? 1 : 0
            artistTotals[b.artist1_name].losses += aWon ? 0 : 1
            artistTotals[b.artist2_name].vol += v2
            artistTotals[b.artist2_name].wins += aWon ? 0 : 1
            artistTotals[b.artist2_name].losses += aWon ? 1 : 0
          }

          const firstDateStr = sorted[0].created_at
          const lastDateStr = sorted[sorted.length - 1].created_at
          const fmt = (d: string, y = true) => new Date(d).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}),
          })

          // Pick the best available image: battle art from any round, or null
          const eventImageUrl = battles.find(b => b.image_url)?.image_url ?? null

          return {
            eventName,
            totalRounds: battles.length,
            firstDateFormatted: fmt(firstDateStr),
            lastDateFormatted: firstDateStr !== lastDateStr ? fmt(lastDateStr) : null,
            youtubeReplay,
            imageUrl: eventImageUrl,
            totalVolumeFormatted: formatSol(totalVolume),
            totalVolumeUsd: solToUsd(totalVolume, solPrice),
            avgRoundVolumeFormatted: formatSol(avgVol),
            artists: Object.entries(artistTotals)
              .sort((a, b) => b[1].vol - a[1].vol)
              .map(([name, s]) => ({ name, volFormatted: formatSol(s.vol), wins: s.wins, losses: s.losses })),
            rounds: sorted.map(b => {
              const p1 = b.artist1_pool ?? 0
              const p2 = b.artist2_pool ?? 0
              const v1 = b.total_volume_a ?? 0
              const v2 = b.total_volume_b ?? 0
              const totalVol = v1 + v2
              const aWon = p1 >= p2
              return {
                battle_id: b.battle_id,
                dateFormatted: fmt(b.created_at, false),
                artist1_name: b.artist1_name,
                artist2_name: b.artist2_name,
                v1Formatted: formatSol(v1),
                v2Formatted: formatSol(v2),
                totalVolFormatted: formatSol(totalVol),
                totalVolUsd: solToUsd(totalVol, solPrice),
                pct1: totalVol > 0 ? Math.round((v1 / totalVol) * 100) : 50,
                pct2: totalVol > 0 ? Math.round((v2 / totalVol) * 100) : 50,
                aWon,
                youtube_replay_link: b.youtube_replay_link,
              }
            }),
          }
        })

        return (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide">
                Artist Spotlights
              </h2>
              <Badge className="bg-[#7ec1fb]/20 text-[#7ec1fb] border border-[#7ec1fb]/40 text-[10px] font-bold tracking-widest">
                EXCLUDED FROM RANKINGS
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">{groupList.length} event{groupList.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Spotlight events are curated showcases for emerging artists. Results are excluded from competitive leaderboard rankings.
            </p>
            <div className="space-y-4">
              {groupList.map(group => (
                <SpotlightEventCard key={group.eventName} group={group} />
              ))}
            </div>
          </section>
        )
      })()}

      {/* ── EMPTY STATE ── */}
      {battles.length === 0 && (
        <div className="rounded-xl border border-border bg-[#111827] p-12 text-center">
          <p className="text-2xl font-rajdhani font-bold text-white mb-2">First Benefit Battle Coming Soon</p>
          <p className="text-muted-foreground text-sm">
            When WaveWarZ hosts its first benefit battle, the full impact report will appear here — live, onchain, and fully auditable.
          </p>
        </div>
      )}

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EventSectionHeader({ number, title, subtitle, date, winner }: {
  number: string; title: string; subtitle: string; date: string; winner?: string | null
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-[#95fe7c]/10 border border-[#95fe7c]/30 flex items-center justify-center">
        <span className="font-rajdhani font-bold text-[#95fe7c] text-lg">{number}</span>
      </div>
      <div>
        <h2 className="text-2xl font-rajdhani font-bold text-white tracking-wide leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle} &middot; {date}</p>
        {winner && (
          <p className="text-xs font-bold text-[#95fe7c] mt-1 font-rajdhani tracking-wide">
            Series Winner: {winner}
          </p>
        )}
      </div>
    </div>
  )
}

function FiatTotalCard({ fiatUsd, solscanUrl, solPrice }: {
  fiatUsd: number; solscanUrl: string | null; solPrice: number
}) {
  const solEquiv = solPrice > 0 ? (fiatUsd / solPrice).toFixed(2) : '—'
  return (
    <div className="rounded-xl border border-[#95fe7c]/20 bg-[#111827] p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Total Fiat Raised</p>
      <p className="text-2xl font-rajdhani font-bold text-[#95fe7c]">~${fiatUsd.toLocaleString()} USD</p>
      <p className="text-sm font-rajdhani font-bold text-white mt-0.5">≈ {solEquiv} SOL</p>
      <p className="text-xs text-muted-foreground mt-1">cc / debit / PayPal / Apple Pay / Google Pay</p>
      {solscanUrl ? (
        <a href={solscanUrl} target="_blank" rel="noreferrer"
          className="inline-block mt-2 text-[10px] text-[#7ec1fb] hover:underline">
          Verify on Solscan ↗
        </a>
      ) : (
        <p className="text-[10px] text-muted-foreground/50 mt-2 italic">Solscan verification link coming soon</p>
      )}
    </div>
  )
}

function FlyerCard({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="rounded-xl border border-border bg-[#111827] aspect-[3/4] flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Flyer coming soon</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

function StaticBenefitCard({ title, subtitle, date, fiatUsd, fiatSolscanUrl }: {
  title: string; subtitle: string; date: string
  fiatUsd: number; fiatSolscanUrl: string | null
}) {
  return (
    <div className="rounded-xl border border-[#95fe7c]/20 bg-[#111827] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest mb-2">
            BENEFIT BATTLE
          </Badge>
          <h3 className="text-lg font-rajdhani font-bold text-white">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle} &middot; {date}</p>
        </div>
      </div>
      <div className="rounded-lg bg-[#0d1321] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Fiat Raised</p>
            <p className="text-xl font-rajdhani font-bold text-[#95fe7c]">~${fiatUsd.toLocaleString()} USD</p>
            <p className="text-[10px] text-muted-foreground">cc / debit / PayPal / Apple Pay</p>
          </div>
          {fiatSolscanUrl && (
            <a href={fiatSolscanUrl} target="_blank" rel="noreferrer"
              className="text-xs text-[#7ec1fb] hover:underline shrink-0">
              Verify ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function PartnerCard({ name, description, socials }: {
  name: string
  description: string
  socials: { twitter: string | null; youtube: string | null; instagram: string | null }
}) {
  return (
    <div className="rounded-xl border border-[#7ec1fb]/20 bg-[#111827] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Community Partner</p>
          <h4 className="font-rajdhani font-bold text-white text-lg mb-1">{name}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0 mt-1">
          {socials.twitter && (
            <a href={socials.twitter} target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-border flex items-center justify-center transition-colors"
              title="X / Twitter">
              <XIcon />
            </a>
          )}
          {socials.youtube && (
            <a href={socials.youtube} target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-border flex items-center justify-center transition-colors"
              title="YouTube">
              <YouTubeIcon />
            </a>
          )}
          {socials.instagram && (
            <a href={socials.instagram} target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-border flex items-center justify-center transition-colors"
              title="Instagram">
              <InstagramIcon />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ImpactCard({ label, value, sub, note, color, fiatSolscanUrl }: {
  label: string; value: string; sub: string; note: string; color: 'green' | 'blue'
  fiatSolscanUrl?: string | null
}) {
  const c = color === 'green'
    ? { val: 'text-[#95fe7c]', border: 'border-[#95fe7c]/20' }
    : { val: 'text-[#7ec1fb]', border: 'border-[#7ec1fb]/20' }
  return (
    <div className={`rounded-xl border ${c.border} bg-[#111827] p-5`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-rajdhani font-bold ${c.val}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/70">{note}</p>
        {fiatSolscanUrl && (
          <a href={fiatSolscanUrl} target="_blank" rel="noreferrer"
            className="text-[10px] text-[#7ec1fb] hover:underline shrink-0 ml-2">
            Verify ↗
          </a>
        )}
      </div>
    </div>
  )
}

function OverheadCompare({ label, reach, desc, bad, good }: {
  label: string; reach: string; desc: string; bad?: boolean; good?: boolean
}) {
  const color = good ? 'text-[#95fe7c]' : bad ? 'text-red-400' : 'text-amber-400'
  const border = good ? 'border-[#95fe7c]/20' : bad ? 'border-red-500/20' : 'border-amber-500/20'
  return (
    <div className={`rounded-lg border ${border} bg-[#0d1321] p-4`}>
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-rajdhani font-bold ${color} mb-2`}>{reach}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

function EfficiencyBar({ label, pct, color }: {
  label: string; pct: number; color: 'green' | 'amber' | 'red'
}) {
  const c = { green: 'bg-[#95fe7c]', amber: 'bg-amber-400', red: 'bg-red-400' }[color]
  const t = { green: 'text-[#95fe7c]', amber: 'text-amber-400', red: 'text-red-400' }[color]
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#1f2937] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold font-rajdhani ${t} w-12 text-right`}>{pct}%</span>
    </div>
  )
}

function HowItWorksCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-[#111827] p-6">
      <p className="text-4xl font-rajdhani font-bold text-[#95fe7c]/20 mb-3">{step}</p>
      <h3 className="font-rajdhani font-bold text-white text-lg mb-2 tracking-wide">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

function BenefitBattleCard({ battle: b, solPrice }: { battle: BenefitBattle; solPrice: number }) {
  const vol = (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)
  const loserPool = Math.min(b.artist1_pool ?? 0, b.artist2_pool ?? 0)
  const redirectedFees = vol * 0.005
  const redirectedSettlement = loserPool * 0.03
  const totalRedirected = redirectedFees + redirectedSettlement
  const date = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const a1Won = (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)
  const winner = a1Won ? b.artist1_name : b.artist2_name
  const loser = a1Won ? b.artist2_name : b.artist1_name
  const bothHavePools = (b.artist1_pool ?? 0) > 0 || (b.artist2_pool ?? 0) > 0

  return (
    <div className="rounded-xl border border-[#95fe7c]/20 bg-[#111827] overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest">
                BENEFIT BATTLE
              </Badge>
              {b.charity_name && (
                <span className="text-xs text-muted-foreground">
                  Beneficiary: <span className="text-white font-medium">{b.charity_name}</span>
                </span>
              )}
            </div>
            <h3 className="text-lg font-rajdhani font-bold text-white tracking-wide">
              <span className={a1Won && bothHavePools ? 'text-[#95fe7c]' : ''}>{b.artist1_name}</span>
              {a1Won && bothHavePools && (
                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30 px-1.5 py-0.5 rounded align-middle">W</span>
              )}
              <span className="text-muted-foreground mx-3 font-normal text-base">vs</span>
              <span className={!a1Won && bothHavePools ? 'text-[#95fe7c]' : ''}>{b.artist2_name}</span>
              {!a1Won && bothHavePools && (
                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30 px-1.5 py-0.5 rounded align-middle">W</span>
              )}
            </h3>
            {bothHavePools && (
              <p className="text-xs text-[#95fe7c] font-rajdhani font-bold mt-0.5">
                {winner} <span className="text-muted-foreground font-normal">defeated</span> {loser}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{date} · Battle #{b.battle_id}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {b.youtube_replay_link && (
              <a href={b.youtube_replay_link} target="_blank" rel="noreferrer"
                className="text-xs text-[#7ec1fb] hover:underline">
                Watch ↗
              </a>
            )}
            {b.fiat_donation_proof_link && (
              <a href={b.fiat_donation_proof_link} target="_blank" rel="noreferrer"
                className="text-xs text-[#95fe7c] hover:underline">
                Verify Onchain ↗
              </a>
            )}
          </div>
        </div>

        {/* Impact stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Total Volume" value={`${formatSol(vol)} SOL`} sub={solToUsd(vol, solPrice)} />
          <MiniStat label="Fees Redirected" value={`${formatSol(redirectedFees)} SOL`} sub="0.5% platform share" highlight />
          <MiniStat label="Settlement Redirected" value={`${formatSol(redirectedSettlement)} SOL`} sub="3% of loser pool" highlight />
          <MiniStat label="Total to Cause" value={`${formatSol(totalRedirected)} SOL`} sub={solToUsd(totalRedirected, solPrice)} highlight />
        </div>
      </div>

      {/* Footer bar */}
      <div className="px-5 py-3 bg-[#95fe7c]/5 border-t border-[#95fe7c]/10 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Solana network fee per transaction:
          <span className="text-white font-mono ml-1">&lt;$0.01</span>
        </p>
        <p className="text-xs text-[#95fe7c] font-bold">
          100% impact — zero overhead
        </p>
      </div>
    </div>
  )
}

function MiniStat({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className="rounded-lg bg-[#0d1321] p-3">
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-rajdhani font-bold ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

// ─── Social Icons ──────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}
