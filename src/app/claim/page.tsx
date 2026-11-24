import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClaimClient } from './claim-client'

export const metadata: Metadata = {
  title: 'Claim',
  description: 'Paste a Solana wallet address to see which WaveWarZ battles it still holds shares in, and where to withdraw them.',
}

// Replaces the old claim.wavewarz.info tool. The scan runs on the server (/api/claim) so no API key
// ships to the browser, and the page never asks anyone to connect or sign.
export default function ClaimPage() {
  return (
    <div className="wc">
      <header className="wc-head">
        <h1 className="font-display">Claim</h1>
        <p>Paste a Solana wallet address to see which battles it still holds shares in, and where to withdraw them.</p>
      </header>
      <Suspense>
        <ClaimClient />
      </Suspense>
    </div>
  )
}
