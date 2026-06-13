/**
 * Song Registry backfill — resolve every quick-battle song's music link to its
 * canonical Audius track once, and cache the enrichment in song_registry.
 *
 * The Audius API is free (open protocol), so this just walks every unique
 * permalink and resolves it via a discovered healthy node. Safe to re-run:
 * already-resolved songs are skipped unless --refresh is passed.
 *
 * Usage:
 *   npx tsx scripts/backfill-song-registry.ts            # resolve new songs
 *   npx tsx scripts/backfill-song-registry.ts --refresh  # re-resolve everything
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}
loadEnv()

// Mirror of src/lib/song-identity.ts (kept inline so the script is standalone)
function canonicalSongKey(musicLink: string | null | undefined, title: string | null | undefined): string {
  if (musicLink) {
    const a = musicLink.match(/audius\.co\/([^/?#]+\/[^/?#]+)/i)
    if (a) return `audius:${a[1].toLowerCase()}`
    try { const u = new URL(musicLink); return `${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '') } catch { return musicLink.toLowerCase().trim() }
  }
  return `title:${(title ?? '').toLowerCase().trim()}`
}

let HOSTS: string[] | null = null
async function audiusHost(): Promise<string> {
  if (HOSTS?.length) return HOSTS[0]
  try { const r = await fetch('https://api.audius.co'); const j = await r.json(); if (Array.isArray(j?.data) && j.data.length) { HOSTS = j.data; return HOSTS![0] } } catch { /* */ }
  return 'https://api.audius.co'
}
async function resolveTrack(url: string) {
  const host = await audiusHost()
  try {
    const res = await fetch(`${host}/v1/resolve?url=${encodeURIComponent(url)}&app_name=WaveWarZ`)
    if (!res.ok) return null
    const t = (await res.json())?.data
    if (!t?.id) return null
    return {
      audius_track_id: t.id,
      title: t.title ?? null,
      artist_name: t.user?.name ?? null,
      artist_handle: t.user?.handle ?? null,
      genre: t.genre ?? null,
      artwork_url: t.artwork?.['480x480'] ?? t.artwork?.['1000x1000'] ?? null,
      play_count: t.play_count ?? null,
    }
  } catch { return null }
}

async function main() {
  const refresh = process.argv.includes('--refresh')
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  console.log('─'.repeat(70))
  console.log('Song Registry backfill (Audius open API — free)')
  console.log('─'.repeat(70))

  // Collect every unique (permalink_key → music_link) from quick battles
  const uniq = new Map<string, string>()
  let from = 0
  for (;;) {
    const { data } = await s.from('battles')
      .select('artist1_name,artist2_name,artist1_music_link,artist2_music_link')
      .eq('is_quick_battle', true).eq('is_test_battle', false).range(from, from + 999)
    if (!data?.length) break
    for (const b of data) {
      for (const [t, link] of [[b.artist1_name, b.artist1_music_link], [b.artist2_name, b.artist2_music_link]] as const) {
        if (!link || !/audius\.co/i.test(link)) continue   // only Audius links are resolvable
        const k = canonicalSongKey(link, t)
        if (!uniq.has(k)) uniq.set(k, link)
      }
    }
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Unique Audius songs: ${uniq.size}`)

  // Skip already-resolved unless --refresh
  let skip = new Set<string>()
  if (!refresh) {
    const { data } = await s.from('song_registry').select('permalink_key')
    skip = new Set((data ?? []).map(r => r.permalink_key))
  }

  let done = 0, failed = 0, skipped = 0
  for (const [key, link] of uniq) {
    if (skip.has(key)) { skipped++; continue }
    const r = await resolveTrack(link)
    if (!r) { failed++; process.stdout.write('x'); continue }
    const { error } = await s.from('song_registry').upsert({ permalink_key: key, music_link: link, resolved_at: new Date().toISOString(), ...r }, { onConflict: 'permalink_key' })
    if (error) { failed++; console.error('\n upsert', key, error.message) } else { done++; process.stdout.write('.') }
    await new Promise(r => setTimeout(r, 150))
  }
  console.log(`\n\nResolved: ${done} | Skipped(existing): ${skipped} | Failed: ${failed}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
