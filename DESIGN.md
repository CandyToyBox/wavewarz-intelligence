---
name: WaveWarZ Statz
description: The public, verifiable record of WaveWarZ music battles, on the night-broadcast brand system.
colors:
  action-green: "#95fe7c"
  wave-blue: "#7ec1fb"
  wave-aqua: "#76f3df"
  oxide-amber: "#f2a74b"
  sodium: "#e5c25a"
  ice: "#daecfd"
  stage-black: "#000000"
  smoked-panel: "#070a10"
  panel-inset: "#0c121c"
  deep-navy: "#0d1321"
  ink: "#e8f1fb"
  ink-soft: "#b6c3d1"
  ink-muted: "#8d9bb0"
  on-accent: "#06090f"
  alert-red: "#ef4444"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  number:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.15
    fontFeature: "tnum"
rounded:
  cover: "14px"
  card: "18px"
  tile: "22px"
  panel: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  chip:
    backgroundColor: "rgba(255, 255, 255, .03)"
    textColor: "{colors.ice}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "38px"
  chip-selected:
    backgroundColor: "rgba(149, 254, 124, .12)"
    textColor: "{colors.action-green}"
    rounded: "{rounded.pill}"
  button-solid:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "46px"
  button-solid-hover:
    backgroundColor: "#b6ffa4"
  button-ghost:
    backgroundColor: "rgba(255, 255, 255, .03)"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "46px"
  input:
    backgroundColor: "rgba(255, 255, 255, .03)"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "46px"
  card:
    backgroundColor: "{colors.smoked-panel}"
    textColor: "{colors.ice}"
    rounded: "{rounded.card}"
    padding: "20px"
  receipt:
    backgroundColor: "transparent"
    textColor: "{colors.wave-blue}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
---

# Design System: WaveWarZ Statz

## Overview

**Creative North Star: "The Night Broadcast"**

WaveWarZ Statz looks like a live music show at night. The stage is black, a slow field of thin Wave ID strands drifts behind everything, and the hardware (panels, the nav shell, the logo) is smoked glass with polished chrome edges. The only real color comes from the artists themselves: Wave ID accents, album art, battle flyers. Numbers are set like a broadcast scoreboard, in tabular mono, big where they answer a question and quiet where they support one.

The system is dense but ranked. This is a record people read for results and earnings, so the hierarchy does the work: one result line, two big numbers per side, everything else in smaller rows that are present but never competing. Cards feel like hardware: thick smoked panels, a strong chrome rim, confident blue and green accents on the parts that matter (the winner in their side color, the selected filter, the earned total).

The look rejects the old v1 brand (Rajdhani, Inter, navy with orange) and neon. Light comes from color and chrome, not from glowing halos. The one exception is something happening live right now.

**Key Characteristics:**
- Black stage with a drifting Wave ID strand background and a soft vignette.
- Smoked panels with a chrome top edge; pill-shaped controls everywhere.
- Side A is always wave blue, side B always action green, the platform always oxide amber.
- Numbers in JetBrains Mono with tabular figures; labels in small uppercase mono.
- The WaveWarZ icon set beside labels, never emoji or unicode glyphs.

## Colors

A black stage lit only by the Wave ID palette, with chrome for the hardware.

### Primary
- **Action Green** (action-green): side B of every battle, the selected chip and primary buttons. The one interface color that means "yes, this".

### Secondary
- **Wave Blue** (wave-blue): side A of every battle, links and onchain receipts, secondary accents.

### Tertiary
- **Oxide Amber** (oxide-amber): the WaveWarZ platform's share, pending and attention states. Replaces every old orange and yellow.
- **Wave Aqua** (wave-aqua) and **Sodium** (sodium): extra Wave ID accents for board and event identities (Community board, Benefit and Spotlight events, Clippers board).

