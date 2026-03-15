import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ClipRow = {
  id: number
  caption: string | null
  upvotes: number
  downvotes: number
  net_votes: number
  status: string
  pending_platforms: string[]
  captions: Record<string, string> | null
  created_at: string
  scheduled_at: string | null
}

type Profile = {
  telegramId: number
  telegramName: string | null
  displayName: string
  solWallet: string | null
  pfpUrl: string | null
  points: number
  clipsSubmitted: number
  clipsApproved: number
  clipsPosted: number
  totalUpvotes: number
  isArtist: boolean
  artistName: string | null
  totalBattles: number
  battlesWon: number
  mainBattles: number
  mainWins: number
  recentClips: ClipRow[]
}

// ─── Data ──────────────────────────────────────────────────────────────────────

async function getProfile(id: string): Promise<Profile | null> {
  const supabase = await createClient()
  const telegramId = parseInt(id, 10)
  if (isNaN(telegramId)) return null

  const [profileRes, clipsRes] = await Promise.all([
    supabase
      .from('clipper_profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single(),
    supabase
      .from('clips')
      .select('id,caption,upvotes,downvotes,net_votes,status,pending_platforms,captions,created_at,scheduled_at')
      .eq('submitter_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (profileRes.error || !profileRes.data) return null

  const r = profileRes.data
  const battles  = (r.total_battles as number) ?? 0
  const won      = (r.battles_won as number) ?? 0
  const isArtist = Boolean(r.is_artist)

  const displayName =
    (isArtist && r.artist_name ? r.artist_name as string : null) ??
    (r.telegram_name as string) ??
    `Contributor ${telegramId}`

  return {
    telegramId,
    telegramName:   r.telegram_name as string | null,
    displayName,
    solWallet:      r.sol_wallet as string | null,
    pfpUrl:         r.profile_picture_url as string | null,
    points:         (r.points as number) ?? 0,
    clipsSubmitted: (r.clips_submitted as number) ?? 0,
    clipsApproved:  (r.clips_approved as number) ?? 0,
    clipsPosted:    (r.clips_posted as number) ?? 0,
    totalUpvotes:   (r.total_upvotes as number) ?? 0,
    isArtist,
    artistName:     r.artist_name as string | null,
    totalBattles:   battles,
    battlesWon:     won,
    mainBattles:    (r.main_battles as number) ?? 0,
    mainWins:       (r.main_wins as number) ?? 0,
    recentClips:    (clipsRes.data ?? []) as ClipRow[],
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) return { title: 'Contributor Not Found — WaveWarZ' }
  return {
    title: `${profile.displayName} — WaveWarZ Contributor`,
    description: `${profile.clipsPosted} clips posted · ${profile.points} points · WaveWarZ community contributor`,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  voting:           'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  pending_approval: 'bg-[#7ec1fb]/20 text-[#7ec1fb] border-[#7ec1fb]/40',
  approved:         'bg-orange-500/20 text-orange-400 border-orange-500/40',
  posted:           'bg-[#95fe7c]/20 text-[#95fe7c] border-[#95fe7c]/40',
  rejected:         'bg-red-500/20 text-red-400 border-red-500/40',
}

const STATUS_LABEL: Record<string, string> = {
  voting:           'Voting',
  pending_approval: 'In Review',
  approved:         'Scheduled',
  posted:           'Posted',
  rejected:         'Rejected',
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube: 'YT', twitter: 'X', instagram: 'IG', tiktok: 'TT',
}

export default async function ContributorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) notFound()

  const approvalRate = profile.clipsSubmitted > 0
    ? Math.round(profile.clipsApproved / profile.clipsSubmitted * 100)
    : 0

  const battleWinRate = profile.totalBattles > 0
    ? Math.round(profile.battlesWon / profile.totalBattles * 100)
    : 0

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Back */}
      <Link href="/leaderboards/clippers" className="text-xs text-muted-foreground hover:text-white transition-colors inline-block">
        ← Clipper Rankings
      </Link>

      {/* ── CONTRIBUTOR CARD ── */}
      <div className="relative rounded-2xl border border-orange-500/30 bg-gradient-to-br from-[#0d1321] via-[#111827] to-[#0d1321] overflow-hidden shadow-2xl shadow-orange-500/5">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-[#95fe7c] to-[#7ec1fb]" />

        <div className="p-8">
          <div className="flex items-start justify-between gap-6">

            {/* Avatar + identity */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {profile.pfpUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.pfpUrl} alt={profile.displayName}
                    className="w-20 h-20 rounded-full border-2 border-orange-500/40 object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 border-orange-500/40 bg-[#1f2937] flex items-center justify-center">
                    <span className="text-3xl font-rajdhani font-bold text-orange-400">
                      {profile.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-[#0d1321]" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-4xl font-rajdhani font-bold text-white tracking-wide leading-none">
                    {profile.displayName}
                  </h1>
                  {profile.isArtist && (
                    <Badge className="bg-[#95fe7c]/20 text-[#95fe7c] border border-[#95fe7c]/40 text-[10px] font-bold tracking-wider">
                      ARTIST
                    </Badge>
                  )}
                  <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold tracking-wider">
                    CLIPPER
                  </Badge>
                </div>

                {/* Sub-identity line */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {profile.telegramName && (
                    <span className="text-xs text-muted-foreground">
                      @{profile.telegramName}
                    </span>
                  )}
                  {profile.solWallet && (
                    <a
                      href={`https://solscan.io/account/${profile.solWallet}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[10px] text-[#7ec1fb] hover:underline"
                    >
                      {profile.solWallet.slice(0, 6)}…{profile.solWallet.slice(-4)} ↗
                    </a>
                  )}
                  {!profile.solWallet && (
                    <span className="text-[10px] text-muted-foreground italic">
                      No wallet linked — use /setwallet in Telegram to add for future rewards
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Points badge */}
            <div className="text-right shrink-0">
              <div className="inline-flex flex-col items-center bg-[#0d1321] border border-orange-500/30 rounded-xl px-6 py-4">
                <p className="text-4xl font-rajdhani font-bold text-orange-400">
                  {profile.points.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Points</p>
              </div>
            </div>
          </div>

          {/* Clip stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <StatBox label="Submitted" value={profile.clipsSubmitted.toString()} sub="clips sent to HQ" />
            <StatBox label="Approved" value={profile.clipsApproved.toString()} sub={`${approvalRate}% approval rate`} />
            <StatBox label="Posted" value={profile.clipsPosted.toString()} sub="live on socials" highlight />
            <StatBox label="Total Upvotes" value={profile.totalUpvotes.toString()} sub="from community votes" />
          </div>

          {/* Artist battle stats (if applicable) */}
          {profile.isArtist && profile.totalBattles > 0 && (
            <div className="mt-6 rounded-xl border border-[#95fe7c]/20 bg-[#0d1321] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                    Also battles in WaveWarz
                  </p>
                  <p className="text-xl font-rajdhani font-bold text-white">
                    {profile.artistName ?? profile.displayName}
                    <span className="text-[#95fe7c] ml-2">— Artist Record</span>
                  </p>
                </div>
                {profile.solWallet && (
                  <Link
                    href={`/artist/${profile.solWallet}`}
                    className="text-sm font-rajdhani font-bold text-[#95fe7c] hover:underline shrink-0"
                  >
                    Full Artist Profile →
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-rajdhani font-bold text-[#95fe7c]">{profile.battlesWon}</span>
                    <span className="text-muted-foreground text-lg">–</span>
                    <span className="text-2xl font-rajdhani font-bold text-red-400">{profile.totalBattles - profile.battlesWon}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">All Battles</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-rajdhani font-bold text-white">
                    {battleWinRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-rajdhani font-bold text-white">
                    {profile.mainWins}W–{profile.mainBattles - profile.mainWins}L
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Main Events</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="px-8 py-3 bg-[#0d1321]/60 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
            WaveWarZ Intelligence · Community Clips HQ
          </span>
          <span className="text-[10px] text-orange-400/60 font-mono">
            Member since {new Date(profile.recentClips[profile.recentClips.length - 1]?.created_at ?? Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── CLIP HISTORY ── */}
      {profile.recentClips.length > 0 && (
        <section>
          <h2 className="text-xl font-rajdhani font-bold text-white mb-3 tracking-wide">
            Clip History
            <span className="text-muted-foreground text-sm font-normal ml-2">
              {profile.clipsSubmitted} total
            </span>
          </h2>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px] text-muted-foreground uppercase tracking-widest p-3 border-b border-border gap-4 hidden sm:grid">
              <span>Caption</span>
              <span className="text-center">Votes</span>
              <span className="text-center">Platforms</span>
              <span className="text-right">Status</span>
            </div>

            {profile.recentClips.map(clip => (
              <div
                key={clip.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] items-start sm:items-center p-4 border-b border-border last:border-0 hover:bg-white/[0.02] gap-3 sm:gap-4"
              >
                {/* Caption */}
                <div>
                  <p className="text-xs font-mono text-muted-foreground mb-1">Clip #{clip.id}</p>
                  <p className="text-sm text-white leading-snug line-clamp-2">
                    {clip.caption ?? <span className="italic text-muted-foreground">(no caption)</span>}
                  </p>
                  {/* Show generated captions preview if posted */}
                  {clip.status === 'posted' && clip.captions && (
                    <p className="text-[10px] text-[#95fe7c]/60 mt-1 truncate">
                      AI captions generated for {Object.keys(clip.captions).join(', ')}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(clip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {clip.scheduled_at && clip.status === 'approved' && (
                      <span className="text-orange-400 ml-2">
                        → scheduled {new Date(clip.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>

                {/* Votes */}
                <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                  <span className="text-xs font-mono">
                    <span className="text-[#95fe7c]">+{clip.upvotes}</span>
                    <span className="text-muted-foreground mx-0.5">/</span>
                    <span className="text-red-400">-{clip.downvotes}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground sm:text-right">
                    net {clip.net_votes > 0 ? `+${clip.net_votes}` : clip.net_votes}
                  </span>
                </div>

                {/* Platforms */}
                <div className="flex items-center gap-1 sm:justify-end">
                  {(clip.pending_platforms ?? []).map(p => (
                    <span
                      key={p}
                      className="text-[9px] font-bold font-mono bg-[#0d1321] border border-border rounded px-1.5 py-0.5 text-muted-foreground"
                    >
                      {PLATFORM_ICONS[p] ?? p.toUpperCase()}
                    </span>
                  ))}
                </div>

                {/* Status */}
                <div className="sm:text-right">
                  <Badge className={`${STATUS_STYLES[clip.status] ?? 'bg-border/20 text-muted-foreground'} border text-[9px] font-bold tracking-wider`}>
                    {STATUS_LABEL[clip.status] ?? clip.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {profile.recentClips.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No clips submitted yet.</p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, highlight = false }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-[#0d1321] p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-rajdhani font-bold ${highlight ? 'text-orange-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
