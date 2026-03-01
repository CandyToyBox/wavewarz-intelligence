import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Shared secret to validate requests from wavewarz.com
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  // Validate secret header
  const secret = request.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Map incoming webhook payload to battles table schema
  const battle = {
    battle_id:                       payload.battle_id,
    status:                          payload.status ?? 'active',
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
    is_quick_battle:                 payload.is_quick_battle ?? false,
    is_test_battle:                  payload.is_test_battle ?? false,
    is_main_battle:                  payload.is_main_battle ?? false,
    community_round_id:              payload.community_round_id,
    quick_battle_queue_id:           payload.quick_battle_queue_id,
    split_wallet_address:            payload.split_wallet_address,
  }

  const { error } = await supabase
    .from('battles')
    .upsert(battle, { onConflict: 'battle_id' })

  if (error) {
    console.error('[webhook] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, battle_id: payload.battle_id })
}

// Allow GET for health check / ping
export async function GET() {
  return NextResponse.json({ status: 'WaveWarZ webhook active', timestamp: new Date().toISOString() })
}
