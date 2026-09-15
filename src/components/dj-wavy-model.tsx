'use client'

import { useEffect, useState } from 'react'

export function DJWavyModel({ className }: { className?: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    import('@google/model-viewer').then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className={`flex items-center justify-center ${className ?? ''}`}>
        <div className="w-10 h-10 rounded-full border-2 border-[#95fe7c]/30 border-t-[#95fe7c] animate-spin" />
      </div>
    )
  }

  return (
    <model-viewer
      src="/assets/djwavy/djwavy.glb"
      alt="DJ Wavy, the WaveWarZ AI judge"
      auto-rotate
      camera-controls
      disable-zoom
      autoplay
      shadow-intensity="1"
      exposure="1"
      loading="eager"
      className={className}
      style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
    />
  )
}
