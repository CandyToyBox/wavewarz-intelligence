import { createClient } from '@/lib/supabase/server'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { calculateArtistEarnings, getWinnerLoserPools, formatSol } from '@/lib/wavewarz-math'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ─── Types ────────────────────────────────────────────────────────────────────

type Battle = {
  battle_id: number
  created_at: string
  status: string
  artist1_name: string
  artist1_wallet: string
  artist2_name: string
  artist2_wallet: string
  total_volume_a: number
  total_volume_b: number
  artist1_pool: number
  artist2_pool: number
  winner_artist_a: boolean | null
  winner_decided: boolean
  is_main_battle: boolean
  is_quick_battle: boolean
  event_subtype: string
  image_url: string | null
  stream_link: string | null
  youtube_replay_link: string | null
  battle_duration: number | null
  artist1_music_link: string | null
  artist2_music_link: string | null
}

type ArtistStats = {
  displayName: string
  wallet: string
  profileId: string | null
  pfpUrl: string | null
  bio: string | null
  twitterHandle: string | null
  audiusHandle: string | null
  youtubeUrl: string | null
  instagramHandle: string | null
  tiktokHandle: string | null
  socialStats: Record<string, number>
  mainEventBattles: Battle[]
  quickBattles: Battle[]
  // Overall (all battle types combined)
  wins: number
  losses: number
  // Main Events only
  mainWins: number
  mainLosses: number
  // Quick Battles only
  quickWins: number
  quickLosses: number
  totalVolumeSol: number
  totalEarningsSol: number
  tradingFeesSol: number
  settlementBonusSol: number
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

async function getArtistStats(id: string): Promise<ArtistStats | null> {
  const supabase = await createClient()

  let wallet = id
  let profileId: string | null = null
  let profileData: Record<string, unknown> | null = null

  // UUID path — look up profile then get primary wallet
  if (isUUID(id)) {
    const { data: profile } = await supabase
      .from('artist_profiles')
      .select('*')
      .eq('artist_id', id)
      .single()
    if (!profile) return null
    profileId = id
    profileData = profile
    wallet = (profile.primary_wallet as string) ?? id
  } else {
    // Wallet path — check if there's a linked profile
    const { data: linked } = await supabase
      .from('artist_wallets')
      .select('artist_id, artist_profiles(*)')
      .eq('wallet_address', id)
      .single()
    if (linked?.artist_id) {
      profileId = linked.artist_id
      profileData = linked.artist_profiles as unknown as Record<string, unknown>
    }
  }

  // Get all wallets for this profile (handles artists with multiple wallets / name changes)
  const allWallets: string[] = [wallet]
  if (profileId) {
    const { data: linked } = await supabase
      .from('artist_wallets')
      .select('wallet_address')
      .eq('artist_id', profileId)
    for (const w of linked ?? []) {
      if (w.wallet_address && !allWallets.includes(w.wallet_address)) {
        allWallets.push(w.wallet_address)
      }
    }
  }

  // Get all battles for all linked wallets (both sides), exclude test
  const battleSets = await Promise.all(
    allWallets.flatMap(w => [
      supabase.from('battles').select('*').eq('artist1_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false }),
      supabase.from('battles').select('*').eq('artist2_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false }),
    ])
  )
  const seen = new Set<number>()
  const allBattles: Battle[] = []
  for (const { data } of battleSets) {
    for (const b of data ?? []) {
      if (!seen.has(b.battle_id)) { seen.add(b.battle_id); allBattles.push(b as Battle) }
    }
  }
  allBattles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (allBattles.length === 0) return null

  // Derive display name — prefer non-quick battles (quick battles use song titles, not artist names)
  const nameFromMainBattle =
    allBattles.filter(b => !b.is_quick_battle)
      .map(b => allWallets.includes(b.artist1_wallet) ? b.artist1_name : b.artist2_name)
      .find(n => n?.trim())

  const displayName =
    (profileData?.display_name as string) ??
    nameFromMainBattle ??
    allBattles.find(b => allWallets.includes(b.artist1_wallet))?.artist1_name ??
    allBattles.find(b => allWallets.includes(b.artist2_wallet))?.artist2_name ??
    'Unknown Artist'

  const mainEventBattles = allBattles.filter(b => b.is_main_battle && b.event_subtype === 'standard')
  const quickBattles = allBattles.filter(b => b.is_quick_battle)

  // W/L from onchain data (money layer) — split by category
  let wins = 0, losses = 0
  let mainWins = 0, mainLosses = 0
  let quickWins = 0, quickLosses = 0
  let tradingFeesSol = 0, settlementBonusSol = 0, totalVolumeSol = 0

  for (const b of allBattles) {
    // Skip genuinely live battles — but include ACTIVE battles that have been judged
    if (b.status === 'ACTIVE' && !b.winner_decided) continue

    const isArtistA = allWallets.includes(b.artist1_wallet)
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0

    // For judged battles use winner_artist_a; fall back to pool for quick/undecided.
    const artistAWon = (b.winner_decided && b.winner_artist_a !== null)
      ? Boolean(b.winner_artist_a)
      : p1 >= p2
    const won = isArtistA ? artistAWon : !artistAWon
    const myVolume = isArtistA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)
    const { loserPool } = getWinnerLoserPools(p1, p2, artistAWon)

    // Overall tally
    if (won) wins++; else losses++

    // Per-category tally
    if (b.is_quick_battle) {
      if (won) quickWins++; else quickLosses++
    } else if (b.is_main_battle) {
      if (won) mainWins++; else mainLosses++
    }

    totalVolumeSol += myVolume
    const earnings = calculateArtistEarnings(myVolume, loserPool, won)
    tradingFeesSol += earnings.tradingFees
    settlementBonusSol += earnings.settlementBonus
  }

  return {
    displayName,
    wallet,
    profileId,
    pfpUrl: (profileData?.profile_picture_url as string) ?? (profileData?.custom_pfp_url as string) ?? null,
    bio: (profileData?.bio as string) ?? null,
    twitterHandle: (profileData?.twitter_handle as string) ?? null,
    audiusHandle: (profileData?.audius_handle as string) ?? null,
    youtubeUrl: (profileData?.social_links as Record<string, string> | null)?.youtube ?? null,
    instagramHandle: (profileData?.social_links as Record<string, string> | null)?.instagram ?? null,
    tiktokHandle: (profileData?.social_links as Record<string, string> | null)?.tiktok ?? null,
    socialStats: (profileData?.social_stats as Record<string, number>) ?? {},
    mainEventBattles,
    quickBattles,
    wins,
    losses,
    mainWins,
    mainLosses,
    quickWins,
    quickLosses,
    totalVolumeSol,
    totalEarningsSol: tradingFeesSol + settlementBonusSol,
    tradingFeesSol,
    settlementBonusSol,
  }
}

// ─── OG Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const stats = await getArtistStats(id)
  if (!stats) return { title: 'Artist Not Found — WaveWarZ' }
  return {
    title: `${stats.displayName} — WaveWarZ Player Card`,
    description: `${stats.wins}W ${stats.losses}L · ${formatSol(stats.totalEarningsSol)} SOL earned on WaveWarZ`,
    openGraph: {
      title: `${stats.displayName} — WaveWarZ`,
      description: `${stats.wins}W ${stats.losses}L · ${formatSol(stats.totalEarningsSol)} SOL earned`,
      images: stats.pfpUrl ? [stats.pfpUrl] : [],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [stats, solPrice] = await Promise.all([
    getArtistStats(id),
    getLiveSolPrice(),
  ])

  if (!stats) notFound()

  const totalUsd = stats.totalEarningsSol * solPrice
  const spotifyStreams = Math.floor(totalUsd / 0.003)
  const completedBattles = stats.wins + stats.losses
  const winRate = completedBattles > 0
    ? Math.round((stats.wins / completedBattles) * 100)
    : null

  // Solscan vault link — uses wallet as account reference
  const solscanUrl = `https://solscan.io/account/${stats.wallet}`

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* ── PLAYER CARD (the shareable hero) ── */}
      <div className="relative rounded-2xl border border-[#95fe7c]/30 bg-gradient-to-br from-[#0d1321] via-[#111827] to-[#0d1321] overflow-hidden shadow-2xl shadow-[#95fe7c]/5">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#95fe7c] via-[#7ec1fb] to-[#95fe7c]" />

        <div className="p-8">
          {/* Header row */}
          <div className="flex items-start justify-between gap-6 mb-8">

            {/* PFP + Identity */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {stats.pfpUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={stats.pfpUrl}
                    alt={stats.displayName}
                    className="w-20 h-20 rounded-full border-2 border-[#95fe7c]/40 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 border-[#95fe7c]/40 bg-[#1f2937] flex items-center justify-center">
                    <span className="text-3xl font-rajdhani font-bold text-[#95fe7c]">
                      {stats.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#95fe7c] rounded-full border-2 border-[#0d1321]" />
              </div>

              <div>
                <h1 className="text-4xl font-rajdhani font-bold text-white tracking-wide leading-none">
                  {stats.displayName}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {stats.wallet.slice(0, 6)}...{stats.wallet.slice(-4)}
                  </span>
                  <a
                    href={solscanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[#7ec1fb] hover:underline font-mono"
                  >
                    Verify on Solscan ↗
                  </a>
                </div>
                {/* Social icons */}
                <div className="flex items-center gap-2 mt-2">
                  {stats.twitterHandle && (
                    <SocialIcon href={`https://x.com/${stats.twitterHandle}`} label="X / Twitter" color="#989898">
                      {/* X logo */}
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </SocialIcon>
                  )}
                  {stats.audiusHandle && (
                    <SocialIcon href={`https://audius.co/${stats.audiusHandle}`} label="Audius" color="#7ec1fb">
                      {/* Audius logo mark */}
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.5 14.5L8 12l7.5-4.5v9z"/></svg>
                    </SocialIcon>
                  )}
                  {stats.youtubeUrl && (
                    <SocialIcon href={stats.youtubeUrl} label="YouTube" color="#ff4444">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </SocialIcon>
                  )}
                  {stats.instagramHandle && (
                    <SocialIcon href={`https://instagram.com/${stats.instagramHandle}`} label="Instagram" color="#e1306c">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                    </SocialIcon>
                  )}
                  {stats.tiktokHandle && (
                    <SocialIcon href={`https://tiktok.com/@${stats.tiktokHandle}`} label="TikTok" color="#ffffff">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
                    </SocialIcon>
                  )}
                </div>
              </div>
            </div>

            {/* W/L Record badge */}
            <div className="text-right shrink-0 space-y-2">
              {/* Overall record */}
              <div className="inline-flex items-center gap-2 bg-[#0d1321] border border-border rounded-xl px-5 py-3">
                <div className="text-center">
                  <p className="text-3xl font-rajdhani font-bold text-[#95fe7c]">{stats.wins}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Wins</p>
                </div>
                <div className="text-2xl text-muted-foreground font-light mx-1">—</div>
                <div className="text-center">
                  <p className="text-3xl font-rajdhani font-bold text-red-400">{stats.losses}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Losses</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {winRate === null
                  ? 'First win incoming'
                  : winRate === 100
                  ? 'Undefeated'
                  : `${winRate}% overall`}
              </p>
              {/* Per-category breakdown */}
              <div className="flex gap-3 justify-end text-[11px]">
                {(stats.mainWins + stats.mainLosses) > 0 && (
                  <span className="text-muted-foreground">
                    <span className="text-white font-bold font-rajdhani">{stats.mainWins}W–{stats.mainLosses}L</span>
                    {' '}Main
                    {(stats.mainWins + stats.mainLosses) > 0 && (
                      <span className="text-[#95fe7c]/70 ml-1">
                        {Math.round(stats.mainWins / (stats.mainWins + stats.mainLosses) * 100)}%
                      </span>
                    )}
                  </span>
                )}
                {(stats.quickWins + stats.quickLosses) > 0 && (
                  <span className="text-muted-foreground">
                    <span className="text-white font-bold font-rajdhani">{stats.quickWins}W–{stats.quickLosses}L</span>
                    {' '}Quick
                    <span className="text-[#7ec1fb]/70 ml-1">
                      {Math.round(stats.quickWins / (stats.quickWins + stats.quickLosses) * 100)}%
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {stats.bio && (
            <p className="text-sm text-muted-foreground mb-6 border-l-2 border-[#95fe7c]/40 pl-4 italic">
              {stats.bio}
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatBox
              label="Total Volume"
              value={`${formatSol(stats.totalVolumeSol)} SOL`}
              sub={solToUsd(stats.totalVolumeSol, solPrice)}
            />
            <StatBox
              label="Career Earnings"
              value={`${formatSol(stats.totalEarningsSol)} SOL`}
              sub={solToUsd(stats.totalEarningsSol, solPrice)}
              highlight
            />
            <StatBox
              label="Trading Fees"
              value={`${formatSol(stats.tradingFeesSol)} SOL`}
              sub="1% per trade"
            />
            <StatBox
              label="Settlement Bonuses"
              value={`${formatSol(stats.settlementBonusSol)} SOL`}
              sub="5% win / 2% loss"
            />
          </div>

          {/* Spotify equivalency */}
          <div className="rounded-xl bg-[#0d1321] border border-[#7ec1fb]/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                Spotify Stream Equivalent
              </p>
              <p className="text-2xl font-rajdhani font-bold text-[#7ec1fb]">
                {spotifyStreams.toLocaleString()} streams
              </p>
              {/* Fix #1: tooltip explaining the $0.003 benchmark */}
              <p className="text-xs text-muted-foreground mt-1">
                {solToUsd(stats.totalEarningsSol, solPrice)} ÷ $0.003 per stream
                <span
                  title="Based on average Spotify per-stream payout rates (~$0.003–$0.005). WaveWarZ pays artists instantly and automatically — no label, no middleman."
                  className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground/40 text-[9px] text-muted-foreground cursor-help align-middle"
                >
                  ?
                </span>
              </p>
            </div>
            <div className="text-right">
              <Badge className="bg-[#95fe7c]/10 text-[#95fe7c] border border-[#95fe7c]/30 text-xs">
                INSTANT AUTOMATIC PAYOUT
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-2">
                Paid directly to artist wallet
              </p>
            </div>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="px-8 py-3 bg-[#0d1321]/60 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
            WaveWarZ Intelligence · Solana Mainnet
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            1 SOL = {solToUsd(1, solPrice)}
          </span>
        </div>
      </div>

      {/* ── PAY STUB ── */}
      <section>
        <h2 className="text-xl font-rajdhani font-bold text-white mb-3 tracking-wide">
          Pay Stub — Verified Onchain
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-3 text-[11px] text-muted-foreground uppercase tracking-widest p-3 border-b border-border">
            <span>Source</span>
            <span className="text-center">SOL</span>
            <span className="text-right">USD</span>
          </div>
          <PayRow label="Trading Fees (1% × volume)" sol={stats.tradingFeesSol} usd={solToUsd(stats.tradingFeesSol, solPrice)} />
          <PayRow label="Settlement Bonuses (5%/2%)" sol={stats.settlementBonusSol} usd={solToUsd(stats.settlementBonusSol, solPrice)} />
          <div className="grid grid-cols-3 p-3 bg-[#95fe7c]/5 border-t border-[#95fe7c]/20">
            <span className="text-sm font-bold text-[#95fe7c]">Total Career Earnings</span>
            <span className="text-center text-sm font-bold text-[#95fe7c] font-mono">{formatSol(stats.totalEarningsSol)} SOL</span>
            <span className="text-right text-sm font-bold text-[#95fe7c]">{solToUsd(stats.totalEarningsSol, solPrice)}</span>
          </div>
        </div>
      </section>

      {/* ── BATTLE HISTORY ── */}
      {stats.mainEventBattles.length > 0 && (
        <section>
          <h2 className="text-xl font-rajdhani font-bold text-white mb-3 tracking-wide">
            Main Event History
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px] text-muted-foreground uppercase tracking-widest p-3 border-b border-border gap-4">
              <span>Opponent</span>
              <span className="text-center">Volume</span>
              <span className="text-center">Result</span>
              <span className="text-right">Replay</span>
            </div>
            {stats.mainEventBattles.slice(0, 10).map((b) => {
              const isArtistA = b.artist1_wallet === stats.wallet
              const opponent = isArtistA ? b.artist2_name : b.artist1_name
              const p1 = b.artist1_pool ?? 0
              const p2 = b.artist2_pool ?? 0
              const artistAWon = (b.winner_decided && b.winner_artist_a !== null)
                ? Boolean(b.winner_artist_a)
                : p1 >= p2
              const won = isArtistA ? artistAWon : !artistAWon
              const totalVol = (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)
              return (
                <div key={b.battle_id} className="grid grid-cols-[1fr_auto_auto_auto] items-center p-3 border-b border-border last:border-0 hover:bg-white/5 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#95fe7c] bg-[#95fe7c]/10 border border-[#95fe7c]/30 rounded px-1.5 py-0.5 font-mono tracking-wider shrink-0">
                      VS
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{opponent}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        #{b.battle_id} · {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-[#7ec1fb] text-center">
                    {formatSol(totalVol)} SOL
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded text-center ${
                    b.status === 'ACTIVE'
                      ? 'bg-yellow-500/20 text-yellow-400 animate-pulse'
                      : won
                      ? 'bg-[#95fe7c]/20 text-[#95fe7c]'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {b.status === 'ACTIVE' ? '● LIVE' : won ? 'WIN' : 'LOSS'}
                  </span>
                  <div className="text-right">
                    {b.youtube_replay_link ? (
                      <a href={b.youtube_replay_link} target="_blank" rel="noreferrer"
                        className="text-xs text-[#7ec1fb] hover:underline">
                        Watch ↗
                      </a>
                    ) : b.stream_link ? (
                      <a href={b.stream_link} target="_blank" rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-white">
                        Stream ↗
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── QUICK BATTLE STATS ── */}
      {stats.quickBattles.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xl font-rajdhani font-bold text-white tracking-wide">
              Quick Battle Songs
            </h2>
            <span className="text-xs text-muted-foreground">
              {stats.quickWins}W–{stats.quickLosses}L · {stats.quickWins + stats.quickLosses > 0 ? Math.round(stats.quickWins / (stats.quickWins + stats.quickLosses) * 100) : 0}% overall
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Quick battles are the proving ground — chart performance shows what resonates with the crowd.
          </p>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox label="Quick Record" value={`${stats.quickWins}W – ${stats.quickLosses}L`} sub={`${stats.quickWins + stats.quickLosses > 0 ? Math.round(stats.quickWins / (stats.quickWins + stats.quickLosses) * 100) : 0}% win rate`} />
            <StatBox label="Quick Volume" value={`${formatSol(stats.quickBattles.reduce((s, b) => { const isA = b.artist1_wallet === stats.wallet; return s + (isA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)) }, 0))} SOL`} sub="Chart trading" />
            <StatBox label="Songs Entered" value={[...new Set(stats.quickBattles.map(b => b.artist1_wallet === stats.wallet ? b.artist1_name : b.artist2_name))].length.toString()} sub="Unique tracks" />
          </div>

          {/* Per-song breakdown */}
          <QuickBattleSongTable battles={stats.quickBattles} wallet={stats.wallet} solPrice={solPrice} />
        </section>
      )}

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, highlight = false }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-[#0d1321] p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-lg font-rajdhani font-bold ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>
        {value}
      </p>
      {/* Fix #3: larger sub-text for mobile readability */}
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function SocialIcon({ href, label, color, children }: {
  href: string; label: string; color: string; children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      style={{ color }}
      className="w-8 h-8 rounded-lg border border-border bg-[#0d1321] flex items-center justify-center hover:border-current/50 hover:bg-white/5 transition-colors opacity-70 hover:opacity-100"
    >
      {children}
    </a>
  )
}

function QuickBattleSongTable({ battles, wallet, solPrice }: {
  battles: Battle[]; wallet: string; solPrice: number
}) {
  // Group by song title (artist's song is the one matching their wallet side)
  const songMap = new Map<string, { title: string; musicLink: string | null; wins: number; losses: number; volume: number }>()

  for (const b of battles) {
    const isA = b.artist1_wallet === wallet
    const title = isA ? b.artist1_name : b.artist2_name
    const musicLink = isA ? (b.artist1_music_link ?? null) : (b.artist2_music_link ?? null)
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0
    const artistAWon = p1 >= p2
    const won = isA ? artistAWon : !artistAWon
    const vol = isA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)
    const key = title.toLowerCase().trim()
    const existing = songMap.get(key) ?? { title, musicLink, wins: 0, losses: 0, volume: 0 }
    existing.wins += won ? 1 : 0
    existing.losses += won ? 0 : 1
    existing.volume += vol
    songMap.set(key, existing)
  }

  const songs = Array.from(songMap.values()).sort((a, b) => b.wins - a.wins || b.volume - a.volume)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#111827]">
            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">#</th>
            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Song</th>
            <th className="text-center px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Record</th>
            <th className="text-center px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Win %</th>
            <th className="text-right px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Volume</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s, i) => {
            const total = s.wins + s.losses
            const rate = total > 0 ? Math.round(s.wins / total * 100) : 0
            // Extract Audius handle initial for placeholder art
            const initial = s.title.charAt(0).toUpperCase()
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Album art placeholder — links to Audius */}
                    {s.musicLink ? (
                      <a href={s.musicLink} target="_blank" rel="noreferrer"
                        className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#7ec1fb]/20 to-[#7ec1fb]/5 border border-[#7ec1fb]/20 flex items-center justify-center shrink-0 hover:border-[#7ec1fb]/50 transition-colors">
                        <span className="font-rajdhani font-bold text-[#7ec1fb] text-sm">{initial}</span>
                      </a>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#1f2937] border border-border flex items-center justify-center shrink-0">
                        <span className="font-rajdhani font-bold text-muted-foreground text-sm">{initial}</span>
                      </div>
                    )}
                    <div>
                      {s.musicLink ? (
                        <a href={s.musicLink} target="_blank" rel="noreferrer"
                          className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm leading-tight block">
                          {s.title} ↗
                        </a>
                      ) : (
                        <span className="font-rajdhani font-bold text-white text-sm">{s.title}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{total} battles</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-rajdhani font-bold text-[#7ec1fb]">{s.wins}W</span>
                  <span className="text-muted-foreground mx-1">–</span>
                  <span className="font-rajdhani font-bold text-red-400">{s.losses}L</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-bold font-rajdhani ${rate >= 60 ? 'text-[#95fe7c]' : rate >= 40 ? 'text-[#7ec1fb]' : 'text-red-400'}`}>
                    {rate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className="text-[#7ec1fb]">{formatSol(s.volume)}</span>
                  <span className="text-muted-foreground"> SOL</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PayRow({ label, sol, usd }: { label: string; sol: number; usd: string }) {
  return (
    <div className="grid grid-cols-3 items-center p-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-center text-sm font-mono text-white">{formatSol(sol)} SOL</span>
      <span className="text-right text-sm text-muted-foreground">{usd}</span>
    </div>
  )
}
