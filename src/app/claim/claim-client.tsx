'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CdCase } from '@/components/cd-case'
import type { ClaimHolding, ClaimState } from '@/lib/claim-scan'

type Result =
  | { kind: 'idle' }
  | { kind: 'loading'; wallet: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; wallet: string; holdings: ClaimHolding[] }

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const shares = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : 2 })
const battleUrl = (id: string) => `https://www.wavewarz.com/v2/battles/${id}`

const GROUPS: { key: string; title: string; states: ClaimState[]; note: string }[] = [
  { key: 'ready', title: 'Ready to withdraw', states: ['won', 'lost'], note: 'These battles are settled. Open each one, connect this wallet and press Withdraw.' },
  { key: 'waiting', title: 'Ended, waiting to settle', states: ['waiting'], note: 'Withdrawing opens once the battle settles.' },
  { key: 'live', title: 'Still live', states: ['live'], note: 'You can sell these shares on the battle page until it ends.' },
]

const TAG: Record<ClaimState, string> = {
  won: 'Your side won',
  lost: 'Your side lost',
  waiting: 'Not settled yet',
  live: 'Live now',
}

export function ClaimClient() {
  const router = useRouter()
  const pathname = usePathname() ?? '/claim'
  const params = useSearchParams()
  const fromUrl = params?.get('wallet')?.trim() ?? ''
  const [value, setValue] = useState(fromUrl)
  const [result, setResult] = useState<Result>({ kind: 'idle' })
  const ran = useRef<string | null>(null)
  const out = useRef<HTMLDivElement>(null)

  const scan = useCallback(async (wallet: string) => {
    ran.current = wallet
    setResult({ kind: 'loading', wallet })
    try {
      const res = await fetch(`/api/claim?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (ran.current !== wallet) return
      if (res.status === 400) setResult({ kind: 'error', message: 'That isn’t a Solana wallet address. Check that you copied all of it.' })
      else if (!res.ok) setResult({ kind: 'error', message: 'Solana didn’t answer in time. Try again in a moment.' })
      else setResult({ kind: 'done', wallet, holdings: body.holdings ?? [] })
    } catch {
      if (ran.current === wallet) setResult({ kind: 'error', message: 'Couldn’t reach the server. Check your connection and try again.' })
    }
    out.current?.focus({ preventScroll: true })
  }, [])

  // A shared link like /claim?wallet=… checks straight away
  useEffect(() => {
    if (fromUrl && ADDRESS.test(fromUrl) && ran.current !== fromUrl) queueMicrotask(() => void scan(fromUrl))
  }, [fromUrl, scan])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const w = value.trim()
    if (!w) return
    if (!ADDRESS.test(w)) {
      setResult({ kind: 'error', message: 'That isn’t a Solana wallet address. It’s 32 to 44 letters and numbers, with no spaces.' })
      return
    }
    router.replace(`${pathname}?wallet=${w}`, { scroll: false })
    if (w === fromUrl) void scan(w)
  }

  async function paste() {
    try {
      const t = (await navigator.clipboard.readText()).trim()
      if (t) setValue(t)
    } catch { /* clipboard blocked: the field still takes a normal paste */ }
  }

  const busy = result.kind === 'loading'

  return (
    <>
      <form className="wc-form" onSubmit={submit} role="search">
        <label htmlFor="wc-wallet" className="sr-only">Solana wallet address</label>
        <div className="wc-field">
          <input
            id="wc-wallet"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Solana wallet address"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {!value && <button type="button" className="wc-paste" onClick={paste}>Paste</button>}
        </div>
        <button type="submit" className="ww-btn solid wc-go" disabled={busy || !value.trim()}>
          {busy ? 'Checking…' : 'Check wallet'}
        </button>
      </form>
      <p className="wc-safe">Read only. This page looks up public Solana records and never asks you to connect or sign anything.</p>

      <div ref={out} tabIndex={-1} aria-live="polite" className="wc-out">
        {result.kind === 'loading' && (
          <div className="wc-state" role="status">
            <span className="wc-spin" aria-hidden="true" />
            <p>Reading every WaveWarZ battle on Solana for {short(result.wallet)}. This takes a few seconds.</p>
          </div>
        )}

        {result.kind === 'error' && <p className="wc-err" role="alert">{result.message}</p>}

        {result.kind === 'done' && <Results wallet={result.wallet} holdings={result.holdings} />}
      </div>

      <details className="ww-explain wc-explain">
        <summary>How withdrawing works</summary>
        <div>
          <p>WaveWarZ doesn’t send anything out on its own. When a battle settles, each holder opens that battle on wavewarz.com, connects the wallet that holds the shares, and presses <b>Withdraw</b>.</p>
          <p>Both sides can withdraw. At settlement the losing side’s pool is split: <b>40%</b> to holders of the winning side, <b>50%</b> back to holders of the losing side, <b>5%</b> to the winning artist, <b>2%</b> to the losing artist and <b>3%</b> to WaveWarZ.</p>
          <p>While a battle is live you can sell your shares on its page at any time.</p>
        </div>
      </details>
    </>
  )
}

function Results({ wallet, holdings }: { wallet: string; holdings: ClaimHolding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="wc-state">
        <p><b>No battle shares in {short(wallet)}.</b> If this wallet sold or withdrew everything, this is what you’ll see.</p>
        <p><Link href={`/trader/${wallet}`}>See this wallet’s trading history</Link></p>
      </div>
    )
  }
  const ready = holdings.filter(h => h.state === 'won' || h.state === 'lost').length
  const n = holdings.length
  return (
    <>
      <p className="wc-sum">
        <b>{short(wallet)}</b> still holds shares in {n} battle{n === 1 ? '' : 's'}.
        {ready > 0 && <> {ready === n ? (n === 1 ? 'It’s' : 'All are') : `${ready} are`} ready to withdraw.</>}
        {' '}<Link href={`/trader/${wallet}`}>Trading history</Link>
      </p>
      {GROUPS.map(g => {
        const rows = holdings.filter(h => g.states.includes(h.state))
        if (rows.length === 0) return null
        return (
          <section key={g.key} className="ww-hl-panel wc-group" aria-labelledby={`wc-${g.key}`}>
            <h2 id={`wc-${g.key}`}>{g.title} <span>{rows.length}</span></h2>
            <p className="wc-note">{g.note}</p>
            <ul>
              {rows.map(h => <Row key={`${h.battleId}-${h.side}`} h={h} />)}
            </ul>
          </section>
        )
      })}
    </>
  )
}

function Row({ h }: { h: ClaimHolding }) {
  const act = h.state === 'live' ? 'Trade' : h.state === 'waiting' ? 'Open battle' : 'Withdraw'
  return (
    <li className="wc-row">
      <span className="wc-art"><CdCase src={h.image} /></span>
      <span className="wc-tx">
        <b>{h.heldName} <i>vs</i> {h.otherName}</b>
        <span>{shares(h.shares)} shares of {h.heldName}{h.date ? ` · ${day(h.date)}` : ''}</span>
      </span>
      <span className={`wc-tag ${h.state}`}>{TAG[h.state]}</span>
      <a className={`ww-btn ${h.state === 'won' || h.state === 'lost' ? 'solid' : 'ghost'} wc-act`} href={battleUrl(h.battleId)} target="_blank" rel="noopener noreferrer">
        {act}<span className="sr-only"> on wavewarz.com (opens in a new tab)</span>
      </a>
    </li>
  )
}
