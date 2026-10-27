export const metadata = {
  title: 'Data Deletion — WaveWarZ',
}

export default function DataDeletionPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8 text-sm text-gray-300 font-inter">
      <h1 className="font-rajdhani text-3xl font-bold text-white">User Data Deletion</h1>
      <p className="text-gray-400">Last updated: October 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">1. What You Can Ask Us to Delete</h2>
        <p>You can ask WaveWarZ to delete the off-chain data we hold about you, including any Facebook, Instagram, Threads, YouTube, X, or TikTok account information and access tokens collected when a social account was connected to WaveWarZ tools, plus clips, captions, and notes you submitted.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">2. How to Request Deletion</h2>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Send a direct message to <a href="https://x.com/wavewarz" className="text-[#95fe7c] underline">@WaveWarZ</a> on X with the subject &quot;Data deletion request&quot;.</li>
          <li>Include the social account name (for example, your Instagram or Facebook handle) or the Solana wallet address the request is about, so we can find your records.</li>
          <li>We will confirm by reply once the data is deleted. Requests are handled within 30 days.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">3. Disconnect Without Contacting Us</h2>
        <p>You can remove WaveWarZ&apos;s access to your Facebook or Instagram account at any time. In Facebook, go to Settings, then Business Integrations, find the WaveWarZ app, and choose Remove. For Instagram, open Settings, then Website permissions or Apps and Websites, and remove the app. Removing the app stops all posting on your behalf and revokes its access token.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">4. What We Cannot Delete</h2>
        <p>Trades, payouts, and battle results are recorded on the Solana blockchain and are public by design. WaveWarZ cannot delete or modify onchain data. Content already published to a social platform from a WaveWarZ channel must be removed on that platform.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">5. More Information</h2>
        <p>See our <a href="/privacy" className="text-[#95fe7c] underline">Privacy Policy</a> for how we collect and use data.</p>
      </section>
    </div>
  )
}
