-- ============================================================================
-- LEAGUE HUB — the narrative spine for the internal /hub entertainment-strategy
-- workspace (Master Everything Checklist phases 1, 9-20, 23, 25, 17-18, 36, 37).
--
-- The Hub reuses the app's existing DATA spine (battles, artist_profiles,
-- trades, song_registry) read-only, and adds an editable NARRATIVE layer on
-- top: Identity Bibles, Battle Theses, the storyline graph, a Record Book, and
-- sponsor inventory.
--
-- SYNC MODEL: every /hub page is `dynamic = 'force-dynamic'` and reads Supabase
-- at request time through the SAME shared functions the public site and API
-- use — getArtistLeaderboard() (src/lib/leaderboards/artists.ts),
-- countMainEvents()/groupMainEventRounds() (src/lib/battle-metrics.ts),
-- getArtistStats() (src/lib/artist-stats.ts), song_registry. So records,
-- events, rankings and stats stay in lock-step with wavewarz.info automatically.
-- The only snapshot is roster MEMBERSHIP — the "Sync from leaderboard" button
-- on /hub/artists (syncRoster + syncArtistAvatars in src/app/hub/actions.ts)
-- creates a profile + bible for any leaderboard artist that doesn't have one.
--
-- All Hub tables: RLS ENABLED, NO POLICIES — service-role only. The Hub is
-- admin-gated and reads/writes exclusively through createAdminClient() (service
-- role bypasses RLS), matching the "internal tables" section of
-- rls_intelligence_v2.sql. The public anon key can neither read nor write these.
--
-- HOW TO APPLY: Supabase dashboard → WaveWarZ Intelligence project
-- (dbbhkgrgtfswzqgtwaqf) → SQL Editor → paste → Run.
-- ============================================================================

-- ── 1. LEAGUE BIBLE — single row (id = 1) — Phase 1 ──────────────────────────
create table if not exists public.league_bible (
  id            integer primary key default 1,
  mission       text,
  one_liner     text,
  ten_sec       text,
  thirty_sec    text,
  long_form     text,
  tagline       text,
  positioning   text,
  rules_md      text,
  scoring_md    text,
  glossary      jsonb not null default '[]'::jsonb,  -- [{term, definition}]
  guardrails_md text,
  updated_at    timestamptz not null default now(),
  constraint league_bible_singleton check (id = 1)
);
alter table public.league_bible enable row level security;
insert into public.league_bible (id) values (1) on conflict (id) do nothing;

-- ── 2. ARTIST BIBLES — 1:1 with artist_profiles — Phases 9-20, 36 ────────────
create table if not exists public.artist_bibles (
  artist_id            uuid primary key references public.artist_profiles(artist_id) on delete cascade,
  nickname             text,
  archetype_primary    text,
  archetype_secondary  text,
  hero_heel            text,
  one_line_identity    text,
  want                 text,
  motivation           text,
  core_belief          text,
  greatest_strength    text,
  vulnerability        text,
  whats_proving        text,
  colors               jsonb not null default '{}'::jsonb,  -- {signature, secondary, accent}
  symbol               text,
  typography           text,
  logo_url             text,
  visual_effect        text,
  do_not_use           text,
  entrance_sting_url   text,
  walk_cue_url         text,
  walk_script_md       text,
  catchphrase          text,
  victory_phrase       text,
  challenge_phrase     text,
  signoff              text,
  announcer_intro      text,
  short_bio            text,
  long_bio             text,
  voice_tone           text,
  trashtalk_boundaries text,
  signature_weapon     text,
  memeable_phrase      text,
  artist_emoji         text,
  community_name       text,
  sponsor_fit          jsonb not null default '[]'::jsonb,  -- [string]
  canonical_clips      jsonb not null default '[]'::jsonb,  -- [{title, url, note}]
  needs_review         boolean not null default false,
  updated_at           timestamptz not null default now()
);
alter table public.artist_bibles enable row level security;
insert into public.artist_bibles (artist_id)
  select artist_id from public.artist_profiles
  on conflict (artist_id) do nothing;

-- Auto-provision: every new artist_profiles row gets an (empty) bible, so the
-- Hub roster self-heals as the roster grows via the admin panel or a sync.
create or replace function public.create_artist_bible() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.artist_bibles (artist_id) values (new.artist_id)
  on conflict (artist_id) do nothing;
  return new;
end $$;
drop trigger if exists trg_create_artist_bible on public.artist_profiles;
create trigger trg_create_artist_bible
  after insert on public.artist_profiles
  for each row execute function public.create_artist_bible();

