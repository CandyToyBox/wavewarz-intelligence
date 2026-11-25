'use client'

// Read-only pool chart for the Battle Stage: net SOL traded into each side over
// the battle. Side A wave blue, side B action green. No trade controls: trading
// happens on wavewarz.com.
export type ChartPoint = { t: string; a: number; b: number }

const W = 900
const H = 420
const PAD = { l: 64, r: 24, t: 24, b: 40 }

export function PoolChart({ points, nameA, nameB }: { points: ChartPoint[]; nameA: string; nameB: string }) {
  const pts = points.length ? [{ t: points[0].t, a: 0, b: 0 }, ...points] : []
  const max = Math.max(0.01, ...pts.map((p) => Math.max(p.a, p.b)))
  const x = (i: number) => PAD.l + (pts.length > 1 ? (i / (pts.length - 1)) * (W - PAD.l - PAD.r) : 0)
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b)
  const line = (k: 'a' | 'b') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map((f) => f * max)
  const last = pts[pts.length - 1]
  return (
    <div className="bs-chart">
      <ul className="bs-legend">
        <li style={{ color: '#7ec1fb' }}><i style={{ background: '#7ec1fb' }} />{nameA}<b>◎{(last?.a ?? 0).toFixed(3)}</b></li>
        <li style={{ color: '#95fe7c' }}><i style={{ background: '#95fe7c' }} />{nameB}<b>◎{(last?.b ?? 0).toFixed(3)}</b></li>
      </ul>
      {pts.length < 2 ? (
        <p className="bs-chart-empty">The chart draws as trades come in.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net SOL traded: ${nameA} ${last.a.toFixed(3)}, ${nameB} ${last.b.toFixed(3)}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(216,235,252,.08)" />
              <text x={PAD.l - 10} y={y(v) + 4} textAnchor="end" fill="#8d9bb0" fontSize="13" fontFamily="JetBrains Mono, monospace">◎{v.toFixed(v < 1 ? 2 : 1)}</text>
            </g>
          ))}
          <path d={line('a')} fill="none" stroke="#7ec1fb" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={line('b')} fill="none" stroke="#95fe7c" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx={x(pts.length - 1)} cy={y(last.a)} r="5" fill="#7ec1fb" stroke="#000" strokeWidth="2" />
          <circle cx={x(pts.length - 1)} cy={y(last.b)} r="5" fill="#95fe7c" stroke="#000" strokeWidth="2" />
          <text x={PAD.l} y={H - 12} fill="#8d9bb0" fontSize="13" fontFamily="JetBrains Mono, monospace">{pts.length - 1} trades</text>
        </svg>
      )}
    </div>
  )
}
