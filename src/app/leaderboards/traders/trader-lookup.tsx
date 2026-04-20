'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TraderLookup() {
  const [wallet, setWallet] = useState('')
  const router = useRouter()

  const isValid = wallet.trim().length >= 32

  const handleLookup = () => {
    if (isValid) router.push(`/trader/${wallet.trim()}`)
  }

  return (
    <div className="rounded-xl border border-[#7ec1fb]/25 bg-[#0d1321] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ec1fb] mb-3">
        Look Up Your Trading Stats
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Paste your Solana wallet address…"
          value={wallet}
          onChange={e => setWallet(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          className="flex-1 bg-[#111827] border border-border rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#7ec1fb]/50 min-w-0"
        />
        <button
          onClick={handleLookup}
          disabled={!isValid}
          className="px-5 py-2 rounded-lg bg-[#7ec1fb]/10 border border-[#7ec1fb]/30 text-[#7ec1fb] text-xs font-bold uppercase tracking-widest hover:bg-[#7ec1fb]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          View Stats →
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Pulls your full trade history, battle record, win rate, and net P&L from the WaveWarz database.
      </p>
    </div>
  )
}
