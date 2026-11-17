# WaveWarz homepage: Candy's working copy

Your copy to edit. Started 2026-10-16 from AttaBotty's latest page:
- repo CandyToyBox/wavewarz-intelligence, branch feat/new-wavewarz-site-and-content (same tip as iteration/royal-3d-master), commit b981ea7 (2026-10-14 12:17 ET), file public/index.html

Nothing here is connected to the repo, so edits cannot touch AttaBotty's branches or wavewarz.info.
Untouched reference copy for comparing: ~/wavewarz-homepage-draft/ (do not edit that one).
See your changes any time: `git diff` in this folder.

Preview: in this folder run `python3 -m http.server 8781`, open http://127.0.0.1:8781/
(Port 8765 is used by the older prototype server; 8780 serves the reference copy.)

---

## audius-search.html (Candy's redesign of wavewarz.com/audius/search, 2026-10-28)

Standalone page built from the WaveWarz Rebrand System (Quick Battlez setup, reserved and launched modules). Open it at http://localhost:8781/audius-search.html. It reads the live catalog from `https://www.wavewarz.com/api/audius/tracks?limit=24&offset=N&q=...` and `/api/audius/artists?page=N&limit=20`. That API only allows the origin `http://localhost:3002`, so on any other local port the page falls back to `audius-catalog.sample.json` (first 240 tracks) and `audius-artists.sample.json` and labels itself "Sample catalog". Serve it from port 3002 to see the live catalog.

