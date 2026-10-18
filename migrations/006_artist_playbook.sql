-- ============================================================================
-- ARTIST PLAYBOOK — founding artists fill in a guided playbook; admins review
-- each answer and accept it into the Artist Archive and the Assets folders.
-- Additive only: nothing existing is changed except one new column.
--
-- Access model: artists have no Supabase Auth account. They open a private
-- invite link, which sets a signed session cookie scoped to ONE artist_id.
-- Every read and write goes through server code that takes artist_id from that
-- cookie (never from the browser). So, like every other Hub table, these are
-- RLS-enabled with NO policies = service-role only. The anon key can read
-- nothing here.
--
-- Answers are DRAFTS. They never write into artist_bibles by themselves; an
-- admin accepts them one by one (playbook_reviews records what was reviewed).
-- ============================================================================

-- One private link per artist at a time. Only the SHA-256 of the token is stored.
create table if not exists public.playbook_invites (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artist_profiles(artist_id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  created_by   text,
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists playbook_invites_artist_idx on public.playbook_invites (artist_id);
alter table public.playbook_invites enable row level security;

-- One row per question part. value is JSON: text -> string, links -> string[],
-- upload -> [{kind:'file'|'link', ...}], palette -> {sig,second,accent},
-- choice -> string | string[]. Key '_artist_name' holds the name typed at the top.
create table if not exists public.playbook_answers (
  artist_id  uuid not null references public.artist_profiles(artist_id) on delete cascade,
  field_key  text not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'artist',
  primary key (artist_id, field_key)
);
alter table public.playbook_answers enable row level security;

-- Latest submit per module. content_hash is computed on the server from the
-- stored answers, so "edited since submitting" cannot be faked from the browser.
create table if not exists public.playbook_submissions (
  artist_id    uuid not null references public.artist_profiles(artist_id) on delete cascade,
  module_key   text not null,
  submitted_at timestamptz not null default now(),
  content_hash text not null,
  submit_count integer not null default 1,
  primary key (artist_id, module_key)
);
alter table public.playbook_submissions enable row level security;

-- "I want help with this one" (field_key set) and the per-module note
-- (module_key set, field_key null).
create table if not exists public.playbook_help (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artist_profiles(artist_id) on delete cascade,
  module_key  text not null,
  field_key   text,
  note        text,
  resolved    boolean not null default false,
  resolved_by text,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists playbook_help_field_uq
  on public.playbook_help (artist_id, field_key) where field_key is not null;
create unique index if not exists playbook_help_module_uq
  on public.playbook_help (artist_id, module_key) where field_key is null;
alter table public.playbook_help enable row level security;

-- Uploaded files (private bucket 'playbook'). Pasted links live in the answer
-- JSON, not here.
create table if not exists public.playbook_files (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references public.artist_profiles(artist_id) on delete cascade,
  field_key    text not null,
  storage_path text not null unique,
  file_name    text not null,
  size_bytes   bigint,
  content_type text,
  created_at   timestamptz not null default now()
);
create index if not exists playbook_files_artist_idx on public.playbook_files (artist_id);
alter table public.playbook_files enable row level security;

-- What an admin decided about each answer. answer_snapshot is the answer as it
-- was when reviewed: if the artist changes it later, it no longer matches and
-- the field goes back to "needs review" by itself.
create table if not exists public.playbook_reviews (
  artist_id       uuid not null references public.artist_profiles(artist_id) on delete cascade,
  field_key       text not null,
  status          text not null check (status in ('accepted', 'skipped')),
  answer_snapshot jsonb,
  accepted_value  jsonb,
  reviewed_by     text,
  reviewed_at     timestamptz not null default now(),
  primary key (artist_id, field_key)
);
alter table public.playbook_reviews enable row level security;

-- Playbook fields with no Identity Bible field of their own ("Playbook extras").
alter table public.artist_bibles
  add column if not exists playbook_extras jsonb not null default '{}'::jsonb;

-- Private storage bucket: 20 MB per file, images / video / PDF only (all audio
-- is a pasted link). Reads happen only through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'playbook', 'playbook', false, 20971520,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/heic','image/heif',
        'video/mp4','video/quicktime','video/webm','application/pdf']
)
on conflict (id) do nothing;
