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
| `/v2/battles/[battleId]` | `battle.html` | Battle page. Generated from `index.html` by `tools/build-battle-page.py`. Open with `?id=<battleId>`; `?demo=live` shows a battle in progress |
| (new) | `onboarding.html` | The guided start, embedded in the homepage as an iframe. Also works standalone |

Links between the pages are relative file names in the prototype (`audius-search.html`, `quick-battles.html`, `audius-connect.html`). Change them to your routes.

Unchanged routes the pages link to: `/v2/community/create`, `/terms`, `/docs`. The homepage and queue page still link battles to `/v2/battles/<id>`, which is where `battle.html` goes.

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
| `WW.getBattleChart(battleId)` | `battle.html`, the chart | Pool size of each side over time, from your trade history | `{ points: [{ t, a, b }] }` (`t` in ms, `a` and `b` in SOL) |
| `WW.buy(battle, side, amountSol)` | `battle.html`, trade module | Buy on one side. `side` is `'a'` or `'b'` | anything |
| `WW.sell(battle, side, percent)` | `battle.html`, trade module | Sell 25, 50 or 100 percent of the holder's tokens on that side | anything |
| `WW.getPosition(battle)` | `battle.html`, Sell tab | The connected wallet's balance on each side | `{ a: { tokens, valueSol }, b: { tokens, valueSol } }` |
| `WW.donate(battle, target, amountSol)` | `battle.html`, donate bar | Your existing wallet-to-wallet donation, no fee. `target` is `'a'`, `'b'` or `'wavewarz'` | anything |
| `WW.withdraw(battle)` | `battle.html`, after the battle ends | Your existing Withdraw | anything |
| `WW.getPoll(battle)` | `battle.html`, deck and decision panel | Quick BattleZ poll counts, and the connected wallet's own vote | `{ a, b, locked, mine }` |
| `WW.votePoll(battle, side)` | `battle.html`, the Vote button on each side | Cast the free poll vote (wallet signs a message) | anything |
| `WW.getJudge(battle)` | `battle.html`, decision panel | DJ Wavy's verdict from `/api/quick-battles/judge/<id>` | `{ status: 'locked' or 'ready', winner: 'a' or 'b', confidence, notes }` |
| `WW.getSummary(battle)` | `battle.html`, Your battle panel after the end | The connected wallet's totals and trades in this battle | `{ putInSol, gotBackSol, trades: [{ side, buy, tokens, sol }] }` |
| `WW.shareStats(battle, where)` | `battle.html`, Your battle panel | Your existing stats image and share actions. `where` is `'image'`, `'x'` or `'farcaster'` | anything |
| `WW.audioUrl(battle, side)` | `battle.html`, play buttons | Optional. A playable URL for that side's song, for example your `/api/audius/stream`. Audius links already play without it | a URL |

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

| `GET /api/public/calendar` | Tonight and the weekly shows strip |
| `GET /api/public/wavezstation` | WaveZStation drops |

The last two are in wavewarz-intelligence PR #29. Until that is merged the pages read `calendar.sample.json` and `wavezstation.sample.json`; they switch to the live routes on their own once the routes answer.

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
| 7 | Tonight and weekly shows | `#tonight` | wavewarz.info calendar | none |
| 8 | Sponsor bar | inside `#tonight` | `sponsors.json` | none |
| 9 | DJ Wavy and guided start | `#3d-arena` | `djwavy.glb`, `onboarding.html` | none |
| 10 | Search and Top 5 panels | `#highlights` | wavewarz.info | none |
| 11 | WaveZStation drops | `#wavezstation` | wavewarz.info wavezstation | none |
| 12 | Blog and merch carousel | `#latest` | Paragraph, `merch-featured.json` | none |
| 13 | FAQ | `#faq` | none | Confirm the payout wording (see section 7) |
| 14 | Sunday reminders | `#alerts` | forms route | none |
| 15 | Footer | `footer.cp-foot` | forms route | Merge with your layout footer |

### The battle page (`battle.html`)

Built from the homepage pieces: the Live Battle Deck is the matchup, and the panels are the Top 5 panel shell.

