import { NextResponse } from 'next/server'

/**
 * Public WaveZStation pass-through: the song drops listed on wavezstation.com.
 *
 * GET https://wavewarz.info/api/public/wavezstation
 * Query params:
 *   limit - max songs to return, newest first (default 50, max 200)
 *
 * WaveZStation's own feed (wavezstation.com/api/discover) cannot be read from a
 * browser on another site, so this route fetches it on the server and returns the
 * fields a page needs. Nothing is stored here; the numbers are WaveZStation's.
 * `stats` always covers every song in the feed, not just the ones returned.
 *
 * No auth required. Read-only. Cached for 5 minutes.
 */

export const dynamic = 'force-dynamic'

const SOURCE = 'https://www.wavezstation.com/api/discover'

function corsHeaders(maxAge = 300) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=600`,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

type SourceSong = {
  id?: unknown
  title?: unknown
  artist?: unknown
  created_at?: unknown
  cover_image_url?: unknown
  supporter_count?: unknown
  pool_total_usdc_wei?: unknown
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

function httpsUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

    const res = await fetch(SOURCE, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`source ${res.status}`)
    const body = (await res.json()) as { songs?: SourceSong[] }
    const raw = Array.isArray(body?.songs) ? body.songs : []

    const songs = raw
      .filter(s => typeof s?.id === 'string' && /^[0-9a-f-]{8,64}$/i.test(s.id as string))
      .map(s => {
        const wei = /^\d{1,30}$/.test(String(s.pool_total_usdc_wei ?? '')) ? String(s.pool_total_usdc_wei) : '0'
        return {
          id: s.id as string,
          title: text(s.title, 200),
          artist: text(s.artist, 120),
          created_at: text(s.created_at, 40),
          cover_image_url: httpsUrl(s.cover_image_url),
          supporter_count: Math.max(0, Math.floor(Number(s.supporter_count) || 0)),
          pool_total_usdc_wei: wei,
          url: `https://wavezstation.com/song/${s.id as string}`,
        }
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    const stats = {
      songs: songs.length,
      supporters: songs.reduce((n, s) => n + s.supporter_count, 0),
      poolUsdc: Math.round(songs.reduce((n, s) => n + Number(s.pool_total_usdc_wei) / 1e6, 0) * 100) / 100,
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      source: SOURCE,
      stats,
      count: Math.min(songs.length, limit),
      songs: songs.slice(0, limit),
    }, { headers: corsHeaders() })
  } catch (err) {
    console.error('[api/public/wavezstation] error:', err)
    return NextResponse.json({ error: 'WaveZStation feed unavailable' }, { status: 502, headers: corsHeaders(30) })
  }
}
