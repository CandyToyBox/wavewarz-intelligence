'use client'

// Shared pieces of the battle cards (quick-battle-card.tsx, event-group-card.tsx). Styles: .bt-* in site-shell.css.
// Side A is always green, side B always blue, the platform oxide-amber, so a reader learns the colours once.
import { useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink } from 'lucide-react'
import { WwIcon } from '@/components/ww-icon'
import { Pfp } from '@/components/wavid/pfp'

export const SIDE_A = '#95fe7c'
export const SIDE_B = '#7ec1fb'
export const PLATFORM = '#f2a74b'

type Money = { sol: string; usd: string }

export type LedgerParty = {
  name: string
  color: string
  traded: Money & { note?: string }
  fee: Money & { note: string }
  settle: Money & { note: string }
  earned: Money
  streams?: string | null
  wallet: string | null
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`

/** Profile picture inside a ring made of the artist's Wave ID (chrome when no Wave ID is drawn yet). */
export function IdMark({ name, pfpUrl, wavid, color, size = 48 }: { name: string; pfpUrl: string | null; wavid: string | null; color: string; size?: number }) {
  return (
    <span className={`bt-id${wavid ? ' has-wid' : ''}`} style={{ '--side': color, width: size, height: size } as CSSProperties}
      title={wavid ? `${name}'s Wave ID` : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {wavid && <img className="bt-id-wid" src={wavid} alt="" loading="lazy" />}
      <Pfp className="bt-id-pfp" src={pfpUrl} name={name} />
    </span>
  )
}

/** One row of onchain receipts. Wraps on phones so no link is ever cut off. */
export function Receipts({ children, label = 'Receipts' }: { children: ReactNode; label?: string }) {
  return (
    <div className="bt-receipts">
      <span className="bt-receipts-k">{label}</span>
      {children}
    </div>
  )
}

export function Rcpt({ href, children, internal }: { href: string; children: ReactNode; internal?: boolean }) {
  if (internal) return <Link className="bt-rcpt" href={href}>{children} <span aria-hidden="true">→</span></Link>
  return <a className="bt-rcpt" href={href} target="_blank" rel="noreferrer">{children} <ExternalLink size={12} aria-hidden="true" /></a>
}

export const solscan = (address: string) => `https://solscan.io/account/${address}`

function Wallet({ addr, owner }: { addr: string; owner: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="bt-wallet">
      <a href={solscan(addr)} target="_blank" rel="noreferrer" title={addr} aria-label={`${owner} wallet ${addr} on Solscan`}>
        {short(addr)} <ExternalLink size={11} aria-hidden="true" />
      </a>
      <button type="button" aria-label={`Copy ${owner} wallet address`} onClick={() => {
        navigator.clipboard?.writeText(addr).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
      }}>
        {copied ? <WwIcon name="ui-check" size={12} /> : <Copy size={12} aria-hidden="true" />}
      </button>
    </span>
  )
}

const ROWS: { k: string; render: (p: LedgerParty) => ReactNode; total?: boolean }[] = [
  { k: 'Traded', render: p => <><b>◎{p.traded.sol}</b><small>{p.traded.usd}{p.traded.note ? ` · ${p.traded.note}` : ''}</small></> },
  { k: 'Trading fee', render: p => <><b>◎{p.fee.sol}</b><small>{p.fee.usd} · {p.fee.note}</small></> },
  { k: 'Settlement', render: p => <><b>◎{p.settle.sol}</b><small>{p.settle.usd} · {p.settle.note}</small></> },
  { k: 'Earned', total: true, render: p => <><b>◎{p.earned.sol}</b><small>{p.earned.usd}</small></> },
  { k: 'Spotify equivalent', render: p => p.streams ? <span className="bt-soft">≈ {p.streams}</span> : <span className="bt-soft">–</span> },
  { k: 'Wallet', render: p => p.wallet ? <Wallet addr={p.wallet} owner={p.name} /> : <span className="bt-soft">–</span> },
]

/** Every money number for one battle or round: artists A and B plus the platform, same rows for all three. */
export function Ledger({ parties, caption }: { parties: LedgerParty[]; caption: string }) {
  return (
    <div className="bt-ledger">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {parties.map(p => (
              <th key={p.name} scope="col" style={{ '--side': p.color } as CSSProperties}><i aria-hidden="true" />{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(r => (
            <tr key={r.k} className={r.total ? 'total' : undefined}>
              <th scope="row">{r.k}</th>
              {parties.map(p => <td key={p.name} style={{ '--side': p.color } as CSSProperties}>{r.render(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones: same rows, each row's label above the three values (A · B · platform) */}
      <div className="bt-ledger-m" aria-hidden="true">
        <div className="bt-lm-who">
          {parties.map(p => <span key={p.name} style={{ '--side': p.color } as CSSProperties}><i />{p.name}</span>)}
        </div>
        {ROWS.map(r => (
          <div key={r.k} className={`bt-lm-row${r.total ? ' total' : ''}`}>
            <p>{r.k}</p>
            <div>{parties.map(p => <span key={p.name} style={{ '--side': p.color } as CSSProperties}>{r.render(p)}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
