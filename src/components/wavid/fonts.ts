import { Space_Grotesk, Outfit, JetBrains_Mono } from 'next/font/google'

// The WaveWarz Rebrand System's three families (display, text, data). Loaded
// (variable fonts: no weight list, which Turbopack's font loader rejects)
// only where a WavID surface mounts, and scoped through the `.ww` wrapper, so
// the rest of the site keeps Rajdhani/Inter until the redesign lands.
const display = Space_Grotesk({ subsets: ['latin'], variable: '--ww-font-display' })
const sans = Outfit({ subsets: ['latin'], variable: '--ww-font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--ww-font-mono' })

export const wwFontClass = `${display.variable} ${sans.variable} ${mono.variable}`
