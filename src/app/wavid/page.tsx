import fs from 'fs'
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
          evolves as the artist competes. It is a research and product-definition paper, not a shipped WaveWarZ
          feature, rights opinion, or token prospectus.
        </p>
      </div>

      <article className="font-inter">
        {renderMarkdown(markdown)}
      </article>
    </div>
  )
}
