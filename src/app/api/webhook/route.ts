import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hydrateOnchainData, fetchBattleTradesFromChain } from '@/lib/solana/hydrate'
import { registerBattleSongs } from '@/lib/song-registry'

export async function POST(request: NextRequest) {
  // ── Auth: validate shared secret ─────────────────────────────────────────
  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[webhook] rejected — missing or invalid x-webhook-secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Payload normalisation ─────────────────────────────────────────────────
  // Supabase Database Webhooks wrap the row in { type, table, record: {...} }.
  // Direct/custom webhooks send the battle fields at the top level.
  // Support both so either source works without changes.
  const payload: Record<string, unknown> =
    (raw.record && typeof raw.record === 'object')
      ? (raw.record as Record<string, unknown>)
      : raw

  if (!payload.battle_id) {
    return NextResponse.json({ error: 'Missing battle_id' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // ── Step 1: Store metadata from webhook payload ───────────────────────────
  // Pool/volume values from the payload are wavewarz.com's calculated values.
  // These are correct and will be overwritten by onchain values in Step 2.
  const isQuickBattle = Boolean(payload.is_quick_battle)
  const isEnded = payload.status === 'ENDED' || payload.status === 'ended'

  // If wavewarz.com has already determined the QB winner via 3-factor judging,
  // propagate it to the general winner fields so the app shows the correct result
  // even before on-chain settlement completes.
  const qbWinnerDecided = isQuickBattle && Boolean(payload.quick_battles_winner_decided)
  const qbWinnerArtistA = payload.quick_battles_winner_artist_a as boolean | null | undefined

  const battle = {
    battle_id:                       payload.battle_id,
    status:                          payload.status ?? 'ACTIVE',
    artist1_name:                    payload.artist1_name,
    artist1_wallet:                  payload.artist1_wallet,
    artist1_music_link:              payload.artist1_music_link,
    artist1_twitter:                 payload.artist1_twitter,
    artist1_pool:                    payload.artist1_pool,
    artist1_supply:                  payload.artist1_supply,
    total_volume_a:                  payload.total_volume_a,
    artist2_name:                    payload.artist2_name,
    artist2_wallet:                  payload.artist2_wallet,
    artist2_music_link:              payload.artist2_music_link,
    artist2_twitter:                 payload.artist2_twitter,
    artist2_pool:                    payload.artist2_pool,
    artist2_supply:                  payload.artist2_supply,
    total_volume_b:                  payload.total_volume_b,
    image_url:                       payload.image_url,
    stream_link:                     payload.stream_link,
    battle_duration:                 payload.battle_duration,
    // For QB battles: prefer the QB-specific winner decision over the general one
    winner_decided:                  qbWinnerDecided ? true : payload.winner_decided,
    winner_artist_a:                 qbWinnerDecided && qbWinnerArtistA != null
                                       ? (qbWinnerArtistA ? 1 : 0)
                                       : payload.winner_artist_a,
    unique_traders:                  payload.unique_traders,
    trade_count:                     payload.trade_count,
    total_distribution_amount:       payload.total_distribution_amount,
    wavewarz_wallet:                 payload.wavewarz_wallet,
    creator_wallet:                  payload.creator_wallet,
    is_community_battle:             payload.is_community_battle ?? false,
    is_quick_battle:                 isQuickBattle,
    is_test_battle:                  payload.is_test_battle ?? false,
    // is_main_battle is a GENERATED column — computed by DB, never inserted
    community_round_id:              payload.community_round_id,
    quick_battle_queue_id:           payload.quick_battle_queue_id,
    split_wallet_address:            payload.split_wallet_address,
    // ── QB 3-factor judging — Poll factor ─────────────────────────────────────
    poll_votes_a:                    payload.poll_votes_a,
    poll_votes_b:                    payload.poll_votes_b,
    poll_winner:                     payload.poll_winner,
    poll_finalized_at:               payload.poll_finalized_at,
    // ── QB 3-factor judging — DJ Wavy (AI judge) factor ───────────────────────
    // wavewarz.com column is quick_battles_dj_wavy_winner (prefixed).
    // Map it into our dj_wavy_winner field; fall back to legacy names just in case.
    dj_wavy_winner:                  payload.quick_battles_dj_wavy_winner
                                       ?? payload.dj_wavy_winner
                                       ?? payload.djwavy_winner
                                       ?? null,
    dj_wavy_reasoning:               payload.dj_wavy_reasoning ?? payload.djwavy_reasoning ?? null,
    // ── QB full outcome fields (wavewarz.com quick_battles_* columns) ──────────
    quick_battles_dj_wavy_judged_at:  payload.quick_battles_dj_wavy_judged_at  ?? null,
    quick_battles_chart_winner:       payload.quick_battles_chart_winner        ?? null,
    quick_battles_final_artist1_pool: payload.quick_battles_final_artist1_pool  ?? null,
    quick_battles_final_artist2_pool: payload.quick_battles_final_artist2_pool  ?? null,
    quick_battles_charts_finalized_at: payload.quick_battles_charts_finalized_at ?? null,
    quick_battles_overall_winner:     payload.quick_battles_overall_winner      ?? null,
    quick_battles_winner_decided:     qbWinnerDecided,
    quick_battles_winner_artist_a:    qbWinnerArtistA ?? null,
  }

  const { error: upsertError } = await supabase
    .from('battles')
    .upsert(battle, { onConflict: 'battle_id' })

  if (upsertError) {
    console.error('[webhook] upsert error:', upsertError.message)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // ── Step 2: Hydrate authoritative values from Solana blockchain ───────────
  // The onchain battle state account holds the ground-truth pool sizes,
  // token supplies, and settlement data. We update those fields after
  // the initial upsert so even if this step fails, the metadata is saved.
  const battleId = Number(payload.battle_id)
  try {
    const onchain = await hydrateOnchainData(battleId)

    if (onchain) {
      const hydrated: Record<string, unknown> = {
        artist1_supply:             onchain.artist1_supply,
        artist2_supply:             onchain.artist2_supply,
        total_distribution_amount:  onchain.total_distribution_amount,
      }

      // Only overwrite pool values if onchain has non-zero data
      // (account may not be settled yet on fast ACTIVE webhooks)
      if (onchain.artist1_pool > 0 || onchain.artist2_pool > 0) {
        hydrated.artist1_pool = onchain.artist1_pool
        hydrated.artist2_pool = onchain.artist2_pool
      }

      // Volume: true trading volume = all buyShares (gross SOL) + all sellShares
      // (SOL returned from vault) during the battle window.  We compute this
      // from the vault PDA transaction history via the Helius Enhanced API.
      //
      // Fallback: if the Helius fetch fails or the battle has no valid
      // timestamps, use artist_sol_balance (cumulative buys only — an
      // undercount, but better than nothing).
      if (isEnded && onchain.start_time_sec > 0 && onchain.end_time_sec > 0) {
        try {
          // One chain scan feeds both: per-trade rows for the trades table
          // AND the gross volume totals (sum of those rows).
          const chainTrades = await fetchBattleTradesFromChain(
            battleId,
            onchain.start_time_sec,
            onchain.end_time_sec,
          )
          if (chainTrades && chainTrades.length > 0) {
            const volumeA = chainTrades.filter(t => t.trade_type.endsWith('_a')).reduce((s, t) => s + t.amount_sol, 0)
            const volumeB = chainTrades.filter(t => t.trade_type.endsWith('_b')).reduce((s, t) => s + t.amount_sol, 0)
            hydrated.total_volume_a = volumeA
            hydrated.total_volume_b = volumeB
            console.log(`[webhook] volume from chain: A=${volumeA.toFixed(4)} B=${volumeB.toFixed(4)} (${chainTrades.length} trades)`)

            // Persist per-trade history (powers trader profiles + leaderboard).
            // Delete-then-insert keeps re-fired webhooks idempotent -- but doing
            // that as two separate calls let two overlapping webhook deliveries
            // for the same battle race each other (both pass the delete before
            // either inserts), which produced 709 exact-duplicate trade rows
            // across 79 battles. replace_battle_trades() does both steps inside
            // one Postgres function call, holding pg_advisory_xact_lock(battle_id)
            // for the duration, so concurrent deliveries serialize instead of
            // racing. chainTrades is buy/sell only (claims are backfilled
            // separately by the nightly job via scripts/backfill-claims-from-chain.ts)
            // -- the function excludes trade_type='claim' from its delete, otherwise
            // a re-fired webhook would silently wipe real settlement withdrawals
            // until the next nightly resync.
            const { error: rpcErr } = await supabase.rpc('replace_battle_trades', {
              p_battle_id: battleId,
              p_trades: chainTrades,
            })
            if (rpcErr) console.warn(`[webhook] replace_battle_trades failed for ${battleId}: ${rpcErr.message}`)
            else console.log(`[webhook] stored ${chainTrades.length} trades for battle ${battleId}`)
          } else {
            // Fallback to artist_sol_balance (buys only)
            if (onchain.artist1_sol_balance > 0 || onchain.artist2_sol_balance > 0) {
              hydrated.total_volume_a = onchain.artist1_sol_balance
              hydrated.total_volume_b = onchain.artist2_sol_balance
            }
          }
        } catch (volErr) {
          console.warn(`[webhook] volume fetch failed for ${battleId}, using sol_balance fallback:`, volErr)
          if (onchain.artist1_sol_balance > 0 || onchain.artist2_sol_balance > 0) {
            hydrated.total_volume_a = onchain.artist1_sol_balance
            hydrated.total_volume_b = onchain.artist2_sol_balance
          }
        }
      } else if (onchain.artist1_sol_balance > 0 || onchain.artist2_sol_balance > 0) {
        // ACTIVE battle or missing timestamps: use sol_balance as best available estimate
        hydrated.total_volume_a = onchain.artist1_sol_balance
        hydrated.total_volume_b = onchain.artist2_sol_balance
      }

      // Use onchain battle_duration if we have valid timestamps
      if (onchain.battle_duration > 0) {
        hydrated.battle_duration = onchain.battle_duration
      }

      // ── Winner determination ────────────────────────────────────────────
      // For ENDED battles:
      //   Quick Battles: 3-factor system — Poll + Charts (SOL) + DJ Wavy (AI Judge), 2/3 wins
      //                  If webhook sends winner_decided=true, trust it.
      //                  Fallback: charts-only (larger pool) if no result yet.
      //   Main Events:   determined by admin judging panel (human + X poll + SOL vote)
      //   Community:     determined by admin judging panel
      if (isEnded && !onchain.winner_decided) {
        if (isQuickBattle && !battle.winner_decided) {
          // 3-factor winner: Poll + Charts (SOL) + DJ Wavy — 2 of 3 wins.
          // If wavewarz.com already sent winner_decided=true, trust it (no override).
          // Otherwise compute from available factors:
          const a1pool = onchain.artist1_pool > 0 ? onchain.artist1_pool : (battle.artist1_pool as number ?? 0)
          const a2pool = onchain.artist2_pool > 0 ? onchain.artist2_pool : (battle.artist2_pool as number ?? 0)
          const artist1Name = (battle.artist1_name as string | null) ?? ''

          // Charts factor: larger pool wins
          const chartsA = a1pool >= a2pool

          // Poll factor: poll_winner is "A", "B", "TIE", or artist name
          // wavewarz.com sends "A" or "B" — handle that first, then fall back
          // to name comparison for any legacy format.
          const pollWinner = (battle.poll_winner as string | null) ?? null
          const pollUpper = pollWinner?.trim().toUpperCase() ?? null
          const pollA: boolean | null = pollUpper === null || pollUpper === 'TIE'
            ? null
            : pollUpper === 'A'
              ? true
              : pollUpper === 'B'
                ? false
                : pollWinner!.trim().toLowerCase() === artist1Name.trim().toLowerCase()
                  ? true
                  : false

          // DJ Wavy factor: same A/B/name format as poll_winner
          const djWinner = (battle.dj_wavy_winner as string | null)
            ?? (payload.quick_battles_dj_wavy_winner as string | null)
            ?? (payload.dj_wavy_winner as string | null)
            ?? (payload.djwavy_winner as string | null)
            ?? null
          const djUpper = djWinner?.trim().toUpperCase() ?? null
          const djA: boolean | null = djUpper === null
            ? null
            : djUpper === 'A'
              ? true
              : djUpper === 'B'
                ? false
                : djWinner!.trim().toLowerCase() === artist1Name.trim().toLowerCase()
                  ? true
                  : false

          // Count votes: charts always counts; poll + DJ Wavy count when available
          const factorsForA = [chartsA, pollA, djA].filter(v => v !== null) as boolean[]
          const votesA = factorsForA.filter(Boolean).length
          const votesB = factorsForA.filter(v => !v).length

          if (votesA >= 2 || votesB >= 2) {
            // Enough factors to determine a 2-of-3 winner
            hydrated.winner_decided = true
            hydrated.winner_artist_a = votesA >= 2 ? 1 : 0
          } else {
            // Only charts available — use it as single-factor fallback
            hydrated.winner_decided = true
            hydrated.winner_artist_a = chartsA ? 1 : 0
          }

        }
        // Main/Community: do NOT auto-decide — requires admin judging panel
      } else if (onchain.winner_decided && onchain.winner_artist_a !== null) {
        hydrated.winner_decided = true
        // winner_artist_a is stored as numeric (1.0/0.0) not boolean
        hydrated.winner_artist_a = onchain.winner_artist_a ? 1 : 0
      }

      const { error: hydrateError } = await supabase
        .from('battles')
        .update(hydrated)
        .eq('battle_id', battleId)

      if (hydrateError) {
        console.error('[webhook] hydrate update error:', hydrateError.code, hydrateError.message)
        // Non-fatal: metadata already saved
      } else {
        console.log(`[webhook] hydrated battle ${battleId} from chain`)
      }
    } else {
      console.warn(`[webhook] onchain hydration returned null for battle ${battleId}`)
    }
  } catch (err) {
    // Hydration failure is non-fatal — metadata upsert already succeeded
    console.error(`[webhook] hydration threw for battle ${battleId}:`, err)
  }

  // Register this quick battle's songs in song_registry so new songs from the
  // daily WaveWarZ/Audius catalog are ready immediately (non-fatal).
  if (isQuickBattle) {
    await registerBattleSongs(supabase, [
      { musicLink: payload.artist1_music_link as string | null, title: payload.artist1_name as string | null },
      { musicLink: payload.artist2_music_link as string | null, title: payload.artist2_name as string | null },
    ])
  }

  return NextResponse.json({ ok: true, battle_id: battleId })
}

// GET — health check / ping
export async function GET() {
  return NextResponse.json({ status: 'WaveWarZ webhook active', timestamp: new Date().toISOString() })
}
