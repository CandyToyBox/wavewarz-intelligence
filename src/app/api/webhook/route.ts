import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hydrateOnchainData } from '@/lib/solana/hydrate'

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
    winner_decided:                  payload.winner_decided,
    winner_artist_a:                 payload.winner_artist_a,
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
    // ── QB 3-point judging — Poll factor ──────────────────────────────────────
    poll_votes_a:                    payload.poll_votes_a,
    poll_votes_b:                    payload.poll_votes_b,
    poll_winner:                     payload.poll_winner,
    poll_finalized_at:               payload.poll_finalized_at,
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

      // Volume: artist_sol_balance tracks cumulative trading SOL per side.
      // Webhook payload stopped reliably sending total_volume_a/b, so we
      // always hydrate from chain when the onchain value is non-zero.
      if (onchain.artist1_sol_balance > 0 || onchain.artist2_sol_balance > 0) {
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
          // Chart-based fallback ONLY when neither the chain nor the webhook
          // has already provided a 3-factor winner. If the webhook already
          // sent winner_decided=true (3-factor result), trust it — don't overwrite.
          const a1pool = onchain.artist1_pool > 0 ? onchain.artist1_pool : (battle.artist1_pool as number ?? 0)
          const a2pool = onchain.artist2_pool > 0 ? onchain.artist2_pool : (battle.artist2_pool as number ?? 0)
          hydrated.winner_decided = true
          hydrated.winner_artist_a = (a1pool >= a2pool) ? 1 : 0
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

  return NextResponse.json({ ok: true, battle_id: battleId })
}

// GET — health check / ping
export async function GET() {
  return NextResponse.json({ status: 'WaveWarZ webhook active', timestamp: new Date().toISOString() })
}
