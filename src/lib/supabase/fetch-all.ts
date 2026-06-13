/**
 * Paginated fetch helper.
 *
 * PostgREST caps a single .select() at 1000 rows by default. Any page that
 * AGGREGATES across all battles/trades (totals, leaderboards, revenue) must
 * read every row, or its numbers silently stop counting past row 1000 — the
 * source of every divergent figure across the app.
 *
 * Usage: pass a builder that applies .range(from, to) to your query.
 *
 *   const battles = await fetchAll((from, to) =>
 *     supabase.from('battles').select('...').eq('is_test_battle', false)
 *       .order('created_at', { ascending: false }).range(from, to)
 *   )
 *
 * For a plain count, prefer `.select('*', { count: 'exact', head: true })`
 * instead — it never fetches rows.
 */
const PAGE = 1000

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error('[fetchAll] page error:', error)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}
