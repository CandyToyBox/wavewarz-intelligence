'use client'

export function WinRateBar({ rate, color = 'green' }: { rate: number; color?: 'green' | 'blue' | 'amber' }) {
  const colors = {
    green: { bar: 'bg-[#95fe7c]', text: 'text-[#95fe7c]' },
    blue:  { bar: 'bg-[#7ec1fb]', text: 'text-[#7ec1fb]' },
    amber: { bar: 'bg-amber-400',  text: 'text-amber-400' },
  }
  const c = colors[color]
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-bold font-rajdhani ${c.text}`}>{rate}%</span>
      <div className="w-16 h-1 bg-[#1f2937] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  )
}
