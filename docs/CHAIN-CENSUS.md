# Chain census: battles on chain versus battles listed

Added 2026-11-21. Answers improvement 1 and improvement 4 on Zaal's WaveWarZ System Map (2026-11-20).

## The two counts, and why both exist

| Name in the API | What it counts |
|---|---|
| `onChainAccounts` | Every battle account the WaveWarZ program holds on Solana mainnet. Test battles and launches that never traded are included, because the program cannot tell them apart. |
| `listed` | The real battles this index lists. Same number as `stats.battles.total`. |

They differ on purpose, and the gap is fully accounted for:

    onChainAccounts = listed + testBattlesExcluded + notIndexed

- **testBattlesExcluded**: test battles the index holds but keeps out of every public number.
- **notIndexed**: battle accounts on chain that never reached the index. Only wavewarz.com sends the index a webhook, so a battle launched anywhere else, or one that never fired a webhook, is not listed until the index picks it up. Nearly all of these are abandoned launches holding no SOL. Any that still hold SOL are named, with the amount, in `/api/public/reconciliation`.
- **realBattlesMissingFromChain** should always be 0: a real battle listed here must have an account on chain. Test rows with no chain account (webhook test fixtures such as battle 7777777) are expected and are not counted.

First reading, 2026-11-21: 1,871 on chain = 1,729 listed + 86 test + 56 not indexed (7 of the 56 hold SOL, 0.1775 SOL in total).

## How it runs

`scripts/chain-census.ts` makes one `getProgramAccounts` call (accounts of 353 bytes), compares the ids with the `battles` table, and stores one row in `chain_census` (migration `008_chain_census.sql`). It runs every night as a step of the nightly integrity workflow, writes a summary to the Actions run page, and exits non-zero if the three groups stop adding up or a real battle goes missing from chain. It reads chain and writes only the census row; it never touches `battles`.

`newlyNotIndexedSinceLastCensus` lists battles that went absent since the previous run, so a battle that drifts shows up in a day.

Zaal's protocol repo runs the same comparison from the other side (`index-coverage`, #184), reading our public API. The two should agree; a disagreement is a finding.

## Rent dust: why 30 battles read 0.00424 SOL

Thirty non-test Quick Battles from 2025-12 to 2026-03 store a volume of exactly 0.00423864 SOL, with one trade, no pool, and nothing traded on chain. That figure is the rent-exempt minimum for the two accounts a battle creates:

- Battle account, 353 bytes: (353 + 128) x 6,960 = 3,347,760 lamports
- Vault, 0 bytes: (0 + 128) x 6,960 = 890,880 lamports
- Sum: 4,238,640 lamports = 0.00423864 SOL

So it is rent held by the accounts, not trading volume, and it only appears where the webhook fell back to reading the vault balance because no trade existed. The true volume of those battles is 0. Together they overstate platform volume by 0.1272 SOL (30 x 0.00423864). The same value sits on test battles, which are not counted.
