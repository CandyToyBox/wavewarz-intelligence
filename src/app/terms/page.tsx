export const metadata = {
  title: 'Terms of Service — WaveWarZ',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8 text-sm text-gray-300 font-inter">
      <h1 className="font-rajdhani text-3xl font-bold text-white">Terms of Service</h1>
      <p className="text-gray-400">Last updated: March 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">1. Platform Overview</h2>
        <p>WaveWarZ is a decentralized music battle platform built on Solana. Artists compete in timed battles; fans trade ephemeral tokens on outcomes. All trades are denominated in SOL. By using WaveWarZ you agree to these terms.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">2. Eligibility</h2>
        <p>You must be at least 18 years old and legally permitted to participate in prediction-style entertainment activities in your jurisdiction. You are solely responsible for determining whether your use of this platform complies with applicable local laws.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">3. Trading & Tokens</h2>
        <p>Tokens purchased during a battle are ephemeral — they are destroyed when the battle concludes. WaveWarZ does not guarantee any return on tokens purchased. All transactions are irreversible on the Solana blockchain. Traders must manually claim payouts by clicking the Withdrawal button on the battle page. Unclaimed funds can be recovered at <a href="https://claim.wavewarz.info" className="text-[#95fe7c] underline">claim.wavewarz.info</a>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">4. Fees</h2>
        <p>A 1.5% fee applies to all trades (1.0% to the artist, 0.5% to the platform). Additional fees apply for launching battles and skipping the Quick Battle queue. All fees are disclosed before transactions are confirmed.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">5. Artist Payouts</h2>
        <p>Artists receive automatic SOL payouts to their linked wallet upon battle settlement. WaveWarZ is not responsible for incorrect wallet addresses submitted by artists or users.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">6. Content</h2>
        <p>By submitting music, clips, or other content to WaveWarZ, you confirm you own or have the rights to that content. WaveWarZ may use submitted content for promotional purposes including YouTube, X (Twitter), and TikTok.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">7. No Guarantees</h2>
        <p>WaveWarZ is an entertainment platform. We do not guarantee earnings, platform uptime, or battle outcomes. Participation is at your own risk.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">8. Prohibited Conduct</h2>
        <p>You may not manipulate trading activity, exploit platform bugs for financial gain, or use automated bots to interfere with battles. Violations may result in permanent bans.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">9. Changes</h2>
        <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">10. Contact</h2>
        <p>Questions? Reach us at <a href="https://wavewarz.com" className="text-[#95fe7c] underline">wavewarz.com</a> or via X at <a href="https://x.com/wavewarz" className="text-[#95fe7c] underline">@WaveWarZ</a>.</p>
      </section>
    </div>
  )
}