### Neutral
- **Stage Black** (stage-black): the page itself.
- **Smoked Panel** (smoked-panel): card and panel bodies, drawn as a gradient from rgba(14, 21, 34, .92) to rgba(7, 10, 16, .95).
- **Panel Inset** (panel-inset): image wells, avatar fallbacks, inner surfaces.
- **Deep Navy** (deep-navy): the legacy brand navy, kept for share images and partner assets.
- **Ice** (ice): primary text on panels. **Ink** (ink) is body text on the stage.
- **Ink Soft** (ink-soft): descriptions and secondary copy.
- **Ink Muted** (ink-muted): labels, units, dollar values under SOL figures. Never below 4.5:1 on its surface; no opacity tricks.
- Borders are ice at low alpha: rgba(216, 235, 252, .08) for dividers, .14–.16 for panel edges, .3 for ghost controls.

### Named Rules
**The Fixed Sides Rule.** Side A is wave blue and side B is action green on every card, chart and table, whatever the song or artist. Color follows the side, never a hash of the name.

**The Artist Is The Light Rule.** Saturated color belongs to Wave IDs, artwork and the side accents. Backgrounds, panels and body text stay neutral.

**The No Purple Rule.** No purple, violet or pink in any UI element. Artwork supplied by artists or partners is content and stays as it is.

## Typography

**Display Font:** Space Grotesk (fallback sans-serif)
**Body Font:** Outfit (fallback sans-serif)
**Label/Mono Font:** JetBrains Mono (fallback monospace)

**Character:** Space Grotesk gives headlines and names a confident, slightly technical voice; Outfit keeps reading soft and friendly; JetBrains Mono turns every number and label into broadcast readout.

### Hierarchy
- **Display** (700, clamp(2.4rem, 5vw, 3.6rem), 1): page titles, set uppercase in the board header, the second word in the board's accent color.
- **Headline** (700, 1.3rem, 1.15): the result line on a battle card ("circles wins 2–1").
- **Title** (700, 1.15rem, 1.2): song and artist names, card titles.
- **Body** (400, 1rem, 1.55): descriptions and explainers, max about 72ch.
- **Label** (600, 0.68–0.72rem, 0.1–0.14em, uppercase): kickers, table row labels, stat labels.
- **Number** (700, 1.25rem tier-1 down to 0.8rem in tables, tabular figures): SOL amounts, counts, votes. Dollar values sit underneath in 400 weight, ink muted.

### Named Rules
**The Three Faces Rule.** Space Grotesk, Outfit and JetBrains Mono only. Rajdhani, Inter and Geist are retired everywhere, including share images and embedded pages.

**The Readout Rule.** Every number uses tabular figures, and every SOL amount carries the ◎ sign once, never "◎0.15 SOL".

## Layout

Content sits in a centered column up to 1320px wide with 20px side gutters (16px on phones) under a floating pill nav and a scrolling row of section chips. Pages open with the board header: a mono kicker, the display title, a one-line explainer, and an aside of key counts on the right.

Spacing steps are 6, 8, 12, 16, 20 and 24px; cards stack 16px apart and use 20px inner padding. Battle cards are a three-column scoreboard (side A, result, side B) that becomes result-first then two columns under 900px, and the earnings table becomes a compact three-column list under 640px. Nothing scrolls sideways on a phone except the chip rails, which fade at their edge.

**The Receipt Last Rule.** Every battle card ends with a wrapping row of receipts (Verify Onchain, Battle account, battle page). They are never hidden in a header where a phone can clip them.

## Elevation & Depth

Depth comes from layered smoked surfaces and soft offset shadows, with chrome as the light-catching edge. There are no colored halos at rest.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 24px 60px rgba(0, 0, 0, .45), inset 0 1px 0 rgba(255, 255, 255, .08)`): cards and panels.
- **Object** (`box-shadow: 0 14px 28px rgba(0, 0, 0, .5)`): album covers and flyers.
- **Ring** (`box-shadow: 0 8px 18px rgba(0, 0, 0, .55)`): avatars, Wave ID rings and badges.
- **Solid button** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), 0 8px 22px rgba(0, 0, 0, .45)`).

### Named Rules
**The Chrome Rim Rule.** Every panel carries a 2px chrome edge along its top, inset 20px from each side: `linear-gradient(145deg, #f6fbff 0%, #aebccb 17%, #5a6b7e 40%, #dbe6ef 57%, #6d7e91 76%, #2c3746 100%)`. Avatars and Wave ID badges sit in a chrome ring of the same gradient.

