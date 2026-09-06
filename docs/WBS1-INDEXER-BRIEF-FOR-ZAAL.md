# WaveWarZ Indexer / Record Layer — Full Context Brief

**From:** Samantha (owns the indexer, canonical Battle ID, public API)
**For:** Zaal + his agents, WBS-1 build
**Repo this describes:** `CandyToyBox/wavewarz-intelligence` ("Statz App V2"), live at `wavewarz-intelligence.vercel.app` and `wavewarz.info`
**DB:** Supabase project `supabase-wavewarz` (Postgres)
**Date of the numbers here:** 2026-09-06. Counts drift daily; treat them as "shape", re-pull for anything load-bearing.

This is written so your agents can design against facts, not inferences from the public API. Nothing here is secret — every field is public onchain data or already exposed through `wavewarz.info/api/public/*`. No keys, no secrets in this doc.

---

## 0. TL;DR for the six questions you asked

1. **Indexer**: one push webhook (`POST /api/webhook`), fired by wavewarz.com on battle create/update/settle. Not a Helius webhook, not a cron. Stores site-provided metadata, then hydrates authoritative pool/supply/volume/trades from mainnet via Helius. Details in §2.
2. **Canonical Battle ID = onchain `battle_id`**, same integer, zero transformation. It **is** the Unix start-second (empirically confirmed, §4). One ID system, not two. QBs also have a secondary `quick_battle_queue_id` (text); community battles have `community_round_id`. Neither is canonical.
3. **Operator attribution**: does not exist as a named concept, onchain or in DB. Closest today is `creator_wallet` (the launching wallet), present on 1,308 / 1,594 rows. Adding an `operator` dimension on my side is a few hours **if** derived from `creator_wallet`; the chain half is Hurricane's. §7.
4. **Artist identity**: exists but thin. Canonical ID is `artist_profiles.artist_id` (UUID). 52 profiles, mostly the Main Event roster. `audius_handle` populated on only 2 rows, `twitter_handle` sparse. Resolution is done at query time, not stored. Your Audius+X resolver is a clean fit to populate those columns. §6.
5. **Launch fees**: **not tracked at all** — no column, no table. Cannot give you a count from the DB. Nothing in our data contradicts "effectively none". To answer it, scan the treasury wallet for battle-init transfers — you're better positioned. §8.
6. **Settlement 3% cut**: goes to the `wavewarz_wallet` set on the battle at init. That is `FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37` on 1,443 / 1,594 battles. We do **not** isolate the 3% as its own number anywhere. Who controls that wallet is a Hurricane question. §9.

---

## 1. System map — who owns which surface

| Surface | Owner | Repo | Notes |
|---|---|---|---|
| Solana program, source, IDL, upgrade key | Hurricane (`Hurric4n3ike`) | private | Program ID `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`. Upgrade authority is a **single EOA**, not a multisig, dormant since 2025-05-22 deploy. |
| wavewarz.com (the product / frontend / battle launch UI) | Hurricane | private | This is what fires the webhook into my indexer. |
| Indexer, canonical Battle ID, public API, artist/song identity, leaderboards | **Samantha** | `CandyToyBox/wavewarz-intelligence` | This doc. |
| Protocol repo (onchain decode from mainnet), analytics, embeds | Zaal | `bettercallzaal/wavewarz-protocol` (private) | Your 12-verified-field decode. |
| wwtracker (the lab) | Zaal | wwtracker | Newsletter, surface pages, composer. |

**Data flow:**
```
wavewarz.com  --(battle create/update/settle)-->  POST /api/webhook (my app)
                                                      |
                                        Step 1: upsert site-provided metadata
                                                      |
                                        Step 2: read Solana mainnet via Helius
                                          - Battle PDA account  (pool/supply/winner/distribution)
                                          - battle_vault PDA tx history (per-trade buys/sells -> trades table)
                                                      |
                                                  Supabase
                                                      |
                              wavewarz.info pages  +  /api/public/*  +  leaderboards
```
Nightly scripts fill gaps the webhook can't: claims (settlement withdrawals) and queue fees.

---

## 2. The indexer, end to end

### 2.1 Endpoint

`POST /api/webhook` — source: `src/app/api/webhook/route.ts`.
`GET /api/webhook` returns `{status: "WaveWarZ webhook active"}` as a health check.

### 2.2 Auth

- Header `x-webhook-secret` must equal `process.env.WEBHOOK_SECRET`, compared with a timing-safe equal (`src/lib/rate-limit.ts` → `timingSafeEqual`).
- Per-IP rate limit keyed `webhook:<ip>`; repeated bad-secret attempts get recorded and throttled (429). An authenticated caller is never throttled.
- Rotation of `WEBHOOK_SECRET` is coordinated with Hurricane (he holds the sender side). Rotation was flagged pending as of the 2026-07-21 security pass.

