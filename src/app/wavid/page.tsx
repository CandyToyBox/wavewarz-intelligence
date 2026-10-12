import fs from 'fs'
import { FullBleed } from '@/components/full-bleed'
import path from 'path'
import type { Metadata } from 'next'
import { renderMarkdown } from '@/lib/simple-markdown'

export const metadata: Metadata = {
  title: 'WavID — Verifiable Creative History as Living Visual Identity',
  description: 'WavID transforms an artist’s verifiable WaveWarZ battle history into a persistent, evolving visual identity. Concept by 0xQuan93.',
}

function getPaperMarkdown() {
  const filePath = path.join(process.cwd(), 'content', 'wavid-paper.md')
  return fs.readFileSync(filePath, 'utf-8')
}

export default function WavIdPage() {
  const markdown = getPaperMarkdown()

  return (
    <div className="max-w-4xl mx-auto py-12">
      <div className="mb-10 rounded-xl border border-actiongreen/30 bg-actiongreen/5 px-6 py-5">
        <p className="text-xs uppercase tracking-widest text-actiongreen font-semibold mb-2">Community Research &amp; Product Concept</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          WavID is a concept and research paper developed by <strong className="text-white">0xQuan93</strong>, with
          system formalization by REGALIA//89. It proposes turning an artist&apos;s verifiable WaveWarZ battle
          history — battles, wins, catalog, trading volume — into a persistent generative visual identity that
          evolves as the artist competes. The paper itself is a research and product-definition document, not a rights
          opinion or token prospectus; the studio below is an early developer preview of it, not a finished WaveWarZ feature.
        </p>
      </div>

      <section className="mb-12" aria-labelledby="wavid-studio-heading">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
          <h2 id="wavid-studio-heading" className="text-xl font-bold text-white">Try the Browser Studio</h2>
          <a
            href="/wavid-studio/index.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs uppercase tracking-widest text-actiongreen font-semibold hover:underline"
          >
            Open full screen ↗
          </a>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          A developer preview of WavID by <strong className="text-white">0xQuan93</strong>. It turns public
          WaveWarZ observations into a deterministic visual identity, generated on your own device. The four
          artists shown are frozen examples; official accounts, artist verification and saved identities are
          not live yet.
        </p>
        <FullBleed>
          <iframe
            src="/wavid-studio/index.html"
            title="WavID Browser Studio"
            loading="lazy"
            className="block w-full border-0"
            style={{ height: 'max(720px, calc(100vh - 5rem))' }}
          />
        </FullBleed>
        <p className="mt-3 text-xs text-muted-foreground/70">
          Open source under the MIT License ·{' '}
          <a
            href="https://github.com/0xQuan93/WavID"
            target="_blank"
            rel="noreferrer"
            className="text-actiongreen hover:underline"
          >
            github.com/0xQuan93/WavID
          </a>
          . File integrity is not artist ownership; public records do not grant rights to the underlying music or artwork.
        </p>
      </section>

      <article className="font-inter">
        {renderMarkdown(markdown)}
      </article>
    </div>
  )
}
