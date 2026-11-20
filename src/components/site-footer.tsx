import { main } from '@/lib/site'

// Same footer as the redesigned wavewarz.com pages.
export function SiteFooter() {
  return (
    <footer className="ww-foot">
      <span>&copy; {new Date().getFullYear()} WaveWarZ. Live music battles on Solana.</span>
      <nav aria-label="Footer">
        <a href={main('/')}>Home</a>
        <a href={main('/quick-battles')}>Queue</a>
        <a href="/">Stats</a>
        <a href="https://claim.wavewarz.info" target="_blank" rel="noopener">Claim</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </footer>
  )
}