### 2.3 Trigger — important

- **wavewarz.com pushes to it.** Battle created → push. Battle updated (pools, judging) → push. Battle settled → push.
- It is **not** a Helius webhook and **not** a cron/poller. There is no Vercel cron config (`vercel.json` is absent) and no GitHub Action in this repo.
- The handler also accepts the **Supabase Database Webhook** envelope shape (`{ type, table, record: {...} }`) and unwraps `record`; in practice the live sender posts **flat** battle fields at top level. Both work.
- **Consequence:** if wavewarz.com fails to fire, nothing is indexed until someone runs a backfill script by hand. There is no independent chain-tailing process that would catch a missed battle automatically. This is the single biggest fragility in the pipeline and matters for a "many arenas" future.

### 2.4 Payload → what Step 1 stores (verbatim from the payload)

Upsert into `battles` on conflict `battle_id`. Fields taken straight from the webhook payload:

```
battle_id, status, artist1_name, artist1_wallet, artist1_music_link, artist1_twitter,
artist1_pool, artist1_supply, total_volume_a,
artist2_name, artist2_wallet, artist2_music_link, artist2_twitter,
artist2_pool, artist2_supply, total_volume_b,
image_url, stream_link, battle_duration,
winner_decided, winner_artist_a, unique_traders, trade_count, total_distribution_amount,
wavewarz_wallet, creator_wallet,
is_community_battle, is_quick_battle, is_test_battle,   (is_main_battle is a GENERATED column, never written)
community_round_id, quick_battle_queue_id, split_wallet_address,
poll_votes_a, poll_votes_b, poll_winner, poll_finalized_at,
dj_wavy_winner (from payload.quick_battles_dj_wavy_winner), dj_wavy_reasoning,
quick_battles_dj_wavy_judged_at, quick_battles_chart_winner,
quick_battles_final_artist1_pool, quick_battles_final_artist2_pool,
quick_battles_charts_finalized_at, quick_battles_overall_winner,
quick_battles_winner_decided, quick_battles_winner_artist_a
```

Pool/volume values here are **wavewarz.com's own calculations** and are overwritten in Step 2 by onchain values where available.

QB winner shortcut: if `quick_battles_winner_decided` is true in the payload, it is propagated into the generic `winner_decided` / `winner_artist_a` fields immediately (so the app shows a result before onchain settlement finishes).

### 2.5 Step 2 — chain hydration (`src/lib/solana/hydrate.ts`)

**a) Battle state account.** `hydrateOnchainData(battleId)`:
- Derive Battle PDA (see §3.2), `connection.getAccountInfo(pda)` via Helius RPC (`https://mainnet.helius-rpc.com/?api-key=…`).
- Parse bytes with `parseBattleAccount` (§3.1).
- Overwrites in DB: `artist1_supply`, `artist2_supply`, `total_distribution_amount`, and `artist1_pool` / `artist2_pool` **only if** onchain pool > 0 (a fast ACTIVE webhook may hit an unsettled account).
- Sets `battle_duration` from `end_time - start_time` if positive.
- Winner: for ENDED battles, if onchain `winner_decided` → use it. Else for Quick Battles compute 2-of-3 (Charts = larger pool, Poll = `poll_winner`, DJ Wavy = `dj_wavy_winner`); Charts always counts, Poll and DJ Wavy count when parseable; ≥2 decides; charts-only fallback otherwise. Main/Community are **never** auto-decided — they wait for the admin judging panel.

**b) Per-trade history + true volume.** Only for ENDED battles with valid `start_time_sec` / `end_time_sec`. `fetchBattleTradesFromChain(battleId, start, end)`:
- Derive `battle_vault` PDA, GET `https://api-mainnet.helius-rpc.com/v0/addresses/<vault>/transactions?api-key=…&limit=100`, paginate `before=<signature>`, cap 20 pages / 2000 tx.
- 429 handling: up to 6 retries with linear backoff. **If Helius still fails, the function returns `null` and the whole volume/trade write is skipped** — partial history is never mistaken for complete history.
- For each tx within `[start, end]`: find the instruction whose `programId` is the WaveWarZ program, base58-decode its data.
  - byte 16 (`data[16] !== 0`) = **isArtistA** flag.
  - BUY discriminator → `amount_sol` = `u64 LE at data[8]` / 1e9 (gross SOL the buyer committed). `trade_type` = `buy_a` | `buy_b`.
  - SELL discriminator → `amount_sol` = sum of `nativeTransfers` where `fromUserAccount == vault` / 1e9 (net SOL returned). `trade_type` = `sell_a` | `sell_b`.
  - trader wallet = `tx.feePayer`.
