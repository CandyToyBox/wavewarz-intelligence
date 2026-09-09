import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import type { Metadata } from 'next'
import { renderMarkdown } from '@/lib/simple-markdown'

export const metadata: Metadata = {
  title: 'API Changelog — WaveWarZ Intelligence',
  description:
    'Every change to what the WaveWarZ public API returns — corrected values, new fields, recomputed formulas — with how much your numbers move and how to verify it.',
}

// Single source of truth: the same file that lives in the repo. Public-safe.
function getChangelog() {
  return fs.readFileSync(path.join(process.cwd(), 'docs', 'API-CHANGELOG.md'), 'utf-8')
}

export default function ApiChangelogPage() {
  const markdown = getChangelog()

  return (
    <div className="max-w-4xl mx-auto py-12 font-inter">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link href="/api-docs" className="text-xs text-[#7ec1fb] hover:text-white transition-colors">
          ← API docs
        </Link>
        <span className="px-2 py-0.5 rounded bg-actiongreen/20 text-actiongreen text-[10px] font-bold tracking-widest border border-actiongreen/40">
          NEWEST FIRST
        </span>
      </div>

      <article>{renderMarkdown(markdown)}</article>

      <div className="mt-12 rounded-xl border border-border bg-white/[0.02] px-5 py-4 text-xs text-muted-foreground">
        Machine-readable source:{' '}
        <a
          href="https://github.com/CandyToyBox/wavewarz-intelligence/blob/main/docs/API-CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-actiongreen underline decoration-actiongreen/40 hover:decoration-actiongreen"
        >
          docs/API-CHANGELOG.md
        </a>
        . Building on the API and want to be told before a value moves? Open an
        issue on that repo.
      </div>
    </div>
  )
}
