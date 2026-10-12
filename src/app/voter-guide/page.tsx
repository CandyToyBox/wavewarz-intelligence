import type { Metadata } from 'next'
import { FullBleed } from '@/components/full-bleed'

export const metadata: Metadata = {
  title: 'Voter Guide — Get Ready to Vote',
  description: 'A beginner-friendly walkthrough to get set up with a Solana wallet and vote for free in WaveWarZ battles. No crypto experience needed.',
}

export default function VoterGuidePage() {
  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-rajdhani text-2xl font-bold text-white">Voter Onboarding Guide</h1>
          <p className="text-sm text-gray-400">Produced by Web3 Metal — a free, no-crypto-experience-needed walkthrough to get ready for battle night.</p>
        </div>
        <a
          href="/voter-guide-embed/index.html"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-actiongreen/40 bg-actiongreen/10 px-4 py-2 text-sm font-medium text-actiongreen hover:bg-actiongreen/20 transition-colors"
        >
          Open full-screen ↗
        </a>
      </div>

      <FullBleed>
        <iframe
          src="/voter-guide-embed/index.html"
          title="WaveWarZ Voter Onboarding Guide"
          className="block w-full border-0"
          style={{ height: 'max(700px, calc(100vh - 5rem))' }}
        />
      </FullBleed>
    </div>
  )
}
