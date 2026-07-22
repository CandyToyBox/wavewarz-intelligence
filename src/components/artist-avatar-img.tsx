'use client'

// Renders an avatar image that falls back to a letter badge if the source
// 404s (most commonly an unavatar.io Twitter lookup for a handle that
// doesn't resolve to a real profile photo).
export function ArtistAvatarImg({
  imgSrc, alt, initial, containerClassName, imgClassName,
}: {
  imgSrc: string
  alt: string
  initial: string
  containerClassName: string
  imgClassName: string
}) {
  return (
    <div className={containerClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={alt}
        className={imgClassName}
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent && !parent.querySelector('[data-avatar-fallback]')) {
            const span = document.createElement('span')
            span.dataset.avatarFallback = 'true'
            span.className = 'font-rajdhani font-bold text-[#95fe7c]'
            span.textContent = initial
            parent.appendChild(span)
          }
        }}
      />
    </div>
  )
}
