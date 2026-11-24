import { useId } from 'react'
import { WW_ICON_SVG, type WwIconName } from './ww-icon-set'

// One icon from the WaveWarZ set (the same SVGs as wavewarz.com's icons/ folder). Works in server and client components.
// Clip-path ids are made unique per use so two copies of one icon on a page never share an id.
export function WwIcon({ name, size = 24, className, label }: { name: WwIconName; size?: number; className?: string; label?: string }) {
  const k = `wwi${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = WW_ICON_SVG[name]
    .replace('width="24" height="24"', `width="${size}" height="${size}"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"'}`)
    .replace(/id="([a-z-]+)-(t|b)"/g, `id="${k}-$2"`)
    .replace(/url\(#([a-z-]+)-(t|b)\)/g, `url(#${k}-$2)`)
  return <span className={`ww-icon${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}

export type { WwIconName }
