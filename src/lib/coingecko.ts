export async function getLiveSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 } }
    )
    if (!res.ok) throw new Error('CoinGecko response not ok')
    const data = await res.json()
    return data.solana.usd as number
  } catch (error) {
    console.error('CoinGecko fetch failed:', error)
    return 150.00 // fallback
  }
}

export function solToUsd(sol: number, solPrice: number): string {
  return (sol * solPrice).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