- `total_volume_a` / `total_volume_b` = sum of the buy+sell rows on each side.
- **Fallback** if Helius fails or timestamps missing: `artist_sol_balance` (cumulative buys only — an undercount).
- Rows written via `replace_battle_trades(p_battle_id, p_trades)` RPC (§5.2).

**c) Song registry.** For Quick Battles, `registerBattleSongs` resolves each Audius music link to its canonical track and upserts `song_registry` (non-fatal).

### 2.6 What the webhook does NOT capture

| Data | Why not | How it's filled |
|---|---|---|
| Claims (trader settlement withdrawals, `trade_type='claim'`) | Happen any time after `end_time`, including weeks later via `claim.wavewarz.info`. Not bounded by the battle window. | Nightly `scripts/backfill-claims-from-chain.ts`. `replace_battle_trades` deliberately **excludes** `claim` rows from its delete so a re-fired webhook can't wipe them. |
| Skip Queue / Add to Queue fees | Plain SystemProgram SOL transfers straight to the treasury wallet — outside the Anchor program. No instruction data, no memo, nothing tying them to a `battle_id`. | `scripts/backfill-queue-fees.ts` → `treasury_fee_events`. Classified purely by amount (0.005 = add_to_queue; 0.02 + n·0.01 = skip_queue). Amount-based classification is fuzzy — a round-number donation to the same wallet would misclassify. |
| **Launch fees** | Same problem — if charged, it's a transfer at init with no battle linkage we parse. | **Nothing. Not tracked.** |
| Sponsorships / donations | Off-protocol. | Not tracked in this system. |

### 2.7 Env / infra

- `WEBHOOK_SECRET` — shared with Hurricane's sender.
- `NEXT_PUBLIC_HELIUS_API_KEY` — the Helius key. **Domain rules (hard-won):** `api.helius.xyz` is dead (403 on everything). Use `mainnet.helius-rpc.com` for RPC, `api-mainnet.helius-rpc.com` for Enhanced Transactions.
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role used by webhook + scripts, bypasses RLS).
- Helius account ownership: currently on a personal Google login. Being moved to a shared/org account + key rotated (independent of anything in WBS-1).

### 2.8 Backfill scripts (all under `scripts/`, run with `npx tsx`)

| Script | Purpose |
|---|---|
| `backfill-battles.ts` | CSV import of new battles only (`ignoreDuplicates`, never touches existing rows). CUTOFF_DATE gated. |
| `fix-volume-from-chain.ts` | **Canonical volume backfill.** Parses BUY/SELL from vault history. Battles settled before 2026-04-27 have corrupted volume — this fixes them. |
| `backfill-volume.ts` | **Deprecated / do not use** — reads net pool state, not gross flow. |
| `backfill-trades-from-chain.ts` | Rebuilds `trades` rows for a battle range. |
| `backfill-claims-from-chain.ts` | Nightly — pulls `claimShares` withdrawals into `trades` as `trade_type='claim'`. |
| `backfill-queue-fees.ts` | Nightly — treasury wallet scan → `treasury_fee_events`. |
| `backfill-qb-outcomes.ts` | Recomputes QB 2-of-3 winners. |
| `backfill-song-registry.ts` | Resolves Audius links for all QBs. |
| `merge-artists.ts`, `battle_artist_overrides` tooling | Identity consolidation (§6). |
| `ops/nightly-integrity-check.sh` + launchd plist | Local nightly data-integrity audit. |

---

## 3. Onchain decode — what my parser reads

This is my independent decode. **Cross-check it against your protocol repo's 12 verified fields — my parser reads more than 12, and if we disagree on offsets that's a finding.**

### 3.1 Battle account byte layout (`src/lib/solana/parser.ts`)

Little-endian throughout. Offsets from start of account data:

