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

## 2026-09-08 — trader leaderboard: P&L suppressed for unverified wallets — CORRECTION (shipped)

**Endpoints:** `/leaderboards/traders` (+ the `/leaderboards/traders` and
`/trader/[wallet]` site pages).
**Type:** CORRECTION + ADDITIVE.

**What changed.** Zaal's complete chain scan (`bettercallzaal/wavewarz-protocol`,
`recon/PNL-DIAGNOSIS.md`) showed the `trades` table holds only **~43% of buy
value** and **~46% of sell value** — confirmed here with
`select trade_type, count(*), sum(amount_sol) from trades group by 1` (buys
304.8 SOL vs 714 real, sells 99.4 vs 214, claims 1,949 rows vs ~3,390). Buy/sell
rows are written only on a successful full vault-history fetch, and the biggest
battles fail most often, so the gap concentrates in the largest battles.

The trader leaderboard's `netPnlSol`, `totalVolumeSol` and win/loss are all
derived from that table, so they were undercounted — aggregate trader P&L read
**+204 SOL** when the real figure is about **-17** (that -17 is the fees, paid to
artists and the platform, working as designed).

Now: each trader carries **`dataComplete`** (new field). It is `true` only when
every battle the wallet traded has `battles.trades_status = 'complete'` **and**
the wallet never claimed in a battle where it has no buy row. When `false`,
`netPnlSol` / `totalVolumeSol` / wins / losses are a **lower bound** and the site
hides the P&L figure. The response also carries **`dataCompleteShare`** (0–1),
the fraction of battles verified so far. Self-heals as
`backfill-trades-from-chain.ts --force` rebuilds the history from chain.

**Resolution (backfill complete, 2026-09-09).** Full `--force` re-fetch of 1,451
battles from chain. `trades` now holds:

| | now | Zaal's chain scan | |
|---|---|---|---|
| buys, by value | 712.73 SOL | 714.32 | 99.8% |
| sells, by value | 212.75 SOL | 213.89 | 99.5% |
| claims, by value | 478.51 SOL | 483.48 | 99.0% |
| buy/sell rows | 11,651 | 11,968 | 97.4% |
| distinct traders | 157 | 157 | complete (the 12 missing wallets are back) |

**Aggregate trader P&L now reads −19.88 SOL** (was showing +204), against Zaal's
independent chain figure of −17.04 — the ~3 SOL residual is the last ~1–3% of
rows. **23 wallets in profit** (was 64), **0 zero-trade phantom-profit wallets**
(was 38). `dataCompleteShare` ≈ 0.96; 153 of 157 wallets are `dataComplete:true`
with their real (mostly negative) P&L shown; 4 remain hidden pending the last
battles.

**Not affected:** `/stats` volume, artist payouts, settlement — those read from
`battles`, independently reconstructed by Zaal to within 0.7%.

## 2026-09-09 — `total_distribution_amount` backfilled from chain — CORRECTION (shipped)

- **Endpoints:** `/stats`, `/battles`, `/battles/:id`
- **What:** the column was populated by a hydration step that failed on most
  battles — it summed to ~44 SOL across 197. Now **449.03 SOL across 1,436
  battles**, from Battle account byte 249 (`scripts/apply-settlement-from-chain.ts`,
  data from Zaal's `recon/settlement-from-chain.csv`). Only that column was
  written — `winner_decided` / `winner_artist_a` untouched.
- **Magnitude:** any consumer using `total_distribution_amount` or a derived
  "platform paid out" / "artist settlement" figure sees it rise ~10x.
- **Verify:** `SELECT SUM(total_distribution_amount) FROM battles WHERE NOT is_test_battle` → ~449.

## 2026-09-08 — Quick Battle artist record counts per song — RECOMPUTE (shipped, commit 3707d90)

- **Endpoints:** no public endpoint exposes a QB-inclusive artist record yet —
  `/leaderboards/artists` is Main-Events-only and unaffected. This is the
  `/trader/[wallet]`-style artist profile record and any future QB artist
  endpoint. Logged so a consumer building on it knows the rule.
- **What:** an artist's Quick Battle W/L is the sum of their **songs'** outcomes,
  not one flag per battle. A self-battle (one artist, two of their own songs)
  contributes **one win and one loss**, because one song won and one lost. The
  code previously counted a self-battle once, as a coin flip.
- **Why:** the competitive unit of a Quick Battle is the song; song win streaks
  are the product (merch + bounties). "Count per song" was always the intent —
  losses just weren't being counted. Not a penalty; self-battles are encouraged.
- **Magnitude:** ~367 QB self-battles across history. Win *rate* barely moves
  (equal W and L added); records get heavier. e.g. Lui 110-70 → 146-96,
  Stormi 79-85 → 108-112.
- **Also:** "opponents defeated" for QB excludes self → "battled X artists' songs".

## 2026-09-08 — Community leaderboard excludes Benefit Battles — CORRECTION (shipped, commit 3707d90)

- **Endpoints:** none — `/leaderboards/community` is a site page, no public API
  endpoint. Logged for completeness.
- **What:** filters `event_subtype = 'charity'`. Benefit Battles (IndieZ vs
  ClassicZ, PolyRaiders wallet on both sides) are fundraisers, not rivalries, and
  were collapsing into one wallet row with equal W/L.

---

## Pending — not yet shipped

### `launcher_wallet` added — ADDITIVE
- **Endpoints:** `/battles`, `/battles/:id`
- **What:** new field — the on-chain battle creator (Battle account byte 257 =
  the `admin` field = the `initializeBattle` signer, confirmed 40/40 against the
  IDL + 44/44 against transaction logs). Distinct from `creator_wallet`, which is
  a UI-attribution hint from the webhook and is wrong ~⅓ of the time.
- **Magnitude:** none for existing fields. `creator_wallet` stays, relabelled a
  soft hint in the docs.

### `volume_source` added — ADDITIVE
- **Endpoints:** `/battles`, `/battles/:id`
- **What:** new enum on each battle — `chain_trades` | `pool_field` | `site` |
  `unknown` — how `total_volume_*` was derived. `pool_field` / `site` are
  lower-confidence (a Helius fetch fell back).
- **Magnitude:** none. Lets consumers filter on volume confidence.

---

## Before 2026-09-08

No formal changelog was kept. Known API-affecting changes from the session log
(`~/.claude/.../memory/project_wavewarz_session_checkpoint_2026-07-16.md`):
2026-07-18 public API launch (7 endpoints); 2026-07-21 QB winner backfill +
`factors` field added; volume corrections via `fix-volume-from-chain.ts` for
battles settled before 2026-04-27.
