import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol, calculateArtistEarnings, calculatePlatformRevenue, calculateSettlementBreakdown, getWinnerLoserPools } from '@/lib/wavewarz-math'
import { resolveAudiusTrack } from '@/lib/audius'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/tip'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Battle #${id} — WaveWarZ Intelligence`,
    description: `Detailed stats for WaveWarZ battle #${id}.`,
  }
}

async function getBattle(id: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('battles')
    .select('*')
    .eq('battle_id', id)
    .single()
  return data
}

type ArtistProfile = {
  primary_wallet: string
  artist_id: string | null
  profile_picture_url: string | null
  bio: string | null
  twitter_handle: string | null
  audius_handle: string | null
  youtube_url: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  display_name: string | null
}

async function getProfilesForWallets(wallets: (string | null)[]): Promise<Map<string, ArtistProfile>> {
  const valid = wallets.filter(Boolean) as string[]
  if (!valid.length) return new Map()
  const supabase = await createClient()
  const { data } = await supabase
    .from('artist_profiles')
    .select('primary_wallet,artist_id,profile_picture_url,bio,twitter_handle,audius_handle,youtube_url,instagram_handle,tiktok_handle,display_name')
    .in('primary_wallet', valid)
  const map = new Map<string, ArtistProfile>()
  for (const p of data ?? []) {
    if (p.primary_wallet) map.set(p.primary_wallet, p as ArtistProfile)
  }
  return map
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

export default async function BattleDetailPage({ params }: Props) {
  const { id } = await params
  const battleId = parseInt(id, 10)
  if (isNaN(battleId)) notFound()

  const [battle, solPrice] = await Promise.all([
    getBattle(battleId),
    getLiveSolPrice(),
  ])

  if (!battle) notFound()

  const profileMap = await getProfilesForWallets([battle.artist1_wallet, battle.artist2_wallet])
  const profile1 = profileMap.get(battle.artist1_wallet ?? '') ?? null
  const profile2 = profileMap.get(battle.artist2_wallet ?? '') ?? null

  const isQuick = battle.is_quick_battle === true
  const isCommunity = battle.is_community_battle === true

  const p1 = battle.artist1_pool ?? 0
  const p2 = battle.artist2_pool ?? 0
  const vol1 = battle.total_volume_a ?? 0
  const vol2 = battle.total_volume_b ?? 0
  const totalVol = vol1 + vol2

  // Treat as settled if winner_decided is set OR status indicates the battle is over
  const endedStatuses = ['ended', 'completed', 'settled']
  const isSettled = battle.winner_decided === true ||
    endedStatuses.includes((battle.status ?? '').toLowerCase())

  // Determine winner: use winner_artist_a if set, otherwise fall back to larger pool.
  // winner_artist_a is stored as numeric 1 (A wins) or 0 (B wins).
  const a1Won: boolean = battle.winner_decided === true
    ? (Number(battle.winner_artist_a) === 1)
    : p1 >= p2  // pool-based fallback for ended battles missing the flag

  // For display badge — only show ACTIVE if truly not settled and no pool data suggests end
  const winnerDecided = isSettled

  const { winnerPool, loserPool } = getWinnerLoserPools(p1, p2, a1Won)

  const a1Earn = totalVol > 0
    ? calculateArtistEarnings(vol1, loserPool, a1Won)
    : null
  const a2Earn = totalVol > 0
    ? calculateArtistEarnings(vol2, loserPool, !a1Won)
    : null

  const platform = totalVol > 0
    ? calculatePlatformRevenue(totalVol, loserPool)
    : null

  const settlement = loserPool > 0 ? calculateSettlementBreakdown(loserPool) : null

  const durationSecs = battle.end_time && battle.start_time
    ? battle.end_time - battle.start_time
    : null

  // Resolve Audius artwork for quick battles
  let art1: string | null = null
  let art2: string | null = null
  let genre1: string | null = null
  let genre2: string | null = null
  if (isQuick) {
    const [t1, t2] = await Promise.all([
      battle.artist1_music_link ? resolveAudiusTrack(battle.artist1_music_link) : null,
      battle.artist2_music_link ? resolveAudiusTrack(battle.artist2_music_link) : null,
    ])
    art1 = t1?.artwork?.['480x480'] ?? null
    art2 = t2?.artwork?.['480x480'] ?? null
    genre1 = t1?.genre ?? null
    genre2 = t2?.genre ?? null
  }

  const typeLabel = isQuick ? 'Quick Battle' : isCommunity ? 'Community Battle' : 'Main Event'
  const typeColor = isQuick ? '#7ec1fb' : isCommunity ? '#f59e0b' : '#95fe7c'

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Back */}
      <Link href="/battles" className="text-xs text-muted-foreground hover:text-white transition-colors inline-block">
        ← Back to Battles Feed
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge style={{ backgroundColor: `${typeColor}20`, color: typeColor, borderColor: `${typeColor}40` }} className="border text-[10px] font-bold tracking-widest">
              {typeLabel.toUpperCase()}
            </Badge>
            {isSettled ? (
              <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-widest">SETTLED</Badge>
            ) : (
              <Badge className="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 text-[10px] font-bold tracking-widest animate-pulse">LIVE</Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-rajdhani font-bold text-white tracking-tight">
            Battle <span style={{ color: typeColor }}>#{battleId}</span>
          </h1>
          {battle.created_at && (
            <p className="text-xs text-muted-foreground mt-1">{fmtDate(battle.created_at)}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {durationSecs !== null && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Duration</p>
              <p className="font-mono text-sm text-white">{fmtDuration(durationSecs)}</p>
            </div>
          )}
          {battle.stream_link && (
            <a href={battle.stream_link} target="_blank" rel="noreferrer"
              className="text-xs border border-[#7ec1fb]/30 text-[#7ec1fb] hover:bg-[#7ec1fb]/10 px-3 py-1.5 rounded-lg transition-colors">
              Watch Stream ↗
            </a>
          )}
          {battle.youtube_replay_link && (
            <a href={battle.youtube_replay_link} target="_blank" rel="noreferrer"
              className="text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
              YouTube Replay ↗
            </a>
          )}
        </div>
      </div>

      {/* Head-to-Head */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Side A */}
          <SidePanel
            name={battle.artist1_name}
            wallet={battle.artist1_wallet}
            profile={profile1}
            musicLink={battle.artist1_music_link}
            artUrl={art1}
            genre={genre1}
            pool={p1}
            volume={vol1}
            isWinner={a1Won}
            isLoser={!a1Won}
            settled={isSettled}
            earnings={a1Earn}
            solPrice={solPrice}
            side="left"
          />

          {/* VS divider */}
          <div className="flex flex-col items-center justify-center px-3 sm:px-5 py-6 border-x border-border bg-[#0d1321]">
            <span className="font-rajdhani font-bold text-2xl text-muted-foreground">VS</span>
            <div className="mt-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Vol</p>
              <p className="font-mono text-xs text-white">{formatSol(totalVol)} SOL</p>
              <p className="text-[10px] text-muted-foreground">{solToUsd(totalVol, solPrice)}</p>
            </div>
          </div>

          {/* Side B */}
          <SidePanel
            name={battle.artist2_name}
            wallet={battle.artist2_wallet}
            profile={profile2}
            musicLink={battle.artist2_music_link}
            artUrl={art2}
            genre={genre2}
            pool={p2}
            volume={vol2}
            isWinner={!a1Won}
            isLoser={a1Won}
            settled={isSettled}
            earnings={a2Earn}
            solPrice={solPrice}
            side="right"
          />
        </div>

        {/* Volume bars */}
        {totalVol > 0 && (
          <div className="px-5 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
              <span className="text-[#95fe7c]">{Math.round(vol1 / totalVol * 100)}%</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#95fe7c]"
                  style={{ width: `${vol1 / totalVol * 100}%` }}
                />
              </div>
              <span className="text-[#7ec1fb]">{Math.round(vol2 / totalVol * 100)}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Volume distribution</p>
          </div>
        )}
      </div>

      {/* Quick Battle 3-Factor Result */}
      {isQuick && isSettled && (
        <div className="rounded-xl border border-[#7ec1fb]/20 bg-[#111827] p-5">
          <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">
            3-Factor Result
            <span className="text-xs font-normal text-muted-foreground ml-2">Poll · Charts · DJ Wavy — 2 of 3 wins</span>
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Poll */}
            <div className="rounded-lg border border-border bg-[#0d1321] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Poll</p>
              {battle.poll_winner ? (
                <>
                  <p className="font-rajdhani font-bold text-white text-sm">{battle.poll_winner}</p>
                  {battle.poll_votes_a != null && battle.poll_votes_b != null && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                      {battle.artist1_name}: {battle.poll_votes_a} · {battle.artist2_name}: {battle.poll_votes_b}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">No poll data</p>
              )}
            </div>
            {/* Charts */}
            <div className="rounded-lg border border-border bg-[#0d1321] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Charts (SOL)</p>
              <p className="font-rajdhani font-bold text-white text-sm">
                {a1Won ? battle.artist1_name : battle.artist2_name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {p1.toFixed(4)} vs {p2.toFixed(4)} SOL
              </p>
            </div>
            {/* DJ Wavy */}
            <div className="rounded-lg border border-border bg-[#0d1321] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">DJ Wavy</p>
              <p className="text-[10px] text-muted-foreground italic">AI judge — result in final outcome</p>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Breakdown */}
      {settlement && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">Settlement Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SettleBox label="Winning Traders" sub="40% of loser pool" value={settlement.winningTraders} solPrice={solPrice} color="#95fe7c" />
            <SettleBox label="Losing Traders" sub="50% refund" value={settlement.losingTraders} solPrice={solPrice} color="#7ec1fb" />
            <SettleBox label="Winner Artist" sub="5% of loser pool" value={settlement.winningArtist} solPrice={solPrice} color="#95fe7c" />
            <SettleBox label="Loser Artist" sub="2% consolation" value={settlement.losingArtist} solPrice={solPrice} color="#7ec1fb" />
            <SettleBox label="Platform" sub="3% of loser pool" value={settlement.platform} solPrice={solPrice} color="#989898" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Loser pool: <span className="text-white font-mono">{formatSol(loserPool)} SOL</span> · Winner pool: <span className="text-white font-mono">{formatSol(winnerPool)} SOL</span>
          </p>
        </div>
      )}

      {/* Artist Profiles */}
      {(profile1 || profile2) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">Artist Profiles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { p: profile1, name: battle.artist1_name, wallet: battle.artist1_wallet, artUrl: art1, isWinner: a1Won },
              { p: profile2, name: battle.artist2_name, wallet: battle.artist2_wallet, artUrl: art2, isWinner: !a1Won },
            ].map(({ p, name, wallet, artUrl: songArt, isWinner }) => (
              <ArtistProfileCard
                key={wallet ?? name}
                profile={p}
                fallbackName={name}
                wallet={wallet}
                songArt={songArt}
                isWinner={isWinner && winnerDecided}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trader Payout Guide */}
      {settlement && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-rajdhani font-bold text-white text-lg mb-1 tracking-wide">Trader Payout Guide</h2>
          <p className="text-xs text-muted-foreground mb-4">
            How payouts were distributed to traders who held tokens in this battle.
            Traders must manually claim via the <span className="text-white">Withdrawal</span> button on the battle page or at{' '}
            <a href="https://claim.wavewarz.info" target="_blank" rel="noreferrer" className="text-[#7ec1fb] hover:underline">claim.wavewarz.info</a>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#95fe7c]/20 bg-[#95fe7c]/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#95fe7c] mb-2">Winning Side Traders</p>
              <p className="text-xs text-muted-foreground mb-3">
                Each winner&apos;s payout = their proportional share of their own pool + 40% of the loser pool.
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Winner pool (own tokens)</span>
                  <span className="font-mono text-white">{formatSol(winnerPool)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus from loser pool (40%)</span>
                  <span className="font-mono text-[#95fe7c]">+{formatSol(settlement.winningTraders)} SOL</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                Formula: <span className="font-mono text-white">(your tokens / total winner tokens) × (winner pool + bonus)</span>
              </p>
            </div>
            <div className="rounded-lg border border-[#7ec1fb]/20 bg-[#7ec1fb]/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ec1fb] mb-2">Losing Side Traders</p>
              <p className="text-xs text-muted-foreground mb-3">
                Losers get 50% of their invested value back as a risk refund.
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loser pool (total invested)</span>
                  <span className="font-mono text-white">{formatSol(loserPool)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refund available (50%)</span>
                  <span className="font-mono text-[#7ec1fb]">{formatSol(settlement.losingTraders)} SOL</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                Formula: <span className="font-mono text-white">(your tokens / total loser tokens) × loser pool × 0.50</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Platform Revenue */}
      {platform && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">Platform Revenue</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label={<Tip text="0.5% of all trading volume">Trading Fees</Tip>} value={`${formatSol(platform.tradingFees)} SOL`} sub={solToUsd(platform.tradingFees, solPrice)} />
            <Stat label={<Tip text="3% of the loser pool at settlement">Settlement Bonus</Tip>} value={`${formatSol(platform.settlementBonus)} SOL`} sub={solToUsd(platform.settlementBonus, solPrice)} />
            <Stat label="Total Revenue" value={`${formatSol(platform.totalSol)} SOL`} sub={solToUsd(platform.totalSol, solPrice)} highlight />
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">Battle Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <MetaRow label="Battle ID" value={String(battleId)} mono />
          <MetaRow label="Status" value={battle.status ?? '—'} />
          {durationSecs !== null && <MetaRow label="Duration" value={fmtDuration(durationSecs)} />}
          {battle.unique_traders != null && <MetaRow label="Unique Traders" value={String(battle.unique_traders)} />}
          {battle.artist1_wallet && <MetaRow label={`${battle.artist1_name} Wallet`} value={battle.artist1_wallet} mono truncate />}
          {battle.artist2_wallet && <MetaRow label={`${battle.artist2_name} Wallet`} value={battle.artist2_wallet} mono truncate />}
          {battle.wavewarz_wallet && <MetaRow label="WaveWarz Wallet" value={battle.wavewarz_wallet} mono truncate />}
          {battle.creator_wallet && <MetaRow label="Creator Wallet" value={battle.creator_wallet} mono truncate />}
          {battle.quick_battle_queue_id && <MetaRow label="Queue ID" value={battle.quick_battle_queue_id} mono />}
        </div>
      </div>

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SidePanel({
  name, wallet, profile, musicLink, artUrl, genre,
  pool, volume, isWinner, isLoser, settled,
  earnings, solPrice, side,
}: {
  name: string
  wallet: string | null
  profile: ArtistProfile | null
  musicLink: string | null
  artUrl: string | null
  genre: string | null
  pool: number
  volume: number
  isWinner: boolean
  isLoser: boolean
  settled: boolean
  earnings: { tradingFees: number; settlementBonus: number; totalSol: number } | null
  solPrice: number | null
  side: 'left' | 'right'
}) {
  const align = side === 'left' ? 'items-start text-left' : 'items-end text-right'
  const initial = (name ?? '?').charAt(0).toUpperCase()
  const pfpUrl = profile?.profile_picture_url ?? null
  const profileHref = profile?.artist_id ? `/artist/${profile.artist_id}` : wallet ? `/artist/${wallet}` : null

  return (
    <div className={`flex flex-col gap-3 p-4 sm:p-5 ${align}`}>
      {/* Avatar — song art (quick) > artist pfp (main/community) > letter fallback */}
      {artUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artUrl} alt={name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-border" />
      ) : pfpUrl ? (
        profileHref ? (
          <Link href={profileHref}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pfpUrl} alt={name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#95fe7c]/30 hover:border-[#95fe7c]/70 transition-colors" />
          </Link>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pfpUrl} alt={name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#95fe7c]/30" />
        )
      ) : (
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1f2937] border-2 border-[#95fe7c]/20 flex items-center justify-center">
          <span className="font-rajdhani font-bold text-3xl text-[#95fe7c]">{initial}</span>
        </div>
      )}

      {/* Name + winner badge */}
      <div className={`flex flex-col gap-1 ${align}`}>
        {settled && isWinner && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#95fe7c] bg-[#95fe7c]/10 border border-[#95fe7c]/30 px-2 py-0.5 rounded self-start">
            WINNER
          </span>
        )}
        {settled && isLoser && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-white/5 border border-border px-2 py-0.5 rounded self-start">
            RUNNER UP
          </span>
        )}
        {musicLink ? (
          <a href={musicLink} target="_blank" rel="noreferrer"
            className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-lg sm:text-xl leading-tight">
            {name} ↗
          </a>
        ) : profileHref ? (
          <Link href={profileHref} className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-lg sm:text-xl leading-tight">
            {name} ↗
          </Link>
        ) : (
          <p className="font-rajdhani font-bold text-white text-lg sm:text-xl leading-tight">{name}</p>
        )}
        {genre && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#7ec1fb]/10 text-[#7ec1fb] border border-[#7ec1fb]/20 self-start">
            {genre}
          </span>
        )}
        {wallet && (
          <p className="font-mono text-[10px] text-muted-foreground">{wallet.slice(0, 6)}…{wallet.slice(-4)}</p>
        )}
      </div>

      {/* Pool / Volume stats */}
      <div className={`flex flex-col gap-1 ${align}`}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Pool</p>
        <p className="font-mono text-sm text-white">{formatSol(pool)} <span className="text-muted-foreground text-xs">SOL</span></p>
        <p className="text-[10px] text-muted-foreground">{solToUsd(pool, solPrice ?? 0)}</p>
      </div>
      <div className={`flex flex-col gap-1 ${align}`}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Volume</p>
        <p className="font-mono text-sm text-white">{formatSol(volume)} <span className="text-muted-foreground text-xs">SOL</span></p>
        <p className="text-[10px] text-muted-foreground">{solToUsd(volume, solPrice ?? 0)}</p>
      </div>

      {/* Artist earnings — line-item breakdown */}
      {earnings && (
        <div className={`flex flex-col gap-1.5 border-t border-border pt-3 ${align}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            <Tip text="Paid automatically onchain. Includes 1% trading fee on all volume + settlement bonus from loser pool.">
              Artist Earned
            </Tip>
          </p>
          <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Trading fees (1%)</span>
              <span className="font-mono text-white">{formatSol(earnings.tradingFees)} SOL</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Settlement bonus ({isWinner ? '5%' : '2%'})</span>
              <span className="font-mono text-white">{formatSol(earnings.settlementBonus)} SOL</span>
            </div>
          </div>
          <p className="font-mono text-sm text-[#95fe7c]">{formatSol(earnings.totalSol)} <span className="text-muted-foreground text-xs">SOL</span></p>
          <p className="text-[10px] text-muted-foreground">{solToUsd(earnings.totalSol, solPrice ?? 0)}</p>
        </div>
      )}
    </div>
  )
}

function SettleBox({
  label, sub, value, solPrice, color,
}: {
  label: string; sub: string; value: number; solPrice: number | null; color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-[#0d1321] p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 leading-tight">{label}</p>
      <p className="font-mono text-xs font-bold" style={{ color }}>{formatSol(value)} SOL</p>
      <p className="text-[10px] text-muted-foreground">{solToUsd(value, solPrice ?? 0)}</p>
      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{sub}</p>
    </div>
  )
}

function Stat({
  label, value, sub, highlight,
}: {
  label: React.ReactNode; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-mono text-sm font-bold ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function MetaRow({
  label, value, mono, truncate,
}: {
  label: string; value: string; mono?: boolean; truncate?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground shrink-0 w-36">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} text-white ${truncate ? 'truncate min-w-0' : ''}`}>{value}</span>
    </div>
  )
}

function ArtistProfileCard({
  profile, fallbackName, wallet, songArt, isWinner,
}: {
  profile: ArtistProfile | null
  fallbackName: string
  wallet: string | null
  songArt: string | null
  isWinner: boolean
}) {
  const pfpUrl = profile?.profile_picture_url ?? null
  const displayName = profile?.display_name ?? fallbackName
  const profileHref = profile?.artist_id ? `/artist/${profile.artist_id}` : wallet ? `/artist/${wallet}` : null
  const initial = (displayName ?? '?').charAt(0).toUpperCase()
  const imgSrc = songArt ?? pfpUrl

  return (
    <div className={`rounded-lg border p-4 flex gap-4 ${isWinner ? 'border-[#95fe7c]/30 bg-[#95fe7c]/5' : 'border-border bg-[#0d1321]'}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {imgSrc ? (
          profileHref ? (
            <Link href={profileHref}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc} alt={displayName} className={`w-14 h-14 ${songArt ? 'rounded-lg' : 'rounded-full'} object-cover border-2 ${isWinner ? 'border-[#95fe7c]/40' : 'border-border'}`} />
            </Link>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt={displayName} className={`w-14 h-14 ${songArt ? 'rounded-lg' : 'rounded-full'} object-cover border-2 ${isWinner ? 'border-[#95fe7c]/40' : 'border-border'}`} />
          )
        ) : (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${isWinner ? 'border-[#95fe7c]/40 bg-[#95fe7c]/10' : 'border-border bg-[#1f2937]'}`}>
            <span className="font-rajdhani font-bold text-2xl text-[#95fe7c]">{initial}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {profileHref ? (
            <Link href={profileHref} className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-base leading-tight">
              {displayName} ↗
            </Link>
          ) : (
            <p className="font-rajdhani font-bold text-white text-base leading-tight">{displayName}</p>
          )}
          {isWinner && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#95fe7c] bg-[#95fe7c]/10 border border-[#95fe7c]/30 px-1.5 py-0.5 rounded">
              WINNER
            </span>
          )}
        </div>

        {profile?.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{profile.bio}</p>
        )}

        {/* Social links */}
        <div className="flex flex-wrap gap-2">
          {profile?.twitter_handle && (
            <a href={`https://x.com/${profile.twitter_handle}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#7ec1fb] hover:text-white transition-colors border border-[#7ec1fb]/20 rounded px-1.5 py-0.5">
              @{profile.twitter_handle}
            </a>
          )}
          {profile?.audius_handle && (
            <a href={`https://audius.co/${profile.audius_handle}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#7ec1fb] hover:text-white transition-colors border border-[#7ec1fb]/20 rounded px-1.5 py-0.5">
              Audius ↗
            </a>
          )}
          {profile?.youtube_url && (
            <a href={profile.youtube_url} target="_blank" rel="noreferrer"
              className="text-[10px] text-red-400 hover:text-white transition-colors border border-red-500/20 rounded px-1.5 py-0.5">
              YouTube ↗
            </a>
          )}
          {profile?.instagram_handle && (
            <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#989898] hover:text-white transition-colors border border-white/10 rounded px-1.5 py-0.5">
              Instagram ↗
            </a>
          )}
          {profile?.tiktok_handle && (
            <a href={`https://tiktok.com/@${profile.tiktok_handle}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#989898] hover:text-white transition-colors border border-white/10 rounded px-1.5 py-0.5">
              TikTok ↗
            </a>
          )}
        </div>

        {wallet && !profile?.twitter_handle && !profile?.audius_handle && (
          <p className="font-mono text-[10px] text-muted-foreground mt-1">{wallet.slice(0, 8)}…{wallet.slice(-6)}</p>
        )}
      </div>
    </div>
  )
}

// React import for ReactNode type
import type React from 'react'
