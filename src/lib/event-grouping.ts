// Groups multi-round main-event battles (same two sides, played close together)
// into a single "event" -- e.g. a 3-round match is one event, not 3 separate
// results. Shared by the Battles Feed (display grouping) and artist profiles
// (event-level win/loss tallying) so both agree on what counts as one event.

const EVENT_GROUP_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

export function pairKey(
  wallet1: string | null | undefined, name1: string | null | undefined,
  wallet2: string | null | undefined, name2: string | null | undefined,
): string {
  return [wallet1 || name1 || '', wallet2 || name2 || ''].sort().join('|')
}

/** Groups items into events using a rolling time window: an item joins the
 * most recent same-key group if it falls within the window of that group's
 * last item, otherwise it starts a new group. */
export function groupIntoEvents<T>(
  items: T[],
  getKey: (item: T) => string,
  getTime: (item: T) => number,
): T[][] {
  const sorted = [...items].sort((a, b) => getTime(a) - getTime(b))
  const groups: { key: string; items: T[]; lastTime: number }[] = []

  for (const item of sorted) {
    const key = getKey(item)
    const t = getTime(item)

    let matched: (typeof groups)[number] | null = null
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      if (g.key !== key) continue
      if (t - g.lastTime <= EVENT_GROUP_WINDOW_MS) { matched = g; break }
    }

    if (matched) { matched.items.push(item); matched.lastTime = t }
    else groups.push({ key, items: [item], lastTime: t })
  }

  return groups.map(g => g.items)
}
