import { buildRosterSnapshot, generateDefinition } from './core/index.mjs'

// WavID roster for wavewarz.info pages (prototype).
//
// Built from the same two public leaderboard feeds Quan's studio reads, so a
// page here draws the same WavID as /wavid and /wavid/card/<handle>. The feeds
// are fetched over HTTP (cached 5 min by Next) rather than called in-process so
// the numbers match the public API byte for byte. Swap for direct calls to
// getArtistLeaderboard / getSongLeaderboard once the aggregation in
// api/public/leaderboards/songs is moved into src/lib.

const API = 'https://wavewarz.info/api/public/leaderboards'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type WavIdArtist = any

export type WavIdRoster = {
  checkpoint: { checkedAt: string; rosterSnapshotSha256: string; sources: unknown; revision: number; freshness: string }
  byHandle: Map<string, WavIdArtist>
  byWallet: Map<string, WavIdArtist>
  byName: Map<string, WavIdArtist>
}

/** Names compare without case, spacing or punctuation ("Cannon Jones 973" = "Cannon Jones973"). */
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

async function feed(path: string) {
  const res = await fetch(`${API}/${path}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`WavID roster feed ${path} returned ${res.status}`)
  return res.json()
}

// One roster per server instance per 5 minutes. A plain memo (not React cache)
// so this also works from the Pages-router image route.
let memo: { at: number; roster: Promise<WavIdRoster | null> } | null = null

/** Null when the feeds are unreachable: pages then simply show no WavID. */
export function getWavIdRoster(): Promise<WavIdRoster | null> {
  if (!memo || Date.now() - memo.at > 5 * 60_000) memo = { at: Date.now(), roster: loadRoster() }
  return memo.roster
}

async function loadRoster(): Promise<WavIdRoster | null> {
  try {
    const [artistsPayload, songsPayload] = await Promise.all([
      feed('artists?limit=500'),
      feed('songs?sort=volume&limit=500'),
    ])
    const snap = buildRosterSnapshot({ artistsPayload, songsPayload, retrievedAt: new Date().toISOString() })
    const eligible: WavIdArtist[] = snap.artists.filter((a: WavIdArtist) => a.eligibility.canBirth)
    const byHandle = new Map<string, WavIdArtist>()
    const byWallet = new Map<string, WavIdArtist>()
    const byName = new Map<string, WavIdArtist>()
    const ambiguous = new Set<string>()
    for (const a of eligible) {
      byHandle.set(a.identity.audiusHandle.toLowerCase(), a)
      if (a.identity.wallet) byWallet.set(a.identity.wallet, a)
      const key = nameKey(a.displayName)
      if (byName.has(key)) ambiguous.add(key)
      byName.set(key, a)
    }
    // A name two roster artists share proves nothing about either: drop it.
    for (const key of ambiguous) byName.delete(key)
    return {
      checkpoint: {
        checkedAt: snap.checkedAt,
        rosterSnapshotSha256: snap.snapshotSha256,
        sources: snap.sources,
        revision: 1,
        freshness: 'browser-observation',
      },
      byHandle,
      byWallet,
      byName,
    }
  } catch (err) {
    console.error('[wavid] roster unavailable:', err)
    return null
  }
}

/**
 * Resolve a site artist to a WavID-eligible roster artist. Audius handle is the
 * stable identity; wallet is the Main Event join the roster already made; name
 * is a last resort and only used when it is unambiguous in the roster.
 */
export function findWavIdArtist(
  roster: WavIdRoster | null,
  who: { audiusHandle?: string | null; wallet?: string | null; name?: string | null },
): WavIdArtist | null {
  if (!roster) return null
  if (who.audiusHandle) {
    const hit = roster.byHandle.get(who.audiusHandle.toLowerCase())
    if (hit) return hit
  }
  if (who.wallet) {
    const hit = roster.byWallet.get(who.wallet)
    if (hit) return hit
  }
  if (who.name) return roster.byName.get(nameKey(who.name)) ?? null
  return null
}

export function wavIdDefinition(artist: WavIdArtist, roster: WavIdRoster) {
  return generateDefinition(artist, roster.checkpoint)
}
