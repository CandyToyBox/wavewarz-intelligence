import { Space_Grotesk, Outfit, JetBrains_Mono } from 'next/font/google'

// The WaveWarz Rebrand System's three families (display, text, data). Loaded
// only where a WavID surface mounts, and scoped through the `.ww` wrapper, so
// the rest of the site keeps Rajdhani/Inter until the redesign lands.
const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--ww-font-display' })
const sans = Outfit({ subsets: ['latin'], weight: ['400', '600'], variable: '--ww-font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--ww-font-mono' })

export const wwFontClass = `${display.variable} ${sans.variable} ${mono.variable}`