| Offset | Bytes | Field | Type |
|---|---|---|---|
| 0 | 8 | Anchor discriminator | skip |
| 8 | 8 | `battleId` | u64 |
| 16 | 4 | 4 × bump | u8 each, skip |
| 20 | 8 | `startTime` | i64 (Unix seconds) |
| 28 | 8 | `endTime` | i64 (Unix seconds) |
| 36 | 32 | `artistAWallet` | Pubkey |
| 68 | 32 | `artistBWallet` | Pubkey |
| 100 | 32 | `wavewarzWallet` | Pubkey |
| 132 | 32 | `artistAMint` | Pubkey |
| 164 | 32 | `artistBMint` | Pubkey |
| 196 | 8 | `artistASupply` | u64 |
| 204 | 8 | `artistBSupply` | u64 |
| 212 | 8 | `artistASolBalance` | u64 (lamports, cumulative buys) |
| 220 | 8 | `artistBSolBalance` | u64 |
| 228 | 8 | `artistAPool` | u64 (lamports, net vault balance for side A — goes to ~0 after settlement) |
| 236 | 8 | `artistBPool` | u64 |
| 244 | 1 | `winnerArtistA` | bool |
| 245 | 1 | `winnerDecided` | bool |
| 246 | 1 | `transaction_state` enum | u8, skip |
| 247 | 1 | `isInitialized` | bool |
| 248 | 1 | `isActive` | bool |
| 249 | 8 | `totalDistributionAmount` | u64 (lamports) |

**Semantics that bite people:**
- `artistAPool` is **net vault balance**, not volume. It is ~0 after settlement. Storing it as "volume" is the #1 historical bug in this system.
- True volume = sum of gross BUY amounts + net SOL returned on SELLs, from vault tx history.
- `artistASolBalance` = cumulative buys only (never decremented on sells) → usable as a volume floor / fallback, always an undercount.

### 3.2 PDA seeds (`src/lib/solana/pda.ts`)

All under program `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`, `battleId` as **u64 LE**:

| PDA | Seeds |
|---|---|
| Battle account | `["battle", u64LE(battleId)]` |
| Battle vault | `["battle_vault", u64LE(battleId)]` |
| Artist A mint | `["artist_a_mint", u64LE(battleId)]` |
| Artist B mint | `["artist_b_mint", u64LE(battleId)]` |

`battleId` is the **only** dynamic seed. Two battles with the same `battleId` collide on every one of these PDAs. See §4.

### 3.3 Instruction discriminators (`hydrate.ts`)

```
BUY   [40, 239, 138, 154, 8, 37, 106, 108]
SELL  [184, 164, 169, 16, 231, 158, 199, 196]
CLAIM [130, 131, 29, 237, 134, 20, 110, 245]
```
- BUY data: bytes 0-7 discriminator, bytes 8-15 = `u64 LE` amount (lamports), byte 16 = isArtistA flag (`!= 0`).
- Other instructions seen but not parsed here: `endBattle`, `initializeBattle`, `claimShares` (claims parsed separately in `fetchBattleClaimsFromChain`).

---

## 4. Canonical Battle ID

### 4.1 Statement

- **DB column:** `battles.battle_id` — `bigint`, `NOT NULL`, `UNIQUE` (`battles_battle_id_key`). The table's true PK is a separate `id uuid`, but **every** app route, API route, URL and join keys on `battle_id`.
- It is **identical** to the onchain `battleId` (§3.1). No offset, no hashing, no namespace. The indexer feeds `Number(payload.battle_id)` straight into `getBattleAddress()` as the u64 LE seed.
- **It is the Unix creation second.** Confirmed empirically:

| `battle_id` | `to_timestamp(battle_id)` (UTC) | row `created_at` (webhook landed) | delta |
|---|---|---|---|
| 1788580997 | 2026-09-05 04:03:17 | 2026-09-05 04:03:24 | +7s |
| 1788580083 | 2026-09-05 03:48:03 | 2026-09-05 03:48:18 | +15s |
| 1788579360 | 2026-09-05 03:36:00 | 2026-09-05 03:36:11 | +12s |
| 1788577000 | 2026-09-05 02:56:40 | 2026-09-05 02:56:47 | +8s |

`battle_id` is a few-to-45 seconds **before** our `created_at` — i.e. it's stamped at battle creation on the client/site, and `created_at` is when the webhook reached us. Min `battle_id` in the table is `7777777` (a vanity/test battle).

### 4.2 Implications for WBS-1

- **One ID system.** You do not need to reconcile a separate "canonical ID" against the chain — they're the same number. Anything you build keyed on `battle_id` lines up with my DB and the public API for free.
- **Collision risk is real and structural.** `battleId` is the only PDA seed and it's second-resolution. Two arenas creating a battle in the same wall-clock second produce the same `battleId` → same Battle PDA, same vault PDA, same mints. Invisible at today's ~1 battle at a time. A hard blocker for "many arenas creating battles concurrently". This is a **program change** (Hurricane): needs a second seed component (creator pubkey, or a nonce/counter).
- Secondary IDs, not canonical: `quick_battle_queue_id` (text, QB only), `community_round_id` (numeric, community only). Don't build on these as the primary key.

