import { createClient } from '@/lib/supabase/server'
import { canonicalSongKey } from '@/lib/song-identity'
import { resolveAudiusTrack } from '@/lib/audius'
import { getLiveSolPrice, solToUsd } from '@/lib/coingecko'
import { formatSol } from '@/lib/wavewarz-math'
import { getArtistStats, isUUID, type Battle } from '@/lib/artist-stats'
import { ArtistPlate } from '@/components/wavid/artist-plate'
import { getArtistWavId } from '@/lib/wavid/artist-wavid'
import { CdCase } from '@/components/cd-case'
import { ShareStatz } from '@/components/share-statz'
import { shareOgImages } from '@/lib/share-options'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ─── OG Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { id } = await params
  const { card } = (await searchParams) ?? {}
  const stats = await getArtistStats(id)
  if (!stats) return { title: 'Artist Not Found — WaveWarZ' }
  return {
    title: `${stats.displayName} — WaveWarZ Player Card`,
    description: `${stats.wins}W ${stats.losses}L · ${formatSol(stats.totalEarningsSol)} SOL earned on WaveWarZ`,
    openGraph: {
      title: `${stats.displayName} — WaveWarZ`,
      description: `${stats.wins}W ${stats.losses}L · ${formatSol(stats.totalEarningsSol)} SOL earned`,
      images: shareOgImages('artist', id, card),
    },
    twitter: { card: 'summary_large_image', images: shareOgImages('artist', id, card).map(i => i.url) },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [stats, solPrice] = await Promise.all([
    getArtistStats(id),
    getLiveSolPrice(),
  ])

  if (!stats) notFound()
  const wavid = await getArtistWavId({ audiusHandle: stats.audiusHandle, wallets: stats.allWallets, name: stats.displayName })

  const totalUsd = stats.totalEarningsSol * solPrice
  const spotifyStreams = Math.floor(totalUsd / 0.003)
  const completedBattles = stats.wins + stats.losses
  const winRate = completedBattles > 0
    ? Math.round((stats.wins / completedBattles) * 100)
    : null

  // Sub-profiles (e.g. "AI LUI") fall back to the profile UUID for stats.wallet
  // since they have no real onchain wallet -- don't show it as a Solana address.
  const hasRealWallet = !isUUID(stats.wallet)
  const solscanUrl = `https://solscan.io/account/${stats.wallet}`

  return (
    <div className="space-y-8 max-w-5xl mx-auto">

      {/* ── ARTIST PLATE: the Wave ID is the hero ── */}
      <ArtistPlate
        name={stats.displayName}
        pfpUrl={stats.pfpUrl}
        wavid={wavid}
        action={<ShareStatz kind="artist" id={id} />}
        meta={hasRealWallet
          ? <><span>{stats.wallet.slice(0, 4)}…{stats.wallet.slice(-4)}</span><a href={solscanUrl} target="_blank" rel="noreferrer">Verify on Solscan</a></>
          : <span>Sub-profile</span>}
        social={<>
          {stats.twitterHandle && <SocialIcon href={`https://x.com/${stats.twitterHandle}`} label="X"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></SocialIcon>}
          {stats.audiusHandle && <SocialIcon href={`https://audius.co/${stats.audiusHandle}`} label="Audius"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.5 14.5L8 12l7.5-4.5v9z"/></SocialIcon>}
          {stats.youtubeUrl && <SocialIcon href={stats.youtubeUrl} label="YouTube"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></SocialIcon>}
          {stats.instagramHandle && <SocialIcon href={`https://instagram.com/${stats.instagramHandle}`} label="Instagram"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.6a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/></SocialIcon>}
          {stats.tiktokHandle && <SocialIcon href={`https://tiktok.com/@${stats.tiktokHandle}`} label="TikTok"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></SocialIcon>}
        </>}
        record={[stats.wins, stats.losses]}
        recordSub={[
          winRate === null ? 'First battle coming up' : winRate === 100 ? 'Undefeated' : `${winRate}% win rate`,
          (stats.mainWins + stats.mainLosses) > 0 ? `Main ${stats.mainWins}-${stats.mainLosses}` : null,
          (stats.quickWins + stats.quickLosses) > 0 ? `Quick ${stats.quickWins}-${stats.quickLosses}` : null,
        ].filter(Boolean).join(' · ')}
        stats={[
          { k: 'Earned on WaveWarZ', v: formatSol(stats.totalEarningsSol), unit: 'SOL', sub: solToUsd(stats.totalEarningsSol, solPrice), hi: true },
          { k: 'Traded on their music', v: formatSol(stats.totalVolumeSol), unit: 'SOL', sub: solToUsd(stats.totalVolumeSol, solPrice) },
          { k: 'From trades', v: formatSol(stats.tradingFeesSol), unit: 'SOL', sub: '1% of every trade' },
          { k: 'From settlements', v: formatSol(stats.settlementBonusSol), unit: 'SOL', sub: '5% win · 2% loss' },
        ]}
        foot={<span>
          About <b>{spotifyStreams.toLocaleString('en-US')}</b> Spotify streams at $0.003 each, paid straight to the artist&apos;s wallet · 1 SOL = {solToUsd(1, solPrice)}
        </span>}
      />

      {stats.bio && (
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-[#c3cfdc]">{stats.bio}</p>
      )}

      {/* ── PAY STUB ── */}
      <section>
        <h2 className="text-xl font-rajdhani font-bold text-white mb-3 tracking-wide">
          Pay Stub — Verified Onchain
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-3 text-[11px] text-muted-foreground uppercase tracking-widest p-3 border-b border-border">
            <span>Source</span>
            <span className="text-center">SOL</span>
            <span className="text-right">USD</span>
          </div>
          <PayRow label="Trading Fees (1% × volume)" sol={stats.tradingFeesSol} usd={solToUsd(stats.tradingFeesSol, solPrice)} />
          <PayRow label="Settlement Bonuses (5%/2%)" sol={stats.settlementBonusSol} usd={solToUsd(stats.settlementBonusSol, solPrice)} />
          <div className="grid grid-cols-3 p-3 bg-[#95fe7c]/5 border-t border-[#95fe7c]/20">
            <span className="text-sm font-bold text-[#95fe7c]">Total Career Earnings</span>
            <span className="text-center text-sm font-bold text-[#95fe7c] font-mono">{formatSol(stats.totalEarningsSol)} SOL</span>
            <span className="text-right text-sm font-bold text-[#95fe7c]">{solToUsd(stats.totalEarningsSol, solPrice)}</span>
          </div>
        </div>
      </section>

      {/* ── BATTLE HISTORY ── */}
      {stats.mainEventBattles.length > 0 && (
        <section>
          <h2 className="text-xl font-rajdhani font-bold text-white mb-3 tracking-wide">
            Main Event History
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px] text-muted-foreground uppercase tracking-widest p-3 border-b border-border gap-4">
              <span>Opponent</span>
              <span className="text-center">Volume</span>
              <span className="text-center">Result</span>
              <span className="text-right">Replay</span>
            </div>
            {stats.mainEventBattles.filter(b => {
              // Skip self-battles (two wallets from the same merged profile on opposite sides)
              const a1IsOwn = stats.allWallets.includes(b.artist1_wallet)
              const a2IsOwn = stats.allWallets.includes(b.artist2_wallet)
              return !(a1IsOwn && a2IsOwn)
            }).map((b) => {
              const isArtistA = stats.allWallets.includes(b.artist1_wallet)
              const opponentWallet = isArtistA ? b.artist2_wallet : b.artist1_wallet
              const rawOpponentName = isArtistA ? b.artist2_name : b.artist1_name
              const opponent = stats.opponentNameOverrides.get(`${b.battle_id}|${opponentWallet}`) ?? rawOpponentName
              const p1 = b.artist1_pool ?? 0
              const p2 = b.artist2_pool ?? 0
              const artistAWon = (b.winner_decided && b.winner_artist_a !== null)
                ? Boolean(b.winner_artist_a)
                : p1 >= p2
              const won = isArtistA ? artistAWon : !artistAWon
              const totalVol = (b.total_volume_a ?? 0) + (b.total_volume_b ?? 0)
              return (
                <div key={b.battle_id} className="grid grid-cols-[1fr_auto_auto_auto] items-center p-3 border-b border-border last:border-0 hover:bg-white/5 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#95fe7c] bg-[#95fe7c]/10 border border-[#95fe7c]/30 rounded px-1.5 py-0.5 font-mono tracking-wider shrink-0">
                      VS
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{opponent}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        #{b.battle_id} · {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-[#7ec1fb] text-center">
                    {formatSol(totalVol)} SOL
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded text-center ${
                    b.status === 'ACTIVE'
                      ? 'bg-yellow-500/20 text-yellow-400 animate-pulse'
                      : won
                      ? 'bg-[#95fe7c]/20 text-[#95fe7c]'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {b.status === 'ACTIVE' ? '● LIVE' : won ? 'WIN' : 'LOSS'}
                  </span>
                  <div className="text-right">
                    {b.youtube_replay_link ? (
                      <a href={b.youtube_replay_link} target="_blank" rel="noreferrer"
                        className="text-xs text-[#7ec1fb] hover:underline">
                        Watch ↗
                      </a>
                    ) : b.stream_link ? (
                      <a href={b.stream_link} target="_blank" rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-white">
                        Stream ↗
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── QUICK BATTLE STATS ── */}
      {stats.quickBattles.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xl font-rajdhani font-bold text-white tracking-wide">
              Quick Battle Songs
            </h2>
            <span className="text-xs text-muted-foreground">
              {stats.quickWins}W–{stats.quickLosses}L · {stats.quickWins + stats.quickLosses > 0 ? Math.round(stats.quickWins / (stats.quickWins + stats.quickLosses) * 100) : 0}% overall
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Quick battles are the proving ground — chart performance shows what resonates with the crowd.
          </p>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox label="Quick Record" value={`${stats.quickWins}W – ${stats.quickLosses}L`} sub={`${stats.quickWins + stats.quickLosses > 0 ? Math.round(stats.quickWins / (stats.quickWins + stats.quickLosses) * 100) : 0}% win rate`} />
            <StatBox label="Quick Volume" value={`${formatSol(stats.quickBattles.reduce((s, b) => { const isA = stats.allWallets.includes(b.artist1_wallet); return s + (isA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)) }, 0))} SOL`} sub="Chart trading" />
            <StatBox label="Songs Entered" value={[...new Set(stats.quickBattles.map(b => stats.allWallets.includes(b.artist1_wallet) ? b.artist1_name : b.artist2_name))].length.toString()} sub="Unique tracks" />
          </div>

          {/* Per-song breakdown */}
          <QuickBattleSongTable battles={stats.quickBattles} allWallets={stats.allWallets} solPrice={solPrice} />
        </section>
      )}

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, highlight = false }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-[#0c121c] p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-lg font-rajdhani font-bold ${highlight ? 'text-[#95fe7c]' : 'text-white'}`}>
        {value}
      </p>
      {/* Fix #3: larger sub-text for mobile readability */}
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
    </a>
  )
}

async function QuickBattleSongTable({ battles, allWallets, solPrice }: {
  battles: Battle[]; allWallets: string[]; solPrice: number
}) {
  // Group by song title (artist's song is the one matching their wallet side)
  const songMap = new Map<string, { title: string; musicLink: string | null; wins: number; losses: number; volume: number }>()

  for (const b of battles) {
    const isA = allWallets.includes(b.artist1_wallet)
    const title = isA ? b.artist1_name : b.artist2_name
    const musicLink = isA ? (b.artist1_music_link ?? null) : (b.artist2_music_link ?? null)
    const p1 = b.artist1_pool ?? 0
    const p2 = b.artist2_pool ?? 0
    const artistAWon = (b.winner_decided && b.winner_artist_a !== null)
      ? Boolean(b.winner_artist_a)
      : p1 >= p2
    const won = isA ? artistAWon : !artistAWon
    const vol = isA ? (b.total_volume_a ?? 0) : (b.total_volume_b ?? 0)
    // Key by track permalink, not title string — one track = one row.
    const key = canonicalSongKey(musicLink, title)
    const existing = songMap.get(key) ?? { title, musicLink, wins: 0, losses: 0, volume: 0 }
    existing.wins += won ? 1 : 0
    existing.losses += won ? 0 : 1
    existing.volume += vol
    songMap.set(key, existing)
  }

  const songs = Array.from(songMap.values()).sort((a, b) => b.wins - a.wins || b.volume - a.volume)

  // Album art — prefer the cached song_registry table (same source the Song
  // Charts leaderboard uses) over live Audius calls, which are flaky/rate-limited
  // (same lesson as src/app/battles/page.tsx). Fall back to a live lookup only
  // for songs not yet backfilled into the registry.
  const songKeys = songs.map(s => canonicalSongKey(s.musicLink, s.title))
  const registryArtByKey = new Map<string, string | null>()
  if (songKeys.length) {
    const supabase = await createClient()
    const { data: registry } = await supabase
      .from('song_registry')
      .select('permalink_key, artwork_url')
      .in('permalink_key', songKeys)
    for (const r of registry ?? []) registryArtByKey.set(r.permalink_key, r.artwork_url ?? null)
  }
  const artByKey = new Map<string, string | null>()
  await Promise.all(songs.map(async (s, i) => {
    const key = songKeys[i]
    if (registryArtByKey.has(key)) { artByKey.set(key, registryArtByKey.get(key) ?? null); return }
    if (!s.musicLink) { artByKey.set(key, null); return }
    const track = await resolveAudiusTrack(s.musicLink)
    artByKey.set(key, track?.artwork?.['480x480'] ?? null)
  }))

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#111827]">
            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">#</th>
            <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Song</th>
            <th className="text-center px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Record</th>
            <th className="text-center px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Win %</th>
            <th className="text-right px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest">Volume</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s, i) => {
            const total = s.wins + s.losses
            const rate = total > 0 ? Math.round(s.wins / total * 100) : 0
            const artUrl = artByKey.get(songKeys[i]) ?? null
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.musicLink
                      ? <a href={s.musicLink} target="_blank" rel="noreferrer" className="block w-11 shrink-0" aria-label={`${s.title} on Audius`}><CdCase src={artUrl} /></a>
                      : <span className="block w-11 shrink-0"><CdCase src={artUrl} /></span>}
                    <div>
                      {s.musicLink ? (
                        <a href={s.musicLink} target="_blank" rel="noreferrer"
                          className="font-rajdhani font-bold text-white hover:text-[#7ec1fb] transition-colors text-sm leading-tight block">
                          {s.title} ↗
                        </a>
                      ) : (
                        <span className="font-rajdhani font-bold text-white text-sm">{s.title}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{total} battles</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-rajdhani font-bold text-[#7ec1fb]">{s.wins}W</span>
                  <span className="text-muted-foreground mx-1">–</span>
                  <span className="font-rajdhani font-bold text-red-400">{s.losses}L</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-bold font-rajdhani ${rate >= 60 ? 'text-[#95fe7c]' : rate >= 40 ? 'text-[#7ec1fb]' : 'text-red-400'}`}>
                    {rate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className="text-[#7ec1fb]">{formatSol(s.volume)}</span>
                  <span className="text-muted-foreground"> SOL</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PayRow({ label, sol, usd }: { label: string; sol: number; usd: string }) {
  return (
    <div className="grid grid-cols-3 items-center p-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-center text-sm font-mono text-white">{formatSol(sol)} SOL</span>
      <span className="text-right text-sm text-muted-foreground">{usd}</span>
    </div>
  )
}
