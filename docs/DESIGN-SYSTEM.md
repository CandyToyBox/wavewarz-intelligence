# WaveWarZ Design System v1.0

Extracted 2026-07-20 from the working homepage redesign prototype. Living version (with
rendered specimens, code snippets, and a signature "Arena" demo) published here:

**https://claude.ai/code/artifact/e9ef036f-61d2-4785-be94-1e1bd421af26**

This document is the text/searchable companion — copy tokens directly from here into
`~/wavewarz-base/FRONTEND-DESIGN-SYSTEM.md` or a Tailwind config. Nothing here is
theoretical: every value has already rendered in a browser and been checked for
contrast (WCAG AA) inside the homepage prototype and founder video.

---

## Color

| Token | Hex / value | Usage |
|---|---|---|
| `--void` | `#080d17` | Deepest ground — empty states, timer-ring backdrop, tug-bar track |
| `--bg` | `#0d1321` | Page background, everywhere |
| `--card` | `#111a2c` | Chip backgrounds, small inset surfaces |
| `--card-2` | `#0f1626` | Primary card surface — panels, queue cards, stat cards |
| `--line` | `rgba(126,193,251,.14)` | All hairline borders |
| `--green` | `#95fe7c` | THE accent. Primary CTAs, success, "go," live indicators |
| `--green-dim` | `rgba(149,254,124,.14)` | Green chip backgrounds |
| `--blue` | `#7ec1fb` | Secondary / informational — links, Side A identity, data |
| `--blue-dim` | `rgba(126,193,251,.12)` | Blue hover backgrounds |
| `--ice` | `#daecfd` | Primary body text on dark surfaces |
| `--mut` | `#8b97ab` | Secondary / muted text, captions, timestamps |
| `--red` | `#ef4444` | Sell actions & Artist A identity ONLY — never required/positive |

**Hard rule: zero purple, in any shade, anywhere.** The current wavewarz.com uses purple
for the "Create Quick BattleZ" button, the battle-explainer modal, the Farcaster share
button, and winner overlays — all four are violations to fix, not styles to preserve.

## Typography

Three faces, three jobs:

- **Rajdhani** (600/700) — the arena voice: condensed, always uppercase, for anything
  that should feel like a scoreboard (headlines, section titles, stat numbers rendered
  as display text).
- **Inter** (400/500/600/700) — carries every sentence a human reads (body copy,
  descriptions, card meta).
- **JetBrains Mono** (500/700) — reserved for data, labels, and system state: kickers,
  onchain numbers, timestamps, queue positions. Signals "this is real, not decoration."
  Always paired with `font-variant-numeric: tabular-nums` on digits.

```css
--disp: 'Rajdhani', sans-serif;
--body: 'Inter', system-ui, sans-serif;
--mono: 'JetBrains Mono', ui-monospace, monospace;
```

Rules:
- Headlines are always uppercase, never title-case.
- Kickers: `font-size: .68–.72rem; letter-spacing: .24–.3em; text-transform: uppercase;`
  in mono, colored `--mut` (or `--green` when paired with a live ping dot).
- Body max-width ~60ch for readability.

## Spacing & Radius

Section padding uses `clamp()` so the arena breathes on desktop and stays honest on
mobile:

| Rhythm | Range |
|---|---|
| tight | `1.6rem → 2.6rem` |
| standard | `2.5rem → 4.5rem` |
| close | `3rem → 5rem` |

Border radius scales with a component's visual "weight":

| Radius | Component |
|---|---|
| 8px | chip |
| 14px | button |
| 16px | card |
| 22px | feature card (featured battle) |
| 26px | the Arena hero |
| 999px | pill (wallet chip, live-chip, queue position) |

## Motion — three primitives, nothing else animates

1. **Ping** (`@keyframes ping { 75%,100% { transform: scale(2.6); opacity: 0; } }`,
   1.4–1.6s) — the "this is live" signal. Used on exactly one dot per view.
2. **Equalizer** (`@keyframes eq { 0%,100% { height: 14%; } 50%{ height: 88%; } }`,
   staggered per bar, .75–1.15s) — "music is playing." Only on the currently-playing
   side's album art, never both sides at once.
3. **Hover lift + glow** — every clickable surface: `transition: transform .35s
   cubic-bezier(.34,1.56,.64,1), box-shadow .3s;` then `transform: scale(1.05)` +
   glow shadow on hover. Never animate via opacity alone.

