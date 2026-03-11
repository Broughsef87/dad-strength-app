-- ============================================================
-- Migration 002: User-scoped workouts
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add user_id to workouts table
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;

-- 2. Drop old catch-all read policy
DROP POLICY IF EXISTS "Workouts are publicly readable" ON workouts;

-- 3. New read policy: users see their own workouts OR global templates (user_id IS NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own and global workouts' AND tablename = 'workouts') THEN
    CREATE POLICY "Users can view own and global workouts"
      ON workouts FOR SELECT
      USING (user_id IS NULL OR user_id = auth.uid());
  END IF;
END $$;

-- 4. Drop old insert policy and replace with user-scoped one
DROP POLICY IF EXISTS "Authenticated users can insert workouts" ON workouts;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own workouts' AND tablename = 'workouts') THEN
    CREATE POLICY "Users can insert own workouts"
      ON workouts FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- 5. Drop old update policy and replace with user-scoped one
DROP POLICY IF EXISTS "Authenticated users can update workouts" ON workouts;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own workouts' AND tablename = 'workouts') THEN
    CREATE POLICY "Users can update own workouts"
      ON workouts FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 6. Allow users to delete their own workouts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own workouts' AND tablename = 'workouts') THEN
    CREATE POLICY "Users can delete own workouts"
      ON workouts FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- NOTE: Existing workouts without user_id will remain visible
-- to all users as "global templates" — that's intentional.
-- All new workouts created after this migration will be
-- user-scoped automatically.
-- ============================================================
