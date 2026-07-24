# WaveWarz Platform — Full Reference
*Last Updated: February 2026 | Version 2.0*

---

## 1. CORE MECHANICS

### What Is WaveWarz?
Decentralized music battle platform on Solana where artists compete in timed battles and fans trade ephemeral tokens on outcomes. Artists earn directly from trading volume via automatic SOL wallet payouts. Platform uses hybrid data architecture: static metadata registry + real-time on-chain hydration via Solana blockchain.

### Battle Types & Duration

#### Main Events (Artist vs Artist)
- **Duration**: Variable (typically 20+ minutes, recorded in seconds via timestamps)
  - Use `start_time` and `end_time` fields to calculate actual duration
  - Not fixed to 20 minutes - any duration possible
- **Format**: Multiple rounds per event (typically 3 rounds, can be 5+) with 2 songs per artist per round
- **Structure**: Live-streamed championship battles (Sundays ~8pm EST + special events)
- **Judging**: Triple system - Human judge + X (Twitter) poll + SOL vote (2 out of 3 wins)
- **Leaderboard**: Ranked by artist outcomes (wins/losses, volume) on Artist Leaderboard
- **Identifier**: Battle ID only (no queue ID)

#### Quick Battles (Song vs Song)
- **Duration**: Variable (average 6-9 minutes, recorded in seconds via timestamps)
  - Calculated from `start_time` and `end_time`
  - Each song fully plays, then 30 seconds remain for final trades
- **Format**: Song/track matchups sourced from Audius links (artist catalogs synced to WaveWarz.com)
- **Data Input**: Artist1_name & Artist2_name fields contain **SONG TITLES** (not artist names)
  - This is crucial: In Quick Battles, the "artist" field actually contains the song name
  - Both tracks come from Audius links: `https://audius.co/{artist_handle}/{song_name}`
- **Artist Participation**: Artists DON'T need to be present
  - Anyone can sync their Audius catalog to WaveWarz.com
  - Artist's SOL wallet is linked automatically
  - Payouts are automatic regardless of artist presence
- **Live Broadcast Format**: M-F at 8:30pm EST via YouTube Livestream (started March 2026)
  - One battle runs at a time (queue-based, not simultaneous)
  - Wallet-connected listeners on wavewarz.com participate in real-time poll
- **Launch Process**:
  1. Any user launches a quick battle with 1-minute pre-timer
  2. Joins the queue — only one battle runs at a time
  3. Timer starts -> trading charts open -> music plays automatically
  4. First song plays completely
  5. Second song plays completely
  6. After second song finishes: **30 seconds remaining** for final trades
  7. Timer ends -> trading stops -> winner determined by 3-factor system
- **Winner Determination**: 3-factor system (2 out of 3 wins)
  - **Poll**: Wallet-connected listener vote on wavewarz.com (live during battle)
  - **Charts (SOL)**: Trading volume/pool dominance (larger pool wins this factor)
  - **DJ Wavy**: AI Judge — evaluates and picks a winner
- **Skip Queue Mechanic** (revenue feature):
  - Queue position matters — only one battle plays at a time on the livestream
  - Pay to jump to front of queue: base cost **0.02 SOL**
  - Each successive skip costs **+0.01 SOL more** than whoever is currently at the front
  - Example: Position 1 paid 0.02 → you pay 0.03 to jump them → next person pays 0.04, etc.
  - Creates a live auction for queue priority; all skip fees go to WaveWarz revenue
- **Leaderboard**: Ranked by song/track performance (wins/losses, volume) on Song Leaderboard
- **Unique Identifiers**:
  - Battle ID (primary, used everywhere)
  - Quick Battle Queue ID (unique to Quick Battles only)
- **Launch Fee**: ~$0.69 SOL to WaveWarz per quick battle
- **Detection**: Quick Battle identified by Audius link pattern in artist1_music_link / artist2_music_link fields

#### Community Battles (Side A vs Side B)
- **Duration**: Variable (typically 20-ish minutes, recorded in seconds via timestamps)
- **Format**: Artist vs Artist OR any custom matchup (sports, memes, subjective competitions, anything)
- **Structure**: User-hosted events with custom rules
- **Data Input**: Uses artist1/artist2 OR side_a/side_b in input fields on smart contract
- **Leaderboard**: Ranked by battle outcomes (wins/losses, volume)
- **Identifier**: Battle ID only (no queue ID)
- **Launch Fee**: ~$4 SOL to WaveWarz per community battle

### Key Identifier: Battle ID
- **Battle ID**: Unique integer identifier for EVERY battle across entire ecosystem:
  - WaveWarz Solana program (on-chain)
  - WaveWarz.com site (frontend)
  - Battle page URLs
  - WaveWarz Analytics platform (database)
  - Claim feature (recovery)
  - Everywhere in system
