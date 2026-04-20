import type { Metadata } from 'next'
import { Rajdhani, Inter, Geist_Mono } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/nav-bar'

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
  title: 'WaveWarZ Intelligence',
  description: 'Every battle. Every number. ONCHAIN. Verifiable analytics for WaveWarZ — decentralized music battles on Solana.',
  openGraph: {
    title: 'WaveWarZ Intelligence',
    description: 'Every battle. Every number. ONCHAIN.',
    siteName: 'WaveWarZ Intelligence',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WaveWarZ Intelligence',
    description: 'Every battle. Every number. ONCHAIN.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${rajdhani.variable} ${inter.variable} ${geistMono.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
          {children}
        </main>
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
