-- ============================================================
-- RLS gap-fill migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Covers three tables that were missing row-level security:
--   1. user_programs  — originally commented out in migration-001
--   2. body_composition — created via Supabase UI, no policies
--   3. ai_request_logs — SELECT policy existed; INSERT was missing
--                        (rate limiter writes to this table)
-- ============================================================

-- ── 1. user_programs ─────────────────────────────────────────
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_programs' AND policyname = 'Users manage own programs'
  ) THEN
    CREATE POLICY "Users manage own programs"
      ON user_programs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. body_composition ──────────────────────────────────────
-- Create the table if it doesn't exist yet (idempotent).
CREATE TABLE IF NOT EXISTS body_composition (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_lbs    numeric,
  body_fat_pct  numeric,
  notes         text,
  recorded_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_body_composition_user_recorded
  ON body_composition (user_id, recorded_at DESC);

ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'body_composition' AND policyname = 'Users manage own body composition'
  ) THEN
    CREATE POLICY "Users manage own body composition"
      ON body_composition
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. ai_request_logs — add INSERT policy ───────────────────
-- Table was created by the previous migration (20260408_ai_request_logs.sql).
-- That migration only added a SELECT policy. The rate limiter also needs
-- INSERT so users can log their own requests.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_request_logs' AND policyname = 'Users insert own ai logs'
  ) THEN
    CREATE POLICY "Users insert own ai logs"
      ON ai_request_logs
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