- **Format**: Integer (u64 little-endian on-chain, indexed in database)
- **Critical**: Same Battle ID used for battle lookup across all systems

### Trading Mechanics
- Fans buy/sell ephemeral artist/song tokens during battle window
- Prices move on square-root bonding curve (price increases/decreases with volume)
- All trades denominated in SOL (no platform token required)
- Tokens are **destroyed immediately** when battle concludes
- Winner determination:
  - Main/Community: Triple system (judges + X poll + SOL vote)
  - Quick: 3-factor system (Poll + Charts + DJ Wavy)

---

## 2. PAYOUT STRUCTURE

### Revenue Sources for WaveWarz
1. **Trading Fees**: 0.5% of all trading volume (artist gets 1.0%, platform gets 0.5%)
2. **Quick Battle Launch Fee**: ~$0.69 SOL per quick battle
3. **Community Battle Launch Fee**: ~$4 SOL per community battle
4. **Settlement Bonus**: 3% from loser's pool per battle (automatic)
5. **Skip Queue Fees**: Artists/users pay to jump to front of Quick Battle queue
   - Base skip: 0.02 SOL | Each subsequent skip: +0.01 SOL over current front-of-queue price
   - 100% of skip fees go to WaveWarz revenue (not distributed to traders/artists)
   - High-engagement nights generate significant skip revenue layered on top of trading fees
6. **Sponsorships**: Brand partnerships for exposure during YouTube streams, battles, videos, posts
7. **Donations**: Direct donations from fans via DONATE TO WAVEWARZ button (goes to wavewarz_wallet)

### Fee Architecture for Traders
**Total Platform Fees: 1.5%** (vs 30%+ industry standard)
- Artist Share: 1.0% of all trading volume (instant SOL payout to artist wallet)
- Platform Share: 0.5% for operations
- **Result**: 98.5% of every trade stays in ecosystem

### Prize Distribution (When Battle Ends)
When a battle concludes, the loser's pool is split:

| Recipient | Share | Notes |
|-----------|-------|-------|
| Losing Traders | 50% | Risk mitigation - refunded 50% of their investment |
| Winning Traders | 40% | Distributed proportionally to winners |
| Winning Artist | 5% | Settlement bonus |
| Losing Artist | 2% | Consolation bonus |
| WaveWarz Platform | 3% | Operations & development |

**Verification**: 50% + 40% + 5% + 2% + 3% = 100%

### Artist Earnings Calculation
**All artists receive automatic payouts to their linked SOL wallet**

**Winning Artist Total**:
- Trading Fees = 1% of their total trading volume during battle
- Settlement Bonus = Loser's Pool x 0.05
- **Total = Trading Fees + Settlement Bonus**

**Losing Artist Total**:
- Trading Fees = 1% of their total trading volume during battle
- Settlement Bonus = Loser's Pool x 0.02
- **Total = Trading Fees + Settlement Bonus**

**Payout Timing**: Immediate on-chain execution (no delays, fully automated)

### Trader Earnings & Withdrawal

**Traders DO NOT receive automatic payouts** - they must manually claim based on their **proportional token holdings**:

#### Withdrawal Mechanism
1. **Primary Method**: Click "Withdrawal Tokens" button at bottom of battle page immediately after settlement
2. **Recovery Method**: If trader forgets to withdraw:
   - Visit https://claim.wavewarz.info
   - Copy/paste wallet address
   - Click button to visit unclaimed battle pages
   - Withdrawal SOL from each battle
3. **Requirement**: Must be connected to WaveWarz.com with same wallet used when trading the battle

**Unclaimed Funds**: Traders can check unclaimed SOL balances at https://claim.wavewarz.info by wallet address

#### Proportional Payout Calculation

**For WINNING SIDE Traders:**
```
Trader's Payout =
  (Trader's Winning Tokens / Total Winning Tokens) x Winner's Pool
  +
  (Trader's Winning Tokens / Total Winning Tokens) x (Loser's Pool x 0.40)

= Proportional share of their own pool + proportional share of 40% bonus
```

**For LOSING SIDE Traders:**
```
Trader's Original Value =
  (Trader's Losing Tokens / Total Losing Tokens) x Loser's Pool

Trader's Actual Payout = Trader's Original Value x 0.50

= Traders keep 50% of their original invested value
```

**Key Point**: A trader's payout is **directly proportional to the percentage of tokens they hold** compared to the total supply of tokens for that artist/side.

