# WaveWarZ Stats API — data changelog

Every change to **what the public API returns** for stats, records, leaderboards
or battle data. Third parties build on `wavewarz.info/api/public/*` (WAVYID /
Quan among them), so a value shifting under them without notice is a broken
contract.

**Scope:** anything that changes a number, a field, a filter, or how a record is
computed. Pure additions (new optional field) are logged too, marked ADDITIVE.

**Not in scope:** internal DB migrations with no API-visible effect, UI-only
changes, performance work.

## Entry format

```
## YYYY-MM-DD — short title
**Endpoints:** which /api/public/* routes
**Type:** ADDITIVE | CORRECTION | BREAKING | RECOMPUTE
**What changed:** one paragraph
**Why:** the finding or decision behind it
**Expected magnitude:** how much a consumer's numbers move
**Reproduce / verify:** query or file
```

---

<!-- newest first -->

## 2026-09-08 — pending, not yet shipped

The recon pass with the protocol repo (`bettercallzaal/wavewarz-protocol`)
surfaced four data changes queued for the stats API. None are live yet. Listed
here so the entries are ready the day they ship.

### A. `total_distribution_amount` backfilled from chain — CORRECTION
- **Endpoints:** `/stats`, `/battles`, `/battles/:id`
- **What:** the column was populated by a hydration step that silently failed on
  most battles. It currently sums to ~44 SOL across 197 battles. Chain truth
  (Battle account byte 249, all 1,643 battles) is ~450 SOL across 1,506.
  Applying `recon/settlement-from-chain.csv`.
- **Why:** cross-checked three ways — chain read (450), our own `trades` claim
  rows summed independently (409.50), both ~10x the column.
- **Expected magnitude:** any consumer using `total_distribution_amount` or a
  derived "platform paid out" / "artist settlement" figure sees it rise ~10x.
- **Verify:** `recon/settlement-from-chain.csv`; `SELECT SUM(amount_sol) FROM
  trades WHERE trade_type='claim'`.

### B. `launcher_wallet` added — ADDITIVE
- **Endpoints:** `/battles`, `/battles/:id` (proposed)
- **What:** new field, the on-chain creator of the battle (Battle account byte
  257, validated 44/44 against the `InitializeBattle` fee payer). Distinct from
  the existing `creator_wallet`, which is a UI-attribution hint from the
  wavewarz.com webhook and is wrong ~⅓ of the time.
- **Expected magnitude:** none for existing fields. `creator_wallet` stays,
  relabelled in docs as a soft hint.

### C. `volume_source` added — ADDITIVE
- **Endpoints:** `/battles`, `/battles/:id`
- **What:** new enum field on each battle — `chain_trades` | `pool_field` |
  `site` | `unknown` — saying how `total_volume_*` was derived. `pool_field` /
  `site` rows are lower-confidence (a Helius fetch fell back).
- **Expected magnitude:** none. Lets consumers filter on volume confidence.

### D. Quick Battle artist record counts per song — RECOMPUTE
- **Endpoints:** artist records on `/leaderboards/artists` is unaffected
  (Main-Events-only); this is the **artist profile QB record** and any future
  QB-inclusive artist endpoint.
- **What:** an artist's Quick Battle W/L is derived from their **songs'**
  outcomes, not one flag per battle. A self-battle (one artist, two of their
  own songs) therefore contributes **one win and one loss** — because one song
  won and one lost. Today `artist-stats.ts` counts a self-battle once, as a
  coin flip.
- **Why:** the competitive unit of a Quick Battle is the song. Song win/loss
  and song win streaks are the product (merch and bounties are awarded on
  them). The rule "count per song" has always been the intent; losses were
  never being counted. This is not a penalty for self-battling — self-battles
  are legitimate and encouraged for feedback — it is just accurate scoring.
- **Expected magnitude:** ~367 Quick self-battles across history. Every
  self-battler picks up an equal number of extra wins and losses (one per
  self-battle each), so win *rate* barely moves — the records just get heavier
  and honest. Measured before → after (per primary wallet, secondary-wallet
  merges not applied so real numbers run a little higher):

  | Artist | self QBs | before (W-L) | after (W-L) | win rate |
  |---|---|---|---|---|
  | Lui | 62 | 110-70 | 146-96 | 61.1% → 60.3% |
  | Stormi | 56 | 79-85 | 108-112 | 48.2% → 49.1% |
  | Kata7yst | 24 | 91-105 | 101-119 | 46.4% → 45.9% |
  | Cannon Jones 973 | 22 | 92-85 | 105-94 | 52.0% → 52.8% |
  | R3PLIC4NT | 21 | 26-26 | 35-38 | 50.0% → 47.9% |
  | RoCkY2GriMeY | 12 | 49-81 | 55-87 | 37.7% → 38.7% |
  | GODCLOUD | 7 | 56-31 | 60-34 | 64.4% → 63.8% |
- **Also:** "opponents defeated" for Quick Battles excludes self and is stated
  as unique other artists — "battled X artists' songs".
- **Verify:** `SELECT count(*) FROM battles WHERE artist1_wallet=artist2_wallet
  AND is_quick_battle AND NOT is_test_battle` → 367.

### E. Community leaderboard excludes Benefit Battles — CORRECTION (shipped 2026-09-08)
- **Endpoints:** none — `/leaderboards/community` is a site page only, no public
  API endpoint.
- **What:** `src/app/leaderboards/community/page.tsx` now filters
  `event_subtype = 'charity'`. Benefit Battles (IndieZ vs ClassicZ, PolyRaiders
  wallet on both sides) are fundraisers, not competitor rivalries, and were
  collapsing into one wallet row with equal W/L.
- **Expected magnitude:** the community leaderboard drops the treasury/PolyRaiders
  wallet row; real competitors unaffected.

---

## Before 2026-09-08

No formal changelog was kept. Known API-affecting changes from the session log
(`~/.claude/.../memory/project_wavewarz_session_checkpoint_2026-07-16.md`):
2026-07-18 public API launch (7 endpoints); 2026-07-21 QB winner backfill +
`factors` field added; volume corrections via `fix-volume-from-chain.ts` for
battles settled before 2026-04-27.
