-- ============================================================================
-- WAVEWARZ INTELLIGENCE (V2) — ROW LEVEL SECURITY
-- Project: dbbhkgrgtfswzqgtwaqf.supabase.co
-- Written: 2026-06-12, after a full access-pattern audit of every app that
-- touches this database.
--
-- HOW TO APPLY: Supabase dashboard → WaveWarz Intelligence project →
-- SQL Editor → paste this whole file → Run.
--
-- WHAT THE AUDIT FOUND (why these policies are safe):
--   - Statz V2 site: reads public stats with the anon key (SSR + browser);
--     ALL writes go through createAdminClient (service role) in server
--     actions, the webhook route, and local scripts. Service role bypasses
--     RLS, so nothing breaks.
--   - ClipHQ / Sir Clipz bot: service key only. Unaffected.
--   - DJ Wavey content engine + Clip Engine pipeline: service key. Unaffected.
--   - Hurricane birthday app: API routes use the service key BUT fall back
--     to the anon key if SUPABASE_SERVICE_KEY is unset in its Vercel env —
--     so birthday_submissions keeps an anon INSERT policy (it is a public
--     submission form; public inserts are its purpose).
--   - No realtime subscriptions anywhere.
--
-- BEFORE THIS MIGRATION: the anon key (public, shipped in every browser)
-- could UPDATE AND DELETE EVERY TABLE in this database.
-- AFTER: anon can read public stats, insert birthday submissions, nothing else.
-- ============================================================================

-- 1. PUBLIC-READ TABLES --------------------------------------------------------
-- The public dashboards read these directly with the anon key.
-- Writes become service-role only (scanner, webhook, admin actions, bots).
do $$
declare t text;
begin
  foreach t in array array[
    'battles', 'artist_profiles', 'artist_wallets', 'trades',
    'main_events', 'main_event_rounds', 'platform_stats', 'platform_events',
    'calendar_events', 'clips', 'clipper_profiles', 'flyers',
    -- community_members IS public-read: the clipper_profiles view (which the
    -- site shows publicly) already exposes nearly all of its columns
    -- (telegram handle, wallet, points). Locking reads here would gain no
    -- privacy while risking the leaderboard. Writes stay blocked (no write
    -- policy below) — anon WRITE was the real vulnerability.
    'community_members'
  ] loop
    -- relkind 'r' = ordinary table only; skip views/matviews (RLS is invalid on them)
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "public read" on public.%I', t);
      execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    end if;
  end loop;
end $$;

-- 2. INTERNAL TABLES (service role only — no policies at all) -------------------
-- Bots and the content engine write these with the service key, which
-- bypasses RLS. The public has no reason to read them, and none of them backs
-- a public view. birthday_submissions holds personal data and was publicly
-- readable before — it gets an insert-only policy in step 3.
do $$
declare t text;
begin
  foreach t in array array[
    'posting_slots', 'scheduled_slots',
    'clip_approvals', 'clip_votes',
    'dj_wavey_pipelines', 'dj_wavey_content', 'dj_wavey_performance',
    'birthday_submissions'
  ] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- 3. BIRTHDAY SUBMISSIONS: public form — allow anon INSERT only -----------------
-- (Covers the anon-key fallback in the app's API route. Reads/updates/deletes
-- stay service-only, so submitted personal data is no longer publicly visible.)
drop policy if exists "public can submit" on public.birthday_submissions;
create policy "public can submit" on public.birthday_submissions
  for insert to anon, authenticated with check (true);

-- 4. CLIP ENGINE TABLES — already locked by migration 002 (RLS, no policies).
-- Re-asserting is harmless and keeps this file complete.
do $$
declare t text;
begin
  foreach t in array array[
    'clip_recordings', 'clip_transcripts', 'clip_moments',
    'clip_renders', 'clip_queue', 'clip_brain_packets'
  ] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
