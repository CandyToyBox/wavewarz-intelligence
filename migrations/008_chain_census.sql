-- ============================================================================
-- CHAIN CENSUS — a daily count of every battle account the WaveWarZ program
-- holds on Solana, set against what this index lists.
-- Additive only: nothing existing is changed.
--
-- Why: the chain and the index count different things. The chain holds every
-- battle account ever created, including test battles and abandoned launches.
-- The index lists real battles only. Publishing both numbers, side by side and
-- named, lets every app quote the same two figures. See docs/CHAIN-CENSUS.md.
--
-- Access model: scripts/chain-census.ts writes with the service role. The rows
-- are public chain facts and aggregate counts, so anyone may read them (the
-- public API reads them with the anon key). RLS stays on; the only policy is a
-- read policy, so the anon key cannot insert, update or delete.
-- ============================================================================

create table if not exists public.chain_census (
  id                       bigserial primary key,
  census_at                timestamptz not null default now(),
  on_chain                 integer not null,           -- battle accounts the program holds
  listed                   integer not null,           -- non-test battles in this index
  test_excluded            integer not null,           -- test battles held but left out of the public API
  not_indexed              integer not null,           -- on chain, absent from this index
  not_indexed_holding      integer not null default 0, -- of those, accounts still holding SOL
  not_indexed_holding_sol  numeric not null default 0, -- SOL they hold now
  db_only                  integer not null default 0, -- held here but not found on chain (should be 0)
  not_indexed_ids          jsonb not null default '[]'::jsonb, -- [{battleId, startedAt, holdingSol, ended}]
  newly_not_indexed_ids    jsonb not null default '[]'::jsonb, -- absent now, not absent at the previous census
  method                   text not null default 'getProgramAccounts dataSize=353'
);
create index if not exists chain_census_at_idx on public.chain_census (census_at desc);

alter table public.chain_census enable row level security;
drop policy if exists chain_census_public_read on public.chain_census;
create policy chain_census_public_read on public.chain_census for select using (true);
