'use client'

export function WinRateBar({ rate, color = 'green' }: { rate: number; color?: 'green' | 'blue' | 'amber' }) {
  const colors = {
    green: { bar: 'bg-[#95fe7c]', text: 'text-[#95fe7c]' },
    blue:  { bar: 'bg-[#7ec1fb]', text: 'text-[#7ec1fb]' },
    amber: { bar: 'bg-amber-400',  text: 'text-amber-400' },
  }
  const c = colors[color]
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-bold font-rajdhani ${c.text} w-8 text-left`}>{rate}%</span>
    </div>
  )
}
