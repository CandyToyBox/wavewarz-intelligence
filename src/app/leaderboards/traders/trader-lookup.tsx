'use client'

import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

export function TraderLookup() {
  const [wallet, setWallet] = useState('')
  const router = useRouter()

  const isValid = wallet.trim().length >= 32

  const handleLookup = () => {
    if (isValid) router.push(`/trader/${wallet.trim()}`)
  }

  // Same panel, pill field and solid button as the rest of the redesign (.ww-lookup in site-shell.css)
  return (
    <form className="ww-lookup" onSubmit={e => { e.preventDefault(); handleLookup() }}>
      <label htmlFor="trader-wallet" className="ww-bh-k" style={{ '--acc': '#7ec1fb' } as CSSProperties}><i aria-hidden="true" />Look up your trading stats</label>
      <div className="ww-lookup-row">
        <input
          id="trader-wallet"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Paste your Solana wallet address"
          value={wallet}
          onChange={e => setWallet(e.target.value)}
        />
        <button type="submit" className="ww-btn solid" disabled={!isValid}>View stats</button>
      </div>
      <p>Pulls your full trade history, battle record, and net SOL from the WaveWarZ database.</p>
    </form>
  )
}