- **One chart, same as today's.** Your current page already plots both sides' Pool Size (SOL) over time, once in each artist card. The new page keeps that chart (same measure, axes, legend and point markers) and shows it once. Until `WW.getBattleChart` exists the line shape is a labeled sample that ends on the real pool sizes.
- **Chart or game.** The chart panel has a switch: Chart, DJ Clash, Racers, Dancers, Surf. The game views are the stream games from `CandyToyBox/WaveWarz-Stream-Battle` (built copy in `games/arena/`, commit 92047b6), loaded in an iframe and driven through the game's own `wavewarz:*` postMessage bridge with the battle's names, pictures, pools, poll and time left. To make the games react to each trade as it happens, fire `document.dispatchEvent(new CustomEvent('ww-trade', { detail: { side: 'a', buy: true, sol: 0.1 } }))`; without it the page infers moves from pool changes on each refresh. Set `window.WW_GAME_URL` to host the game somewhere else.
- **The poll comes first.** Each side's main button is Vote, marked Free, with Trade underneath. The vote shows the moment it is tapped (the audit found a one minute delay that read as a failure) and is taken back with a message if the wallet rejects it. The poll count sits in the middle of the deck above the pools. On Featured and Community battles the button reads "Vote on X" and opens the X poll (`window.WW_POLL_URL` to point it at the exact post).
- **Songs play on the page.** The play button on each cover plays and pauses that song in place and marks it Now playing. It no longer opens a new tab mid battle.
- **DJ Wavy's call.** Locked during the battle; after it, the winner, the confidence and his written feedback. No Yay or Nay buttons: Candy says they are not used.
- **Live stream above the chart** on Featured and Community battles while the battle is live, from the battle's `streamLink` (Twitch, Kick and YouTube embed; anything else gets an Open stream button). `window.WW_STREAM_URL` overrides it.
- **After the battle.** Withdraw shows the tokens held and the SOL the person will receive before they approve (`WW.getPosition` may return `claimSol`). A "Your battle" panel shows what they put in, what they got back and the difference to four decimals, never a red negative zero for a winner, with the save and share actions.
- **Donate bar.** Under the matchup: donate to either artist or to WaveWarZ, wallet to wallet, no fees.
- **How it is decided.** Three rows: the poll, the judges (DJ Wavy on Quick BattleZ) and the chart, each showing who holds it. Two of three takes the round, and on Sunday Featured battles best of three rounds takes the battle. Results come from wavewarz.info `/battles/:id` (`factors`) and `/events` (rounds).
- **Trade module.** The Trade button on each side opens one dialog with Buy (0.05, 0.10, 0.25 SOL) and Sell (25, 50, 100 percent), the same choices as today's page.
- **After the battle.** The deck shows the winner and a Withdraw bar appears.
- The battle object passed to the hooks is `{ id, type, a, b, start, end, winner, factors }`, where `a` and `b` are the `artist1` and `artist2` objects from wavewarz.info.
- Left off on purpose: the intro pop-up and the yellow Mainnet banner.
- Kept short on purpose: viewers see this page on stream, so panels carry labels and results, not explanations.

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
- **Wave ID callouts.** The Wave ID previews on the setup page follow Quan's card (WavID repo, commit 7307c4e, `studio/src/card/callouts.mjs` and the `.card-callout` styles): a glass tile, a thin leader line and a dot, hidden until the ID is hovered, focused or held. Keep that behavior. The orb image is a stand-in texture; the artist's real Wave ID still needs an image route on wavewarz.info.
- **Not tested:** a real phone (layouts were checked at 390px wide on desktop), and nothing has been run inside the real wavewarz.com app.

---

## 7. Questions for you

1. Is the layout document still accurate for today's wavewarz.com?
2. Does voting on the poll ever cost a network fee? The guided start says voting is free.
3. FAQ payout wording: the page says the losing side's pool splits 50% to losing traders, 40% to winning traders, and the rest to the artists and the platform, and that artists earn 1% of every trade. Is that the right plain-language version?
4. How should Community BattleZ connect, if at all, for launch?
5. Are the fixed fees in section 6 right?
6. What does `/audius/search` call today to reserve a battle, and what does it return? `WW.reserve` assumes `{ position, skipPrice }`.
7. Is the red End Battle step still needed before people can withdraw? The new page has no button for it. If it is, it should be a green "Settle battle" action, and it needs a hook.
8. Can a trade show "Waiting for your wallet" separately from "Preparing"? The new trade module has one waiting state and one confirmation, in the module itself, instead of two toasts.
9. On the battle page, can you supply pool size over time for both sides (`WW.getBattleChart`), and is the poll on Sunday Featured battles still the X poll?
10. Would you rather receive these as React components? Candy can have them converted section by section once the answers above are settled.
