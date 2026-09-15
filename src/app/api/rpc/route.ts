import { NextRequest, NextResponse } from 'next/server'

const HELIUS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? ''
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`

// Server-side proxy so the Helius key never reaches the browser.
// Client components should point their Connection at this route instead
// of building the Helius URL with the key inline.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const upstream = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await upstream.text()
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
