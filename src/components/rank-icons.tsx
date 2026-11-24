// Leaderboard icons, two-colour line style from the redesigned homepage (green + blue strokes).
// Kept out of rank-list.tsx ('use client') because a server page that imports a value from a client
// module gets a client reference, not the SVG, and renders an empty icon box.
import type { ReactNode } from 'react'

// Two-colour line icons in the homepage style (green + blue strokes)
const I = ({ children }: { children: ReactNode }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
export const RANK_ICONS: Record<'artists' | 'songs' | 'community' | 'traders' | 'clippers', ReactNode> = {
  artists: <I><circle cx="11" cy="7" r="3.4" stroke="#95fe7c" /><path d="M4.4 20.8c.8-4.1 3.4-6.2 6.6-6.2s5.8 2.1 6.6 6.2" stroke="#95fe7c" /><path d="M18.6 10.2l.75 1.7 1.85.2-1.4 1.3.4 1.8-1.6-.9-1.6.9.4-1.8-1.4-1.3 1.85-.2z" fill="#7ec1fb" stroke="none" /></I>,
  songs: <I><circle cx="12" cy="12" r="8.8" stroke="#95fe7c" /><circle cx="12" cy="12" r="5.4" stroke="#7ec1fb" strokeWidth="1.4" /><circle cx="12" cy="12" r="1.6" fill="#daecfd" stroke="none" /><path d="M15.8 6a7 7 0 0 1 2.2 2.4" stroke="#daecfd" strokeWidth="1.3" /></I>,
  community: <I><circle cx="8" cy="8" r="3" stroke="#95fe7c" /><circle cx="16.5" cy="9" r="2.5" stroke="#7ec1fb" strokeWidth="1.6" /><path d="M2.8 20c.6-3.6 2.6-5.4 5.2-5.4s4.6 1.8 5.2 5.4" stroke="#95fe7c" /><path d="M14.4 14.6c.7-.3 1.4-.4 2.1-.4 2.2 0 3.9 1.6 4.4 4.8" stroke="#7ec1fb" strokeWidth="1.6" /></I>,
  traders: <I><path d="M3.5 19.5h17" stroke="#7ec1fb" strokeWidth="1.4" /><path d="M4.5 15.5l4.5-4.5 3.5 3 6.5-7" stroke="#95fe7c" /><path d="M15 7h4v4" stroke="#95fe7c" /></I>,
  clippers: <I><rect x="3.4" y="7.2" width="17.2" height="12.4" rx="2.2" stroke="#95fe7c" /><path d="M3.6 7.4l3-3.6M9 7.2l3-3.6M14.4 7.2l3-3.6" stroke="#7ec1fb" strokeWidth="1.5" /><path d="M10.4 11.2v5l4-2.5z" fill="#daecfd" stroke="none" /></I>,
}
