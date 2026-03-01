import type { Metadata } from 'next'
import ClaimChecker from './claim-checker'

export const metadata: Metadata = {
  title: 'Claim Funds — WaveWarZ Intelligence',
  description: 'Scan your SOL wallet for unclaimed WaveWarZ battle payouts and active battle shares.',
}

export default function ClaimPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#95fe7c] mb-2">Recovery Tool</p>
        <h1 className="text-3xl sm:text-4xl font-rajdhani font-bold text-white tracking-tight">
          Claim Your <span className="text-[#95fe7c]">Funds</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Paste your SOL wallet address to scan every WaveWarZ battle for active shares or unclaimed winning payouts. Winners must manually withdraw — this tool finds what you&apos;re owed.
        </p>
      </div>

      <ClaimChecker />

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-rajdhani font-bold text-white text-lg mb-4 tracking-wide">How Withdrawals Work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Battle Settles',
              desc: 'When a battle ends, the loser pool is split. Winning traders receive a share of the winner pool + 40% of the loser pool.',
            },
            {
              step: '02',
              title: 'Funds Wait On-Chain',
              desc: 'Unlike artist payouts (automatic), trader funds sit in the Battle Vault PDA until you manually claim them.',
            },
            {
              step: '03',
              title: 'Claim Your SOL',
              desc: 'Use the Withdrawal button on the battle page at wavewarz.com, or use this tool to find all unclaimed battles at once.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <span className="font-rajdhani font-bold text-2xl text-[#95fe7c]/30 leading-none shrink-0">{step}</span>
              <div>
                <p className="font-bold text-white text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          Losing traders get <span className="text-white">50% refunded</span>. Winning traders get their proportional share of the winner pool plus bonus. All funds are on-chain — no expiry.
        </div>
      </div>
    </div>
  )
}
