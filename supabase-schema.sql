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
  created_at TIMESTAMPTZ DEFAULT now()
);
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