---

## 5. Database schema

Supabase Postgres, project `supabase-wavewarz`. 37 tables in `public`. The ones that matter for WBS-1:

### 5.1 `battles` — 1,594 rows

Full column list, grouped:

**Identity / status**
`id uuid PK` · `battle_id bigint UNIQUE NOT NULL` · `created_at timestamptz` · `status varchar` · `last_scanned_at timestamptz`

**Type flags**
`is_quick_battle bool` · `is_community_battle bool` · `is_main_battle bool` *(GENERATED — computed by DB from the other two, never inserted)* · `is_test_battle bool` · `event_subtype varchar` (`standard`|`charity`|`spotlight`|`prediction`)

**Sides A / B** (in Quick Battles, `artist1_name` / `artist2_name` hold **SONG TITLES**, not artist names)
`artist1_name text` · `artist1_wallet text` · `artist1_music_link text` · `artist1_twitter text` · `artist1_pool numeric` · `artist1_supply numeric` · `total_volume_a numeric` · (same for `artist2_*` / `_b`)

**Identity links (see §6)**
`artist_a_profile_id uuid` · `artist_b_profile_id uuid` — **both populated on ZERO rows. Dead columns.** Identity is resolved at query time.

**Wallets**
`creator_wallet text` — the launching wallet. **Present on 1,308 / 1,594; null on 286** (mostly older Main Events + backfills). Closest thing to operator attribution.
`wavewarz_wallet text` — platform/treasury wallet set at battle init. `FNjYt…kq37` × 1,443, `BBQ5…Xrjm` × 15, null × 136.
`split_wallet_address text`

**Outcome / settlement**
`winner_decided bool` · `winner_artist_a numeric` (1.0 / 0.0, not bool) · `total_distribution_amount numeric` (SOL, from onchain `totalDistributionAmount`) · `battle_duration integer` (seconds) · `total_distribution_amount` non-zero on only **197 rows**, 44.15 SOL total.

**Trading rollups**
`trade_count integer` · `unique_traders integer` · `recent_trades_cache jsonb`

**Quick Battle 3-factor judging**
`poll_votes_a/b integer` · `poll_winner text` · `poll_finalized_at` · `dj_wavy_winner text` · `dj_wavy_reasoning text` · `dj_wavy_confidence numeric` · `quick_battles_dj_wavy_judged_at` · `quick_battles_chart_winner text` · `quick_battles_final_artist1_pool` / `_artist2_pool numeric` · `quick_battles_charts_finalized_at` · `quick_battles_overall_winner text` · `quick_battles_winner_decided bool` · `quick_battles_winner_artist_a bool`

**Main Event judging**
`main_event_human_judge text` · `main_event_x_poll_winner text` · `main_event_sol_vote_winner text` · `main_event_judged_at`

**Quick Battle metadata**
`quick_battle_queue_id text` · `quick_battle_track_name text` · `quick_battle_artist1_audius_handle` / `_artist2_audius_handle text` · `quick_battle_artist{1,2}_audius_profile_pic text` · `quick_battle_artist{1,2}_profile text` · `community_round_id numeric`

**Misc**
`image_url` · `stream_link` · `youtube_replay_link` · `charity_name` · `fiat_donation_proof_link`

**Factor value formats (normalize these):** `poll_winner`, `dj_wavy_winner`, `main_event_*_winner` can each be `"A"` / `"B"` / `"artist_a"` / `"artist_b"` / `"TIE"` / a literal artist name. Helpers: `parseFactorWinner()` in the webhook, `normalizeFactorSide()` in the public API.

**Indexes:** `battles_pkey (id)`, `battles_battle_id_key (battle_id)`. That's it — no index on `creator_wallet`, `wavewarz_wallet`, `created_at`, or the type flags. Fine at 1.6k rows; revisit before a partner-facing query load.

### 5.2 `trades` — 10,371 rows

```
id uuid PK
battle_id bigint            (nullable, NO foreign key, NO index)
trader_wallet text NOT NULL  (= tx fee payer)
trade_type varchar           buy_a | buy_b | sell_a | sell_b | claim
amount_sol numeric NOT NULL
timestamp timestamptz
```

- **No unique constraint** on `(battle_id, trader_wallet, trade_type, timestamp)`. Idempotency is enforced only by `replace_battle_trades()` holding `pg_advisory_xact_lock(battle_id)` while it does delete-then-insert in one call. A past race (two calls, separate delete + insert) produced 709 exact-dupe rows across 79 battles — hence the function.
- `replace_battle_trades(p_battle_id bigint, p_trades jsonb)`: advisory-locks the battle_id, `DELETE FROM trades WHERE battle_id = $1 AND trade_type <> 'claim'`, then bulk-inserts from the jsonb array. Claims are preserved.
- Claims are ground truth for trader payouts — the actual SOL the vault sent each wallet, no estimation.

