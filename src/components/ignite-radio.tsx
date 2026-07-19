'use client'

import { useState } from 'react'

export function IgniteRadio() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-1 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white/60 hover:text-white hover:bg-black/80 transition-colors text-xs"
          aria-label="Close radio"
        >
          ✕
        </button>
        <iframe
          src="https://harmonyhub.love/embed/ignite-radio-mini.html"
          title="Ignite Radio — Live Mix"
          width="100%"
          height="96"
          loading="lazy"
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ border: 0, maxWidth: '100%', background: 'transparent', display: 'block' }}
        />
      </div>
    </div>
  )
}
