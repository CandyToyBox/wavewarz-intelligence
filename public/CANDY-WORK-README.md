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