### Donation Buttons (On Each Battle Page)
1. **DONATE TO ARTIST** — Goes directly to artist's SOL wallet
2. **DONATE TO WAVEWARZ** — Goes to wavewarz_wallet (platform treasury)

### Example Payout Math
```
Battle: Artist A vs Artist B
Total Trading Volume: $10,000 SOL
Winner: Artist A
Artist A Pool (Winner): $5,500 SOL
Artist B Pool (Loser): $4,500 SOL

Artist A Earnings (Automatic):
- Trading Fees: 1% of $5,500 = $55
- Settlement Bonus: $4,500 x 5% = $225
- Total: $280 SOL

Artist B Earnings (Automatic):
- Trading Fees: 1% of $4,500 = $45
- Settlement Bonus: $4,500 x 2% = $90
- Total: $135 SOL

WaveWarz Platform (Automatic):
- $4,500 x 3% = $135 SOL

TRADER PAYOUTS (Manual Withdrawal Required):

Winning Traders (Artist A):
- Trader holding 10% of Artist A tokens:
  = (0.10 x $5,500) + (0.10 x $1,800) = $730

Losing Traders (Artist B):
- Trader holding 5% of Artist B tokens:
  = (0.05 x $4,500) x 0.50 = $112.50
```

### Current Performance Metrics
- Average Volume Per Match: $800-2,500 SOL
- Break-even Threshold: $500 per battle ($2.50 platform trading fee)
- Real Payouts: Instant SOL transfers
- Transaction Cost: ~$0.00025 per transaction

---

## 3. TECHNICAL SPECIFICATIONS

### Blockchain Foundation
- **Blockchain**: Solana Mainnet
- **Language**: Rust (Anchor framework)
- **Program ID**: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`
- **Frontend**: React/TypeScript with Solana Web3.js
- **RPC**: Helius Enhanced RPC (key in `NEXT_PUBLIC_HELIUS_API_KEY`, Vercel env — never hardcode it here)
- **Database**: Supabase (Postgres) for analytics & historical data
- **Music Integration**: Audius SDK (for Quick Battle detection & catalog sync)

### Program Derived Addresses (PDAs)
Battle accounts are derived deterministically using Little-Endian (LE) encoding:

```typescript
Seeds: [b"battle", battle_id.toBuffer("le", 8)]           // Battle State Account
Seeds: [b"battle_vault", battle_id.toBuffer("le", 8)]     // Battle SOL Vault
Seeds: [b"artist_a_mint", battle_id.toBuffer("le", 8)]    // Artist A Token Mint
Seeds: [b"artist_b_mint", battle_id.toBuffer("le", 8)]    // Artist B Token Mint
```

**Critical**: Seed order matters. Any change to seed order breaks PDA derivation.

### Account Structure (Battle State)
```
battle_id: u64          | start_time: i64        | end_time: i64
artist_a_wallet: Pubkey | artist_b_wallet: Pubkey | wavewarz_wallet: Pubkey
artist_a_mint: Pubkey   | artist_b_mint: Pubkey
artist_a_supply: u64    | artist_b_supply: u64
artist_a_sol_balance: u64 | artist_b_sol_balance: u64
artist_a_pool: u64      | artist_b_pool: u64
winner_artist_a: bool   | winner_decided: bool
transaction_state: TransactionState (Idle | InProgress)
is_initialized: bool    | is_active: bool
total_distribution_amount: u64 | admin: Pubkey
battle_bump: u8 | artist_a_mint_bump: u8 | artist_b_mint_bump: u8 | battle_vault_bump: u8
```

### Program Instructions
1. **initializeBattle** - Create new battle (battle_id, battle_duration, start_time)
2. **initializeMints** - Create token mints for Artist A and Artist B shares
3. **buyShares** - Purchase artist tokens (amount, artistA bool, minTokensOut, deadline)
4. **sellShares** - Sell artist tokens (amount, artistA bool, minSolOut, deadline)
5. **endBattle** - Conclude battle and distribute artist/platform payouts
6. **claimShares** - Traders claim their proportional SOL payout

### Data Reading Architecture
- Custom DataView parser reads raw byte arrays directly (no heavy IDL libraries)
- Volume = sum of all NativeTransfers into Battle Vault PDA (via Helius Enhanced API)
- **Trade-off**: Brittle-mapping risk if Solana program struct changes

### Helius RPC
```typescript
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
```
Never hardcode the actual key value in this file or anywhere else committed to git — this repo is public. Current key lives only in Vercel's `NEXT_PUBLIC_HELIUS_API_KEY` env var.

**CRITICAL — Helius API domains (2026-04-27):**

| Purpose | Correct URL |
|---------|-------------|
| RPC (getAccountInfo, getProgramAccounts) | `https://mainnet.helius-rpc.com/?api-key=KEY` |
| Enhanced TX batch (POST `/v0/transactions`) | `https://api-mainnet.helius-rpc.com/v0/transactions` |
| Address TX history (GET `/v0/addresses/{addr}/transactions`) | `https://api-mainnet.helius-rpc.com/v0/addresses/{addr}/transactions` |
| **DEAD — always 403 — NEVER USE** | `https://api.helius.xyz/v0/...` |