-- ── 3. STORYLINES — relationship / story graph — Phases 17-18 ────────────────
create table if not exists public.storylines (
  id                  uuid primary key default gen_random_uuid(),
  type                text,
  title               text not null,
  artist_a_id         uuid references public.artist_profiles(artist_id) on delete set null,
  artist_b_id         uuid references public.artist_profiles(artist_id) on delete set null,
  status              text not null default 'open',   -- open | resolved
  summary             text,
  what_happened       text,
  happened_at         timestamptz,
  relevant_battle_id  bigint,
  unresolved_tension  text,
  rematch_possible    boolean not null default false,
  needs_review        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.storylines enable row level security;

-- ── 4. BATTLE THESES — narrative layer for a Main Event — Phases 25, 27 ──────
-- Events are DERIVED from grouped main battles (main_events table is empty), so
-- these attach by a stable slug, not a hard FK. slug = {sorted-pair-key}-{date}.
create table if not exists public.battle_theses (
  id                    uuid primary key default gen_random_uuid(),
  event_slug            text not null unique,
  event_label           text,
  artist_a_id           uuid references public.artist_profiles(artist_id) on delete set null,
  artist_b_id           uuid references public.artist_profiles(artist_id) on delete set null,
  event_date            timestamptz,
  thesis                text,
  headline              text,
  why_these_two         text,
  why_now               text,
  stakes                text,
  contrast              text,
  who_has_more_to_prove text,
  angle                 text,
  storyline_1           text,
  storyline_2           text,
  storyline_3           text,
  winner_consequence    text,
  loser_consequence     text,
  sponsor_id            uuid,
  runway                jsonb not null default '{}'::jsonb,  -- 21-day cadence checklist state
  needs_review          boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.battle_theses enable row level security;

-- ── 5. CONTENT ASSETS — the file library — Phase 37 ─────────────────────────
create table if not exists public.content_assets (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null,   -- league | artist | event
  artist_id   uuid references public.artist_profiles(artist_id) on delete cascade,
  event_slug  text,
  category    text not null,
  franchise   text,            -- WARZ COUNTDOWN | FACE THE WAVE | THE WALK | ...
  title       text not null,
  url         text,
  asset_type  text not null default 'link',
  notes       text,
  created_at  timestamptz not null default now()
);
alter table public.content_assets enable row level security;
create index if not exists content_assets_artist_idx on public.content_assets (artist_id);
create index if not exists content_assets_event_idx  on public.content_assets (event_slug);

-- ── 6. SPONSOR INVENTORY — sellable properties — Phase 23 ───────────────────
create table if not exists public.sponsor_inventory (
  id            uuid primary key default gen_random_uuid(),
  property_name text not null,
  property_type text not null default 'ritual',  -- presenting | franchise | ritual | surface | artist | season
  tier          text,
  status        text not null default 'available',  -- available | pitched | sold
  partner_name  text,
  deliverables  jsonb not null default '[]'::jsonb,
  value_notes   text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.sponsor_inventory enable row level security;

insert into public.sponsor_inventory (property_name, property_type, sort_order, value_notes) values
  ('WaveWarZ Gauntlet / Season', 'presenting', 10, 'Top-level naming, hero assets, opening/closing, media kit — hold until a smaller property has closed.'),
  ('Arena Partner',              'surface',    20, 'Persistent event/broadcast presence: pre-show, scoreboard/overlay, results, website battle page.'),
  ('WARZ COUNTDOWN',             'franchise',  30, 'Owns the cinematic pre-battle story package and clips derived from it.'),
  ('WARZ EMBEDDED',              'franchise',  40, 'Presenting partner of the daily battle-week artist clips.'),
  ('FACE THE WAVE',              'franchise',  50, 'Owns the live press-conference-style faceoff Space and its clips.'),
  ('TALE OF THE TRACK',          'franchise',  60, 'Brand integrated into the matchup breakdown / stats surface.'),
  ('TRACK LOCK',                 'ritual',     70, 'Owns the song-submission deadline/reveal ritual.'),
  ('THE WALK',                   'ritual',     80, 'Owns artist entrances / sonic stings / pre-song animation.'),
  ('WAR ROOM',                   'franchise',  90, 'Owns the live chart/poll/DJ Wavy broadcast analysis layer.'),
  ('DJ WAVY INSIGHTS',           'franchise', 100, 'Owns AI analysis, comparison cards and post-round insight moments.'),
  ('COMMUNITY VOTE',             'ritual',    110, 'Owns poll graphics, vote reminders and outcome reveal.'),
  ('BATTLE CLOCK',               'surface',   120, 'Named timer / scorecard broadcast inventory.'),
  ('WINNER REVEAL',              'ritual',    130, 'Owns the result reveal moment and winner card.'),
  ('AFTERMATH',                  'franchise', 140, 'Owns winner interview, result card and next-callout content.'),
  ('NEXT ON WAVEWARZ',           'franchise', 150, 'Owns the immediate next-battle teaser / serialized continuity beat.'),
  ('WARZ FOR GOOD',              'franchise', 160, 'Benefit-battle sub-brand: impact counter, cause pages, donation proof.'),
  ('Artist Ambassador',          'artist',    170, 'Sponsor pairs with selected artists for campaign content outside battle night.')
on conflict do nothing;

-- ── 7. RECORD BOOK MARKS — manual/narrative all-time marks — Phase 3 ────────
-- Computed marks (most wins, longest streak, biggest-volume battle) come from
-- src/lib/record-book.ts. This table only holds marks needing human judgement.
create table if not exists public.record_book_marks (
  id         uuid primary key default gen_random_uuid(),
  mark_key   text not null unique,
  label      text not null,
  artist_id  uuid references public.artist_profiles(artist_id) on delete set null,
  value_text text,
  battle_id  bigint,
  note       text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.record_book_marks enable row level security;

insert into public.record_book_marks (mark_key, label, sort_order) values
  ('biggest_upset',     'Biggest Upset',            10),
  ('biggest_comeback',  'Biggest Comeback',         20),
  ('most_dominant',     'Most Dominant Performance', 30),
  ('most_charitable',   'Most Charitable Money Raised', 40),
  ('most_discussed',    'Most Watched / Discussed Battle', 50)
on conflict (mark_key) do nothing;