### 5.3 `treasury_fee_events` — 645 rows ⚠️ **RLS DISABLED**

```
id uuid PK
signature text UNIQUE
fee_type text        skip_queue | add_to_queue
amount_sol numeric
from_wallet text
timestamp timestamptz
created_at timestamptz
```

- **This table has Row Level Security disabled.** Anyone with the Supabase anon key can read or write every row. It's the only unprotected table in the DB. Remediation is `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + a read policy; the backfill script uses the service role so it's unaffected. On my list to fix.
- Contents: skip_queue 315 events / 11.12 SOL; add_to_queue 330 events / 1.65 SOL. All since 2026-07-02 (that's when the backfill script's window starts, not when fees started).
- Classification is amount-based and fuzzy (§2.6).

### 5.4 Identity tables

`artist_profiles` — 52 rows
```
artist_id uuid            <-- THE canonical artist ID
display_name text
audius_handle text        <-- populated on 2 / 52
twitter_handle text       <-- sparse
primary_wallet text       <-- populated on 49 / 52
profile_picture_url text
custom_pfp_url text
social_links jsonb
social_stats jsonb
bio text
created_at timestamptz
```

`artist_wallets` — 8 rows (secondary wallets → profile)
```
wallet_address text
artist_id uuid
```

`battle_artist_overrides` — 16 rows (per-battle reassignment of a side to a specific profile; used for sub-profiles like "AI LUI" vs "LUI" sharing a wallet)
```
battle_id bigint
wallet text
artist_id uuid
created_at timestamptz
```
This is the **sanctioned** attribution-editing mechanism. It does not touch battle outcomes — only which profile a side's stats roll up to.

`song_registry` — 929 rows (Audius track enrichment cache)
```
permalink_key text UNIQUE  (canonicalSongKey — see below)
music_link text
audius_track_id text
title / artist_name / artist_handle / genre / artwork_url text
play_count int
resolved_at timestamptz
```

### 5.5 Other tables (context, not WBS-1 critical)

`platform_stats` (1 row, Spotify stream counts), `platform_events` (2), `main_events` / `main_event_rounds` (0 — events are derived at query time, not stored, see `src/lib/event-grouping.ts`), `clips*` / `clip_*` (the Clip Engine pipeline), `dj_wavey_*` / `dj_wavy_import` (DJ Wavy content), `league_bible` / `artist_bibles` / `storylines` / `battle_theses` / `sponsor_inventory` / `record_book_marks` (the internal League Hub, `/hub`, RLS-locked), `auth_failures`.

---

## 6. Artist identity — how it actually works

### 6.1 The problem it solves

- Quick Battles store **song titles** in `artist1_name` / `artist2_name`.
- Artists use multiple wallets across battles.
- One human artist can have sub-personas ("LUI" and "AI LUI").
- We need one canonical artist entity for profile pages + leaderboard links + win/loss records.

### 6.2 The resolution chain (done at QUERY time, not stored)

Primary: `src/lib/actions/identity.ts`, `src/lib/artist-stats.ts`, `src/lib/leaderboards/artists.ts`.

```
wallet_address
   -> artist_wallets.wallet_address       -> artist_id      (secondary wallets)
   -> artist_profiles.primary_wallet      -> artist_id      (primary wallet)
audius_handle
   -> artist_profiles.audius_handle (lowercased) -> artist_id
(battle_id, wallet)
   -> battle_artist_overrides             -> artist_id      (per-battle override, wins over wallet match)
fallback
   -> normalized display name match
```

`getArtistLeaderboard()` builds a `wallet → canonical profileId` map in memory for every request, applies overrides as `battle_id|wallet → artist_id`, then aggregates wins/losses/volume per canonical artist. Event-level win/loss (Main Events) is majority-of-rounds, computed in `src/lib/event-grouping.ts` — **never per round**.

### 6.3 Coverage / state

- 52 profiles — essentially the Main Event roster + notable QB artists. Not the long tail.
- `audius_handle` on **2**, `twitter_handle` sparse, `primary_wallet` on 49.
- `artist_a_profile_id` / `artist_b_profile_id` on `battles`: **0 rows**. The columns were added for a stored-resolution approach that was never backfilled. If WBS-1 wants stored resolution, these are the columns to populate.

### 6.4 Where your resolver fits