`api.helius.xyz` is retired. It returns 403 silently, which caused every `fetchBattleVolumeFromChain()` call to fail and fall back to storing the net pool state as volume — corrupting `total_volume_a/b` for all battles.

### Volume Calculation Architecture

**True trading volume ≠ account pool state.** Two distinct fields in the battle account:
- `artistASolBalance` (offset 212) — running balance tracker. NOT volume.
- `artistAPool` (offset 228) — current vault net (buys minus sells). Goes to zero after settlement. NOT volume.

**True gross trading volume** = parse instruction data from vault PDA transaction history:
- `buyShares` discriminator `[40,239,138,154,8,37,106,108]` → amount = `data.readBigUInt64LE(8)` (lamports the buyer paid)
- `sellShares` discriminator `[184,164,169,16,231,158,199,196]` → amount = sum of `nativeTransfers` where `fromUserAccount === vaultAddr`
- Filter to `[start_time, end_time]` window; artist A/B flag = `data[16] !== 0`

Correct backfill tool: `scripts/fix-volume-from-chain.ts` (URL fixed 2026-04-27).
Wrong tool: `scripts/backfill-volume.ts` (reads `artistASolBalance`, not gross flow — do not use).

### Wallet Integration
- Primary: Phantom | Alternative: Solflare | Other Solana wallets supported

---

## 4. WEBHOOK DATA STRUCTURE

### Data Flow
WaveWarz.com (Solana program) -> Webhook -> WaveWarz Analytics Application

### Webhook Payload Fields
```javascript
{
  id: String (UUID),
  battle_id: Integer,                    // on-chain identifier, unique everywhere
  status: String,                        // "active" | "completed" | "settled"
  created_at: Date,

  artist1_name: String,                  // Artist OR Song title (Quick) OR Side A
  artist2_name: String,                  // Artist OR Song title (Quick) OR Side B
  artist1_wallet: String,                // Solana address
  artist2_wallet: String,                // Solana address
  artist1_music_link: String,            // Audius URL — detects Quick Battle
  artist2_music_link: String,            // Audius URL — detects Quick Battle

  artist1_pool: Integer,                 // lamports
  artist2_pool: Integer,                 // lamports
  artist1_supply: Integer,               // tokens minted
  artist2_supply: Integer,               // tokens minted

  wavewarz_wallet: String,
  image_url: String,
  battle_duration: Integer,              // seconds (or calc: end_time - start_time)
  winner_decided: Boolean,
  winner_artist_a: Float,                // 1.0 = A wins, 0.0 = B wins

  artist1_twitter: String,
  artist2_twitter: String,
  stream_link: String,
  creator_wallet: String,

  is_community_battle: Boolean,
  is_quick_battle: Boolean,
  is_test_battle: Boolean,

  quick_battle_queue_id: String,         // Quick Battles only
  community_round_id: Float,             // Community Battles only
  split_wallet_address: Float,
}
```

### Quick Battle Detection Logic
Quick Battle if: `is_quick_battle === true` AND `quick_battle_queue_id` present AND both music links match `https://audius.co/{handle}/{song}`

When detected:
- `artist1_name` / `artist2_name` = **SONG TITLES** (not artist names)
- Use Song Leaderboard (not Artist Leaderboard)
- Winner = 3-factor: Poll + Charts (SOL) + DJ Wavy (2 of 3 wins)
- Duration ~6-9 min average; skip fees: 0.02 SOL base, +0.01 per successive skip

---

## 5. KEY CONSTANTS & PERCENTAGES

```
Artist Revenue Per Trade:           1.0%
Platform Revenue Per Trade:         0.5%
Total Transaction Fees:             1.5%

Settlement (Loser's Pool):
  Winning Traders:                  40%
  Losing Traders (Refund):          50%
  Winning Artist:                    5%
  Losing Artist:                     2%
  WaveWarz Platform:                 3%
                                   ----
                                   100%

Quick Battle Launch Fee:            ~0.69 SOL
Community Battle Launch Fee:        ~4 SOL

Break-even Volume Per Battle:       500 SOL
Quick Battle pre-timer:             1 minute
Final trading window (Quick):       30 seconds after both songs play
Skip Queue base fee:                0.02 SOL (+0.01 each successive skip)
```

