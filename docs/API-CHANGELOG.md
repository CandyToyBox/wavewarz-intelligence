# WaveWarZ Stats API — changelog

Every change to **what the public API returns** — a number, a field, a filter, or
how a record is computed. If you build on `wavewarz.info/api/public/*`, this is
the page to watch: a value moving under you without notice is a broken contract,
so we log it here.

Rendered at **wavewarz.info/api-docs/changelog**. Newest first.

**In scope:** response values, new/changed/removed fields, filter changes,
recomputations. **Not in scope:** internal database work with no API-visible
effect, UI-only changes, performance work.

**Entry shape:** date · endpoints affected · type (`ADDITIVE` — new optional
field, safe; `CORRECTION` — a wrong value fixed; `RECOMPUTE` — a formula changed;
`BREAKING` — a field renamed or removed) · what changed · how much your numbers
move · how to verify it yourself.

---

## 2026-09-09 — artist trade-fee rate corrected to 1.005%

**Endpoints:** `/stats` (`artistPayouts`), `/battles/:id` (`artistEarnings`), `/leaderboards/artists` (`totalEarnings`) — **Type:** RECOMPUTE

The per-trade fee is **1.500%** of gross buy volume, and the program splits it
**67 / 33 between the artist and the platform** — so the artist's share is
**1.005%** and the platform's is **0.495%**, not the 1.00% / 0.50% our older docs
stated. Confirmed by decomposing the on-chain SOL transfers on every buy across a
223-buy sample: the artist leg lands at exactly 1.0050%, the platform leg at
0.4950%.

**How much your numbers move:** artist trading-fee figures rise about **0.5%
relative** (roughly 9.28 → 9.33 SOL platform-wide). Platform figures fall ~1%
relative. Settlement bonuses (5% / 2% / 3% of the loser pool) are unchanged.

## 2026-09-09 — trader P&L and volume rebuilt from chain

**Endpoints:** `/leaderboards/traders` — **Type:** CORRECTION + ADDITIVE

The `trades` table was only holding **~43% of buy value and ~46% of sell value** —
per-trade rows are captured from a battle's on-chain vault history, and the fetch
was silently truncating on the largest battles. The trader leaderboard's
`netPnlSol`, `totalVolumeSol` and win/loss all derive from that table, so
aggregate trader P&L was reading **+204 SOL** when the real figure is about **−17**
(and that −17 is simply the fees flowing to artists and the platform — traders in
aggregate net out to roughly minus the fee, by design).

**The full trade history was re-fetched from chain.** After the rebuild:

| leg | now | on-chain | match |
|---|---|---|---|
| buys, by value | 712.73 SOL | 714.32 | 99.8% |
| sells, by value | 212.75 SOL | 213.89 | 99.5% |
| claims, by value | 478.51 SOL | 483.48 | 99.0% |
| distinct traders | 157 | 157 | complete |

**Aggregate trader P&L now reads −19.88 SOL** (vs an independent chain rebuild of
−17.04). **23 wallets in profit** (was showing 64); the 38 wallets that showed a
positive P&L with zero trades are gone.

**Each trader now carries `dataComplete` (boolean).** It is `true` only when
every battle that wallet traded has a fully verified trade history. When `false`,
`netPnlSol` / `totalVolumeSol` / win-loss for that wallet are a **lower bound**
and the site hides the P&L figure. The response also carries
**`dataCompleteShare`** (0–1) — the fraction of battles verified so far (currently
~0.96). As the last battles verify, wallets flip to `true` with their real
numbers.

**Not affected:** `/stats` volume, artist payouts, and settlement come from a
different table (`battles`) that was independently reconstructed and holds up to
within 0.7%.

## 2026-09-09 — `total_distribution_amount` backfilled from chain

**Endpoints:** `/stats`, `/battles`, `/battles/:id` — **Type:** CORRECTION

`total_distribution_amount` (the total SOL a battle settled) was populated by a
step that silently failed on most battles — it summed to ~44 SOL across 197
battles. It is now **449 SOL across 1,436 battles**, read directly from the
on-chain Battle account. Only that field changed; recorded winners were not
touched.

**How much your numbers move:** anything using `total_distribution_amount`, or a
"platform paid out" / "total settled" figure derived from it, rises roughly 10x.

**Verify:** `SELECT SUM(total_distribution_amount) FROM battles WHERE NOT is_test_battle` → ~449.

## 2026-09-08 — Quick Battle artist records count per song

**Endpoints:** none yet (`/leaderboards/artists` is Main-Event-only and unaffected; logged because it governs any future Quick-Battle artist record) — **Type:** RECOMPUTE

An artist's Quick Battle win/loss is the sum of their **songs'** outcomes, not
one flag per battle. When an artist runs two of their own songs against each
other (about 1 in 4 Quick Battles historically), one song wins and one loses — so
that contributes **one win and one loss** to the artist, not a coin flip.
"Opponents defeated" for Quick Battles excludes self and reads as unique other
artists — "battled X artists' songs".

**How much your numbers move:** win *rate* barely shifts (an equal win and loss
are added); records get heavier — e.g. one artist goes 110-70 → 146-96.

## 2026-09-08 — community leaderboard excludes Benefit Battles

**Endpoints:** none (the community leaderboard is a site page, not a public API endpoint; logged for completeness) — **Type:** CORRECTION

Benefit Battles (charity fundraisers, both sides on one wallet) were collapsing
into a single competitor row with an equal win/loss. They are now filtered out —
they're fundraisers, not rivalries.

---

## Coming soon (not shipped yet)

### `launcher_wallet` — ADDITIVE
A new field on `/battles` and `/battles/:id`: the wallet that actually created
the battle on chain. It differs from the existing `creator_wallet` (a UI hint
from wavewarz.com that is wrong about a third of the time), which will stay and
be relabelled in the docs as a soft hint.

### `volume_source` — ADDITIVE
A new field on `/battles` and `/battles/:id`: an enum
(`chain_trades` | `pool_field` | `site` | `unknown`) saying how that battle's
`total_volume_*` was derived, so you can filter on volume confidence.

---

## Before this changelog (2026-07)

No formal changelog was kept before September 2026. Known API-affecting changes:
**2026-07-18** — public API launch (7 endpoints); **2026-07-21** — Quick Battle
winners backfilled and the `factors` object added to battle responses;
**2026-04** — historical trading-volume figures repaired for battles that settled
before 2026-04-27.
