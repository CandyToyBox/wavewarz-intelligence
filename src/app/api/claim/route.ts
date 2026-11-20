import { NextRequest, NextResponse } from 'next/server'
import { isWalletAddress, scanWallet } from '@/lib/claim-scan'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/claim?wallet=<address> -> { holdings: ClaimHolding[] }
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isWalletAddress(wallet)) {
    return NextResponse.json({ error: 'not-an-address' }, { status: 400 })
  }
  try {
    const holdings = await scanWallet(wallet)
    return NextResponse.json({ holdings }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[claim] scan failed:', err)
    return NextResponse.json({ error: 'scan-failed' }, { status: 502 })
  }
}
