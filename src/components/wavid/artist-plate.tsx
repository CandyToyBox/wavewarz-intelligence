// The top of an artist's Statz page: a chrome frame, the artist's own Wave ID as the focal orb with
// Quan's three labeled callouts, the same Wave ID blurred into the background, then the numbers.
// Styles: site-shell.css (.wa-*). Callout data: src/lib/wavid/artist-wavid.ts.
import type { ReactNode } from 'react'
import type { ArtistWavId } from '@/lib/wavid/artist-wavid'
import { Pfp } from './pfp'

const art = (handle: string, q: string) => `/api/wavid-art/${encodeURIComponent(handle)}?${q}`
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export type PlateStat = { k: string; v: string; unit?: string; sub?: string; hi?: boolean }

export function ArtistPlate({ name, pfpUrl, wavid, meta, social, record, recordSub, stats, foot, action }: {
  name: string
  pfpUrl: string | null
  wavid: ArtistWavId | null
  meta: ReactNode
  social: ReactNode
  record: [number, number]
  recordSub: string
  stats: PlateStat[]
  foot: ReactNode
  action: ReactNode
}) {
  const callouts = wavid?.callouts ?? []
  return (
    <section className="wa-plate" aria-label={`${name} artist card`}>
      <div className="wa-in">
        {wavid && <div className="wa-bleed" aria-hidden="true" style={{ backgroundImage: `url(${art(wavid.handle, 'format=png&size=640')})` }} />}

        <div className="wa-top">
          <p className="wa-src">
            {wavid
              ? <>Wave ID · <a href={`/wavid/card/${encodeURIComponent(wavid.handle)}`}>open the card</a></>
              : 'Wave ID not drawn yet'}
          </p>
          {action}
        </div>

        <figure className={`wa-stage${wavid ? '' : ' none'}`}>
          <div className="wa-ring">
            <div className="wa-orb">
              <div>
                {wavid
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={art(wavid.handle, 'format=svg')} alt={`${name}'s Wave ID`} width={1080} height={1080} fetchPriority="high" />
                  : <Pfp className="wa-pfp" src={pfpUrl} name={name} />}
              </div>
            </div>
            {callouts.length > 0 && (
              <svg className="wa-lines" viewBox="0 0 1760 1080" preserveAspectRatio="none" aria-hidden="true">
                {callouts.map(c => (
                  <line key={c.id} x1={340 + c.ax} y1={c.ay} x2={c.side === 'left' ? 316 : 1444} y2={c.ly} />
                ))}
              </svg>
            )}
            {callouts.map((c, i) => (
              <i key={c.id} className="wa-dot" aria-hidden="true" style={{ '--ax': c.ax, '--ay': c.ay } as React.CSSProperties}>{i + 1}</i>
            ))}
          </div>

          {callouts.length > 0 && (
            <ul className="wa-cos" aria-label="What the Wave ID shows">
              {callouts.map((c, i) => (
                <li key={c.id} className={`wa-co ${c.side}`} style={{ '--ly': c.ly } as React.CSSProperties} aria-label={c.aria}>
                  <span className="k"><i aria-hidden="true">{i + 1}</i>{c.kicker}</span>
                  <strong>{c.title}</strong>
                  {c.detail && <p>{c.detail}</p>}
                </li>
              ))}
            </ul>
          )}

        </figure>

        <div className="wa-idrow">
            <div className="wa-who">
              <span className="wa-av">
                <Pfp src={pfpUrl} name={name} />
              </span>
              <div className="min-w-0">
                <h1>{name}</h1>
                <div className="wa-meta">{meta}</div>
                <div className="wa-social mt-2">{social}</div>
              </div>
            </div>

            <div className="wa-rec">
              <b aria-label={`${record[0]} wins, ${record[1]} losses`}>{record[0]}<span>–</span>{record[1]}</b>
              <small>{recordSub}</small>
            </div>
        </div>

        <dl className="wa-stats">
          {stats.map(s => (
            <div key={s.k}>
              <dt>{s.k}</dt>
              <dd className={s.hi ? 'hi' : undefined}>{s.v}{s.unit && <small>{s.unit}</small>}</dd>
              {s.sub && <p>{s.sub}</p>}
            </div>
          ))}
        </dl>

        <div className="wa-foot">
          {foot}
          {wavid && <span>Wave ID drawn from public Quick Battle records, checked {day(wavid.checkedAt)}. Not yet claimed by the artist.</span>}
          {!wavid && <span>A Wave ID is drawn from an artist&apos;s Quick Battle songs on Audius. It shows here once those records line up.</span>}
        </div>
      </div>
    </section>
  )
}
