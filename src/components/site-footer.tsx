import Link from 'next/link'
import { main } from '@/lib/site'

// Same footer as the redesigned wavewarz.com pages.
export function SiteFooter() {
  return (
    <footer className="ww-foot">
      <span>&copy; {new Date().getFullYear()} WaveWarZ. Live music battles on Solana.</span>
      <nav aria-label="Footer">
        <a href={main('/')}>Home</a>
        <a href={main('/quick-battles')}>Queue</a>
        <Link href="/">Statz</Link>
        <Link href="/claim">Claim</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  )
}
