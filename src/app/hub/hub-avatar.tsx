'use client'

// Exact same avatar resolution as the Artist Leaderboard
// (src/app/leaderboards/artists/artist-table.tsx → ArtistAvatar):
//   stored profile_picture_url → unavatar.io/twitter/{handle} → letter fallback.
// Kept identical so the Hub and the public leaderboard never show different faces.
export function HubAvatar({
  name,
  pfpUrl,
  twitterHandle,
  size = 40,
}: {
  name: string
  pfpUrl: string | null
  twitterHandle: string | null
  size?: number
}) {
  const imgSrc = pfpUrl ?? (twitterHandle ? `https://unavatar.io/twitter/${twitterHandle}` : null)
  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <div
      className="shrink-0 rounded-full overflow-hidden border-2 border-border bg-[#1a2235] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent && !parent.querySelector('[data-avatar-fallback]')) {
              const span = document.createElement('span')
              span.dataset.avatarFallback = 'true'
              span.className = 'font-rajdhani font-bold text-[#95fe7c]'
              span.style.fontSize = `${Math.round(size * 0.45)}px`
              span.textContent = initial
              parent.appendChild(span)
            }
          }}
        />
      ) : (
        <span className="font-rajdhani font-bold text-[#95fe7c]" style={{ fontSize: Math.round(size * 0.45) }}>
          {initial}
        </span>
      )}
    </div>
  )
}
