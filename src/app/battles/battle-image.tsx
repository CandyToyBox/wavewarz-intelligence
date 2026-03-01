'use client'

const PALETTE = ['#95fe7c', '#7ec1fb', '#f59e0b', '#f472b6', '#a78bfa', '#34d399']
function colorFor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function BattleImage({
  src,
  alt,
  className = '',
  fallbackText,
}: {
  src: string | null
  alt: string
  className?: string
  fallbackText: string
}) {
  const color = colorFor(fallbackText)

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center font-rajdhani font-bold text-2xl ${className}`}
        style={{ backgroundColor: `${color}18`, color }}
      >
        {fallbackText.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={e => {
        const el = e.currentTarget
        el.style.display = 'none'
        const parent = el.parentElement
        if (parent) {
          parent.style.backgroundColor = `${color}18`
          parent.style.display = 'flex'
          parent.style.alignItems = 'center'
          parent.style.justifyContent = 'center'
          const span = document.createElement('span')
          span.style.color = color
          span.style.fontFamily = 'Rajdhani, sans-serif'
          span.style.fontWeight = '700'
          span.style.fontSize = '1.5rem'
          span.textContent = fallbackText.charAt(0).toUpperCase()
          parent.appendChild(span)
        }
      }}
    />
  )
}
