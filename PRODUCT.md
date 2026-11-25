# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Fans and traders** (primary). They come after a battle, or while one is on, to see whether their side won, how the 2-of-3 result was decided, and what they can claim. Traders are not paid out automatically: they must claim (withdraw) themselves on wavewarz.info/claim or wavewarz.com.
- **Artists** (primary). They check their record, rankings, Wave ID and what they earned from each battle, and they share their artist page. This includes the Founding Artists being recruited through the private Playbook.
- **Partners, investors and press** (secondary). They use the site as proof that the platform is real, busy and paying artists.
- **The WaveWarZ team** (internal). They use /admin and /hub for judging, clips, schedule, media, artist profiles and events.

## Product Purpose

wavewarz.info ("WaveWarZ Statz") is the public record of WaveWarZ, the live music battle platform on Solana. It shows every battle, result, ranking and payout, each one checkable onchain. Success means a fan can answer "did my side win, and why?" and an artist can answer "what did I earn?" within seconds, and anyone can verify either answer on Solscan.

## Positioning

It is the verifiable record. Every number comes from Solana onchain data: vault transaction history, battle accounts and settlement. Every battle links its receipts (the vault on Solscan, the battle account, the battle page). Artists are paid automatically from trading: 1% of every trade on their side, plus a settlement bonus. A stats site without the onchain program behind it cannot truthfully copy this.

## Operating Context

- **The sibling site:** wavewarz.com is where battles are launched, traded and watched. wavewarz.info records and explains them. The wavewarz.com redesign is applied there by Hurric4n3ike and is out of scope for this file.
- **Schedule:** Quick Battles run on the livestream Monday to Friday at 8:30pm EST. Main Events are on Sundays (around 7 to 8pm EST) and special dates, in X Spaces and on stream.
- **Data:** battle data reaches the Supabase database by webhook and is backfilled from vault history. Solana Mainnet program ID `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`. The full platform reference is in CLAUDE.md.
- **Main routes:** /battles, /leaderboards (artists, songs, community, traders, clippers), /artist/[id], /trader, /claim, /calendar, /voter-guide, /wavid, /benefits, /blog, /api-docs, /playbook. Internal: /admin and /hub.

## Capabilities and Constraints

- **Quick Battles** (song vs song). `artist1_name` / `artist2_name` hold SONG TITLES, never artist names. The winner is 2 of 3 from Poll (live listener vote), Charts (the bigger SOL pool) and DJ Wavy (AI judge). Before March 10, 2026 it was V1, charts only. The song is the unit of Quick Battle rankings, keyed by its Audius link.
- **Main Events** (artist vs artist). Multi-round events, decided 2 of 3 from the human judge, X poll and SOL vote. Win/loss is counted per event, not per round.
- **Fees** are fixed by the smart contract. Per trade: artist 1%, platform 0.5%. Settlement of the losing pool: 50% to losing traders, 40% to winning traders, 5% to the winning artist, 2% to the losing artist, 3% to the platform.
- **Volume** is parsed BUY and SELL flows from vault history. It is never pool or account state. Battle duration is always end_time minus start_time.
- **Battle outcomes:** stored winners and outcome data are never changed without approval. `battle_artist_overrides` is the only sanctioned exception.
- **Each artist's Wave ID** is drawn from their public Quick Battle records (by Quan). Not every artist has one yet.

## Brand Commitments

- **Name:** WaveWarZ for display, logos, headlines and product names; WaveWarz in running sentences, FAQ, legal text, alt text and meta tags. WaveZStation always keeps the capital Z.
- **ONCHAIN** is one word.
- **No emojis. No purple anywhere.**
- **No betting or gambling language and no financial promises.** Never state or imply a dollar outcome. Fans "trade" and "back a side". Paid promotional copy follows a stricter word list.
- **Fonts:** Space Grotesk, Outfit and JetBrains Mono only. Rajdhani and Inter are retired.
- **Icons:** the WaveWarZ icon set (`src/components/ww-icon-set.ts`, source in the homepage working copy at `icons/set.json`).
- **Nothing is final** until Candy marks a page FINISHED AND FINAL. Changes are targeted, named and reversible.
- **"Next American Idol"** is an internal metaphor only, never public copy.

## Evidence on Hand

- Every battle, trade and payout is in the Supabase database and on Solana (Solscan links per battle).
- Audius album art for Quick Battle songs; battle flyers for Main Events; artist profile pictures; Wave ID art at /api/wavid-art/[handle].
- Live platform totals and leaderboards are computed from that data.
- **Not on hand:** testimonials, customer quotes, press quotes and benchmark claims. Do not invent them.

## Product Principles

1. **Every number has a receipt.** If it is shown, it can be traced to onchain data or a Solscan link.
2. **Answer the fan and the artist first.** Who won and why, and what the artist earned, come before everything else.
3. **Show the result as it was decided.** Present the 2-of-3 outcome honestly. A pool size is never presented as the reason someone won.
4. **Keep every number, but rank them.** Nothing is hidden or dropped; less important figures sit quieter.
5. **One league, one look.** wavewarz.info and wavewarz.com share the same brand system, so a fan moves between them without noticing a seam.
