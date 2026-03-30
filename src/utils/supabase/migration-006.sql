-- Migration 006: Muscle group feedback per session
-- Run in Supabase SQL Editor

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

CREATE POLICY "Users can manage own muscle feedback"
  ON muscle_group_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
