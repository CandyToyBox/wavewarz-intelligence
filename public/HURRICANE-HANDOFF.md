# WaveWarZ redesign: integration guide for Hurricane

Last updated 2026-11-16. Written for the person wiring the redesign into wavewarz.com.

The redesign is a set of static pages (plain HTML, inline CSS and JS, no build step). They are the design and behavior spec. Every place that needs your backend or a wallet is a named function or a fetch to one of your existing routes, so the work is mostly: move each section into a React component, keep the markup and class names, and swap the stubs for your real calls.

- **Preview:** https://candytoybox.github.io/wavewarz-intelligence/ (launcher with every page)
- **Code:** branch `candy/homepage-and-battle-setup` in `CandyToyBox/wavewarz-intelligence`, folder `public/`
- **Change log for every design decision:** `public/CANDY-WORK-README.md`

One thing to confirm first: this guide assumes wavewarz.com is still built the way `Windsurf homepage layout.docx` describes it (Next.js App Router, `app/page.tsx` as a client component, Tailwind, wallet-adapter, header and footer from `layout.tsx`). That document is from December 2025. If the site has changed since, tell Candy what is different.

---

## 1. Which file replaces which route

| wavewarz.com route | Redesign file | Notes |
|---|---|---|
| `/` | `index.html` | Homepage |
| `/quick-battles` | `quick-battles.html` | Generated from `index.html` by `tools/build-queue-page.py`, so the dock is identical |
| `/audius/search` | `audius-search.html` | Battle setup: pick two songs, review, reserve |
| `/audius/connect` and `/audius/tracks` | `audius-connect.html` | One four-step flow: wallet, rights, Audius, catalog |
| (new) | `onboarding.html` | The guided start, embedded in the homepage as an iframe. Also works standalone |

Links between the pages are relative file names in the prototype (`audius-search.html`, `quick-battles.html`, `audius-connect.html`). Change them to your routes.

Unchanged routes the pages link to: `/v2/battles/[battleId]`, `/v2/community/create`, `/terms`, `/docs`.

---

## 2. What you need to connect

Everything wallet-related goes through one global, `window.WW`. Each function returns a Promise. If a function is missing, the page runs in preview and says so on screen, so nothing ever pretends a transaction happened.

| Function | Called from | What it should do | Resolve with |
|---|---|---|---|
| `WW.launchNext(queueItem)` | Dock button on `/` and `/quick-battles`, and the Launch button in the queue list | Your existing `handleLaunchNextQuickBattle` (launch-intent, initializeBattle, initializeMints, confirm-launch) | anything |
| `WW.skipToFront(queueItem)` | Same places, for any battle that is not #1 | Your existing skip-the-queue payment | anything |
| `WW.reserve(songA, songB)` | `audius-search.html`, Reserve button in the review module | Queue a Quick Battle (0.005 SOL) | `{ position, skipPrice }` |
| `WW.checkAvailability(songA, songB)` | `audius-search.html`, when two songs are picked | Whether this matchup can be queued | `true` or `false` |
| `WW.connectWallet()` | `audius-search.html`, `audius-connect.html` | Open the wallet picker | `{ address }` |
| `WW.resyncAudius()` | `audius-search.html` | Resync the connected artist's songs | anything |
| `WW.connectAudius({ address })` | `audius-connect.html` step 3 | Audius sign-in, then link the profile to the wallet | `{ handle }` |
| `WW.getMyCatalog({ address })` | `audius-connect.html` step 4 | The artist's songs in the WaveWarZ catalog | `{ linked, handle, tracks: [...] }` |
| `WW.resyncCatalog({ address })` | `audius-connect.html` step 4 | Resync, then return the catalog | same as `getMyCatalog` |

`queueItem` is the object from your `/api/quick-battles` response, untouched (`id`, `artist1_track_title`, `artist1_handle`, `artist1_artwork_url`, and so on). `songA` and `songB` are `{ id, title, handle, secs, art, link, wallet, genre }`, mapped from your `/api/audius/tracks` rows by `norm()` in the setup page.

