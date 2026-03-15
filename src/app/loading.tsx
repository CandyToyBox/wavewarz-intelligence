/**
 * Homepage loading skeleton — shown while the server fetches all data.
 * Mirrors the exact layout of page.tsx so there's zero layout shift.
 */
export default function HomeLoading() {
  return (
    <div className="space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="skeleton h-12 w-80" />
          <div className="skeleton h-5 w-60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-36" />
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>

      {/* ── X Spaces Schedule ── */}
      <div className="space-y-4">
        <div className="skeleton h-7 w-52" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Trader Claim Banner ── */}
      <div className="skeleton h-20 rounded-xl" />

      {/* ── QB Charts Preview ── */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-7 w-56" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
            <div className="skeleton h-3.5 w-80" />
          </div>
          <div className="skeleton h-4 w-24" />
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-2">
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-24 rounded-lg" />
          <div className="skeleton h-8 w-28 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg ml-2" />
        </div>

        {/* Chart rows */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border/50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton h-7 w-7 rounded-lg shrink-0" />
                <div className="skeleton h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4" style={{ width: `${55 + i * 7}%` }} />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="hidden sm:flex items-center gap-2 w-20">
                  <div className="flex-1 skeleton h-1.5 rounded-full" />
                  <div className="skeleton h-3 w-5" />
                </div>
                <div className="text-right space-y-1 shrink-0">
                  <div className="skeleton h-3.5 w-16" />
                  <div className="skeleton h-3 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer link */}
        <div className="flex justify-center">
          <div className="skeleton h-3.5 w-72" />
        </div>
      </div>

      {/* ── Events ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-44" />
          <div className="skeleton h-4 w-16" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="skeleton h-40 rounded-none" />
              <div className="p-4 space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-5 w-40" />
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
