type IconProps = { color: string; className?: string }

const base = {
  viewBox: '0 0 64 64',
  fill: 'none' as const,
  strokeWidth: 2.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

export function TrophyIcon({ color, className }: IconProps) {
  return (
    <svg {...base} stroke={color} className={className}>
      <path d="M20 14h24v10c0 8-5.5 14-12 14s-12-6-12-14V14z" />
      <path d="M20 17h-6c0 7 3 11 7.5 12" />
      <path d="M44 17h6c0 7-3 11-7.5 12" />
      <path d="M32 38v8" />
      <path d="M23 54h18l-2-8H25z" />
      <path d="M18 30c3-2 6-2 8 0s5 2 8 0 6-2 8 0" opacity="0.55" />
    </svg>
  )
}

export function EqualizerIcon({ color, className }: IconProps) {
  return (
    <svg {...base} stroke={color} className={className}>
      <path d="M14 48V32" />
      <path d="M24 48V22" />
      <path d="M34 48V36" />
      <path d="M44 48V16" />
      <circle cx="44" cy="12" r="3.4" fill={color} stroke="none" />
      <path d="M44 12c0-4 3-6 6-6" opacity="0.55" />
    </svg>
  )
}

export function PeopleIcon({ color, className }: IconProps) {
  return (
    <svg {...base} stroke={color} className={className}>
      <circle cx="32" cy="18" r="7" />
      <path d="M20 46c0-7.5 5.5-13 12-13s12 5.5 12 13" />
      <circle cx="14" cy="24" r="5.5" opacity="0.6" />
      <path d="M6 46c0-6 3.5-10.5 8-11.5" opacity="0.6" />
      <circle cx="50" cy="24" r="5.5" opacity="0.6" />
      <path d="M58 46c0-6-3.5-10.5-8-11.5" opacity="0.6" />
    </svg>
  )
}

export function TrendIcon({ color, className }: IconProps) {
  return (
    <svg {...base} stroke={color} className={className}>
      <path d="M10 44l12-14 8 8 16-20" />
      <path d="M38 18h8v8" />
      <path d="M10 50h44" opacity="0.5" />
    </svg>
  )
}

export function ClapperboardIcon({ color, className }: IconProps) {
  return (
    <svg {...base} stroke={color} className={className}>
      <path d="M10 22h44v6H10z" />
      <path d="M14 22l6-8" />
      <path d="M26 22l6-8" />
      <path d="M38 22l6-8" />
      <path d="M12 28v22h40V28" />
      <path d="M24 38l8 5-8 5z" fill={color} stroke="none" opacity="0.85" />
    </svg>
  )
}
