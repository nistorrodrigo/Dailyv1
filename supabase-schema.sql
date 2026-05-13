-- LS Daily Builder — Supabase Schema
-- Run this in your Supabase SQL Editor to create the tables

CREATE TABLE dailies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_dailies_date_unique ON dailies (date);
CREATE INDEX idx_dailies_date ON dailies (date DESC);

CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Versioned snapshots of a daily — one row per save. Used by the
-- HistoryPanel "Versions for today" tab and the Save-snapshot button.
-- The dailies table holds the live working copy (one row per date,
-- overwritten by the autosave); daily_versions is the rollback log
-- (many rows per date, immutable). The two together let an analyst
-- recover from an aggressive edit ("I deleted the macro section")
-- without losing in-progress work, AND keep an audit trail of
-- intra-day saves.
CREATE TABLE daily_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_date DATE NOT NULL,
  -- Optional human label so the desk can mark "before AI rewrite",
  -- "after Pedro's review", etc. Auto-generated when the autosave
  -- writes ("Auto · 14:35").
  label TEXT,
  state JSONB NOT NULL,
  -- Email of the analyst who saved this version. Stamped at insert
  -- time so the DELETE path can require ownership (or admin).
  -- Nullable for rows persisted before this column existed.
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Migration for existing deployments — the schema above is for fresh
-- installs. Existing tables get the column via the additive ALTER:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE daily_versions ADD COLUMN created_by TEXT;
  END IF;
END $$;
CREATE INDEX idx_daily_versions_date ON daily_versions (daily_date DESC, created_at DESC);

-- No auth for now — open RLS
ALTER TABLE dailies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dailies" ON dailies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on templates" ON templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on recipients" ON recipients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE daily_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on daily_versions" ON daily_versions FOR ALL USING (true) WITH CHECK (true);

-- Unique index on sg_event_id for the SendGrid webhook receiver's
-- idempotency. SendGrid retries event delivery at-least-once, and
-- the `onConflict: "sg_event_id" ignoreDuplicates: true` upsert in
-- api/sendgrid-webhook.js relies on this index to no-op on retries.
-- The column itself may already exist on the email_events table —
-- this index is the missing piece. Run idempotently:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_events_sg_event_id'
  ) THEN
    -- Tolerate NULLs from pre-existing rows (older inserts didn't
    -- store sg_event_id); only future inserts get the idempotency
    -- benefit.
    CREATE UNIQUE INDEX idx_email_events_sg_event_id
      ON email_events (sg_event_id)
      WHERE sg_event_id IS NOT NULL;
  END IF;
END $$;