Your Audius + X handle resolution (in your lab) is a direct feed for `artist_profiles.audius_handle` / `twitter_handle`, which are the empty columns. No conflict with anything here. If you want a canonical artist ID to key on, it's `artist_profiles.artist_id` (UUID) — but be aware coverage is thin and you may be creating most of the rows.

### 6.5 Canonical song key (`src/lib/song-identity.ts`)

For QB song-level analytics, songs are keyed by music-link permalink, **not** title (titles are hand-entered and inconsistent):
```
audius.co/{handle}/{slug}      -> "audius:{handle}/{slug}"   (lowercased)
other URL                      -> "{host}{pathname}"          (lowercased, trailing / stripped)
no link                        -> "title:{normalized title}"
```

---

## 7. Operator attribution — current state and cost

### 7.1 What exists

- **Nothing named.** No operator/arena concept in the DB schema or the onchain Battle account.
- `creator_wallet` — the wallet that launched the battle. Captured verbatim from the webhook payload. **1,308 / 1,594 populated, 286 null** (older Main Events, backfilled rows). 70 distinct creator wallets across the platform's history.
- `wavewarz_wallet` — set at init, 2 distinct values, effectively a constant (the platform).

### 7.2 What a change looks like

**My side (DB + indexer):** small, ~a few hours.
- New table `operators (wallet text PK, name text, slug text, …)`.
- New nullable `battles.operator_id` (or resolve `creator_wallet → operator` at query time, same pattern as artist identity).
- Populate in the webhook alongside `creator_wallet`.
- Expose in `/api/public/battles`.

**Caveats that aren't code:**
1. Onchain has no operator field, so operator = "whoever's wallet signed the launch". That's trust-the-launcher, not a protocol guarantee. If WBS-1 needs cryptographic operator attribution, that's a **program change** (Hurricane) — likely the same change that fixes the collision (add creator/nonce to the PDA seeds and store operator on the account).
2. 286 rows have no `creator_wallet` at all — backfilling operator intent for those needs a data source we don't have.
3. Everything cross-arena in the PRD depends on this existing first. It's genuinely gating.

---

## 8. Launch fee economics — what we can and can't tell you

- **Not tracked.** No column, no table, no script.
- Platform docs (`CLAUDE.md`): Quick Battle launch fee `~$0.69` (USD-denominated), Community `~$4` (USD-denominated). Your message said "0.69 quick or 4 SOL community" — the 0.69 is dollars, not SOL.
- Skip/Add-to-queue fees ARE tracked (`treasury_fee_events`): 645 events, **12.77 SOL total, ever** (11.12 skip + 1.65 add).
- To get a real launch-fee count: scan the treasury wallet(s) — `FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37` (1,443 battles), `BBQ5bY8aH6NkDB7R4dZzvT1P3MANJr8CnESpJnAnXrjm` (15) — for transfers around battle-init timestamps. Your protocol repo already decodes instructions, so you can likely tie `initializeBattle` txs to fee transfers better than I can from this side.
- **If Zaal's "effectively none" is right:** nothing in our data contradicts it, and yes — a 0.15% operator share of *trading volume* is tiny. Total platform trading volume is on the order of tens to low hundreds of SOL (see the public `/api/public/stats` for the current figure — `volume.totalSol`). 0.15% of that is ~1-2 SOL lifetime. The PRD's partner economics need to be volume-share-based with realistic volume, or fee-based with a real fee that doesn't exist yet.

---

## 9. Settlement / treasury

- Onchain: the Battle account carries `wavewarzWallet` (offset 100, §3.1). The 3% platform settlement share and the loser-pool splits are executed by the program at `endBattle`.
- In our DB: `wavewarz_wallet` per battle — `FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37` on 1,443 / 1,594, older `BBQ5…Xrjm` on 15, null on 136 (mostly community battles).
- `total_distribution_amount` (from onchain) is non-zero on 197 battles, 44.15 SOL total. That's the total settled through the program, **not** the 3% isolated — we don't break the 3% out anywhere.
- **What I can confirm:** the address that receives it. **What I can't:** who controls `FNjYt…kq37`, or whether platform settlement SOL is swept elsewhere afterward. That wallet is set by the program/site at init, not by anything in my system. Hurricane question.

---

## 10. Public API — what partners read today

Base: `https://wavewarz.info/api/public`. All GET, no auth, CORS `*`, `Cache-Control` 30-60s, `is_test_battle=false` always filtered out. Docs page: `wavewarz.info/api-docs`. Source: `src/app/api/public/*`.

