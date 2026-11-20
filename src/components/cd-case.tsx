'use client'

// Song cover as a CD jewel case still in its cellophane, the same build as the redesigned battle page
// (.jc in wavewarz-homepage-candy-work/battle.html): dark hinge spine, clear case edge, art under the lid,
// shrink-wrap with a fold seam, tear strip, crinkled corners and a light streak. CSS: site-shell.css (.ww-jc).
import { useState } from 'react'

export function CdCase({ src, size, className = '' }: { src?: string | null; size?: number; className?: string }) {
  const [bad, setBad] = useState(false)
  const show = !!src && !bad
  return (
    <span className={`ww-jc ${className}`} style={size ? { width: size } : undefined} aria-hidden="true">
      <span className="ww-jc-case">
        <span className="ww-jc-spine" />
        <span className="ww-jc-art">
          {show
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src!} alt="" loading="lazy" onError={() => setBad(true)} />
            : <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 18.2V6.2L19.5 4.2v11.6" stroke="#95fe7c" /><circle cx="7" cy="18.2" r="2.5" stroke="#95fe7c" /><circle cx="17" cy="15.8" r="2.5" stroke="#7ec1fb" /></svg>}
        </span>
      </span>
      <span className="ww-jc-wrap"><span className="ww-jc-crease" /><span className="ww-jc-sheen" /></span>
    </span>
  )
}
