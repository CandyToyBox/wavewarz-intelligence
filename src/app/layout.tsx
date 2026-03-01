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
  description: 'The verifiable analytics engine for WaveWarZ — decentralized music battles on Solana.',
  openGraph: {
    title: 'WaveWarZ Intelligence',
    description: 'Back Music, Not Memes.',
    siteName: 'WaveWarZ',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${rajdhani.variable} ${inter.variable} ${geistMono.variable} font-sans antialiased min-h-screen`}>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
