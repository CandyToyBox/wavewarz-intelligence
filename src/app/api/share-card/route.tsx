// GET /api/share-card?kind=battle&id=1234&look=arena.artists  ->  1200x630 PNG
// The shared card for a Statz page. Numbers come from lib/share-cards (database, server side), never from the URL.
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getShareCard } from '@/lib/share-cards'
import { isShareKind, SHARE_BACKGROUNDS, type ShareBackground } from '@/lib/share-options'

export const runtime = 'nodejs'

const C = { black: '#000000', ink: '#06090f', ice: '#daecfd', mut: '#8d9bb0', green: '#95fe7c', blue: '#7ec1fb', amber: '#f2a74b', line: 'rgba(216,235,252,0.16)' }

let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 600 | 700 | 500; style: 'normal' }[]; logo: string }> | null = null
function loadAssets() {
  if (!assets) {
    const dir = join(process.cwd(), 'src/assets/share-fonts')
    assets = Promise.all([
      readFile(join(dir, 'rajdhani-600.woff')),
      readFile(join(dir, 'rajdhani-700.woff')),
      readFile(join(dir, 'jetbrains-mono-500.woff')),
      readFile(join(process.cwd(), 'public/wavewarz-logo.png')),
    ]).then(([r6, r7, m5, logo]) => ({
      fonts: [
        { name: 'Rajdhani', data: r6, weight: 600, style: 'normal' },
        { name: 'Rajdhani', data: r7, weight: 700, style: 'normal' },
        { name: 'Mono', data: m5, weight: 500, style: 'normal' },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    }))
    assets.catch(() => { assets = null })
  }
  return assets
}

// Deterministic equalizer heights, so the same card always renders the same
const EQ = Array.from({ length: 46 }, (_, i) => 8 + Math.round(Math.abs(Math.sin(i * 0.62) * 22 + Math.sin(i * 1.7) * 8)))

function Background({ bg }: { bg: ShareBackground }) {
  const fill = { position: 'absolute' as const, top: 0, left: 0, width: 1200, height: 630, display: 'flex' }
  if (bg === 'wave') return (
    <div style={{ ...fill, backgroundColor: C.black, alignItems: 'flex-end', padding: '0 40px' }}>
      {EQ.map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, margin: '0 3px', borderRadius: '4px 4px 0 0', backgroundImage: 'linear-gradient(180deg, rgba(149,254,124,0.26), rgba(149,254,124,0))' }} />)}
    </div>
  )
  if (bg === 'split') return (
    <div style={{ ...fill, backgroundColor: C.black, backgroundImage: 'linear-gradient(100deg, rgba(149,254,124,0.16) 0%, rgba(149,254,124,0.10) 47%, rgba(216,235,252,0.35) 49.6%, rgba(216,235,252,0.35) 50%, rgba(126,193,251,0.10) 52.5%, rgba(126,193,251,0.16) 100%)' }} />
  )
  if (bg === 'minimal') return (
    <div style={{ ...fill, background: C.black }}>
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, border: `1px solid ${C.line}`, borderRadius: 26 }} />
    </div>
  )
  return (
    <div style={{ ...fill, backgroundColor: C.black, backgroundImage: 'radial-gradient(circle at 12% 8%, rgba(149,254,124,0.24), rgba(0,0,0,0) 46%), radial-gradient(circle at 92% 100%, rgba(126,193,251,0.26), rgba(0,0,0,0) 50%)' }} />
  )
}

function shortPath(p: string) {
  const s = 'wavewarz.info' + (p === '/' ? '' : decodeURIComponent(p))
  return s.length > 44 ? s.slice(0, 36) + '…' + s.slice(-5) : s
}

function heroSize(v: string) {
  return v.length <= 9 ? 156 : v.length <= 14 ? 118 : v.length <= 20 ? 88 : 66
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  const kind = u.searchParams.get('kind')
  const id = (u.searchParams.get('id') ?? 'all').slice(0, 80)
  const [bgRaw, heroRaw] = (u.searchParams.get('look') ?? '').split('.')
  if (!isShareKind(kind)) return new Response('Unknown card', { status: 404 })

  // ?format=json: the headline choices and share text for the share pop-up (same numbers as the image)
  if (u.searchParams.get('format') === 'json') {
    const c = await getShareCard(kind, id)
    if (!c) return Response.json({ error: 'not found' }, { status: 404 })
    return Response.json(
      { path: c.path, title: c.title, shareText: c.shareText, heroes: c.heroes.map(h => ({ key: h.key, label: h.label })) },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
    )
  }

  const [card, a] = await Promise.all([getShareCard(kind, id), loadAssets()])
  if (!card) return new Response('Not found', { status: 404 })

  const bg = (SHARE_BACKGROUNDS.some(b => b.key === bgRaw) ? bgRaw : 'arena') as ShareBackground
  const hero = card.heroes.find(h => h.key === heroRaw) ?? card.heroes[0]
  const one = { whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', background: C.black, color: C.ice, fontFamily: 'Rajdhani' }}>
        <Background bg={bg} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '44px 60px 40px' }}>
          {/* top: logo + badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.logo} width={150} height={70} alt="" />
            <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: 1.5, textTransform: 'uppercase', color: C.green, border: '1px solid rgba(149,254,124,0.45)', background: 'rgba(149,254,124,0.10)', borderRadius: 999, padding: '9px 20px' }}>
              {card.badge}
            </div>
          </div>

          {/* middle: title + hero */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, color: C.ice, maxWidth: 1080, ...one }}>{card.title}</div>
            <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 21, letterSpacing: 2, textTransform: 'uppercase', color: C.mut, marginTop: 14 }}>{hero.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 2 }}>
              <div style={{ display: 'flex', fontSize: heroSize(hero.value), fontWeight: 700, lineHeight: 1, color: C.green, letterSpacing: -2, maxWidth: 1080, ...one }}>{hero.value}</div>
              {hero.unit && <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: C.ice, marginLeft: 16 }}>{hero.unit}</div>}
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: C.mut, marginTop: 8, maxWidth: 1080, ...one }}>{hero.sub}</div>
          </div>

          {/* bottom: stat strip + footer */}
          <div style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 18, background: 'rgba(0,0,0,0.55)' }}>
            {card.stats.map((s, i) => (
              <div key={s.k} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px 20px', borderLeft: i ? `1px solid ${C.line}` : 'none', minWidth: 0 }}>
                <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase', color: C.mut }}>{s.k}</div>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: C.ice, ...one }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontFamily: 'Mono', fontSize: 17, color: C.mut }}>
            <div style={{ display: 'flex' }}>From public Solana records · ONCHAIN</div>
            <div style={{ display: 'flex', color: C.blue }}>{shortPath(card.path)}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200, height: 630, fonts: a.fonts,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
    },
  )
}
