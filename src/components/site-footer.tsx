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
        <Link href="/">Stats</Link>
        <a href="https://claim.wavewarz.info" target="_blank" rel="noopener">Claim</a>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  )
}
