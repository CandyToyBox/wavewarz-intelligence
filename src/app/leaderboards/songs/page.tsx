import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { canonicalSongKey } from '@/lib/song-identity'
import SongChartsClient from './SongChartsClient'
import type { SongData, SongBattle } from './SongChartsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Song Charts — WaveWarZ Intelligence',
  description: 'Quick battle song charts: trending, most played, most volume, most traders, by genre.',
}

type RawBattle = {
  battle_id: number
  artist1_name: string
  artist2_name: string
  artist1_pool: number
  artist2_pool: number
  total_volume_a: number
  total_volume_b: number
  artist1_music_link: string | null
  artist2_music_link: string | null
  battle_duration: number | null
  created_at: string
  unique_traders: number | null
  winner_decided: boolean | null
  winner_artist_a: number | null
}

function parseAudiusHandle(url: string | null): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[0] ?? null
  } catch {
    return null
  }
}

async function getData() {
  const supabase = await createClient()
  // fetchAll paginates past the 1000-row cap — quick battles are nearing it.
  const battles = (await fetchAll((from, to) => supabase
    .from('battles')
    .select(
      'battle_id,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,artist1_music_link,artist2_music_link,battle_duration,created_at,unique_traders,winner_decided,winner_artist_a'
    )
    .eq('is_quick_battle', true)
    .eq('is_test_battle', false)
    .neq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .range(from, to))) as RawBattle[]
  const map = new Map<string, SongData>()

  for (const b of battles) {
    // winner_artist_a: 1 = artist A wins, 0 = artist B wins
    const aWon = (b.winner_decided && b.winner_artist_a != null)
      ? Number(b.winner_artist_a) === 1
      : (b.artist1_pool ?? 0) >= (b.artist2_pool ?? 0)

    const durationSeconds = b.battle_duration ?? 0
    const uniqueTraders   = b.unique_traders ?? 0

    const sides: Array<{
      title: string
      musicLink: string | null
      pool1: number
      pool2: number
      volume1: number
      won: boolean
    }> = [
      {
        title: b.artist1_name,
        musicLink: b.artist1_music_link,
        pool1: b.artist1_pool ?? 0,
        pool2: b.artist2_pool ?? 0,
        volume1: b.total_volume_a ?? 0,
        won: aWon,
      },
      {
        title: b.artist2_name,
        musicLink: b.artist2_music_link,
        pool1: b.artist2_pool ?? 0,
        pool2: b.artist1_pool ?? 0,
        volume1: b.total_volume_b ?? 0,
        won: !aWon,
      },
    ]

    for (const s of sides) {
      if (!s.title) continue
      // Key by the track's permalink, not the hand-entered title — so one
      // track is one row regardless of title-string variations, and two
      // different tracks sharing a title stay separate.
      const key = canonicalSongKey(s.musicLink, s.title)
      const handle = parseAudiusHandle(s.musicLink)

      if (!map.has(key)) {
        map.set(key, {
          key,
          songTitle: s.title,
          musicLink: s.musicLink,
          handle,
          artUrl: null,
          genre: null,
          artistName: null,
          battles: [],
        })
      }

      const entry = map.get(key)!

      // Keep first non-null music link
      if (!entry.musicLink && s.musicLink) {
        entry.musicLink = s.musicLink
        entry.handle = handle
      }

      const battle: SongBattle = {
        battleId: b.battle_id,
        pool1: s.pool1,
        pool2: s.pool2,
        volume1: s.volume1,
        durationSeconds,
        createdAt: b.created_at,
        uniqueTraders,
        won: s.won,
      }
      entry.battles.push(battle)
    }
  }

  const songs = Array.from(map.values())

  // Enrich from song_registry — resolved once via the (free, open) Audius API
  // by scripts/backfill-song-registry.ts, keyed by the same canonical permalink.
  // This replaces ~hundreds of live API calls per render with one cached read.
  // Falls back gracefully (no artwork) if the table isn't populated yet.
  const { data: registry } = await supabase
    .from('song_registry')
    .select('permalink_key, title, artist_name, genre, artwork_url')
  const regMap = new Map((registry ?? []).map(r => [r.permalink_key, r]))

  for (const song of songs) {
    const r = regMap.get(song.key)
    if (r) {
      song.artUrl = r.artwork_url ?? null
      song.genre = r.genre ?? null
      song.artistName = r.artist_name ?? null
      // Prefer the official Audius title over the hand-typed battle name
      if (r.title) song.songTitle = r.title
    }
  }

  return { songs }
}

export default async function SongChartsPage() {
  const { songs } = await getData()
  return <SongChartsClient songs={songs} />
}
