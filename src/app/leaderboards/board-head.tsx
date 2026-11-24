import type { CSSProperties, ReactNode } from 'react'
import { board, type BoardKey } from './boards'

// One header for every board: a mono label in the board's colour, the title with its accent word,
// a one-line explainer, and an optional figure on the right (count or total). Styles: .ww-bh in site-shell.css.
export function BoardHead({ k, children, aside }: { k: BoardKey; children?: ReactNode; aside?: ReactNode }) {
  const b = board(k)
  return (
    <header className="ww-bh" style={{ '--acc': b.accent } as CSSProperties}>
      <div className="ww-bh-main">
        <p className="ww-bh-k"><i aria-hidden="true" />{b.label}</p>
        <h1>{b.title[0]} <span>{b.title[1]}</span></h1>
        {children && <p className="ww-bh-d">{children}</p>}
      </div>
      {aside && <div className="ww-bh-aside">{aside}</div>}
    </header>
  )
}

export function BoardFigure({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <>
      <small>{label}</small>
      <b>{value}{unit && <em> {unit}</em>}</b>
      {sub && <span>{sub}</span>}
    </>
  )
}
