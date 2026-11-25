'use client'

// Profile picture that falls back to the artist's initial when the image host fails (unavatar often does).
import { useState } from 'react'

export function Pfp({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const [bad, setBad] = useState(false)
  if (src && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={src} alt="" onError={() => setBad(true)} />
  }
  return <b className={className} aria-hidden="true">{(name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase()}</b>
}
