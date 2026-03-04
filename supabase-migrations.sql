-- ─── WaveWarZ Intelligence — DB Migrations ────────────────────────────────────
-- Run this in your Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/dbbhkgrgtfswzqgtwaqf/sql/new

-- 1. X Spaces / Broadcast Schedule
CREATE TABLE IF NOT EXISTS platform_events (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  description text,
  day_of_week text,           -- e.g. "Mon–Fri" or "Sunday"
  time_est    text,           -- e.g. "8:30 PM"
  event_type  text DEFAULT 'X_SPACE',  -- X_SPACE | STREAM | AMA
  platform_link text,
  is_active   boolean DEFAULT true,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Seed default schedule
INSERT INTO platform_events (title, description, day_of_week, time_est, event_type, platform_link, sort_order)
VALUES
  ('Live Quick Battle Trading',  'Join us on X Spaces to trade the charts live. Watch the 30-second final windows play out in real-time.', 'Mon–Fri', '8:30 PM', 'X_SPACE', 'https://x.com/wavewarz', 1),
  ('Community AMA & Feedback',   'Talk directly with the founders, give feedback, and help shape the platform''s future.',                  'Mon–Fri', '11:00 AM', 'X_SPACE', 'https://x.com/wavewarz', 2)
ON CONFLICT DO NOTHING;


-- 2. Events Calendar (manually managed in admin)
CREATE TABLE IF NOT EXISTS calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  event_date    date NOT NULL,
  event_time    text,                     -- e.g. "8:00 PM EST"
  event_type    text DEFAULT 'BATTLE',   -- BATTLE | SPACES | COMMUNITY | OTHER
  location_or_link text,
  is_featured   boolean DEFAULT false,
  is_active     boolean DEFAULT true,
  flyer_url     text,                     -- YouTube-thumbnail-sized battle flyer image URL
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Add flyer_url to existing calendar_events tables (run if table already exists)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS flyer_url text;


-- 3. Platform Stats (Spotify + manual global numbers)
CREATE TABLE IF NOT EXISTS platform_stats (
  id                      int PRIMARY KEY DEFAULT 1,
  spotify_monthly_streams bigint DEFAULT 0,
  spotify_total_streams   bigint DEFAULT 0,
  spotify_profile_url     text DEFAULT 'https://open.spotify.com',
  updated_at              timestamptz DEFAULT now()
);

-- Seed single row (there will always be exactly 1 row, updated via admin)
INSERT INTO platform_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
