-- ============================================================
-- Migration 006: Fix workout_logs schema mismatch + create
--               generated_workouts and muscle_group_feedback
--
-- ROOT CAUSE: setup.sql defined workout_logs with weight_lbs,
-- workout_id, and set_number NOT NULL. The app writes weight,
-- rir_actual, and generated_workout_id. Every insert was
-- silently failing due to missing columns / NOT NULL violation.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. Fix workout_logs columns ───────────────────────────────────────────────

-- Add weight (the name the app actually uses)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS weight numeric;

-- Add rir_actual
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rir_actual numeric;

-- Add generated_workout_id (FK added after generated_workouts is created below)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS generated_workout_id uuid;

-- Make set_number nullable — app doesn't send it, NOT NULL was blocking every insert
ALTER TABLE workout_logs ALTER COLUMN set_number DROP NOT NULL;

-- Drop the old unique constraint that referenced set_number (it will fail on NULLs anyway)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_logs_unique_set'
  ) THEN
    ALTER TABLE workout_logs DROP CONSTRAINT workout_logs_unique_set;
  END IF;
END $$;

-- ── 2. Create generated_workouts ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generated_workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  day_name TEXT,
  week_theme TEXT,
  exercises JSONB NOT NULL DEFAULT '[]',
  ai_reasoning TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_number, day_number)
);

ALTER TABLE generated_workouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own generated workouts' AND tablename = 'generated_workouts') THEN
    CREATE POLICY "Users can view own generated workouts"
      ON generated_workouts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own generated workouts' AND tablename = 'generated_workouts') THEN
    CREATE POLICY "Users can insert own generated workouts"
      ON generated_workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own generated workouts' AND tablename = 'generated_workouts') THEN
    CREATE POLICY "Users can update own generated workouts"
      ON generated_workouts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own generated workouts' AND tablename = 'generated_workouts') THEN
    CREATE POLICY "Users can delete own generated workouts"
      ON generated_workouts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Now add the FK from workout_logs to generated_workouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_logs_generated_workout_id_fkey'
  ) THEN
    ALTER TABLE workout_logs
      ADD CONSTRAINT workout_logs_generated_workout_id_fkey
      FOREIGN KEY (generated_workout_id) REFERENCES generated_workouts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 3. Create muscle_group_feedback ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS muscle_group_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_slug TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  muscle_group TEXT NOT NULL,
  volume_rating TEXT NOT NULL CHECK (volume_rating IN ('not_enough', 'about_right', 'bit_much', 'too_much')),
  pump_rating TEXT NOT NULL CHECK (pump_rating IN ('barely', 'mild', 'good', 'skin_splitting')),
  pain_rating TEXT NOT NULL CHECK (pain_rating IN ('none', 'mild', 'moderate', 'had_to_stop')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_slug, week_number, day_number, muscle_group)
);

ALTER TABLE muscle_group_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own muscle feedback' AND tablename = 'muscle_group_feedback') THEN
    CREATE POLICY "Users can manage own muscle feedback"
      ON muscle_group_feedback FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
