-- ============================================================
-- Migration 001: Schema fixes for workout logging
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add missing completed_at column to workouts
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Add unique constraint on workout_logs so upserts work correctly
--    (prevents duplicate set entries per user/workout/exercise/set combo)
ALTER TABLE workout_logs
  ADD CONSTRAINT IF NOT EXISTS workout_logs_unique_set
    UNIQUE (user_id, workout_id, exercise_name, set_number);

-- 3. Enable Row Level Security on both tables (required for Supabase auth)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for workout_logs: users can only see and edit their own logs
CREATE POLICY IF NOT EXISTS "Users can view own logs"
  ON workout_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own logs"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own logs"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own logs"
  ON workout_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS Policies for workouts: publicly readable (shared templates), but protected for modifications
CREATE POLICY IF NOT EXISTS "Workouts are publicly readable"
  ON workouts FOR SELECT
  USING (true);

-- ============================================================
-- OPTIONAL (Future): User-specific program tracking
-- Uncomment when ready to scope programs per user
-- ============================================================

-- CREATE TABLE IF NOT EXISTS user_programs (
--   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id uuid REFERENCES auth.users NOT NULL,
--   workout_id uuid REFERENCES workouts(id) NOT NULL,
--   assigned_at timestamptz DEFAULT now(),
--   is_active boolean DEFAULT true,
--   UNIQUE(user_id, workout_id)
-- );
-- ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users manage own programs" ON user_programs FOR ALL USING (auth.uid() = user_id);
