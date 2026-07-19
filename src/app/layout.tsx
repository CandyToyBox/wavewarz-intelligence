import type { Metadata } from 'next'
import { Rajdhani, Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/nav-bar'
import { IgniteRadio } from '@/components/ignite-radio'

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-rajdhani',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://wavewarz.info'),
  title: {
    default: 'WaveWarZ Intelligence',
    template: '%s | WaveWarZ Intelligence',
  },
  description: 'Every battle. Every number. ONCHAIN. Verifiable analytics for WaveWarZ — decentralized music battles on Solana.',
  alternates: { canonical: '/' },
  keywords: ['WaveWarZ', 'music battles', 'Solana', 'onchain analytics', 'music trading', 'Audius', 'quick battles'],
  openGraph: {
    title: 'WaveWarZ Intelligence',
    description: 'Every battle. Every number. ONCHAIN.',
    siteName: 'WaveWarZ Intelligence',
    url: 'https://wavewarz.info',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'WaveWarZ' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@wavewarz',
    title: 'WaveWarZ Intelligence',
    description: 'Every battle. Every number. ONCHAIN.',
    images: ['/og-card.png'],
  },
}

// AEO/GEO: structured data for search engines and AI agents.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://wavewarz.info/#org',
      name: 'WaveWarZ',
      url: 'https://wavewarz.com',
      logo: 'https://wavewarz.info/og-card.png',
      sameAs: ['https://x.com/wavewarz', 'https://wavewarz.com', 'https://wavewarz.info'],
      description:
        'Decentralized music battle platform on Solana. Artists go head-to-head in timed battles while fans trade on who they think will win. Artists earn from trading volume the moment a battle settles — all onchain.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://wavewarz.info/#site',
      name: 'WaveWarZ Intelligence',
      url: 'https://wavewarz.info',
      publisher: { '@id': 'https://wavewarz.info/#org' },
      description:
        'Verifiable onchain analytics for WaveWarZ music battles: volume, pools, payouts, leaderboards, and a public API.',
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${rajdhani.variable} ${inter.variable} ${geistMono.variable} font-sans antialiased min-h-screen flex flex-col pb-24`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
          {children}
        </main>
        <IgniteRadio />
        <footer className="border-t border-border mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} WaveWarZ. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="https://wavewarz.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">wavewarz.com ↗</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
