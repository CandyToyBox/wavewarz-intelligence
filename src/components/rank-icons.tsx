// Leaderboard icons from the WaveWarZ icon set (components/ww-icon.tsx). Kept out of rank-list.tsx ('use client')
// so server pages can render them.
import type { ReactNode } from 'react'
import { WwIcon } from './ww-icon'

export const RANK_ICONS: Record<'artists' | 'songs' | 'community' | 'traders' | 'clippers', ReactNode> = {
  artists: <WwIcon name="artist" size={28} />,
  songs: <WwIcon name="song" size={28} />,
  community: <WwIcon name="community-battlez" size={28} />,
  traders: <WwIcon name="trade" size={28} />,
  clippers: <WwIcon name="launch" size={28} />,
}