---

## 6. CONSTRAINTS & IMMUTABLE RULES

### Cannot Be Changed
1. Battle duration NOT fixed — use timestamps
2. Main/Community winner: 2 of 3 (human + X poll + SOL vote)
3. Quick Battle winner: 2 of 3 (Poll + Charts + DJ Wavy)
4. Fee split: 1.0% artist, 0.5% platform (baked into protocol)
5. Settlement matrix: 50/40/5/2/3 (immutable)
6. Tokens ephemeral — destroyed at settlement
7. SOL-only trading — no platform tokens
8. Artists: instant automatic payouts
9. Traders: manual withdrawal required
10. Battle ID: unique, used everywhere across all systems

### Must Always Respect
- Order: initialize → wallets linked → trades accumulate → timer → winner → settlement → tokens burned
- All on-chain data is single source of truth
- Duration calculated from timestamps, not constants
- Trader funds indexed by wallet address + battle_id
- Nightly go/no-go (Quick): first 6 WaveWarz-launched battles must avg >= 0.5 SOL to continue stream
- Settlement is final and irreversible

### Regulatory / Operational
- Legal: Delaware C-Corporation
- Entertainment platform with prediction market elements
- Risk disclosure required before trading
- No promise of returns

---

## 7. CRITICAL INTEGRATION POINTS

### Database Integration (Supabase)
- Historical battle data stored (not on-chain)
- Real-time webhook updates from blockchain
- Battle records indexed by battle_id (primary key everywhere)
- Row Level Security (RLS) for user data isolation
- Artist/Song Leaderboard data derived from battle records

### Audius SDK Integration
- Artist catalog syncing to WaveWarz.com
- Detection pattern: `https://audius.co/{handle}/{song}`

### Performance Caching
- Active battles: Poll blockchain (RPC calls)
- Historical: Read from cached database instantly
- New battles: Update via webhook
- Cache TTL: 5 minutes

---

## 8. DATA FIELD REFERENCE

```typescript
// Identifiers
battle_id: Integer                  // THE primary key — everywhere
quick_battle_queue_id: String       // Quick Battles only
community_round_id: Float           // Community Battles only

// Status
status: "active" | "completed" | "settled"

// Artist/Side
artist1_name: String                // Artist OR Song title (Quick Battles)
artist2_name: String
artist1_wallet: String              // Solana address
artist2_wallet: String
artist1_music_link: String          // Audius URL (Quick Battle detection)
artist2_music_link: String

// Pool & Supply
artist1_pool: Integer               // TVL in lamports
artist2_pool: Integer
artist1_supply: Integer             // tokens minted
artist2_supply: Integer

// Battle Mechanics
battle_duration: Integer            // seconds (calc from timestamps)
winner_decided: Boolean
winner_artist_a: Float              // 1.0 = A wins, 0.0 = B wins

// Classification
is_main_battle: Boolean             // inferred: not quick, not community
is_community_battle: Boolean
is_quick_battle: Boolean
is_test_battle: Boolean
```

### Critical Relationships
- 1 Main Event = Multiple rounds = Multiple battles (each with own battle_id)
- 1 Quick Battle = 1 Song vs 1 Song = 1 battle (~6-9 min)
- 1 Trade = 1 SOL amount → N tokens via square-root bonding curve

---

## 9. COMMON CALCULATIONS

```typescript
// Artist earnings
WINNING: Trading_Fees (1% of volume) + Loser_Pool × 0.05
LOSING:  Trading_Fees (1% of volume) + Loser_Pool × 0.02
// Both sent AUTOMATICALLY to artist_wallet

// Platform revenue
Per trade: amount × 0.005
At settlement: Loser_Pool × 0.03
At launch: 0.69 SOL (Quick) or 4 SOL (Community)

// Trader payout — MANUAL withdrawal required
Winner side: (own_tokens / total_supply) × winner_pool + (own_tokens / total_supply) × (loser_pool × 0.40)
Loser side:  ((own_tokens / total_supply) × loser_pool) × 0.50

// Battle duration
Duration_Seconds = end_time - start_time

// Quick Battle winner: 2 of 3 factors
Poll (wallet-connected voters) | Charts (larger pool wins) | DJ Wavy (AI judge)

// Main/Community winner: 2 of 3 judges
Human judge | X (Twitter) poll | SOL vote
```

---

## 10. VISUAL IDENTITY & BRANDING

