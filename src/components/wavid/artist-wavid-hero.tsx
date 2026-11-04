import './wavid.css'
import { wwFontClass } from './fonts'
import { wavIdArtUrl, wavIdCardUrl } from './wavid-url'

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** Hero art for an artist page: the WavID on the stage, pfp as a small chip, card link, required caption. */
export function ArtistWavIdHero({
  handle,
  name,
  pfpUrl,
  checkedAt,
}: {
  handle: string
  name: string
  pfpUrl: string | null
  checkedAt: string
}) {
  return (
    <figure className={`ww ${wwFontClass} ww-hero`} style={{ margin: 0 }}>
      <div className="ww-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ww-art" src={wavIdArtUrl(handle, { format: 'svg' })} alt={`${name} WavID`} width={264} height={264} />
        {pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ww-pfp" src={pfpUrl} alt="" />
        )}
      </div>
      <figcaption className="ww-cap">
        <a href={wavIdCardUrl(handle)}>WavID card</a>
        <br />
        Public observation · {fmt(checkedAt)} · Artist control unverified
      </figcaption>
    </figure>
  )
}

/** Soft, screen-blended bleed of the artist's own WavID behind the player card. Same art, so still one WavID per view. */
export function ArtistWavIdAmbient({ handle }: { handle: string }) {
  return (
    <div className="ww ww-ambient" aria-hidden="true">
      <i style={{ backgroundImage: `url(${wavIdArtUrl(handle, { size: 480 })})` }} />
    </div>
  )
}
