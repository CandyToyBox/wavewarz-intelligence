-- ============================================================================
-- HUB MODULES — modular progress, "why it is here", and family tags.
-- Additive only: no existing column is changed or dropped.
--
-- 1. content_assets: every item records WHY it was added and what it brings
--    to the lore (why_added, required by the Hub UI), which module it belongs
--    to, and which family members it touches (Wave ID, Wave Station, ...).
-- 2. league_bible.ethos_md: the ethos, written once.
-- 3. artist_bibles: stage_character (look / costume / stage presence),
--    founding flag and rollout batch.
-- 4. hub_modules: status per module per subject. subject is
--    'league' | 'artist:<uuid>' | 'event:<slug>'. Done modules are hidden by
--    default in the Hub; their links stay saved.
--
-- Service-role only (RLS on, no policies), same as every other Hub table.
-- ============================================================================

alter table public.content_assets
  add column if not exists why_added   text,
  add column if not exists module_key  text,
  add column if not exists family_tags text[] not null default '{}';

alter table public.league_bible
  add column if not exists ethos_md text;

alter table public.artist_bibles
  add column if not exists stage_character text,
  add column if not exists founding        boolean not null default false,
  add column if not exists batch           integer;

create table if not exists public.hub_modules (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  module_key   text not null,
  status       text not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'done')),
  checklist    jsonb not null default '{}'::jsonb,
  note         text,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  constraint hub_modules_subject_key unique (subject, module_key)
);
alter table public.hub_modules enable row level security;

-- The two files already in the archive get a recorded reason.
update public.content_assets
   set why_added = 'Milestone: a pitch interview with a possible investor network. Saved as proof that WaveWarZ was invited to present, with no terms announced.'
 where scope = 'league' and why_added is null and title ilike '%CyreneAI%';
