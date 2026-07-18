import { getSongLeaderboard } from '@/lib/leaderboards/songs'
import SongChartsClient from './SongChartsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Song Charts — WaveWarZ Intelligence',
  description: 'Quick battle song charts: trending, most played, most volume, most traders, by genre.',
}

export default async function SongChartsPage() {
  const { songs } = await getSongLeaderboard()
  return <SongChartsClient songs={songs} />
}
