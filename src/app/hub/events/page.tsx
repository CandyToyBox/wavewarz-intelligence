export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { listHubEvents } from '@/lib/hub-events'
import { HubAvatar } from '@/app/hub/hub-avatar'

export default async function HubEvents() {
  const events = await listHubEvents()
  const withThesis = events.filter(e => e.hasThesis).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {events.length} Main Events — grouped from battle rounds the same way the wavewarz.info homepage counts them.
        {' '}{withThesis}/{events.length} have a written thesis (Phase 25 — before any promo asset is made, one sentence
        explaining why this matchup matters).
      </p>

      <div className="rounded-xl border border-border bg-[#111827] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-widest">
          <span>Event</span>
          <span className="text-center">Result</span>
          <span className="text-center">Volume</span>
          <span className="text-right">Thesis</span>
        </div>
        {events.map(e => {
          const winnerName = e.winner === 'a' ? e.a.name : e.winner === 'b' ? e.b.name : e.winner === 'draw' ? 'Draw' : 'Pending'
          return (
            <Link
              key={e.slug}
              href={`/hub/events/${e.slug}`}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 shrink-0">
                  <HubAvatar name={e.a.name} pfpUrl={e.a.pfpUrl} twitterHandle={e.a.twitterHandle} size={30} />
                  <HubAvatar name={e.b.name} pfpUrl={e.b.pfpUrl} twitterHandle={e.b.twitterHandle} size={30} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{e.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(e.date).toLocaleDateString()} · {e.rounds} round{e.rounds > 1 ? 's' : ''}
                    {e.eventSubtype !== 'standard' && ` · ${e.eventSubtype}`}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-rajdhani font-bold text-center ${e.winner === 'pending' ? 'text-amber-400' : 'text-[#95fe7c]'}`}>
                {winnerName}
              </span>
              <span className="text-xs font-mono text-[#7ec1fb] text-center">{e.totalVolumeSol} SOL</span>
              <span className="text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  e.hasThesis
                    ? (e.thesisNeedsReview ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-[#95fe7c] border-[#95fe7c]/40 bg-[#95fe7c]/10')
                    : 'text-muted-foreground border-border'
                }`}>
                  {e.hasThesis ? (e.thesisNeedsReview ? 'REVIEW' : '✓') : 'needed'}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
