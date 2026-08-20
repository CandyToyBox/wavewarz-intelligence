import { createElement, type ReactNode } from 'react'

// Minimal markdown renderer for static long-form docs (headings, lists, tables,
// blockquotes, code fences, bold/italic/inline-code/links). Not a general-purpose
// parser — built for the WavID paper's specific formatting.

let keyCounter = 0
function nextKey() {
  keyCounter += 1
  return `md-${keyCounter}`
}

function renderInline(text: string): ReactNode[] {
  // Strip LaTeX-ish math delimiters, keep the expression as inline code.
  const withMath = text
    .replace(/\\\[(.+?)\\\]/g, (_m, expr) => `\`${expr.trim()}\``)
    .replace(/\\\((.+?)\\\)/g, (_m, expr) => `\`${expr.trim()}\``)

  const tokens: ReactNode[] = []
  const pattern = /(\*\*.+?\*\*|`[^`]+`|\[.+?\]\(.+?\)|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(withMath)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(withMath.slice(lastIndex, match.index))
    }
    const token = match[0]

    if (token.startsWith('**')) {
      tokens.push(<strong key={nextKey()} className="font-semibold text-white">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      tokens.push(<code key={nextKey()} className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] text-actiongreen font-mono">{token.slice(1, -1)}</code>)
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[(.+?)\]\((.+?)\)$/)
      if (linkMatch) {
        tokens.push(
          <a key={nextKey()} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-actiongreen underline decoration-actiongreen/40 hover:decoration-actiongreen">
            {linkMatch[1]}
          </a>
        )
      } else {
        tokens.push(token)
      }
    } else if (token.startsWith('*')) {
      tokens.push(<em key={nextKey()}>{token.slice(1, -1)}</em>)
    } else {
      tokens.push(token)
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < withMath.length) {
    tokens.push(withMath.slice(lastIndex))
  }

  return tokens
}

function renderTable(lines: string[]): ReactNode {
  const rows = lines
    .filter((line) => !/^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|?$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))

  const [header, ...body] = rows

  return (
    <div key={nextKey()} className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5">
          <tr>
            {header.map((cell) => (
              <th key={nextKey()} className="px-3 py-2 font-semibold text-white whitespace-nowrap">{renderInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr key={nextKey()} className="border-t border-border">
              {row.map((cell) => (
                <td key={nextKey()} className="px-3 py-2 align-top text-gray-300">{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const nodes: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i += 1
      continue
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1
      nodes.push(
        <pre key={nextKey()} className="my-4 overflow-x-auto rounded-lg border border-border bg-black/40 p-4 text-xs text-gray-300 font-mono">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    if (line.trim() === '\\[') {
      const mathLines: string[] = []
      i += 1
      while (i < lines.length && lines[i].trim() !== '\\]') {
        mathLines.push(lines[i])
        i += 1
      }
      i += 1
      nodes.push(
        <pre key={nextKey()} className="my-4 overflow-x-auto rounded-lg border border-actiongreen/20 bg-black/30 px-4 py-3 text-sm text-actiongreen font-mono">
          <code>{mathLines.join('\n').trim()}</code>
        </pre>
      )
      continue
    }

    if (/^\|/.test(line)) {
      const tableLines: string[] = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      nodes.push(renderTable(tableLines))
      continue
    }

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={nextKey()} className="my-8 border-border" />)
      i += 1
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const headingClasses: Record<number, string> = {
        1: 'font-rajdhani text-3xl sm:text-4xl font-bold text-white mt-2 mb-4',
        2: 'font-rajdhani text-2xl font-bold text-white mt-10 mb-3 pb-2 border-b border-border',
        3: 'font-rajdhani text-xl font-bold text-actiongreen mt-8 mb-2',
        4: 'font-rajdhani text-lg font-bold text-white mt-6 mb-2',
      }
      nodes.push(createElement(`h${level}`, { key: nextKey(), className: headingClasses[level] }, renderInline(text)))
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      nodes.push(
        <blockquote key={nextKey()} className="my-4 border-l-2 border-actiongreen/50 pl-4 italic text-gray-400">
          {quoteLines.map((l) => <p key={nextKey()}>{renderInline(l)}</p>)}
        </blockquote>
      )
      continue
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''))
        i += 1
      }
      nodes.push(
        <ul key={nextKey()} className="my-3 list-disc space-y-1.5 pl-6 text-gray-300">
          {items.map((item) => <li key={nextKey()}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i += 1
      }
      nodes.push(
        <ol key={nextKey()} className="my-3 list-decimal space-y-1.5 pl-6 text-gray-300">
          {items.map((item) => <li key={nextKey()}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|```|\||>|\s*-\s|\s*\d+\.\s|---+$|\\\[$)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i += 1
    }
    // A trailing double-space on a line is a markdown hard break — keep it as
    // its own line; otherwise treat the wrap as a soft join (single space).
    const paraContent: ReactNode[] = []
    paraLines.forEach((paraLine, idx) => {
      const hardBreakBefore = idx > 0 && /  $/.test(paraLines[idx - 1])
      if (idx > 0) {
        paraContent.push(hardBreakBefore ? <br key={nextKey()} /> : ' ')
      }
      paraContent.push(...renderInline(paraLine.trimEnd()))
    })
    nodes.push(<p key={nextKey()} className="my-3 leading-relaxed text-gray-300">{paraContent}</p>)
  }

  return nodes
}
