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

## 2026-10-12 — Five Quick Battles from October 9-10 added (they were missing from the index)

**Endpoints:** `/stats` (`volume.totalSol`, battle and trade counts), `/battles`, `/battles/:id`, `/leaderboards/*` — **Type:** ADDITIVE (new records)

Five Quick Battles played on the night of October 9 to 10 UTC never reached the index while its storage was locked (see the status note of 2026-10-10). They have now been imported: `1791598241`, `1791598919`, `1791599596`, `1791600998` and `1791603005`. Their trades and volume were read from the chain, and their poll, DJ Wavy, chart and overall results were taken from the wavewarz.com record. No existing battle was changed.

**How much your numbers move:** `volume.totalSol` in `/stats` rises by 0.7700 SOL, from 979.3181 to 980.0881 SOL (battles: 0.1500, 0.1500, 0.1500, 0.1500 and 0.1700 SOL). Battle and trade counts rise by 5 and 14. Leaderboards that count songs, artists or traders may shift slightly where these songs or wallets appear.

**How to verify:** `GET /api/public/battles/1791603005`, or sum the buy and sell instructions on that battle's vault.

---

## 2026-10-12 — 84 older battles' volume lowered to what the chain shows (overstated at save time)

**Endpoints:** `/stats` (`volume.totalSol`), `/battles`, `/battles/:id` (`volumeSol` per artist), `/leaderboards/*` where they total volume — **Type:** CORRECTION

Unlike the two corrections before it, this one moves numbers **down**. 84 battles (created December 2025 to March 2026) stored a volume higher than the buys and sells actually recorded for them. The most likely cause is that these rows kept the volume wavewarz.com calculated and sent with the battle, saved before the chain hydration step, and that figure counts differently from a parse of the vault's buy and sell instructions. For every one of the 84, the chain figure agrees with the sum of the battle's buy and sell rows in our trades table, and 83 of the 84 also match an independent chain read by the protocol team. Each was recomputed from the vault with `scripts/fix-volume-from-chain.ts` (passing the battle ids), the same method as the earlier corrections. Only `volumeSol` changed; winners, pools and payouts were not touched.

**How much your numbers move:** these 84 battles together go from 25.7580 to 18.7709 SOL (-6.9871). `volume.totalSol` in `/stats` falls by the same 6.9871 SOL, to 979.3181 SOL. Biggest single moves: battle `1769653724` 3.5010 to 2.6411 SOL; battle `1767577018` 1.3872 to 0.9062 SOL; battle `1770604952` 3.3119 to 2.8567 SOL.

**Not changed:** battle `1760215752` goes the other way (stored 0.3928, recorded trades 0.8597 SOL). It is an undercount, not part of this group, and was left alone pending review.

**Verify:** `GET /api/public/battles/:id` for any id below; `volumeSol` per side should now match the sum of buys and sells on the battle's vault.