All motion respects `prefers-reduced-motion: reduce`.

## Components

### Buttons
- **Primary (`.btn-green`)** — solid green, black text, glow shadow. One per screen.
- **Ghost (`.btn-ghost`)** — blue outline, transparent fill. Secondary paths.
- **Mute (`.btn-mute`)** — dim outline, muted text. Lowest-commitment option only
  ("just watching," dismiss) — never a path you actually want people to take.

### Chips & kickers
- `.kicker` — mono, tracked-out eyebrow, optional ping dot.
- `.live-chip` — pill, green border/glow, ping dot, for "LIVE" states.
- `.pill-chip` — plain mono pill for factual tags (judge criteria, genre).
- `.pos-chip` — small mono badge for queue position (NEXT, #2, #3…).

### Cards
- **Queue/battle card** — album art pair with "VS" overlay, meta below, position badge,
  hover lift.
- **Story panel** — villain/guide dual layout: `.dark` variant (red-tinted border) for
  the problem, `.win` variant (green-tinted border) for the resolution.
- **Stat card** — big Rajdhani number, small mono/body caption underneath.
- **Step card** — numbered (01/02/03) only for genuinely sequential processes.

### The Arena (signature component)
The live-battle hero that replaces "which screenshot goes at the top of the homepage"
forever. Data-driven fallback chain: `quickActive[0]` → `activeBattles[0]` →
`featuredBattle` → static brand hero. Built from:
- Two square album-art panels, rotated ±2.2° away from center, straightening on hover.
- A glowing green countdown ring with mono tabular digits.
- A blue-vs-green "crowd meter" gradient bar showing live pool sizes.
- An equalizer animation on whichever side is currently playing.
- One green "Jump into Battle" CTA at the center.

### Before/After (pitch pattern)
Born in the founder video, reusable for any redesign argument: old screen desaturated
on the left tagged BEFORE (red-tinted tag), new screen full-color on the right tagged
AFTER (green-tinted tag), one caption underneath naming the fix.

### Section rhythm
Every content section opens the same way: `kicker/h2` + flex-1 hairline `.rule` +
optional mono link on the right. This is what lets a reader's eye always find where a
new idea starts.

## Content / Voice Rules

Sourced from the StoryBrand audit (current site scored ~4/10; redesign copy scored
9.5/10):

1. **ONCHAIN is one word**, capitalized when doing brand work. Never "on-chain."
2. **No emojis** — chips and kickers use text and the ping dot only.
3. **The customer is the hero.** "You put SOL behind the one you believe in," never
   "WaveWarZ lets you trade."
4. **Name the villain, not the feature.** "Streams pay fractions of a cent" beats "we
   have better economics."
5. **Numbers are always provable** — every stat should link to wavewarz.info or name
   its source.
6. **Numbered steps (01/02/03) mean a real sequence** — never decorative.

## Do / Don't (from the July 2026 UX audit — not hypothetical)

| Situation | Do | Don't (found live on wavewarz.com) |
|---|---|---|
| Async action | idle → waiting-for-wallet → confirming → success/error, one state at a time | Two "Preparing transaction…" toasts at once, no wallet-wait state |
| Required action button | Green, confident: "Settle Battle & Unlock Withdrawals" | Giant red "End Battle" button reading as a warning |
| Winner overlay | Green, appears only once winner is decided | Purple "Winner" banner above "no winner has been decided" |
| Song catalog | Genre chips, search, preview player, sticky matchup bar | 51 alphabetical pages, no filter, no preview |
| Any button | Green (primary) or blue outline (secondary) | Purple — Create Quick BattleZ, Farcaster share, battle-explainer modal |
| Settlement result | Exact SOL amount, one green Claim button | "-0.000 SOL" / "-32.50%" in red for a trader who won |

## Sources

- Living style guide: https://claude.ai/code/artifact/e9ef036f-61d2-4785-be94-1e1bd421af26
- Homepage prototype: https://claude.ai/code/artifact/f068b749-d557-4688-8a48-f87bfe46d5fb
- Blueprint compatibility: `HOMEPAGE-REDESIGN-SPEC.md` (this folder)
- Original hand-off doc: `~/wavewarz-base/FRONTEND-DESIGN-SYSTEM.md` (Hurricane's spec —
  this system refines its tokens with real-world-tested values, does not replace it)
