'use client'

import { useCallback, useEffect, useRef } from 'react'

// The WavID studio is a static, same-origin app (public/wavid-studio) whose
// layout is taller than any fixed iframe height: it stacks on narrow screens
// and changes with the selected tab and artist. A fixed height cuts it off
// mid-panel, so this sizes the frame to the studio's own content.
//
// The studio's shell uses viewport-height minimums (min-height: 100vh), which
// inside an iframe mean "the iframe's height". Measuring a tall frame just
// returns that height, so each fit shrinks the frame, reads the natural
// height, and sets the final height in one synchronous pass (no paint between).
const MIN_HEIGHT = 720
const MAX_HEIGHT = 6000
const SHRINK_TO = 400

export function WavIdEmbed({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const detachRef = useRef<(() => void) | null>(null)

  const fit = useCallback(() => {
    const frame = frameRef.current
    const root = frame?.contentDocument?.documentElement
    if (!frame || !root) return
    frame.style.height = `${SHRINK_TO}px`
    const natural = Math.ceil(root.scrollHeight)
    frame.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, natural))}px`
  }, [])

  const attach = useCallback(() => {
    detachRef.current?.()
    detachRef.current = null
    const frame = frameRef.current
    let doc: Document | null = null
    try {
      doc = frame?.contentDocument ?? null
    } catch {
      doc = null
    }
    if (!frame || !doc?.body) return // keep the CSS fallback height

    let queued = 0
    const schedule = () => {
      if (queued) return
      queued = window.requestAnimationFrame(() => {
        queued = 0
        if (!document.hidden) fit()
      })
    }
    const mutations = new MutationObserver(schedule)
    mutations.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true })
    window.addEventListener('resize', schedule)
    fit()
    // Fonts and the first artwork frame land after load and change the height.
    const settle = window.setTimeout(fit, 600)

    detachRef.current = () => {
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
      window.clearTimeout(settle)
      if (queued) window.cancelAnimationFrame(queued)
    }
  }, [fit])

  useEffect(() => {
    // The frame may finish loading before React attaches onLoad.
    if (frameRef.current?.contentDocument?.readyState === 'complete') attach()
    return () => detachRef.current?.()
  }, [attach])

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      loading="lazy"
      onLoad={attach}
      className="block w-full border-0"
      // Used until the studio reports its real height (and if it cannot).
      style={{ height: 'max(720px, calc(100vh - 5rem))' }}
    />
  )
}