| Battle | Old volume (SOL) | New volume (SOL) |
|---|---|---|
| 1773363954 | 0.4441 | 0.2384 |
| 1773363064 | 0.1431 | 0.0710 |
| 1773283234 | 0.3441 | 0.2806 |
| 1773280776 | 0.1638 | 0.0960 |
| 1770864845 | 0.1855 | 0.1287 |
| 1770863942 | 0.2702 | 0.2378 |
| 1770861399 | 0.1914 | 0.1193 |
| 1770778723 | 0.3982 | 0.2492 |
| 1770777051 | 0.0555 | 0.0406 |
| 1770776178 | 0.1815 | 0.0998 |
| 1770691594 | 0.0417 | 0.0272 |
| 1770690939 | 0.0732 | 0.0492 |
| 1770687895 | 0.0535 | 0.0250 |
| 1770604952 | 3.3119 | 2.8567 |
| 1770433152 | 0.0968 | 0.0470 |
| 1770432513 | 0.0929 | 0.0499 |
| 1770429382 | 0.0594 | 0.0280 |
| 1770350374 | 0.0377 | 0.0170 |
| 1770347141 | 0.0515 | 0.0283 |
| 1770345879 | 0.0456 | 0.0253 |
| 1770344348 | 0.0633 | 0.0312 |
| 1770177866 | 0.0259 | 0.0110 |
| 1770173708 | 0.1274 | 0.0650 |
| 1770173066 | 0.0535 | 0.0340 |
| 1770086986 | 0.0358 | 0.0160 |
| 1770084659 | 0.2328 | 0.1352 |
| 1770084006 | 0.0732 | 0.0350 |
| 1770010188 | 0.0633 | 0.0492 |
| 1769832928 | 0.0850 | 0.0410 |
| 1769830084 | 0.0535 | 0.0250 |
| 1769827554 | 0.3982 | 0.2541 |
| 1769826345 | 0.0929 | 0.0597 |
| 1769740892 | 0.0791 | 0.0602 |
| 1769739113 | 0.4751 | 0.2464 |
| 1769738375 | 0.0929 | 0.0646 |
| 1769653724 | 3.5010 | 2.6411 |
| 1769569533 | 0.0633 | 0.0366 |
| 1769567444 | 0.1226 | 0.1078 |
| 1769565160 | 0.2603 | 0.1300 |
| 1769305856 | 0.0732 | 0.0461 |
| 1769223203 | 0.1323 | 0.0848 |
| 1769221921 | 0.2406 | 0.1569 |
| 1769220732 | 0.1815 | 0.1379 |
| 1769219479 | 0.6622 | 0.4079 |
| 1769138519 | 0.4475 | 0.2947 |
| 1769132963 | 0.7331 | 0.6713 |
| 1769049450 | 0.4770 | 0.3761 |
| 1769048390 | 0.4475 | 0.2989 |
| 1769046157 | 0.0929 | 0.0598 |
| 1768961859 | 0.2152 | 0.1262 |
| 1768269376 | 0.0947 | 0.0459 |
| 1768015447 | 0.9301 | 0.6855 |
| 1767836853 | 0.5007 | 0.4981 |
| 1767753460 | 0.0535 | 0.0250 |
| 1767750503 | 0.0830 | 0.0597 |
| 1767749917 | 0.2899 | 0.2077 |
| 1767664587 | 0.1165 | 0.0884 |
| 1767664032 | 0.1520 | 0.1291 |
| 1767663370 | 0.1480 | 0.1446 |
| 1767577994 | 0.8021 | 0.5120 |
| 1767577018 | 1.3872 | 0.9062 |
| 1767373620 | 0.0574 | 0.0270 |
| 1767234060 | 0.2525 | 0.1872 |
| 1767201371 | 0.2170 | 0.1178 |
| 1767113663 | 0.1934 | 0.1215 |
| 1766953252 | 0.0082 | 0.0037 |
| 1766768091 | 0.1362 | 0.0901 |
| 1766682027 | 0.1737 | 0.0923 |
| 1766078531 | 0.2249 | 0.1427 |
| 1765938925 | 0.1027 | 0.0500 |
| 1765908738 | 0.0062 | 0.0010 |
| 1765689611 | 0.0062 | 0.0010 |
| 1765557253 | 1.1271 | 1.0553 |
| 1765480411 | 0.1027 | 0.0500 |
| 1765472117 | 0.3644 | 0.3500 |
| 1765471580 | 0.4846 | 0.4633 |
| 1765402044 | 0.2012 | 0.1984 |
| 1765387532 | 0.5558 | 0.3553 |
| 1765323871 | 0.0161 | 0.0106 |
| 1765298109 | 0.1618 | 0.1460 |
| 1765211439 | 0.3194 | 0.1600 |
| 1765047821 | 0.4278 | 0.2955 |
| 1765046272 | 0.2111 | 0.1296 |
| 1765036044 | 0.0062 | 0.0017 |

---

## 2026-10-12 — 33 more pre-2026-04 battles' volume corrected (pool-fallback bug)

**Endpoints:** `/stats` (`volume.totalSol`), `/battles`, `/battles/:id` (`volumeSol` per artist), `/leaderboards/*` where they total volume — **Type:** CORRECTION