Hooks for the live app (set `window.WW.<name>` before the script runs; the prototype defaults only simulate):
- `connectWallet()`, `resyncAudius()`
- `checkAvailability(trackG, trackB)` returns a promise of true/false (the live page's "Checking Audius track availability" step)
- `reserve(trackG, trackB)` returns a promise of `{ position, skipPrice }` after the wallet confirms the add-to-queue fee

Filters at the top (Candy, 2026-10-28): Genre chips and Leaderboard chips (Most wins, Best win rate, Most battles, Most volume, Not yet battled). The WaveWarz catalog API has no genre and no server-side sort or filter, so on load the page builds a full index in the background: all catalog pages (24 per request), genre for every track from the Audius API (`api.audius.co/v1/tracks?id=...`, 100 ids per request), and wins, battles and volume from `wavewarz.info/api/public/leaderboards/songs`, matched by Audius link. The index is cached in localStorage for 6 hours; after that, search, sort, filters and paging all run on the full catalog in the browser. Hurricane can replace this by storing genre on each catalog track and adding sort and filter parameters to `/api/audius/tracks`. The artist chips from the old page were replaced by these filters; searching `@handle` still finds an artist's songs.

Wave ID background on audius-search.html: `wave-id/` holds Quan's loop (`wave-id-loop-ice.mp4`, plays muted, 4 second loop, screen blend) and the green, ice and aqua stills. The loop sits fixed behind the page at the top right. Inside the matchup panel a green Wave ID fades in behind the green side and an ice one behind the blue side once a song is picked. Reduced motion shows the still instead of the video.

**Wave IDs on the setup page (update):** the fixed background layer now has two loops (top right, and a mirrored one bottom left) plus ice, green and aqua stills bleeding in from the edges. The catalog (`#browse`) sits on a solid #070b14 panel so nothing shows through the rows.

## Stats app pages with Wave IDs (branch `wavid-ui-prototype`)

A separate prototype of the WaveWarz Intelligence (Statz) app, styled from the WaveWarz Rebrand System, with each artist's Wave ID drawn from their public WaveWarz record.

- **Branch:** `wavid-ui-prototype` on CandyToyBox/wavewarz-intelligence. Design prototype, not for merge as is.
- **Pages:** `/artist/[id]` (Wave ID as the hero image), `/leaderboards/artists` (Wave ID mark on every row), `/battles/[id]` (two Wave IDs head to head).
- **How it works:** a vendored copy of Quan's WavID core and renderer in `src/lib/wavid/`, a roster resolver, and an image route at `src/pages/api/wavid-art/[handle].ts` that serves each Wave ID as SVG or small PNG.
- **Labels:** each Wave ID card says "Public observation" and "Artist control unverified". Keep that wording.
- **Run it:** check out the branch, install, `npm run dev`. The pages read live battle data, so they need the app's environment variables.
- **Preview:** screenshots of the three pages are on the shared preview page, because they cannot run as static files.

## Wave ID orb preview (battle setup page)
Each picked song now shows a Wave ID preview under its title: Quan's aqua texture as an orb on a blueprint grid, with three callouts (song, battles, win ratio and volume) read from the song's own battle record. A song with no record says "None yet" and "Not yet battled". The full-size design study is `wave-id-display.html`. Backup of the page before this change is in the session scratchpad (`audius-search.before-orb.html`). Not yet pushed to GitHub.

## Homepage copy rewrite (from homepage-copy.docx, Nov 11 2026)
`index.html` now carries the rewritten copy and the sections the draft was missing, in this order: header (Watch live chooser, Schedule, How it works, For Artists, Stats, Merch, Select Wallet), hero, stats strip, **Tonight / Next up**, **How it works** (3 steps) then the Ride the WaveWarZ walkthrough, **For music lovers**, **For traders**, **For musicians**, **Live and upcoming BattleZ** (existing Quick BattleZ modules, relabelled), **Community BattleZ**, **Past BattleZ**, DJ Wavy, stats, **FAQ** (10 questions), **Get battle alerts**, footer. SEO title, description and OG tags are set.

Nothing invents a schedule. To publish a show, fill the `SHOW` object at the top of `<script id="copy-rewrite-js">` (day, one locked ET time, type, artists, songs, listen and battle links, optional single watch URL). Until then Tonight says "Nothing booked", unless the public API shows a Featured battle live now (Tonight switches to "Live now") or one that ended in the last 12 hours ("Battle ended"). Preview the four states with `?tonight=live`, `?tonight=upcoming`, `?tonight=ended`, `?tonight=none` (sample data, labelled).
Past BattleZ read `wavewarz.info/api/public/events` and `/battles?type=quick`. Community BattleZ shows only its empty state (no community feed is wired). The marquee no longer names a Sunday time. Backup of the page before this change is in the 2026-11-11 session scratchpad (`index.before-copy-rewrite.html`).

## Guided onboarding is now the main "How it works" (onboarding.html, embedded on the homepage)
The written How it works steps and the three audience sections were replaced by one embedded flow with DJ Wavy: `index.html` section `#how-it-works` holds an iframe of `onboarding.html`. Lanes in order: Listener (start here, free: listen, get a wallet, vote), Artist, Trader (opens by pointing people to vote first), Host. Everyone gets the same three short basics first. `#for-artists`, `#for-traders` and `#for-fans` open that lane in the frame; `onboarding.html?lane=artist` does the same standalone. The guide reports its own height to the homepage, so the frame has no inner scrollbar. Ride the WaveWarZ (AttaBotty's scrolling walkthrough) is back in its original spot above DJ Wavy.
Copy follows the copy document (plain words; "Sunday Featured" and "BattleZ"). Removed from the old onboarding as unverified or conflicting: Sunday 7 PM Eastern, a community battle running "a day or three", "Quick Battlez keep running alongside", "0.05 SOL is plenty". To confirm with Hurricane: whether the poll vote ever asks for a network fee, and the exact place the poll sits on the battle page.

## Onboarding v2: one DJ Wavy, one guide (supersedes the iframe-in-the-middle note above)
The homepage keeps a single 3D DJ Wavy: the doors-open section (`#3d-arena`). The old lore and AR-code columns are replaced by the guided onboarding (`onboarding.html?panel=1` in a frame). Links to `#how-it-works`, `#for-artists`, `#for-traders` and `#for-fans` jump to the open-gates view and open that lane; DJ Wavy turns to face each step. On small or short screens the scene is not pinned: the model sits above the guide and the page scrolls normally.
`onboarding.html` now starts at the welcome frame and each person walks only their own track (Listener, Artist, Trader, Host), with a Start over button on every step. Steps use icons from the design system's 32-icon set, and the judging factors are shown as icons: Quick BattleZ = Poll, Charts, DJ Wavy; Sunday Featured = Poll, Charts, Judges. The set has no Poll or Judges icon yet, so Poll uses Headphones and Judges uses Leaderboard until proper ones are drawn.
Dropped from the homepage by this change: the DJ Wavy Breakdown pitch (0.015 SOL), the AR code card, and the standalone "Start here" section.

## Calendar-driven Tonight, live-slot linger, and what was removed (2026-11-11)
- **Tonight** now follows the wavewarz.info/calendar schedule (one-off events plus the weekly shows), with an "Every week" strip that mirrors the calendar sidebar. There is no public calendar API yet, so the page tries `https://wavewarz.info/api/public/calendar` and falls back to `calendar.sample.json` (a 2026-11-11 snapshot). Adding that API route to wavewarz-intelligence is the proper fix and needs Candy's go-ahead.
- **Live battles** use the live slot above the hero only. It now lingers 3 minutes after a battle ends (result shown when the API has it), then hides. Tonight no longer repeats live or ended battles.
- **Removed from the homepage scroll:** the "Live and upcoming BattleZ" intro and the Community BattleZ block (nobody is launching them right now). Community stays in the Host onboarding track. The Community backend hookup still needs to line up with Hurric4n3ike's live homepage.
- Not done: a Main Event staying pinned across all rounds (the slot only lingers 3 minutes after each battle ends).

## Quick BattleZ queue as a music-player deck (2026-11-11, v4)
`#quick-queue` is a chrome cueing deck. Left: three separate actions. Create a battle (goes to the battle setup page: pick 2 songs from the Audius catalog, 0.005 SOL, joins the back of the queue); Skip #N to the front (for whichever battle is in the slot, the live price, 0.02 SOL now, moves it to #1); Launch #1 now (0.007 SOL, starts the #1 battle immediately; only #1 can launch). Plus a link to all finished battles. Middle: one large chrome slot holding the selected pair. Its queue number (#1, big), the pair of vinyls laid on top of each other, and the two titles directly underneath with a leader line up to each record, in the Wave ID display callout style. The first battle starts in the slot tagged Next to play (Now playing when one is live). Other pairs sit either side and grow as they slide into the slot; scroll, drag, use the arrow keys or the chrome buttons. The carousel only moves when someone moves it. Phones stack the buttons above the slot. No orb inside the deck; the section's edge Wave ID textures sit outside it.
`quick-battles.sample.json` is padded for the preview: positions 2 and up are recent finished Quick BattleZ from the public API, marked `"demo": true`. The live API only allows localhost:3002, so any other host shows the sample and labels it.

## Ride the WaveWarZ: benefits copy and graphics pass (2026-11-11)
Same five stops, same scroll-driven ride. Copy now follows the artist and music benefits: get a wallet (your voice: vote and back the artists you love), pick a battle, hear both songs, back your favorite (vote on the poll; ready for more, back a side with real SOL), and your artist gets paid (earn from every trade as it happens, both artists paid when the battle ends). The closing button reads Back your artist. Graphics: Wave ID textures drift behind the wave, a second deeper swell and a specular crest line sit under it and gently move, the stop pins have chrome rims like the queue deck, the cards are glass with a design-system icon each (Wallet, Quick BattleZ, Headphones, Leaderboard, Paid to Artist), and cards above a stop now hang clear of DJ Wavy on a thin line. Reduced motion stops the movement.

## Live battle deck: chrome and Wave ID (2026-11-11)
The live slot above the hero (`.ld`, also used for the just-ended card) now has the same chrome bezel as the queue deck, chrome rims on the two artist cards, chrome play buttons, a chrome timer ring, a chrome VS medallion and a chrome frame on the pool bar. Layout unchanged. The Wave ID is NOT inside the deck: it sits steady in the page background behind it (live slot and preview arena), so it never reads as battle data. The Quick BattleZ preview arena (`#interactiveBattleDeck`) got the same bezel and card rims. See it any time with `?demo=quick`.

## Queue under the ride; Tonight as an X Space invitation (2026-11-11, not pushed yet)
Order is now: hero and stats, Ride the WaveWarZ, Quick BattleZ queue deck, scrolling ribbon, Tonight, then the rest. Tonight reads as an invitation: the section tag says JOIN US TONIGHT, the headline is "Join us tonight on X Spaces", the line says to meet the WaveWarZ community (artists and musicians are in the Space too), and the buttons are Join the X Space, Watch live and See the calendar, with "No wallet needed to listen." Shows that are not on X Spaces keep their own title and a Watch live button.

## Onboarding under Tonight; one combined "best of" section (2026-11-11, not pushed yet)
Order: hero and stats, Ride the WaveWarZ, Quick BattleZ queue, ribbon, Tonight, **DJ Wavy and the guided onboarding** (the doors now read GET THE FULL TOUR, guided by DJ Wavy, step by step), the Quick BattleZ sample preview arena, then **The best of WaveWarZ**, FAQ, alerts, footer. The best-of section replaces both Past BattleZ and the old stats-hub iframe: three panels of five with matching chrome-rimmed art, read live from the public API: the last 5 Featured battles (winner, rounds), the top 5 artists (most wins, SOL earned) and the top 5 Quick BattleZ songs (most wins, win rate, genre). More panels (for example top songs per genre) can be added the same way.

## Original logo with a chrome edge (2026-11-11, not pushed yet)
`wavewarz-logo.svg` is Candy's original logo (`WaveWarz Logo copy.svg`, original blue and green colors) with the black outline and extrusion kept black but made metallic (black metal with soft specular bands) plus a thin chrome rim line around it; the small inner shadow shapes are dark steel. The viewBox is cropped to the artwork. It replaces the old PNG everywhere (nav, hero fractal intro, footer, onboarding and setup page headers, favicon). The 16-shard assembly, float and hover animations are unchanged, and a slow glint now sweeps across the hero logo after it assembles (stops for reduced motion). The original untouched file is kept as `wavewarz-logo-original.svg`.

## Design pass (2026-11-11, not pushed yet)
No gradient text or gradient buttons: emphasis words are solid brand green; the primary button is solid green with a thin chrome lip, the secondary is a hairline. One type system on the homepage, matching the setup and onboarding pages: Space Grotesk for display, numerals and buttons; Outfit for body and UI copy; JetBrains Mono for labels and data (two label sizes). Section headings share one size and weight, section padding shares one rhythm, and the logo has no colored glow. The logo SVG is black metal with a soft sheen and a thin chrome rim. Web Interface Guidelines fixes: color-scheme and theme-color meta, no `transition: all`, visible focus rings, touch-action on controls, logo image dimensions. The Wave ID backdrop sections (best-of, preview arena, live slot, queue) now span the full page width.

## Launch station (2026-11-11, not pushed yet)
The Quick BattleZ deck reads as a launch station. A console strip across the top (LED, LAUNCH STATION, queue count). The chrome slot holds one module for the highlighted battle: its number, the two records, the full song titles with leader lines, and a big LAUNCH THIS BATTLE button (0.007 SOL, starts right now) with a slow ping ring. Only #1 can launch, so when a later battle is highlighted the same button reads SKIP TO THE FRONT (live skip price, moves it to #1, ready to launch). While a battle is playing the button reads Playing now. The left rail is just Add a battle (0.005 SOL) and a link to finished battles; the paragraphs of instructions are gone from the deck (they live in the Artist track of the onboarding). On phones the station comes first and Add a battle sits under it.

## Station polish + The Latest (2026-11-11, not pushed yet)
- Quick BattleZ heading swapped: eyebrow "Launch a battle anytime 24/7", big title "Quick BattleZ. Song vs song."
- Add-a-battle pad uses the same record size as the neighbouring queue pairs; the highlighted #1 pair is the one large size. Station corners are fully rounded and the vertical spacing is tightened.
- The queue is a scroll-pinned scene (sticky, 240vh): it holds the screen and scrolling walks through the queue (native scroll, nothing hijacked). It zooms to fit short screens and drops the pin on phones and very short windows.
- Live battle preview bar says LIVE BATTLE PREVIEW (any battle type goes in that slot); the skip chip is replaced by the battle type label.
- Best-of title is now "Top 5 onchain battle stats."
- New section "The latest" (#latest) above the FAQ: one scroll-snap carousel mixing blog posts (live from Paragraph, falls back to blog.sample.json; cover falls back to the Wave ID texture) and merch (merch-featured.json: curated WaveWarZ-branded products from merch.wavewarz.info; the profane Yo FeelinZ items and ZAOStock tees are left out on purpose). Edit merch-featured.json to change the picks.

## WaveZStation section (2026-11-11, not pushed yet)
`#wavezstation` sits right after the leaderboard/stats section: the WaveZStation logo (wavezstation-logo.jpg, feathered into the background), a one-line explainer, three stats (songs dropped, fans backing, USDC in fan pools), and a chrome CD display: the newest drop large (jewel case with a disc sliding out, slow spin) plus the next four. Each links to https://wavezstation.com/song/<id>. Data: wavezstation.com/api/discover is not CORS-open, so the page reads wavezstation.sample.json (snapshot 2026-11-11) and swaps to the live list automatically if WaveZStation ever allows cross-origin reads. Titles with profanity are skipped on purpose. Refresh the snapshot by re-running the discover fetch; a /api/public/wavezstation proxy route in wavewarz-intelligence would make it live (needs Candy's go-ahead).

## Sponsor bar (under Tonight)
- Thin chrome-rimmed rail directly under the Tonight card and weekly strip: "Thank you to our sponsors", three transparent logo slots, and a green "Become a sponsor" button.
- Data lives in `sponsors.json`: set `name`, `logo` (transparent PNG or SVG, about 130 x 34) and `url` for each slot, and change `applyUrl` for the become-a-sponsor link (currently https://x.com/wavewarz as a stand-in). Empty slots show a dashed "Your logo" placeholder.
- Phones stack the bar: line, logos, button.

## 5-second song previews (battle setup page, audius-search.html)
- Every song row has a small chrome play button on its cover; the big picked-song cards and the mobile dock have one too.
- It plays 5 seconds from the Audius public stream (`api.audius.co/v1/tracks/<id>/stream`, no play count), starting about 30% into the song so you hear the song and not the intro. Songs under 40 seconds start at 0:00.
- The waveform fills green as it plays, the button becomes a stop button, and the last 0.4 seconds fade out. One preview at a time; Escape, switching tabs, or tapping another song stops it.
- If a stream will not load, a toast says "That preview would not play."

## Hero stats, Mainnet callout, site forms (2026-11-16, local only until PR #28 is merged)
- Hero sub line: "Two songs go head to head. The audience decides who wins." Same line in the ribbon and the share description.
- Stats strip cut from six numbers to four (trading volume, paid to artists, Spotify streams to match, battles onchain), one label each, hairline dividers. SOL amounts and the stream-rate note moved to hover titles.
- "Live on Solana Mainnet" is a Wave ID style callout hanging off the wallet button; it fades once you scroll. Hidden under 960px.
- Site forms replace Tally: one chrome dialog (`#wwForm`, script `forms-js`) for Featured Battle application, sponsorship, support, feedback and Sunday reminders. Any element with `data-form="<kind>"` opens it; so do `#apply`, `#sponsor`, `#support`, `#feedback`, `#remind` and the onboarding guide's Apply buttons.
- Forms post to `https://wavewarz.info/api/public/forms` (wavewarz-intelligence PR #28; table already live). For local testing add `?formsUrl=<url>` or set `window.WW_FORMS_URL`. Submissions are read at wavewarz.info/admin/inbox.
- Text reminders: numbers and consent are collected, nothing is sent yet (no SMS provider).
- Sponsor bar button and empty logo slots open the sponsorship form; `applyUrl` removed from sponsors.json.
- Wording: no "back", "winnings" or "profit" left in visible copy.

## Ride the WaveWarZ: chrome wave, shorter copy, new DJ Wavy (2026-11-16)
- The wave is a chrome rail: dim until ridden, then polished chrome with a green bloom and a white top highlight (`#rideChrome`, `#rideHi`). Crest dots and the amber ghost line are gone.
- Every card is one short line. Sub line: "Every genre. Decided by the listeners." End button: "Open WaveWarZ".
- DJ Wavy redrawn from the 3D model (round blue gentleman, tall top hat with feather, monocle and chain, walrus mustache, dark tailcoat, no purple) on a chrome board with a green rail stripe. He is larger (200px), and the cards above the wave sit higher to clear him.

## Queue page, Audius flow, search, arena removed, Hurricane guide (2026-11-16)
- `quick-battles.html`: the queue page. Same chrome dock as the homepage, then "Up next" (Launch on #1, Skip on the rest) and "Recently finished". GENERATED by `tools/build-queue-page.py` from index.html; rerun it after changing the dock, nav, footer or dialogs.
- `audius-connect.html`: artist flow in four steps (wallet, rights, Audius, catalog) with friendly empty and not-linked states. Built by `tools/build-audius-connect.py` from the setup page's styles. Review states: `?step=2..4`, `?state=empty|unlinked`.
- Homepage search (artists, songs, battles) above the Top 5 panels, from the wavewarz.info API (`search-js`).
- Launch and Skip open one action module (`actions-js`); real calls are `WW.launchNext` and `WW.skipToFront`, preview until provided.
- The mid-page sample arena, its fake timer and synth, the Sound button and the "tap for a demo beat" tags are removed.
- `HURRICANE-HANDOFF.md`: integration guide (routes, `window.WW` functions, data, section map, questions).

## Phone pass (2026-11-16)
- Checked at 390px wide: homepage (ride, sponsor bar, search, forms, footer), queue page, Audius flow. No sideways scrolling on any of them.
- Ride the WaveWarZ on phones now shows one card at a time, for the current stop, in the open space under the wave (container query units on `.ride-board`).
- Form eyebrow no longer runs under the close button. Audius catalog rows get a placeholder cover when a song has no artwork.

## Wave ID callouts matched to Quan's card; live calendar and WaveZStation routes (2026-11-16)
- Quan's Nov 4 update (WavID #12, commit 7307c4e) is the callout design from the IMG_7344 vision frame: a glass tile with a small green label, a title and a mono detail line, joined to a dot on the ID by a thin line, hidden until the ID is hovered, focused or held. The setup page preview (`.wprev` in `audius-search.html`), the design study (`wave-id-display.html`) and the Mainnet callout on the homepage now use his values (tile `rgba(7,14,12,.22)`, border `rgba(188,241,207,.42)`, line `#c8ffd9`, dot `#e9fff3`, 56px grid) and his wording: Song with volume and record, Battle activity, Win ratio. On touch screens, holding the ID shows the callouts and letting go hides them.
- The orb in the previews is still the stand-in texture, not the artist's own Wave ID. Showing the real one needs an image route on wavewarz.info (draft PR #25).
- WaveZStation drops now read `https://wavewarz.info/api/public/wavezstation`; Tonight already reads `/api/public/calendar`. Both routes are in wavewarz-intelligence PR #29 and both sections keep using their saved snapshot until it is merged.
- wavewarz.info: PR #30 updates the embedded Wave ID studio to the same commit.
- Backups before this change: scratchpad `*.before-quan-callouts.html`. Patch script `apply_quan_callouts.py`.

## Battle page (2026-11-16)
`battle.html` is the redesigned battle page (wavewarz.com `/v2/battles/<id>`), generated from `index.html` by `tools/build-battle-page.py` so it shares the nav, footer, dialog shell, Live Battle Deck and panel styles. Open it with `?id=<battleId>`; with no id it shows the live battle or the latest one; `?demo=live` shows a battle in progress with sample pools.
- Matchup: the Live Battle Deck, with Trade buttons that open a Buy / Sell module in the shared dialog.
- One chart for both sides: SOL in each pool over time, legend, values at the line ends, a crosshair readout (pointer, touch, arrow keys) and a table view. The line shape is a labeled sample until wavewarz.com supplies `WW.getBattleChart`.
- "How this round is decided": the poll, the judges (DJ Wavy on Quick BattleZ) and the chart, with who holds each; two of three. Rounds panel on Sunday Featured battles: best of three.
- Side by side table: pool, traded, earned by the artist.
- After the end: winner on the deck and a Withdraw bar.
- Real data today: names, pools, volume, results, rounds and artist earnings from wavewarz.info. Preview only: buy, sell, withdraw, poll voting and the chart history.
- Left off on purpose: the intro pop-up, the Mainnet banner, donate blocks.

## Battle page, second pass (2026-11-16)
From Candy's review: donations are back, the chart matches the current one, far less text, and the stream games can be switched in.
- Donate bar under the matchup: either artist or WaveWarZ, wallet to wallet, no fees (`WW.donate`). Amount chips plus a free amount.
- The chart is drawn like the current wavewarz.com chart (both sides' Pool Size (SOL) over time, boxed grid, axis titles, clock times, hollow point markers, outlined legend keys), shown once instead of once per artist.
- Panel explanations removed. The decision panel is "2 of 3 wins" with three rows: Poll, Judges (DJ Wavy on Quick BattleZ), Chart.
- Chart panel switch: Chart, DJ Clash, Racers, Dancers, Surf. The game views are a built copy of `CandyToyBox/WaveWarz-Stream-Battle` at 92047b6 in `games/arena/` (rebuild: `npm install --legacy-peer-deps && npx vite build --base ./`, copy `dist/` without `assets/aistudio`). The page feeds it names, pictures, pools, poll and time left through its `wavewarz:*` messages and remembers the last view. In the game side A is blue and side B is green, the reverse of the deck and chart; that lives in the game repo.
- Backup of the first version of the generator: scratchpad `build-battle-page.v1.py`.

## Battle page, third pass: built around the July UX audit (2026-11-17)
Source: `~/wavewarz-ux-audit-2026-07 copy/REPORT.md` plus Candy's review of live battle 1794886688.
- The poll is the first action. Each side's main button is Vote (Free), Trade is the second button, and the poll count is in the middle of the deck. A vote shows instantly.
- Play and pause on each cover play the song on the page (Audius links resolve through the Audius API; `WW.audioUrl` can supply another source).
- DJ Wavy's call: locked during the battle, then winner, confidence and written feedback. Yay and Nay removed.
- Featured and Community battles embed the live stream above the chart while live.
- Withdraw shows what you receive. "Your battle" shows put in, got back and difference to four decimals, with save and share.
- Removed for good: wallet address dump, Reconnect Sync, the second explainer pop-up, the yellow banner, purple, winner overlays on the chart, duplicate toasts.
- Review states: `?demo=live`, `?demo=ended`, and `?id=<main battle id>&demo=live` for the stream embed.
- Not solved here, raised with Hurricane: whether End Battle is still a manual step, and the wallet waiting state.

## Battle page: settle state and briefing rules (2026-11-17)
Sources: Candy on End Battle, `~/wavewarz-homepage-blueprint-2026-10-21.md`, `~/WaveWarz-Muse-Briefing-2026-10-24.md`.
- No End Battle button. After the timer the bar reads "Settling the result" with Withdraw disabled, re-checks every 8 seconds, and opens Withdraw once settled. A green "Settle battle" appears only if `WW.settle` exists and nobody has settled after 20 seconds. Battles more than 10 minutes old never sit on Settling.
- `ww-now-playing` event lets wavewarz.com's synced song order drive the Now playing state.
- "Best of N rounds" follows the event's round count (three, sometimes five).
- Trade module always shows the risk line. Withdraw says to use the wallet you traded with. End bar links claim.wavewarz.info.
- DJ Wavy's call has a "Get a DJ Wavy Breakdown" link.

## Battle page rebuilt as a one-screen cockpit (2026-11-17)
From Candy's voice note: timing is everything when trading, so everything has to be right there. Buy and sell for both sides next to each other, timer always visible, chart, music, vote and stream on one screen; scrolling is for after the battle. Lighter type, chrome TV for the stream, an app feel on phones, a reward animation on launch and queue, and straight to the battle after launching.
- Layout: sticky timer bar, then side A, stage, side B in a grid sized to the viewport (`calc(100svh - 206px)`). Details moved below the fold.
- One-tap buy (0.05 / 0.10 / 0.25 SOL) and sell (25 / 50 / 100 percent) on each side, no pop-up. Keys 1 2 3 and 8 9 0. One status line per side.
- Type: Outfit 300 to 500 instead of the heavy display weights; thin chrome hairlines instead of thick bezels, except the TV.
- Stream in a chrome TV beside the chart on Featured and Community battles; battle flyer there when no stream is live. Artists with no picture get a monogram instead of an empty frame.
- Phone: compact side cards, chart, and a fixed bottom trade dock with a Buy / Sell switch.
- `ww-celebrate.js`: wave or champagne bubbles on canvas. Launch plays the wave and goes to the battle; reserving plays bubbles.
- `share-module.html`: Candy's Battle Share Card artifact (https://claude.ai/artifact/SumSU8RQ8tfE4FGZUqE7b1) with an embed mode; opens after Withdraw and from Your battle.
- The trade pop-up from the earlier passes is gone. Backups: scratchpad `build-battle-page.v3.py`, `index.before-cockpit.html`, `audius-search.before-cockpit.html`. Patch: `cockpit_patch.py`.
