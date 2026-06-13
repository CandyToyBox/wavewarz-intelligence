# WaveWarz Intelligence (Statz App V2)

WaveWarz analytics platform. Reads battle state from Solana Mainnet and stores derived stats in Supabase.

## Critical: Helius API Domain

`api.helius.xyz` is a dead domain — returns 403 for every request. Always use `api-mainnet.helius-rpc.com`:

| Purpose | URL |
|---------|-----|
| RPC calls | `https://mainnet.helius-rpc.com/?api-key=KEY` |
| Enhanced TX batch (POST) | `https://api-mainnet.helius-rpc.com/v0/transactions` |
| Address TX history (GET) | `https://api-mainnet.helius-rpc.com/v0/addresses/{addr}/transactions` |

## Critical: Volume Calculation

True trading volume ≠ account pool state. `artistAPool` is the net vault balance (goes to zero at settlement). True volume must be computed by parsing BUY/SELL instructions from the vault PDA's transaction history.

- Correct backfill: `npx tsx scripts/fix-volume-from-chain.ts`
- Do not use: `scripts/backfill-volume.ts` (reads net pool state, not gross flow)

## Volume Backfill

Battles settled before 2026-04-27 have corrupted volume data. Run the fix:

```bash
# Dry run first
npx tsx scripts/fix-volume-from-chain.ts --dry-run

# Apply
npx tsx scripts/fix-volume-from-chain.ts
```

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
