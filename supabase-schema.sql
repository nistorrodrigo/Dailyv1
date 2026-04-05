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

-- No auth for now — open RLS
ALTER TABLE dailies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dailies" ON dailies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on templates" ON templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on recipients" ON recipients FOR ALL USING (true) WITH CHECK (true);
