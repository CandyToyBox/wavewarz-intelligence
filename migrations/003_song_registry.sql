-- ============================================================================
-- Song Registry — canonical identity + cached Audius enrichment for songs.
--
-- Quick Battles are song vs song, but the chain only stores a hand-typed
-- title. This table gives each song a stable home keyed by its music-link
-- permalink, enriched once from the (free, open) Audius API: real track id,
-- official title, artist, genre, artwork, play count. Pages read from here
-- instead of resolving the API on every render.
--
-- HOW TO APPLY: Supabase dashboard → WaveWarZ Intelligence project
-- (dbbhkgrgtfswzqgtwaqf) → SQL Editor → paste → Run.
-- Then populate it: `npx tsx scripts/backfill-song-registry.ts`
-- ============================================================================

create table if not exists song_registry (
  permalink_key   text primary key,        -- canonicalSongKey value, e.g. "audius:cannonjones973/ego-death..."
  music_link      text,                     -- the original full URL
  audius_track_id text,                     -- canonical Audius track id (survives title edits)
  title           text,                     -- official title from Audius (vs hand-typed battle name)
  artist_name     text,                     -- official Audius artist name
  artist_handle   text,                     -- Audius handle
  genre           text,
  artwork_url     text,                     -- 480x480 cached artwork
  play_count      integer,
  resolved_at     timestamptz default now(),
  created_at      timestamptz default now()
);

create index if not exists idx_song_registry_track on song_registry(audius_track_id);

-- Public read (powers the public songs leaderboard); writes are service-role only.
alter table song_registry enable row level security;
drop policy if exists "public read" on song_registry;
create policy "public read" on song_registry for select to anon, authenticated using (true);