To show an error to the user, reject with an object that has `userMessage`. Any other rejection shows a generic "that did not go through" line.

After a successful launch or skip the action module fires a `ww-queue-changed` event on `document`. Nothing listens for it yet; the dock re-polls every 30 seconds. Wire it to an immediate refresh if you want.

The "Select wallet" button in the nav is a plain link today. Replace it with your wallet button from the layout.

---

## 3. Data each page reads

### Your API (wavewarz.com)

These are the routes the pages already call. Inside wavewarz.com they are same-origin, so no CORS change is needed there. They only fall back to sample files on other hosts because the routes currently allow `http://localhost:3002` only.

| Route | Used by | Fields read |
|---|---|---|
| `GET /api/quick-battles` | Dock on `/` and `/quick-battles` | `active[]`, `queued[]` (`id`, `battle_id`, `artist1_track_title`, `artist2_track_title`, `artist1_handle`, `artist2_handle`, `artist1_artwork_url`, `artist2_artwork_url`), `skipState.min_skip_lamports` |
| `GET /api/quick-battles/recent` | Recently finished list on `/quick-battles` | `battles[]` (`battle_id`, `completed_at`, track titles, handles) |
| `GET /api/audius/tracks?limit=&offset=&q=` | Setup page catalog | `total`, `tracks[]` (`audius_track_id`, `title`, `artist_handle`, `duration_seconds`, `artwork_url`, `stream_url`, `artist_wallet`, `genre`) |

To point the pages at a different host for testing, set `window.WW_API_BASE` before the scripts run.

Sample files used when the API is not reachable: `quick-battles.sample.json`, `quick-battles-recent.sample.json`, `audius-catalog.sample.json`, `audius-artists.sample.json`. The dock labels itself "sample data" when it is on one. Delete these once the pages live on wavewarz.com.

### wavewarz.info public API (Candy's side, already live, open to any site)

| Route | Used by |
|---|---|
| `GET /api/public/stats` | Stats strip under the hero, and `liveBattle` for the live deck |
| `GET /api/public/battles`, `/battles/:id` | Live deck details, search |
| `GET /api/public/events` | Past Featured battles panel |
| `GET /api/public/leaderboards/artists`, `/songs` | Top artists, top songs, search, song stats on the setup page |
| `POST /api/public/forms` | All five forms. Submissions are read at wavewarz.info/admin/inbox |

Not built yet on wavewarz.info: `/api/public/calendar` (Tonight reads `calendar.sample.json` until it exists) and a pass-through for WaveZStation (that section reads `wavezstation.sample.json`).

### Other

- Audius public API for the 5-second song previews: `https://api.audius.co/v1/tracks/<id>/stream`.
- Paragraph public API for the blog cards.
- `merch-featured.json` and `sponsors.json` are hand-edited lists.

---

## 4. Homepage, section by section

In page order. "Yours" means it needs something from wavewarz.com; everything else already works.

| # | Section | id | Data | Yours |
|---|---|---|---|---|
| 1 | Live Battle Deck | `#liveSlot` | wavewarz.info stats and battles | Trade buttons link to `/v2/battles/<id>` |
| 2 | Hero | `#top` | none | Wallet button in the nav |
| 3 | Stats strip | `#statsStrip` | wavewarz.info stats | none |
| 4 | Ride the WaveWarZ | `#ride-the-wave` | none | none |
| 5 | Quick BattleZ dock | `#quick-queue` | `/api/quick-battles` | `WW.launchNext`, `WW.skipToFront` |
| 6 | Ribbon | (marquee) | skip price from the dock | none |
| 7 | Tonight and weekly shows | `#tonight` | calendar | none |
| 8 | Sponsor bar | inside `#tonight` | `sponsors.json` | none |
| 9 | DJ Wavy and guided start | `#3d-arena` | `djwavy.glb`, `onboarding.html` | none |
| 10 | Search and Top 5 panels | `#highlights` | wavewarz.info | none |
| 11 | WaveZStation drops | `#wavezstation` | snapshot | none |
| 12 | Blog and merch carousel | `#latest` | Paragraph, `merch-featured.json` | none |
| 13 | FAQ | `#faq` | none | Confirm the payout wording (see section 7) |
| 14 | Sunday reminders | `#alerts` | forms route | none |
| 15 | Footer | `footer.cp-foot` | forms route | Merge with your layout footer |

