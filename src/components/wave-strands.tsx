'use client'

// The redesign's page background: slow Wave ID strands that light up and bend away near the cursor.
// Ported from wavewarz-homepage-candy-work/ww-v2.js so wavewarz.info sits on the same stage as the
// redesigned pages. Decorative only: hidden from assistive tech, static under reduced motion,
// paused when the tab is hidden. To remove it, delete <WaveStrands /> from app/layout.tsx.
import { useEffect, useRef } from 'react'

type Strand = { y: number; a: number; f: number; amp: number; sp: number; c: number[]; w: number }
const COLS = [[149, 254, 124], [126, 193, 251], [218, 236, 253]]

export function WaveStrands() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    const x = c?.getContext('2d')
    if (!c || !x) return
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let W = 0, H = 0, mx = -9999, my = -9999, sx = -9999, sy = -9999, t = 0, raf = 0
    let strands: Strand[] = []
    let sizeTimer: ReturnType<typeof setTimeout> | undefined

    const seed = () => {
      strands = []
      const n = Math.round(Math.min(60, Math.max(24, W / 26)))
      for (let i = 0; i < n; i++) strands.push({ y: (i + .5) / n * H, a: Math.random() * 6.28, f: .0015 + Math.random() * .002, amp: 30 + Math.random() * 80, sp: .15 + Math.random() * .35, c: COLS[i % 3], w: Math.random() < .25 ? 1.3 : .8 })
    }
    const draw = () => {
      x.clearRect(0, 0, W, H); sx += (mx - sx) * .18; sy += (my - sy) * .18
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i]; let hot = 0; x.beginPath()
        for (let px = -20; px <= W + 20; px += 16) {
          let py = s.y + Math.sin(px * s.f + s.a + t * s.sp) * s.amp + Math.sin(px * .011 + t * .3 + i) * 8
          const dx = px - sx, dy = py - sy, d = Math.sqrt(dx * dx + dy * dy)
          if (d < 200) { const k = 1 - d / 200; py += (dy > 0 ? 1 : -1) * k * k * 34; hot = Math.max(hot, k) }
          if (px === -20) x.moveTo(px, py); else x.lineTo(px, py)
        }
        x.strokeStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${Math.min(.6, .1 + hot * .5)})`; x.lineWidth = s.w + hot * .7; x.stroke()
      }
    }
    const size = () => { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); seed(); draw() }
    const loop = () => { t += .004; draw(); raf = requestAnimationFrame(loop) }
    const onResize = () => { clearTimeout(sizeTimer); sizeTimer = setTimeout(size, 150) }
    const onMove = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; if (sx < -999) { sx = mx; sy = my } }
    const onLeave = () => { mx = my = -9999 }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !RM) loop() }

    addEventListener('resize', onResize)
    if (FINE && !RM) { addEventListener('pointermove', onMove, { passive: true }); document.documentElement.addEventListener('pointerleave', onLeave) }
    document.addEventListener('visibilitychange', onVis)
    size(); if (!RM) loop()
    return () => {
      cancelAnimationFrame(raf); clearTimeout(sizeTimer)
      removeEventListener('resize', onResize); removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave); document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <>
      <canvas ref={ref} className="ww-strands" aria-hidden="true" />
      <div className="ww-vig" aria-hidden="true" />
    </>
  )
}
