# Making WaveWarZ Battle Plays Count on Audius

**For:** Hurric4n3IKE (wavewarz.com player)
**Why it matters:** Every Quick Battle plays a song's *full* track to a live audience. Audius will count those as real plays **if** we stream the audio the right way — which means WaveWarZ battles directly grow each artist's Audius play count and chart position. That's a concrete artist value-prop: *"battle on WaveWarZ, climb the Audius charts."*

This is a **wavewarz.com player change** (not the Statz analytics app). Statz already resolves and stores each song's canonical Audius track ID, so the hard part (knowing *which* Audius track a battle song is) is done — see the bottom of this doc.

---

## 1. How Audius counts a play (confirmed from the SDK source)

Audius records a play when audio is streamed through the track **stream endpoint**:

```
GET https://{discovery-node}/v1/tracks/{track_id}/stream?app_name=WaveWarZ
```

The decisive detail, straight from the Audius SDK (`TracksApi.getTrackStreamUrl`): the request supports a **`skip_play_count`** query param. Plays are counted **by default** — you would only pass `skip_play_count=true` to *suppress* counting. So simply streaming the audio through this endpoint increments the track's public `play_count`.

Relevant params:
| Param | Purpose |
|---|---|
| `app_name` | App attribution (use `WaveWarZ`). Strongly encouraged. |
| `user_id` | Optional. Attributes the play to a listener (helps personalization + anti-abuse legitimacy). |
| `skip_play_count` | Optional, default false. **Leave it off** so the play counts. |

---

## 2. What wavewarz.com must do

**Stream the battle audio from the Audius stream URL itself** — not from a re-hosted/cached copy. If the player pulls the file from anywhere other than the Audius stream endpoint, Audius never sees the play and `play_count` doesn't move.

Two ways to wire it:

### Option A — Audius SDK (recommended)
```bash
npm install @audius/sdk
```
```ts
import { sdk } from '@audius/sdk'

const audius = sdk({ appName: 'WaveWarZ' })

// trackId comes from the song registry (see section 4)
const streamUrl = await audius.tracks.getTrackStreamUrl({
  trackId,                 // e.g. "19K5mE"
  // userId,               // optional: the listener's Audius user id, if known
  // skipPlayCount: false  // default — the play counts
})

audioElement.src = streamUrl   // play this; the play is recorded
```

### Option B — Raw endpoint (no SDK)
```ts
// Discover a healthy node (never hardcode one — they rotate/go down):
const hosts = (await (await fetch('https://api.audius.co')).json()).data
const node  = hosts[0]

const streamUrl = `${node}/v1/tracks/${trackId}/stream?app_name=WaveWarZ`
audioElement.src = streamUrl   // playing this records the play
```

> Node discovery matters: the old hardcoded `discoveryprovider.audius.co` is dead (404). Always resolve a current node from `https://api.audius.co`.

---

## 3. Important caveats (set expectations honestly)

- **One stream = one play, roughly.** The play is recorded by whoever/whatever pulls the stream. On a YouTube livestream, the *viewers* are watching YouTube — they are not each streaming from Audius — so you don't get one Audius play per viewer. You get a play from the **source player** that's actually streaming the Audius audio during the battle. To multiply plays you'd need each wavewarz.com listener's browser to stream via Audius (e.g. the on-site battle player), not just the broadcast.
- **Anti-abuse / dedup.** Audius rate-limits and de-duplicates plays (repeated plays from the same source/IP in a short window may be filtered; there's a minimum-listen threshold). Genuine, full-song, distinct-listener plays are exactly what counts — which is what WaveWarZ produces. Passing `user_id` when you know the listener strengthens legitimacy.
- **Don't fake it.** Looping the stream endpoint to inflate counts will get filtered and risks the app's standing. The honest model (real full-song plays to real listeners) is both compliant and the actual product.

---

## 4. You already have the track IDs — use the song registry

Statz resolves every battle song's music link to its canonical Audius track and stores it in the **`song_registry`** table (WaveWarZ Intelligence Supabase, project `dbbhkgrgtfswzqgtwaqf`):

| column | example |
|---|---|
| `permalink_key` | `audius:cannonjones973/ego-death-cannon-jones` |
| `audius_track_id` | `19K5mE`  ← **use this as `trackId`** |
| `title`, `artist_name`, `artist_handle`, `genre`, `artwork_url`, `play_count` | (official Audius metadata) |

So in the wavewarz.com player, for a Quick Battle song you can look up `audius_track_id` by the song's music link (or resolve it live from the link via `/v1/resolve?url={musicLink}&app_name=WaveWarZ`), then stream that track ID through the endpoint above.

If you'd rather resolve at play time without the table, the music link → track id is one call:
```ts
const r = await fetch(`${node}/v1/resolve?url=${encodeURIComponent(musicLink)}&app_name=WaveWarZ`)
const trackId = (await r.json()).data.id
```

---

## 5. How to verify it's working

1. Note a test track's current `play_count` (GET `/v1/tracks/{id}?app_name=WaveWarZ`).
2. Play the full song through the stream endpoint as a real listener would.
3. Wait a few minutes (counts aren't always instant), re-fetch the track, confirm `play_count` incremented.
4. Confirm `skip_play_count` is **not** being sent.

---

## 6. Open Audio Protocol notes

Audius is a client on the open-source **Open Audio Protocol** (openaudio.org) — the API is free and permissionless, no per-call cost. Deeper protocol/storage docs: docs.openaudio.org. App-level API + SDK: docs.audius.co.

**Sources:** Audius SDK `TracksApi.ts` (`getTrackStreamUrl`, `skip_play_count` param), [Audius Developer Docs](https://docs.audius.co/), [Audius API Reference](https://docs.audius.co/api/).