| Endpoint | Params | Returns |
|---|---|---|
| `/stats` | — | `volume {totalSol, totalUsd, last24hSol, last7dSol}`, `liveBattle`, `artistPayouts`, `traderClaims {totalSol, withdrawalCount}`, `battles {total, mainEvents, mainBattles, quickBattles, communityBattles}`, `solPriceUsd`. |
| `/battles` | `type` (main\|quick\|community), `live=true`, `limit` (≤200), `offset` | Flat feed. Per battle: `battleId, type, live, winnerDecided, winnerSide (artist1\|artist2), artist1/2 {name, wallet, musicLink, poolSol, volumeSol, profilePictureUrl, twitterHandle, albumArtUrl}, factors {…}, imageUrl, createdAt, endsAt, url`. |
| `/battles/:id` | — | Above + `artistEarnings {artist1/2: {tradingFeesSol, settlementBonusSol, totalSol}}`, `battleDurationSeconds`, `streamLink`. |
| `/events` | `subtype`, `live=true`, `limit` | Main Events grouped to best-of-3-rounds. Event winner = majority of rounds. |
| `/leaderboards/artists` | `limit` (≤500) | Canonical-artist win/loss/volume ranking. |
| `/leaderboards/songs` | `limit` | Song-level (QB) ranking, keyed by canonical song key. |
| `/leaderboards/traders` | `limit` | Trader P&L from `trades`. |

**Not exposed anywhere in the API:** `creator_wallet`, `wavewarz_wallet`, operator anything, `split_wallet_address`, raw trade rows, `treasury_fee_events`, `total_distribution_amount`.

**Known caveat baked into the code:** Supabase PostgREST caps at 1,000 rows/request. `/stats` uses a `fetchAll` paginator; `/battles` does not (it paginates by `offset` and is capped at 200/page anyway). The 1,000-row cap was the root cause of a past stats-divergence bug — anything you build that aggregates over all battles must paginate.

---

## 11. Known gaps & data-quality issues (be aware when building on this)

1. **No independent chain tailer.** Missed webhook = missing battle until manual backfill. Critical for multi-arena.
2. **`battle_id` second-collision** (§4.2). Program-level.
3. **`trades` has no unique constraint** and **no `battle_id` index** (§5.2). Dupe-safe only via the RPC's advisory lock. Add both before partner query load.
4. **`treasury_fee_events` RLS disabled** (§5.3).
5. **`artist_a/b_profile_id` dead columns** — identity is query-time only (§6.3).
6. **Volume before 2026-04-27** was corrupted (pool-state-as-volume); fixed by `fix-volume-from-chain.ts` but re-verify any historical row you depend on.
7. **Queue-fee classification is amount-based and fuzzy** (§2.6).
8. **`total_volume_*` fallback to `sol_balance`** (buys-only undercount) whenever the Helius trade fetch fails — a row can silently hold a low estimate rather than true volume. No flag distinguishes "true" from "fallback" volume in the schema.
9. **4 unverified Battle-account fields** in your protocol repo — my parser reads `transaction_state` (skipped), the 4 bump bytes, `isInitialized`, `isActive`. If those are among your 4 unverified, my offsets are a starting hypothesis, not gospel — verify against a known account.

---

## 12. Open questions for Hurricane (not answerable from my side)

1. Who controls `FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37`? Is settlement SOL swept from it?
2. Are launch fees actually charged by the current program? Which instruction, what amount, to which wallet?
3. Is there any appetite for a program upgrade to (a) add a second PDA seed to kill `battle_id` collisions and (b) store an operator pubkey on the Battle account?
4. IDL release — private IDL gates ~6 PRD steps. Even a read-only IDL share unblocks the SDK work.
5. `WEBHOOK_SECRET` rotation (pending since 2026-07-21).

---

## 13. Numbers snapshot (2026-09-06)

| Metric | Value |
|---|---|
| `battles` rows | 1,594 (1,501 non-test) |
| — quick | 1,307 |
| — community | 141 |
| — main (rounds) | 171 |
| — test | 93 |
| `trades` rows | 10,371 |
| `treasury_fee_events` | 645 (12.77 SOL lifetime) |
| `artist_profiles` | 52 |
| `artist_wallets` | 8 |
| `battle_artist_overrides` | 16 |
| `song_registry` | 929 |
| battles with `creator_wallet` | 1,308 / 1,594 |
| battles with non-zero `total_distribution_amount` | 197 (44.15 SOL) |
| distinct `wavewarz_wallet` | 2 (+ null) |
| distinct `creator_wallet` | 70 |
| `battle_id` range | 7,777,777 → 1,788,580,997 |

Re-pull anything load-bearing — `execute_sql` against the `supabase-wavewarz` project, or hit `/api/public/stats`.