### How the Live Battle Deck behaves

This replaces the old Featured Battle card.

- It is hidden when nothing is live.
- When any battle is live (Featured, Quick or Community) it appears above the hero.
- When the battle ends it shows the winner and the final numbers, and stays for three minutes or until another battle goes live, whichever comes first.
- It polls wavewarz.info `/stats` every 30 seconds and reads `liveBattle`. That field is a single battle today. If two battles can ever be live at once, tell Candy and she will add a list.
- Preview it with `?demo=live` or `?demo=main` on the homepage.

### What was deliberately left out of the new homepage

Per Candy, compared with the current homepage:

- The Quick / Community tab toggle and the Community Battles carousel. Community BattleZ are reachable from the guided start only.
- The Past Battles carousel. Past Featured battles are the first Top 5 panel.
- The Tally artist form. Replaced by the site's own Featured Battle application form.
- The yellow Mainnet Beta banner. Replaced by a small "Live on Solana Mainnet" callout on the wallet button.
- **The $WARZ token banner and every $WARZ mention. Please remove it from the live site as well.**

---

## 5. Suggested order of work

1. Add the fonts and tokens. Fonts are Space Grotesk, Outfit and JetBrains Mono from Google Fonts. Colors and spacing are CSS variables on `:root` at the top of each file.
2. Port the dock (`#quick-queue` markup, the `.qp` styles, and `<script id="quick-battlez-js">`) and connect `WW.launchNext` and `WW.skipToFront`. This is the one piece with real money on it, so do it first and test it on its own.
3. Port the action module and the forms module. They share one dialog shell (`.wf`): `<script id="actions-js">` and `<script id="forms-js">`.
4. Port the setup page and connect `WW.reserve` and `WW.checkAvailability`.
5. Port the Audius flow and connect its four functions.
6. Port the rest of the homepage. These sections have no dependencies on you.
7. Remove the sample files and the $WARZ banner.

Each script block on the homepage has an `id` and is self-contained (its own closure, no shared globals except `window.WW` and `window.WWAct`), so they can be moved one at a time.

---

## 6. Things to know before you start

- **Money amounts shown on the pages.** Launch 0.007 SOL, add a battle 0.005 SOL, DJ Wavy Breakdown up to 0.015 SOL are written into the pages. Skip comes from `skipState.min_skip_lamports`. If any of the fixed ones are wrong or should come from the API, say so.
- **The queue page is generated.** Do not edit `quick-battles.html` by hand in the prototype; change `index.html` or the generator.
- **Scroll-pinned sections.** The dock, Ride the WaveWarZ and the DJ Wavy section use `position: sticky` inside a tall section, with native scroll. They need `overflow: clip` (not `hidden`) on their ancestors, or the pinning breaks.
- **Reduced motion** is respected everywhere. Keep the `prefers-reduced-motion` rules when porting.
- **Wording rule from Candy:** no betting, gambling, wagering or profit language anywhere. Use listen, vote, trade, support. "ONCHAIN" is one word.
- **Not tested:** phone widths for the newest pieces (sponsor bar, forms, queue page lists, Audius flow), and nothing has been run inside the real wavewarz.com app.

---

## 7. Questions for you

1. Is the layout document still accurate for today's wavewarz.com?
2. Does voting on the poll ever cost a network fee? The guided start says voting is free.
3. FAQ payout wording: the page says the losing side's pool splits 50% to losing traders, 40% to winning traders, and the rest to the artists and the platform, and that artists earn 1% of every trade. Is that the right plain-language version?
4. How should Community BattleZ connect, if at all, for launch?
5. Are the fixed fees in section 6 right?
6. What does `/audius/search` call today to reserve a battle, and what does it return? `WW.reserve` assumes `{ position, skipPrice }`.
7. Would you rather receive these as React components? Candy can have them converted section by section once the answers above are settled.
