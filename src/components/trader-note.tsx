// The standing note under every trader stat. Wording follows the homepage copy (Nov 11, 2026):
// no profit promises, Withdraw is manual, 18+.
export function TraderNote() {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground max-w-3xl">
      These are public onchain records, shown for transparency. They are not advice and do not predict future results.
      Backing the winning side does not guarantee getting back what you put in, and trading during a battle can lose money.
      Withdrawing is not automatic: if you hold tokens when a battle ends, press Withdraw to collect what is yours.
      Trading is for people 18 or older, or the legal age where you live. Don&apos;t put in more than you can afford to lose.
    </p>
  )
}