**The Live Glow Rule.** A colored glow is allowed only on something happening live right now (a battle in progress, the live mix). Finished battles, winners and buttons never glow; they use a solid accent border instead.

## Shapes

Controls are pills (999px). Panels are generously rounded: 18px for cards, 22px for tiles and lookup panels, 28px for hero panels and board cards. Album covers use 14px corners; avatars, Wave ID art and status dots are full circles. Borders are 1px ice at low alpha; a winner's cover gets a 2px border in its side color.

## Components

### Buttons
- **Shape:** pill (999px), 46px tall, 24px side padding, Space Grotesk 700 uppercase with 0.06em tracking.
- **Solid:** action green on near-black text with the solid button shadow; hover lightens to #b6ffa4 and lifts 1px; press scales to 0.97.
- **Ghost:** near-transparent with a 30% ice border; hover turns the border action green over an 8% green wash.
- **Blue:** wave blue text on an 8% blue wash with a 40% blue border, for secondary links.

### Chips
- **Style:** pill, 38px (32px small), Outfit 500, ice text on a 3% white wash with a 16% ice border. A set icon may lead the label.
- **State:** selected (aria-current or aria-pressed) is action green text on a 12% green wash with a 55% green border. Hover only on fine pointers.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** the smoked panel gradient.
- **Shadow Strategy:** Panel shadow plus the Chrome Rim.
- **Border:** 1px ice at 16%.
- **Internal Padding:** 20px (16px on phones).

### Inputs / Fields
- **Style:** pill, 46px tall, 3% white wash, 18% ice border, JetBrains Mono for wallets and IDs.
- **Focus:** border turns action green at 60%; keyboard focus on links and buttons shows a 2px action green outline offset 2px.
- **Disabled:** 35% opacity, not-allowed cursor.

### Navigation
- **Style:** a floating pill shell with the WaveWarZ logo, Space Grotesk links and a solid green Connect Wallet button. Under it, a horizontal rail of section chips with the current page selected. On phones the links collapse behind a menu button and the rail scrolls.

### Battle Scoreboard (signature)
A battle card is a two-side scoreboard. Each side shows cover art (112px, 14px corners) with the artist's Wave ID badge on the corner, a Winner tag with the trophy icon, the name, the Audius handle with profile picture, then two tier-1 numbers: Final pool and Artist earned. The middle shows the result line ("circles wins 2–1") and three factor rows (Charts, Poll, DJ Wavy), each with its icon and a dot in the side color it went to. Below sit a one-line summary (Traded, Spotify equivalent), the earnings ledger (artist A, artist B, platform × Traded, Trading fee, Settlement, Earned, Spotify equivalent, Wallet) and the receipts row.

### Wave ID Ring (signature)
An artist's profile picture sits inside a circle of their own Wave ID art. With no Wave ID drawn yet, the ring is chrome and the fallback is the artist's initial in their side color.

## Do's and Don'ts

### Do:
- **Do** keep side A wave blue and side B action green on every card, table and chart.
- **Do** put the WaveWarZ set icon beside a label wherever one fits (filters, types, factors, row labels, receipts).
- **Do** show every number, ranked: tier-1 figures at 1.1–1.3rem mono in the side color, supporting figures at 0.8–0.9rem, dollars underneath in ink muted.
- **Do** end every battle with its receipts row and give every wallet its owner's name, a Solscan link and a copy button.
- **Do** use the chrome rim on panels and chrome rings on avatars.

### Don't:
- **Don't** use Rajdhani, Inter, Geist or any font beyond the three faces.
- **Don't** use purple, pink or violet, or the old Tailwind orange and yellow; use oxide amber.
- **Don't** add colored glows or halos to finished content; glows are for live moments only.
- **Don't** use emoji or unicode check, cross and tree characters as icons.
- **Don't** set functional text below 11px or fade labels with opacity until they fail contrast.
- **Don't** describe a pool size as why someone won; the result line states the decided result.