### Color Palette
- **Deep Space Navy**: #0d1321 (background/primary)
- **Wave Blue**: #7ec1fb (accent/secondary)
- **Action Green**: #95fe7c (success/active/calls-to-action)
- **Grey**: #989898 (neutral/disabled)
- **Ice Blue**: #daecfd (subtle accent)
- **Black**: #000000 | **White**: #ffffff

### Fonts
- **Rajdhani Bold** — Headlines, prominent text
- **Inter** — Body copy, UI elements

### Design Philosophy
- Reject standard "crypto purple" — zero purple anywhere
- Dramatic neon battle arena aesthetic
- Gaming-style visualizations (fighting game mechanics)
- Concert-style atmosphere

---

## 11. TEAM & LEADERSHIP

**Hurric4n3IKE** — Founder, Developer, MC & Visionary
**Candytoybox** — Design, Content, Marketing & Promotion
**BettercallZaal** — Internal & External Communications

---

## 12. WHEN BUILDING WITH CLAUDE CODE

### Always Verify
- [ ] Program ID: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`
- [ ] Solana Mainnet only
- [ ] Fee percentages hardcoded (1% artist, 0.5% platform)
- [ ] Settlement math sums to 100%
- [ ] Duration from timestamps, not constants
- [ ] Quick Battle detected by Audius link pattern
- [ ] artist1_name/artist2_name = SONG TITLES in Quick Battles
- [ ] Traders withdraw manually; artists receive automatically
- [ ] Helius URL uses `api-mainnet.helius-rpc.com` (never `api.helius.xyz` — dead domain)
- [ ] Volume computed from BUY/SELL instruction parsing, not pool state fields

### Never Assume
- Battle duration is 20 min (it's variable)
- artist1_name is an artist name (could be song title)
- Traders get automatic payouts (they must withdraw)
- Trading fees paid at settlement (paid per transaction)
- Quick Battle is 20 min (usually 6-9 min)
- Quick Battle winner is chart-only (3-factor now)

### Always Document
- Which field came from blockchain vs database
- Timestamp of last RPC call
- Cache validity (5-min TTL)
- PDA derivation seed order (LE encoding)
- Battle type (Quick/Main/Community)
- Which leaderboard (Artist vs Song)

### Critical UX Patterns
- **Withdrawal Button**: Prominently at bottom of battle page
- **Claim Feature**: Link to https://claim.wavewarz.info
- **Donate Buttons**: Artist wallet + WaveWarz wallet (two separate targets)
- **Battle Type**: Show upfront (Main/Quick/Community)
- **Song Names (Quick)**: Display song titles prominently

---

## 13. DATABASE SCHEMA NOTES

### Indexes (For Performance)
- `battle_id` — Primary key, indexed everywhere
- `created_at` — For history/sorting
- `artist1_wallet / artist2_wallet` — User profile lookup
- `is_quick_battle` — Song Leaderboard filtering
- `status` — Active vs completed battles

### Row Level Security (RLS)
- Users see only battles they participated in or public battles
- Artist wallet data: only visible to that artist
- Trader data isolated by wallet address

### Webhook Handler
- Receives updates from WaveWarz.com smart contract
- Stores all critical fields; triggers payout calculations
- Queues withdrawal notifications for traders

---

## 14. SOLANA PROGRAM IDL (Frontend Reference)

```json
{
  "address": "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
  "metadata": { "name": "wavewarzvtwo", "version": "0.1.0" },
  "instructions": [
    {
      "name": "initializeBattle",
      "discriminator": [117, 108, 166, 159, 146, 82, 246, 223],
      "accounts": [
        { "name": "battle", "writable": true, "pda": { "seeds": [{"kind": "const", "value": [98,97,116,116,108,101]}, {"kind": "arg", "type": "u64", "path": "params.battle_id"}] } },
        { "name": "admin", "writable": true, "signer": true },
        { "name": "artistA" }, { "name": "artistB" }, { "name": "wavewarzWallet" },
        { "name": "battleVault", "writable": true, "pda": { "seeds": [{"kind": "const", "value": [98,97,116,116,108,101,95,118,97,117,108,116]}, {"kind": "arg", "type": "u64", "path": "params.battle_id"}] } },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [{ "name": "params", "type": { "defined": { "name": "BattleInitParams" } } }]
    },
    {
      "name": "initializeMints",
      "discriminator": [189, 84, 85, 142, 177, 200, 57, 22],
      "accounts": [
        { "name": "battle", "writable": true },
        { "name": "artistAMint", "writable": true, "pda": { "seeds": [{"kind": "const", "type": "string", "value": "artist_a_mint"}, {"kind": "account", "account": "Battle", "path": "battle.battle_id"}] } },
        { "name": "artistBMint", "writable": true, "pda": { "seeds": [{"kind": "const", "type": "string", "value": "artist_b_mint"}, {"kind": "account", "account": "Battle", "path": "battle.battle_id"}] } },
        { "name": "admin", "writable": true, "signer": true },
        { "name": "tokenProgram" }, { "name": "systemProgram" }, { "name": "rent" }
      ]
    },
    {
      "name": "buyShares",
      "discriminator": [40, 239, 138, 154, 8, 37, 106, 108],
      "accounts": [
        { "name": "battle", "writable": true },
        { "name": "artistAMint", "writable": true }, { "name": "artistBMint", "writable": true },
        { "name": "artistAToken", "writable": true }, { "name": "artistBToken", "writable": true },
        { "name": "trader", "writable": true, "signer": true },
        { "name": "wavewarzWallet", "writable": true },
        { "name": "artistA", "writable": true }, { "name": "artistB", "writable": true },
        { "name": "battleVault", "writable": true },
        { "name": "tokenProgram" }, { "name": "systemProgram" }, { "name": "associatedTokenProgram" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }, { "name": "artistA", "type": "bool" },
        { "name": "minTokensOut", "type": "u64" }, { "name": "deadline", "type": "i64" }
      ]
    },
    {
      "name": "sellShares",
      "discriminator": [184, 164, 169, 16, 231, 158, 199, 196],
      "accounts": [
        { "name": "battle", "writable": true },
        { "name": "artist_a_mint", "writable": true }, { "name": "artist_b_mint", "writable": true },
        { "name": "artist_a_token", "writable": true }, { "name": "artist_b_token", "writable": true },
        { "name": "trader", "writable": true, "signer": true },
        { "name": "wavewarz_wallet", "writable": true },
        { "name": "artist_a", "writable": true }, { "name": "artist_b", "writable": true },
        { "name": "battle_vault", "writable": true },
        { "name": "token_program" }, { "name": "system_program" }, { "name": "associated_token_program" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }, { "name": "artistA", "type": "bool" },
        { "name": "minSolOut", "type": "u64" }, { "name": "deadline", "type": "i64" }
      ]
    },
    {
      "name": "endBattle",
      "discriminator": [80, 145, 208, 48, 183, 92, 168, 112],
      "accounts": [
        { "name": "battle", "writable": true },
        { "name": "battle_vault", "writable": true, "pda": { "seeds": [{"kind": "const", "type": "string", "value": "battle_vault"}, {"kind": "account", "account": "Battle", "path": "battle.battle_id"}] } },
        { "name": "artist_a", "writable": true }, { "name": "artist_b", "writable": true },
        { "name": "wavewarz_wallet", "writable": true },
        { "name": "system_program" }, { "name": "rent" }
      ],
      "args": []
    },
    {
      "name": "claimShares",
      "discriminator": [130, 131, 29, 237, 134, 20, 110, 245],
      "accounts": [
        { "name": "battle", "writable": true }, { "name": "battleVault", "writable": true },
        { "name": "trader", "writable": true, "signer": true },
        { "name": "artistAToken", "writable": true }, { "name": "artistBToken", "writable": true },
        { "name": "artistAMint", "writable": true }, { "name": "artistBMint", "writable": true },
        { "name": "tokenProgram" }, { "name": "systemProgram" }
      ],
      "args": []
    }
  ],
  "accounts": [
    { "name": "Battle", "discriminator": [81, 148, 121, 71, 63, 166, 116, 24] }
  ],
  "types": [
    {
      "name": "Battle",
      "type": { "kind": "struct", "fields": [
        { "name": "battle_id", "type": "u64" }, { "name": "battle_bump", "type": "u8" },
        { "name": "artist_a_mint_bump", "type": "u8" }, { "name": "artist_b_mint_bump", "type": "u8" },
        { "name": "battle_vault_bump", "type": "u8" }, { "name": "start_time", "type": "i64" },
        { "name": "end_time", "type": "i64" }, { "name": "artist_a_wallet", "type": "pubkey" },
        { "name": "artist_b_wallet", "type": "pubkey" }, { "name": "wavewarz_wallet", "type": "pubkey" },
        { "name": "artist_a_mint", "type": "pubkey" }, { "name": "artist_b_mint", "type": "pubkey" },
        { "name": "artist_a_supply", "type": "u64" }, { "name": "artist_b_supply", "type": "u64" },
        { "name": "artist_a_sol_balance", "type": "u64" }, { "name": "artist_b_sol_balance", "type": "u64" },
        { "name": "artist_a_pool", "type": "u64" }, { "name": "artist_b_pool", "type": "u64" },
        { "name": "winner_artist_a", "type": "bool" }, { "name": "winner_decided", "type": "bool" },
        { "name": "transaction_state", "type": { "defined": { "name": "TransactionState" } } },
        { "name": "is_initialized", "type": "bool" }, { "name": "is_active", "type": "bool" },
        { "name": "total_distribution_amount", "type": "u64" }, { "name": "admin", "type": "pubkey" }
      ]}
    },
    { "name": "BattleInitParams", "type": { "kind": "struct", "fields": [
      { "name": "battle_id", "type": "u64" }, { "name": "battle_duration", "type": "i64" },
      { "name": "start_time", "type": "i64" }
    ]}},
    { "name": "TransactionState", "type": { "kind": "enum", "variants": [{"name": "Idle"}, {"name": "InProgress"}] }}
  ],
  "errors": [
    { "code": 6000, "name": "InvalidDuration" }, { "code": 6001, "name": "BattleEnded" },
    { "code": 6002, "name": "BattleActive" }, { "code": 6003, "name": "BattleNotActive" },
    { "code": 6004, "name": "InvalidStartTime" }, { "code": 6005, "name": "InsufficientFunds" },
    { "code": 6006, "name": "InvalidAmount" }, { "code": 6007, "name": "MathOverflow" },
    { "code": 6008, "name": "InvalidCalculation" }, { "code": 6009, "name": "BattleNotEnded" },
    { "code": 6010, "name": "WinnerAlreadyDecided" }, { "code": 6011, "name": "BattleAlreadyInitialized" },
    { "code": 6012, "name": "MintsAlreadyInitialized" }, { "code": 6013, "name": "DeadlineExceeded" },
    { "code": 6014, "name": "SlippageExceeded" }, { "code": 6015, "name": "InvalidTokenMint" },
    { "code": 6016, "name": "TieNotAllowed" }, { "code": 6017, "name": "NoTokensToClaim" },
    { "code": 6018, "name": "InsufficientFundsForTransaction" }, { "code": 6019, "name": "NonZeroBalance" },
    { "code": 6020, "name": "MathOperationOverflow" }, { "code": 6021, "name": "InvalidVaultOwner" },
    { "code": 6022, "name": "InvalidTokenAccountOwner" }, { "code": 6023, "name": "InvalidBattleVault" },
    { "code": 6024, "name": "InsufficientVaultBalance" }, { "code": 6025, "name": "WinnerNotDecided" },
    { "code": 6026, "name": "TransactionInProgress" }, { "code": 6027, "name": "InvalidTransactionState" }
  ]
}
```

---

## 15. WAVEWARZ BASE PLATFORM (Agents-Only Testing)

WaveWarz operates TWO separate platforms:

### WaveWarz Solana (Mainnet)
- Users: Real artists, traders, fans
- Network: Solana Mainnet
- Program ID: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`
- Live Battles: Main Events, Quick Battles, Community Battles
- Trading: Real SOL, real earnings, real consequences

### WaveWarz Base (L2 Testnet → Mainnet)
- Users: OpenClaw agents ONLY (lil_lob, candy_cookz, merch)
- Network: Base L2 (Ethereum)
- Purpose: Platform testing, agent trading, volume data collection
- Trading Mode: Profit-seeking (genuine conviction, not manipulation)
- Contract Address: TBD (when deployed)

### Solana Trading Agent (Future Scope)
- Status: NOT current sprint — planning phase
- Purpose: Stealth volume-only bot for market-making on Solana
- Do NOT confuse with Base agent testing

---

## 16. OPENCLAW AGENT SETUP (February 2026)

### Team Agents
**lil_lob** — Strategic Content (qwen3-vl:8b) | @Lil_Lob_bot
- X Spaces monitoring, content drafting, knowledge graph building, Base testing

**candy_cookz** — Ops/Approvals (llama3.2:latest) | @CandyCookz_bot
- Trade approvals, post scheduling, daily monitoring, platform health checks

**merch** — Merchandise Operations (llama3.2-vision:11b) | @WaveWarz_Merch_bot
- Graphics review, product naming/descriptions, mockup briefs, POD listings

### Model Routing
| Task | Model |
|------|-------|
| Quick text/ops | llama3.2:latest |
| General writing | qwen:latest |
| Vision (lil_lob) | qwen3-vl:8b |
| Graphics (merch) | llama3.2-vision:11b |
| Complex reasoning | gpt-oss:120b-cloud |

### Config
- `openclaw.json` includes all 3 agents
- Agent brain dirs: `~/claw/{candy_cookz,lil_lob,merch}/brain/`
- Daily memory logs per agent
- `.env.openclaw`: 0600 perms, not committed
