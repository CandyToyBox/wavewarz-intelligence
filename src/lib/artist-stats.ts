import { createClient } from '@/lib/supabase/server'
import { getAudiusUser, getUserPfp } from '@/lib/audius'
import { calculateArtistEarnings, getWinnerLoserPools } from '@/lib/wavewarz-math'
import { groupIntoEvents, pairKey } from '@/lib/event-grouping'

// Shared artist career-stats computation. Extracted verbatim from
// src/app/artist/[id]/page.tsx so the /hub Booker Card and the public Player
// Card can never drift (same lesson as battle-metrics.ts / leaderboards/artists.ts).

// ─── Types ────────────────────────────────────────────────────────────────────

export type Battle = {
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

export type ArtistStats = {
  displayName: string
  wallet: string
  allWallets: string[]
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
  opponentNameOverrides: Map<string, string>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

export async function getArtistStats(id: string): Promise<ArtistStats | null> {
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
    // Sub-profiles (e.g. "AI LUI") don't have their own wallet -- their battles
    // come entirely from battle_artist_overrides below, not a wallet match.
    wallet = (profile.primary_wallet as string) ?? ''
  } else {
    // Wallet path — check artist_wallets first (secondary wallets)
    const { data: linked } = await supabase
      .from('artist_wallets')
      .select('artist_id, artist_profiles(*)')
      .eq('wallet_address', id)
      .maybeSingle()
    if (linked?.artist_id) {
      profileId = linked.artist_id
      profileData = linked.artist_profiles as unknown as Record<string, unknown>
    } else {
      // Also check if this wallet is the primary_wallet on artist_profiles
      const { data: primary } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('primary_wallet', id)
        .maybeSingle()
      if (primary) {
        profileId = primary.artist_id as string
        profileData = primary
      }
    }
  }

  // Get all wallets for this profile (handles artists with multiple wallets / name changes)
  // dbQueryWallets = only real onchain wallets, used to fetch from `battles` by wallet match.
  // Sub-profiles (e.g. "AI LUI") have none -- their battles come entirely from overrides below.
  const dbQueryWallets: string[] = wallet ? [wallet] : []
  if (profileId) {
    // Include the canonical primary wallet from artist_profiles (in case we navigated via a secondary wallet)
    const primaryFromProfile = profileData?.primary_wallet as string | undefined
    if (primaryFromProfile && !dbQueryWallets.includes(primaryFromProfile)) {
      dbQueryWallets.push(primaryFromProfile)
    }
    // Include all secondary wallets linked via artist_wallets
    const { data: linked } = await supabase
      .from('artist_wallets')
      .select('wallet_address')
      .eq('artist_id', profileId)
    for (const w of linked ?? []) {
      if (w.wallet_address && !dbQueryWallets.includes(w.wallet_address)) {
        dbQueryWallets.push(w.wallet_address)
      }
    }
  }

  // Per-battle profile overrides — splits one wallet's battles across multiple
  // named profiles. Two directions: overrides ON this profile's own wallets
  // (exclude those battles, they've been reassigned elsewhere) and overrides
  // POINTING TO this profile from a wallet that isn't otherwise "ours" (include
  // those battles even though dbQueryWallets wouldn't have found them).
  const [overridesOnOwnWallets, overridesIntoThisProfile] = await Promise.all([
    dbQueryWallets.length
      ? supabase.from('battle_artist_overrides').select('battle_id,wallet,artist_id').in('wallet', dbQueryWallets)
      : Promise.resolve({ data: [] }),
    profileId
      ? supabase.from('battle_artist_overrides').select('battle_id,wallet,artist_id').eq('artist_id', profileId)
      : Promise.resolve({ data: [] }),
  ])
  const excludeBattleIds = new Set(
    (overridesOnOwnWallets.data ?? []).filter(o => o.artist_id !== profileId).map(o => o.battle_id)
  )
  const includeOverrides = overridesIntoThisProfile.data ?? []
  const includeBattleIds = includeOverrides.map(o => o.battle_id)
  // allWallets drives side-detection (artist1 vs artist2) throughout the rest of
  // this page/component tree — extend it with override wallets so a battle
  // pulled in purely via override still correctly resolves which side is "mine".
  const allWallets = [...dbQueryWallets, ...new Set(includeOverrides.map(o => o.wallet))]

  // Get all battles for all linked wallets (both sides), exclude test
  const battleSets = await Promise.all([
    ...dbQueryWallets.flatMap(w => [
      supabase.from('battles').select('*').eq('artist1_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false }),
      supabase.from('battles').select('*').eq('artist2_wallet', w).eq('is_test_battle', false).order('created_at', { ascending: false }),
    ]),
    ...(includeBattleIds.length
      ? [supabase.from('battles').select('*').in('battle_id', includeBattleIds).eq('is_test_battle', false)]
      : []),
  ])
  const seen = new Set<number>()
  const allBattles: Battle[] = []
  for (const { data } of battleSets) {
    for (const b of data ?? []) {
      if (excludeBattleIds.has(b.battle_id)) continue
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

  // Include all main battles except charity/spotlight/prediction — use JS filter because
  // SQL neq() excludes NULL rows (battles with no event_subtype would be dropped)
  const mainEventBattles = allBattles.filter(
    b => b.is_main_battle && b.event_subtype !== 'charity' && b.event_subtype !== 'spotlight' && b.event_subtype !== 'prediction'
  )
  const quickBattles = allBattles.filter(b => b.is_quick_battle)

  // Opponent display names — resolve through battle_artist_overrides the same
  // way the artist leaderboard does (src/lib/leaderboards/artists.ts), so a
  // wallet that's been re-tagged to a sub-profile (e.g. "AI LUI" sharing a
  // battle wallet) shows that profile's name instead of the raw battle text.
  const opponentNameOverrides = new Map<string, string>()
  if (mainEventBattles.length) {
    const { data: opponentOverrides } = await supabase
      .from('battle_artist_overrides')
      .select('battle_id,wallet,artist_id')
      .in('battle_id', mainEventBattles.map(b => b.battle_id))
    const overrideArtistIds = [...new Set((opponentOverrides ?? []).map(o => o.artist_id))]
    if (overrideArtistIds.length) {
      const { data: overrideProfiles } = await supabase
        .from('artist_profiles')
        .select('artist_id,display_name')
        .in('artist_id', overrideArtistIds)
      const nameByArtistId = new Map((overrideProfiles ?? []).map(p => [p.artist_id, p.display_name as string | null]))
      for (const o of opponentOverrides ?? []) {
        const name = nameByArtistId.get(o.artist_id)
        if (name) opponentNameOverrides.set(`${o.battle_id}|${o.wallet}`, name)
      }
    }
  }

  // Quick Battles are single-round events, tallied per battle. Main Events
  // are multi-round matches -- a round win isn't an event win, so main-event
  // W/L is tallied per EVENT (round majority within a match), same grouping
  // the artist leaderboard uses (src/lib/leaderboards/artists.ts).
  let mainWins = 0, mainLosses = 0
  let quickWins = 0, quickLosses = 0
  let tradingFeesSol = 0, settlementBonusSol = 0, totalVolumeSol = 0
  const wonByBattleId = new Map<number, boolean>()

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

    wonByBattleId.set(b.battle_id, won)
    if (b.is_quick_battle) {
      if (won) quickWins++; else quickLosses++
    }

    totalVolumeSol += myVolume
    const earnings = calculateArtistEarnings(myVolume, loserPool, won)
    tradingFeesSol += earnings.tradingFees
    settlementBonusSol += earnings.settlementBonus
  }

  const decidedMainBattles = mainEventBattles.filter(b => wonByBattleId.has(b.battle_id))
  const mainEvents = groupIntoEvents(
    decidedMainBattles,
    b => pairKey(b.artist1_wallet, b.artist1_name, b.artist2_wallet, b.artist2_name),
    b => new Date(b.created_at).getTime(),
  )
  for (const event of mainEvents) {
    let myRoundWins = 0, oppRoundWins = 0
    for (const b of event) {
      if (wonByBattleId.get(b.battle_id)) myRoundWins++; else oppRoundWins++
    }
    if (myRoundWins > oppRoundWins) mainWins++
    else if (oppRoundWins > myRoundWins) mainLosses++
    // an exact round tie decides neither way
  }

  const wins = mainWins + quickWins
  const losses = mainLosses + quickLosses

  // No artist in the database has a manually-set profile_picture_url/custom_pfp_url
  // yet -- fall back to their Audius profile photo when they've linked a handle,
  // rather than showing initials for artists who do have a real photo available.
  let pfpUrl = (profileData?.profile_picture_url as string) ?? (profileData?.custom_pfp_url as string) ?? null
  const audiusHandle = (profileData?.audius_handle as string) ?? null
  if (!pfpUrl && audiusHandle) {
    const audiusUser = await getAudiusUser(audiusHandle)
    const audiusPfp = getUserPfp(audiusUser)
    if (audiusUser && !audiusPfp.startsWith('/placeholder')) pfpUrl = audiusPfp
  }

  return {
    displayName,
    // Sub-profiles have no real wallet -- fall back to the profile UUID so
    // links/routing (e.g. Solscan, /artist/{wallet}) still resolve to something.
    wallet: wallet || profileId || '',
    allWallets,
    profileId,
    pfpUrl,
    bio: (profileData?.bio as string) ?? null,
    twitterHandle: (profileData?.twitter_handle as string) ?? null,
    audiusHandle: (profileData?.audius_handle as string) ?? null,
    youtubeUrl: (profileData?.social_links as Record<string, string> | null)?.youtube ?? null,
    instagramHandle: (profileData?.social_links as Record<string, string> | null)?.instagram ?? null,
    tiktokHandle: (profileData?.social_links as Record<string, string> | null)?.tiktok ?? null,
    socialStats: (profileData?.social_stats as Record<string, number>) ?? {},
    mainEventBattles,
    quickBattles,
    opponentNameOverrides,
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