A follow-up to the 2026-09-13 correction. 33 more battles (all created before 2026-04-27) still stored volume equal to the pool, an undercount left by the retired `backfill-volume.ts`. The earlier repair's automatic sweep missed them because its query stops at 1,000 rows and these are older than the newest 1,000. Each was recomputed from the vault's buy and sell instructions on chain (`scripts/fix-volume-from-chain.ts`, passing the battle ids), the same method as before. Only `volumeSol` changed; winners, pools and payouts were not touched.

**How much your numbers move:** these 33 battles together go from 7.3034 to 32.3005 SOL (+24.9971). `volume.totalSol` in `/stats` moves from 961.7748 to 986.7719 SOL (+2.6%). Biggest single moves: battle `1757898875` 1.8753 to 6.7992 SOL, `1757207855` 0.0514 to 2.6899 SOL, `1753063414` 0.0816 to 1.6156 SOL.

**Verify:** `GET /api/public/battles/:id` for any id below; `volumeSol` per side should now match the sum of buys and sells on the battle's vault.

| Battle | Old volume (SOL) | New volume (SOL) |
|---|---|---|
| 1770949491 | 0.3654 | 0.4286 |
| 1770516000 | 0.0098 | 0.0100 |
| 1769988803 | 0.0123 | 0.0274 |
| 1768529618 | 0.0200 | 0.0693 |
| 1764207785 | 0.4120 | 0.7812 |
| 1764205612 | 0.0402 | 0.5751 |
| 1763864825 | 0.1036 | 0.5514 |
| 1763042352 | 0.0256 | 0.0260 |
| 1762740734 | 0.2010 | 1.2093 |
| 1761788317 | 0.0087 | 0.4756 |
| 1761438641 | 0.0367 | 0.2809 |
| 1761437309 | 0.0318 | 0.2262 |
| 1760666134 | 0.6277 | 0.8611 |
| 1760663446 | 0.1791 | 0.7340 |
| 1760576678 | 0.3138 | 1.0460 |
| 1760574699 | 0.1273 | 1.2622 |
| 1760226775 | 0.0001 | 0.0198 |
| 1759715433 | 0.3682 | 2.0237 |
| 1759452150 | 0.0001 | 0.3969 |
| 1758505532 | 0.4037 | 2.3058 |
| 1758503315 | 0.1462 | 2.1584 |
| 1757898875 | 1.8753 | 6.7992 |
| 1757211619 | 0.0139 | 0.3156 |
| 1757207855 | 0.0514 | 2.6899 |
| 1756689557 | 0.8970 | 2.8626 |
| 1754876069 | 0.3833 | 1.9035 |
| 1754605788 | 0.0010 | 0.0050 |
| 1753856330 | 0.0001 | 0.0595 |
| 1753063414 | 0.0816 | 1.6156 |
| 1752335404 | 0.0030 | 0.0089 |
| 1751837807 | 0.2630 | 0.2670 |
| 1751421607 | 0.2069 | 0.2100 |
| 1751420288 | 0.0936 | 0.0950 |

## 2026-09-13 — 29 pre-2026-04 battles' volume corrected (pool-fallback bug)

**Endpoints:** `/stats` (`volume.totalSol`), `/battles`, `/battles/:id` (`volumeSol` per artist) — **Type:** CORRECTION

29 battles (24 from 2025-07-21 → 2026-03-10, plus 5 later single-trade battles
where the values coincidentally matched) had `volumeSol` exactly equal to
`poolSol` per artist side — a known-bad backfill (`scripts/backfill-volume.ts`,
retired) had written pool-adjacent chain state into the volume field instead of
true buy+sell flow, and the correct tool's auto-sweep never caught these because
they're old enough that a prior Helius pass returned no vault history for them.

Recomputed all 29 directly from vault buy/sell instruction data
(`scripts/fix-volume-from-chain.ts`). Net effect is small platform-wide (most of
these are low-volume early battles) but several individual battles move
meaningfully — e.g. battle `1753061890`: 1.7406 → 2.8110 SOL;
`1753665241`: 0.6370 → 2.3570 SOL. Full before/after list in the commit.

**Verify:** `GET /api/public/battles/:id` for any of the 29 IDs above — `volumeSol`
per side should no longer equal `poolSol` unless the battle genuinely had one
buy and no sell.

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
