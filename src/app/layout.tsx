import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Outfit, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import './site-shell.css'
import { SiteNav } from '@/components/site-nav'
import { WaveStrands } from '@/components/wave-strands'
import { SiteFooter } from '@/components/site-footer'
import { IgniteRadio } from '@/components/ignite-radio'
import { AdClickCapture } from '@/components/ad-click-capture'
import { Analytics } from '@vercel/analytics/next'

// The redesign's three faces, the same as wavewarz.com: Space Grotesk (display, font-display), Outfit (body, font-sans),
// JetBrains Mono (numbers and labels, font-mono). No other fonts are loaded.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-grotesk',
})

const body = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
})

// Phones: paint under the notch and home bar (the fixed nav and radio bar pad back out with env()), black browser chrome
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://wavewarz.info'),
  title: {
    default: 'WaveWarZ Statz',
    template: '%s | WaveWarZ Statz',
  },
  description: 'Every battle. Every number. ONCHAIN. Verifiable analytics for WaveWarZ — decentralized music battles on Solana.',
  alternates: { canonical: '/' },
  keywords: ['WaveWarZ', 'music battles', 'Solana', 'onchain analytics', 'music trading', 'Audius', 'quick battles'],
  openGraph: {
    title: 'WaveWarZ Statz',
    description: 'Every battle. Every number. ONCHAIN.',
    siteName: 'WaveWarZ Statz',
    url: 'https://wavewarz.info',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'WaveWarZ' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@wavewarz',
    title: 'WaveWarZ Statz',
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
      name: 'WaveWarZ Statz',
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
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans antialiased min-h-screen flex flex-col pb-24 overflow-x-clip`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* X (Twitter) Ads conversion tracking — pixel ID reaex */}
        <Script id="x-pixel" strategy="afterInteractive">
          {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
          },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
          a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
          twq('config','reaex');`}
        </Script>
        <AdClickCapture />
        <WaveStrands />
        <SiteNav />
        <main className="max-w-[1320px] mx-auto px-4 sm:px-5 py-8 flex-1 w-full">
          {children}
        </main>
        <IgniteRadio />
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
