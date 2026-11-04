import './wavid.css'
import { wwFontClass } from './fonts'
import { wavIdArtUrl, wavIdCardUrl } from './wavid-url'

export type MatchupSide = {
  name: string
  /** Audius handle of an eligible roster artist, or null when the side has no WavID. */
  handle: string | null
  /** Roster display name of the WavID artist; shown under song titles on Quick Battles. */
  artist?: string | null
  won: boolean
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function Side({ side, which, settled }: { side: MatchupSide; which: 'l' | 'r'; settled: boolean }) {
  return (
    <div className={`ww-side ${which}${settled && side.won ? ' win' : ''}`}>
      {side.handle ? (
        <div className="ww-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ww-art" src={wavIdArtUrl(side.handle, { size: 560 })} alt={`${side.name} WavID`} width={280} height={280} loading="lazy" />
        </div>
      ) : (
        <div className="ph" aria-hidden="true">{side.name.charAt(0).toUpperCase()}</div>
      )}
      <div>
        <p className="tag">{settled && side.won ? 'Winner' : which === 'l' ? 'Side A' : 'Side B'}</p>
        <h2 className="nm">{side.name}</h2>
        {side.handle && (
          <p className="ww-cap" style={{ marginTop: 4 }}>
            {side.artist && side.artist.toLowerCase() !== side.name.toLowerCase() ? `${side.artist} · ` : ''}
            <a href={wavIdCardUrl(side.handle)}>WavID card</a>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Head-to-head WavIDs for a battle page, in the live-deck family: stage panel,
 * tilted tiles (green left, blue right), VS in the middle, one mono footer line.
 * Reads the outcome the page already computed; it never decides one.
 */
export function BattleWavIdMatchup({
  a,
  b,
  settled,
  checkedAt,
}: {
  a: MatchupSide
  b: MatchupSide
  settled: boolean
  checkedAt: string
}) {
  return (
    <section className={`ww ${wwFontClass} ww-deck`} aria-label="WavID head to head">
      <div className="ww-stage3">
        <Side side={a} which="l" settled={settled} />
        <div className="ww-mid">
          <span className="ww-label">WavID</span>
          <span className="ww-vs">VS</span>
        </div>
        <Side side={b} which="r" settled={settled} />
      </div>
      <p className="ww-cap ww-foot">
        Each WavID is drawn from that artist&apos;s public WaveWarz record · Public observation · {fmt(checkedAt)} · Artist control unverified
      </p>
    </section>
  )
}
