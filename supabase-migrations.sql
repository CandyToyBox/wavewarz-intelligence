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


-- 4. Battles (core battle feed — written by webhook, read by frontend)
CREATE TABLE IF NOT EXISTS battles (
  -- Primary key (on-chain u64 battle ID — unique everywhere)
  battle_id                   bigint PRIMARY KEY,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),

  -- Status: ACTIVE | ENDED | completed | settled
  status                      text DEFAULT 'ACTIVE',

  -- Artist / Side 1
  artist1_name                text,          -- song title in Quick Battles
  artist1_wallet              text,
  artist1_music_link          text,          -- Audius URL — presence detects Quick Battle
  artist1_twitter             text,
  artist1_pool                numeric DEFAULT 0,
  artist1_supply              bigint  DEFAULT 0,
  total_volume_a              numeric DEFAULT 0,

  -- Artist / Side 2
  artist2_name                text,
  artist2_wallet              text,
  artist2_music_link          text,
  artist2_twitter             text,
  artist2_pool                numeric DEFAULT 0,
  artist2_supply              bigint  DEFAULT 0,
  total_volume_b              numeric DEFAULT 0,

  -- Media
  image_url                   text,
  stream_link                 text,
  youtube_replay_link         text,

  -- Battle mechanics
  battle_duration             integer,       -- seconds (end_time - start_time)
  winner_decided              boolean DEFAULT false,
  winner_artist_a             numeric,       -- 1.0 = A wins, 0.0 = B wins (not a boolean)
  unique_traders              integer,
  trade_count                 integer,
  total_distribution_amount   numeric DEFAULT 0,

  -- Wallets
  wavewarz_wallet             text,
  creator_wallet              text,

  -- Battle type flags
  is_community_battle         boolean DEFAULT false,
  is_quick_battle             boolean DEFAULT false,
  is_test_battle              boolean DEFAULT false,
  -- Generated: true when not quick, not community, not test
  is_main_battle              boolean GENERATED ALWAYS AS (
    NOT is_quick_battle AND NOT is_community_battle AND NOT is_test_battle
  ) STORED,

  -- Subtype (charity | spotlight | null)
  event_subtype               text,

  -- Community / Quick Battle specific
  community_round_id          numeric,
  quick_battle_queue_id       text,
  split_wallet_address        numeric,

  -- Quick Battle 3-factor judging — Poll factor
  poll_votes_a                integer,
  poll_votes_b                integer,
  poll_winner                 text,
  poll_finalized_at           timestamptz
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS battles_updated_at ON battles;
CREATE TRIGGER battles_updated_at
  BEFORE UPDATE ON battles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS battles_created_at_idx       ON battles (created_at DESC);
CREATE INDEX IF NOT EXISTS battles_is_test_idx          ON battles (is_test_battle);
CREATE INDEX IF NOT EXISTS battles_is_quick_idx         ON battles (is_quick_battle);
CREATE INDEX IF NOT EXISTS battles_artist1_wallet_idx   ON battles (artist1_wallet);
CREATE INDEX IF NOT EXISTS battles_artist2_wallet_idx   ON battles (artist2_wallet);
CREATE INDEX IF NOT EXISTS battles_status_idx           ON battles (status);


-- 5. Trades (individual buy/sell records per wallet per battle)
-- Populated by WaveWarz.com trade events forwarded to the analytics webhook,
-- or by on-chain transaction parsing via Helius Enhanced API.
CREATE TABLE IF NOT EXISTS trades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id       bigint REFERENCES battles(battle_id) ON DELETE CASCADE,
  trader_wallet   text NOT NULL,
  -- trade_type: buy_a | buy_b | sell_a | sell_b
  trade_type      text,
  amount_sol      numeric DEFAULT 0,
  -- Solana transaction signature for deduplication
  signature       text UNIQUE,
  timestamp       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_trader_wallet_idx ON trades (trader_wallet);
CREATE INDEX IF NOT EXISTS trades_battle_id_idx     ON trades (battle_id);
CREATE INDEX IF NOT EXISTS trades_timestamp_idx     ON trades (timestamp DESC);

-- Row Level Security: trades are public read (leaderboard data)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "trades_public_read" ON trades FOR SELECT USING (true);


-- 6. Artist Profiles (manually managed via admin panel)
CREATE TABLE IF NOT EXISTS artist_profiles (
  artist_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name          text NOT NULL,
  primary_wallet        text UNIQUE NOT NULL,
  audius_handle         text,
  twitter_handle        text,
  profile_picture_url   text,
  bio                   text,
  social_links          jsonb,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS artist_profiles_updated_at ON artist_profiles;
CREATE TRIGGER artist_profiles_updated_at
  BEFORE UPDATE ON artist_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS artist_profiles_wallet_idx ON artist_profiles (primary_wallet);


-- 6. Artist Wallets (links additional wallets to a single artist profile)
CREATE TABLE IF NOT EXISTS artist_wallets (
  wallet_address  text PRIMARY KEY,
  artist_id       uuid REFERENCES artist_profiles(artist_id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now()
);
