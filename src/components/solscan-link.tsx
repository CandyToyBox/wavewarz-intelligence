'use client'

import { ExternalLink } from 'lucide-react'

/** Consistent "view on Solscan" link — used anywhere a wallet, account, mint, or program is shown. */
export function SolscanLink({
  address,
  kind = 'account',
  label = 'Solscan',
  className = '',
}: {
  address: string
  kind?: 'account' | 'token'
  label?: string
  className?: string
}) {
  return (
    <a
      href={`https://solscan.io/${kind}/${address}`}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-[10px] text-[#7ec1fb] border border-[#7ec1fb]/20 px-1.5 py-0.5 rounded hover:bg-[#7ec1fb]/10 transition-colors ${className}`}
    >
      {label} <ExternalLink size={9} />
    </a>
  )
}
