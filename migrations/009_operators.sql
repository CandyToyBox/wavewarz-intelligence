-- ============================================================================
-- OPERATORS — which arena ran each battle, and the first phase of integration
-- intake. Additive only: nothing existing is changed or removed.
--
-- The registry itself is Zaal's: spec/operators.json in the protocol repo is
-- the single approval list. scripts/sync-operators.ts projects it into these
-- tables; it is never edited by hand here, except operators.listing_mode, which
-- is the grant (see below). Design: recon/INTEGRATION-INTAKE-DESIGN-2026-11-21.md.
--
-- Attribution follows the registry's rules exactly: explicit claim, then fee
-- wallet, then declared redirect plus a registered launcher, else unattributed.
-- Inputs come from the chain (fee wallet at offset 100, launcher at 257), never
-- from a caller.
--
-- listing_mode is the grant, set by Candy, Zaal or Hurricane and never by sync:
--   off      registered, but nothing is listed for it
--   main     its battles reach the main index the usual way (webhook); wavewarz and
--            songchainn today
--   partner  battles found on chain are pulled into partner_battles (a separate
--            table) when fee wallet AND launcher match, or the battle is claimed.
--            They never enter battles or trades.
-- ============================================================================

alter table public.battles
  add column if not exists launcher_wallet  text,   -- chain, offset 257 (the wallet that signed the launch)
  add column if not exists fee_wallet_chain text,   -- chain, offset 100 (caller-set fee destination)
  add column if not exists operator_id      text,   -- resolved from the registry; null = unattributed
  add column if not exists operator_basis   text;   -- explicit_claim | fee_wallet | declared_redirect | unattributed
create index if not exists battles_operator_idx on public.battles (operator_id);

create table if not exists public.operators (
  operator_id      text primary key,
  name             text not null,
  home             text,
  registered       date,
  status           text not null default 'active' check (status in ('active','suspended')),
  listing_mode     text not null default 'off'    check (listing_mode in ('off','main','partner')),
  formats          text[] not null default array['music'],
  granted_by       text,
  registry_version text,
  updated_at       timestamptz not null default now()
);

create table if not exists public.operator_wallets (
  id          bigserial primary key,
  operator_id text not null references public.operators(operator_id) on delete cascade,
  wallet      text not null,
  kind        text not null check (kind in ('fee','launcher','redirect')),
  role        text,
  unique (operator_id, wallet, kind)
);

create table if not exists public.operator_claims (
  operator_id text   not null references public.operators(operator_id) on delete cascade,
  battle_id   bigint not null unique,           -- a battle can be claimed by one operator only
  primary key (operator_id, battle_id)
);

-- Chain-derived record for battles pulled in for an approved partner. Separate
-- from battles on purpose: nothing here can change a number the main index shows.
create table if not exists public.partner_battles (
  battle_id        bigint primary key,
  operator_id      text not null references public.operators(operator_id),
  basis            text not null,
  launcher_wallet  text,
  fee_wallet       text,
  artist_a_wallet  text,
  artist_b_wallet  text,
  started_at       timestamptz,
  ends_at          timestamptz,
  pool_a_sol       numeric,
  pool_b_sol       numeric,
  settled          boolean,
  settlement_winner_a boolean,
  distribution_sol numeric,
  first_pulled_at  timestamptz not null default now(),
  last_seen_at     timestamptz not null default now()
);
create index if not exists partner_battles_operator_idx on public.partner_battles (operator_id, started_at desc);

-- Who knocked: every battle the census could not list, and why. Service role only.
create table if not exists public.intake_events (
  id              bigserial primary key,
  at              timestamptz not null default now(),
  kind            text not null check (kind in ('pulled','rejected','unmatched')),
  battle_id       bigint,
  operator_id     text,
  launcher_wallet text,
  fee_wallet      text,
  reason          text
);
create index if not exists intake_events_at_idx on public.intake_events (at desc);

-- RLS. The registry and the pulled partner record are public chain facts: public
-- read, no public write. intake_events has no policy: service role only.
alter table public.operators        enable row level security;
alter table public.operator_wallets enable row level security;
alter table public.operator_claims  enable row level security;
alter table public.partner_battles  enable row level security;
alter table public.intake_events    enable row level security;
drop policy if exists operators_public_read        on public.operators;
drop policy if exists operator_wallets_public_read on public.operator_wallets;
drop policy if exists operator_claims_public_read   on public.operator_claims;
drop policy if exists partner_battles_public_read   on public.partner_battles;
create policy operators_public_read        on public.operators        for select using (true);
create policy operator_wallets_public_read on public.operator_wallets for select using (true);
create policy operator_claims_public_read  on public.operator_claims  for select using (true);
create policy partner_battles_public_read  on public.partner_battles  for select using (true);

-- Bulk-apply resolved operators to battles. Touches ONLY the four operator
-- columns, and only rows whose values would change. Service role only.
create or replace function public.apply_battle_operators(p jsonb) returns integer
language plpgsql set search_path = public as $$
declare n integer;
begin
  with src as (
    select * from jsonb_to_recordset(p)
      as x(battle_id bigint, launcher_wallet text, fee_wallet_chain text, operator_id text, operator_basis text)
  )
  update public.battles b
     set launcher_wallet = s.launcher_wallet,
         fee_wallet_chain = s.fee_wallet_chain,
         operator_id = s.operator_id,
         operator_basis = s.operator_basis
    from src s
   where b.battle_id = s.battle_id
     and (b.launcher_wallet  is distinct from s.launcher_wallet
       or b.fee_wallet_chain is distinct from s.fee_wallet_chain
       or b.operator_id      is distinct from s.operator_id
       or b.operator_basis   is distinct from s.operator_basis);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.apply_battle_operators(jsonb) from public, anon, authenticated;
grant execute on function public.apply_battle_operators(jsonb) to service_role;
