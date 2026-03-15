import { createClient } from '@/lib/supabase/server'
import { resolveAudiusTrack } from '@/lib/audius'
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
  const [res] = await Promise.all([
    supabase
      .from('battles')
      .select(
        'battle_id,artist1_name,artist2_name,artist1_pool,artist2_pool,total_volume_a,total_volume_b,artist1_music_link,artist2_music_link,battle_duration,created_at,unique_traders,winner_decided,winner_artist_a'
      )
      .eq('is_quick_battle', true)
      .eq('is_test_battle', false)
      .neq('status', 'ACTIVE')
      .order('created_at', { ascending: false }),
  ])

  const battles = (res.data ?? []) as RawBattle[]
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
      const key = s.title.toLowerCase().trim()
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

  // Resolve Audius artwork + genre server-side (parallel, cached 60s in resolveAudiusTrack)
  const uniqueLinks = [
    ...new Set(songs.map(s => s.musicLink).filter(Boolean) as string[]),
  ]

  const trackMap = new Map<string, { artUrl: string | null; genre: string | null; artistName: string | null }>()
  await Promise.all(
    uniqueLinks.map(async (link) => {
      const track = await resolveAudiusTrack(link)
      trackMap.set(link, {
        artUrl: track?.artwork?.['480x480'] ?? null,
        genre: track?.genre ?? null,
        artistName: track?.user?.name ?? null,
      })
    })
  )

  for (const song of songs) {
    if (song.musicLink) {
      const info = trackMap.get(song.musicLink)
      if (info) {
        song.artUrl = info.artUrl
        song.genre = info.genre
        song.artistName = info.artistName
      }
    }
  }

  return { songs }
}

export default async function SongChartsPage() {
  const { songs } = await getData()
  return <SongChartsClient songs={songs} />
}
