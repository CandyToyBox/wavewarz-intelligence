'use client'

// Share pop-up for Statz pages, adapted from the Battle Share Card draft (Nov 2026): pick a headline and a
// background, see the real card, then post it, copy the link or save the PNG. The card's numbers are drawn on
// the server from the database (api/share-card); the shared link unfurls with the same card (?card=bg.headline).
import { useRef, useState } from 'react'
import { SHARE_BACKGROUNDS, shareImagePath, type ShareBackground, type ShareKind } from '@/lib/share-options'

type Info = { path: string; title: string; shareText: string; heroes: { key: string; label: string }[] }

const ICON = {
  share: <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4" /></>,
  down: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
}
const Svg = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

const TARGETS: { key: string; label: string; mark: React.ReactNode; href: (url: string, text: string) => string }[] = [
  { key: 'x', label: 'X', mark: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.3l8.2-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.2 18h1.7L7.4 4H5.6l12.1 16Z" /></svg>,
    href: (u, t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { key: 'fc', label: 'Farcaster', mark: <Svg d={<><path d="M6 20V10a6 6 0 0 1 12 0v10" /><path d="M4 20h4M16 20h4" /></>} size={17} />,
    href: (u, t) => `https://farcaster.xyz/~/compose?text=${encodeURIComponent(t)}&embeds[]=${encodeURIComponent(u)}` },
  { key: 'tg', label: 'Telegram', mark: <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 3 2.6 10.6c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 1.9 5.8c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.2-.5-1.7-1.4-1.7ZM8.6 13.4l9.3-5.9c.4-.3.8-.1.5.3l-7.7 7-.3 3.2-1.5-4.6Z" /></svg>,
    href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'th', label: 'Threads', mark: <b className="text-[15px] leading-none">@</b>,
    href: (u, t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'fb', label: 'Facebook', mark: <b className="text-[16px] leading-none">f</b>,
    href: u => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'li', label: 'LinkedIn', mark: <b className="text-[13px] leading-none">in</b>,
    href: u => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
]

const KIND_NOUN: Record<ShareKind, string> = { platform: 'WaveWarZ Statz', battle: 'this battle', artist: 'this artist' }

export function ShareStatz({ kind, id, className = '' }: { kind: ShareKind; id: string; className?: string }) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const [failed, setFailed] = useState(false)
  const [bg, setBg] = useState<ShareBackground>('arena')
  const [hero, setHero] = useState<string>('')
  const [loadedSrc, setLoadedSrc] = useState('')
  const [note, setNote] = useState('')
  const [canNative, setCanNative] = useState(false)

  const look = `${bg}${hero ? '.' + hero : ''}`
  const img = shareImagePath(kind, id, look)
  const pageUrl = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://wavewarz.info'
    return `${base}${info?.path ?? '/'}${(info?.path ?? '/').includes('?') ? '&' : '?'}card=${look}`
  }
  const say = (m: string) => { setNote(m); window.setTimeout(() => setNote(n => (n === m ? '' : n)), 2200) }

  async function open() {
    dlg.current?.showModal()
    setCanNative(typeof navigator.share === 'function')
    if (info) return
    setFailed(false)
    try {
      const r = await fetch(shareImagePath(kind, id) + '&format=json')
      if (!r.ok) throw new Error(String(r.status))
      const j: Info = await r.json()
      setInfo(j)
      setHero(j.heroes[0]?.key ?? '')
    } catch { setFailed(true) }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(pageUrl()); say('Link copied') } catch { say('Copy failed. Long-press the link in your browser bar instead.') }
  }

  async function blob() {
    const r = await fetch(img)
    if (!r.ok) throw new Error('image')
    return r.blob()
  }

  async function download() {
    try {
      const b = await blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `wavewarz-${kind}-${id}.png`.replace(/[^a-z0-9.-]+/gi, '-')
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      say('Card saved')
    } catch { say('Could not save the card. Try again.') }
  }

  async function nativeShare() {
    try {
      const file = new File([await blob()], `wavewarz-${kind}.png`, { type: 'image/png' })
      const data: ShareData = { title: info?.title, text: info?.shareText, url: pageUrl() }
      if (navigator.canShare?.({ files: [file] })) data.files = [file]
      await navigator.share(data)
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') say('Sharing is not available here. Copy the link instead.')
    }
  }

  const ready = !!info && loadedSrc === img

  return (
    <>
      <button type="button" className={`ww-cta ghost ww-share-trigger ${className}`} onClick={open} aria-haspopup="dialog">
        <Svg d={ICON.share} /> Share
      </button>

      <dialog ref={dlg} className="ww-share" aria-labelledby={`share-h-${kind}`} onClick={e => { if (e.target === dlg.current) dlg.current?.close() }}>
        <div className="ww-share-panel">
          <header className="ww-share-head">
            <div>
              <p className="ww-share-eyebrow">Share card</p>
              <h2 id={`share-h-${kind}`}>Share {KIND_NOUN[kind]}</h2>
            </div>
            <button type="button" className="ww-share-icon" onClick={() => dlg.current?.close()} aria-label="Close"><Svg d={ICON.close} size={18} /></button>
          </header>

          <div className="ww-share-body">
            <div className={`ww-share-preview${ready ? ' is-ready' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {info && <img key={img} src={img} alt={`Share card: ${info.title}`} width={1200} height={630} onLoad={() => setLoadedSrc(img)} />}
              {!ready && !failed && <span className="ww-share-shimmer" aria-hidden="true" />}
              {failed && <p className="ww-share-fail">The card could not load. Close and try again in a moment.</p>}
            </div>

            {info && info.heroes.length > 1 && (
              <fieldset className="ww-share-group">
                <legend>Headline</legend>
                <div className="ww-share-seg">
                  {info.heroes.map(h => (
                    <button key={h.key} type="button" aria-pressed={hero === h.key} onClick={() => setHero(h.key)}>{h.label}</button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="ww-share-group">
              <legend>Background</legend>
              <div className="ww-share-swatches">
                {SHARE_BACKGROUNDS.map(b => (
                  <button key={b.key} type="button" aria-pressed={bg === b.key} onClick={() => setBg(b.key)}>
                    <span className={`ww-swatch ww-swatch-${b.key}`} aria-hidden="true" />
                    {b.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="ww-share-group">
              <p className="ww-share-legend">Post it</p>
              <div className="ww-share-targets">
                {TARGETS.map(t => (
                  <a key={t.key} href={info ? t.href(pageUrl(), info.shareText) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!info}>
                    <span className="ww-share-mark">{t.mark}</span>{t.label}
                  </a>
                ))}
                {canNative && (
                  <button type="button" onClick={nativeShare} disabled={!info}><span className="ww-share-mark"><Svg d={ICON.more} size={17} /></span>More</button>
                )}
              </div>
            </div>

            <div className="ww-share-actions">
              <button type="button" className="ww-cta ghost" onClick={copy} disabled={!info}><Svg d={ICON.link} /> Copy link</button>
              <button type="button" className="ww-cta" onClick={download} disabled={!info}><Svg d={ICON.down} /> Save image</button>
            </div>
            <p className="ww-share-fine">
              For Instagram, TikTok or Discord, save the image and post it there. Numbers come from public Solana records; the link shows this same card.
            </p>
            <p className="ww-share-toast" role="status" aria-live="polite">{note}</p>
          </div>
        </div>
      </dialog>
    </>
  )
}
