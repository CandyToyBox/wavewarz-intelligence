'use client'

import { type ReactNode } from 'react'

/**
 * Lightweight CSS-only tooltip. Wrap any element and supply a `text` prop.
 * The tooltip appears above the element on hover/focus.
 */
export function Tip({ children, text, wide }: {
  children: ReactNode
  text: string
  wide?: boolean
}) {
  return (
    <span className="relative inline-flex items-center group cursor-help">
      {children}
      <span
        role="tooltip"
        className={`
          pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          rounded-lg bg-[#1f2937] border border-white/10 shadow-xl
          text-[11px] leading-relaxed text-white/90 px-3 py-2
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          ${wide ? 'w-56' : 'w-max max-w-[220px]'}
          whitespace-normal text-center
        `}
      >
        {text}
        {/* caret */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1f2937]" />
      </span>
    </span>
  )
}
