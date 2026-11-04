import './wavid.css'
import { wwFontClass } from './fonts'
import { wavIdArtUrl } from './wavid-url'

/**
 * A small WavID for lists and rows. Rasterized server-side (a WavID is ~1 MB
 * of SVG), lazy-loaded, and served at 2x for crisp edges. The deterministic art
 * is the artist's identity mark: never recolor or crop to a circle.
 */
export function WavIdMark({ handle, name, size = 40 }: { handle: string; name: string; size?: number }) {
  return (
    <span className={`ww ${wwFontClass} ww-mark`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wavIdArtUrl(handle, { size: size * 2 })}
        alt={`${name} WavID`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
