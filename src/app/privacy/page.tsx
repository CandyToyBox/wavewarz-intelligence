export const metadata = {
  title: 'Privacy Policy — WaveWarZ',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8 text-sm text-gray-300 font-inter">
      <h1 className="font-rajdhani text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="text-gray-400">Last updated: March 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">1. What We Collect</h2>
        <p>WaveWarZ collects the following data when you use the platform:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Solana wallet address (required for trading and payouts)</li>
          <li>Battle participation and trading activity (onchain, publicly visible)</li>
          <li>Social media account identifiers when you connect platforms (YouTube, X, TikTok)</li>
          <li>Content you submit (clips, captions, context notes)</li>
          <li>Basic usage data (page views, feature interactions)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">2. How We Use Your Data</h2>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Process trades and distribute payouts to your wallet</li>
          <li>Display leaderboards, battle stats, and analytics</li>
          <li>Publish approved video clips to connected social channels (YouTube, X, TikTok)</li>
          <li>Send platform notifications via Telegram (if opted in)</li>
          <li>Improve platform performance and detect abuse</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">3. Social Media Integrations</h2>
        <p>When you connect a social account (YouTube, X, TikTok) to WaveWarZ tools, we use OAuth tokens to post content on your behalf. We access only the scopes you authorize. We do not sell or share your social account credentials or data with third parties. You can revoke access at any time through the respective platform&apos;s account settings.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">4. Blockchain Data</h2>
        <p>All trades, payouts, and battle outcomes are recorded on the Solana blockchain and are publicly visible by design. WaveWarZ cannot delete or modify onchain data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">5. Data Storage</h2>
        <p>Off-chain data (battle metadata, leaderboards, submitted clips) is stored in a secured database. We use industry-standard security practices and do not store private keys or seed phrases.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">6. Third-Party Services</h2>
        <p>We use third-party services including Helius (Solana RPC), Supabase (database), Vercel (hosting), and Railway (infrastructure). Each service operates under its own privacy policy.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">7. Your Rights</h2>
        <p>You may request deletion of your off-chain data by contacting us. Onchain data cannot be deleted. You may disconnect social accounts at any time.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">8. Contact</h2>
        <p>Privacy questions? Reach us at <a href="https://wavewarz.com" className="text-[#95fe7c] underline">wavewarz.com</a> or via X at <a href="https://x.com/wavewarz" className="text-[#95fe7c] underline">@WaveWarZ</a>.</p>
      </section>
    </div>
  )
}
