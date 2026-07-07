-- ============================================================
-- DAD STRENGTH — FULL SCHEMA REVIVAL
--
-- One-shot, idempotent setup for a fresh Supabase project.
-- Consolidates 29 historical migration files into the final
-- state the app code actually expects (as of 2026-04-28).
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Improvements over the old production schema (deliberate):
--   * generated_workouts has NO table-level UNIQUE(user_id, week, day)
--     — that constraint made Zeus and Ares collide for the same user.
--     Per-program partial unique indexes are used instead.
--   * daily_checkins includes growth_state / forge_state /
--     habit_completions and user_profiles includes program_data /
--     growth_data — columns the code always selected but that never
--     existed, causing chronic dashboard 400s.
--   * ares_session_logs unique index is FULL (not partial) with
--     NULLS NOT DISTINCT so PostgREST upserts work (42P10 fix).
--   * generated_workouts.exercises is nullable (legacy column).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. programs (legacy organizational table — kept for FK)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_public   boolean DEFAULT false,
  created_by  uuid REFERENCES auth.users,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='programs' AND policyname='Programs are readable') THEN
    CREATE POLICY "Programs are readable" ON programs FOR SELECT USING (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. workouts (templates + quick-start single workouts)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  description  text,
  exercises    jsonb NOT NULL,
  status       text DEFAULT 'active',
  completed_at timestamptz,
  user_id      uuid REFERENCES auth.users,
  program_id   uuid REFERENCES programs(id),
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workouts' AND policyname='Users can view own and global workouts') THEN
    CREATE POLICY "Users can view own and global workouts" ON workouts
      FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workouts' AND policyname='Users can insert own workouts') THEN
    CREATE POLICY "Users can insert own workouts" ON workouts
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workouts' AND policyname='Users can update own workouts') THEN
    CREATE POLICY "Users can update own workouts" ON workouts
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workouts' AND policyname='Users can delete own workouts') THEN
    CREATE POLICY "Users can delete own workouts" ON workouts
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. user_profiles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                       uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name             text,
  bodyweight_lbs           numeric,
  streak_days              int DEFAULT 0,
  last_workout_date        timestamptz,
  weekly_goal_sessions     int DEFAULT 3,
  onboarding_complete      boolean DEFAULT false,
  active_program_config    jsonb,
  mission_data             jsonb,
  -- subscription / founder
  subscription_tier        text NOT NULL DEFAULT 'free',
  stripe_customer_id       text,
  stripe_subscription_id   text,
  subscription_status      text,
  founder_pass             boolean NOT NULL DEFAULT false,
  subscription_updated_at  timestamptz,
  -- mission
  mission_title            text,
  mission_description      text,
  mission_progress         int NOT NULL DEFAULT 0,
  mission_milestone        text,
  -- onboarding checklist + life context
  first_week_checklist     jsonb NOT NULL DEFAULT '{
    "first_workout": false, "set_mission": false, "morning_protocol": false,
    "joined_brotherhood": false, "dismissed": false, "dismissed_at": null
  }'::jsonb,
  life_context             jsonb NOT NULL DEFAULT '{
    "sleep_quality": null, "energy_level": null,
    "time_available": null, "updated_date": null
  }'::jsonb,
  -- NEW: columns the app selects but the old DB never had (dashboard 400s)
  program_data             jsonb,
  growth_data              jsonb,
  body_composition         jsonb,
  sleep_log                jsonb,
  workout_notes            jsonb,
  created_at               timestamptz DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='Users can manage own profile') THEN
    CREATE POLICY "Users can manage own profile" ON user_profiles
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_premium(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id
      AND ((subscription_tier = 'pro' AND subscription_status = 'active')
           OR founder_pass = true)
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 4. user_programs (one active program per user)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_programs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  program_slug  text NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  started_at    timestamptz DEFAULT now(),
  current_week  int NOT NULL DEFAULT 1 CHECK (current_week >= 1),
  equipment     jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id   uuid,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_programs_user_active_idx
  ON user_programs (user_id) WHERE status = 'active';
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_programs' AND policyname='Users manage own programs') THEN
    CREATE POLICY "Users manage own programs" ON user_programs
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. generated_workouts (AI-generated sessions, all programs)
--    NOTE: no table-level UNIQUE(user_id, week, day) — per-program
--    partial indexes below handle uniqueness without cross-program
--    collisions.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_workouts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_slug  text,
  week_number   int NOT NULL,
  day_number    int NOT NULL,
  day_name      text,
  week_theme    text,
  exercises     jsonb DEFAULT '[]'::jsonb,      -- legacy, nullable
  ai_reasoning  text,
  workout_data  jsonb,                           -- canonical payload
  generated_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);
-- Zeus (and other personal programs): one row per user/week/day
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_zeus_user_week_day_unique
  ON generated_workouts (user_id, week_number, day_number)
  WHERE program_slug = 'zeus';
-- Ares: one shared WOD per (slug, week, day) across all users
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_ares_week_day_unique
  ON generated_workouts (program_slug, week_number, day_number)
  WHERE program_slug = 'ares';
-- Legacy per-user path (custom/forge programs, program_slug IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_legacy_user_week_day_unique
  ON generated_workouts (user_id, week_number, day_number)
  WHERE program_slug IS NULL;
ALTER TABLE generated_workouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_workouts' AND policyname='Users can view own or shared workouts') THEN
    CREATE POLICY "Users can view own or shared workouts" ON generated_workouts
      FOR SELECT USING (auth.uid() = user_id OR program_slug = 'ares');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_workouts' AND policyname='Users can insert own generated workouts') THEN
    CREATE POLICY "Users can insert own generated workouts" ON generated_workouts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_workouts' AND policyname='Users can update own generated workouts') THEN
    CREATE POLICY "Users can update own generated workouts" ON generated_workouts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_workouts' AND policyname='Users can delete own generated workouts') THEN
    CREATE POLICY "Users can delete own generated workouts" ON generated_workouts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. workout_logs (streak counter, history, legacy player)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_logs (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              uuid REFERENCES auth.users NOT NULL,
  workout_id           uuid REFERENCES workouts(id),
  generated_workout_id uuid REFERENCES generated_workouts(id) ON DELETE SET NULL,
  exercise_name        text NOT NULL,
  set_number           int,
  weight_lbs           numeric NOT NULL DEFAULT 0,
  reps                 int,
  rir_actual           numeric,
  completed            boolean DEFAULT false,
  notes                text,
  created_at           timestamptz DEFAULT now()
);
-- Zeus session-complete shim upserts on this exact tuple. FULL index
-- (no WHERE) so PostgREST ON CONFLICT can match it; default NULLS
-- DISTINCT means legacy rows (NULL generated_workout_id) never collide.
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_generated_unique_set
  ON workout_logs (user_id, generated_workout_id, exercise_name, set_number);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_created
  ON workout_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_workout_id
  ON workout_logs (workout_id) WHERE workout_id IS NOT NULL;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_logs' AND policyname='Users manage own logs') THEN
    CREATE POLICY "Users manage own logs" ON workout_logs
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. ares_session_logs (Zeus + Ares session logging)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ares_session_logs (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  generated_workout_id    uuid,
  week_number             int NOT NULL,
  day_number              int NOT NULL,
  log_type                text NOT NULL
    CHECK (log_type IN ('strength_set','build_to_max','skill_work',
                        'monostructural','metcon','session_complete')),
  block_name              text NOT NULL,
  -- strength_set
  set_number              int,
  weight_lbs              numeric,
  reps                    int,
  rir_actual              int,
  completed               boolean DEFAULT true,
  completed_at            timestamptz,
  -- build_to_max
  peak_weight_lbs         numeric,
  climb_scheme            text,
  -- skill_work
  skill_duration_minutes  int,
  -- monostructural
  distance_meters         numeric,
  duration_seconds        int,
  -- metcon
  metcon_format           text
    CHECK (metcon_format IN ('for_time','amrap','emom','chipper',
                             'for_time_with_cap') OR metcon_format IS NULL),
  metcon_time_seconds     int,
  metcon_rounds           int,
  metcon_partial_reps     int,
  metcon_rx               boolean DEFAULT true,
  time_cap_hit            boolean DEFAULT false,
  notes                   text,
  created_at              timestamptz DEFAULT now() NOT NULL
);
-- FULL unique index, NULLS NOT DISTINCT: PostgREST upserts match it,
-- and blocks without set numbers (metcon/oly/skill) collapse to one
-- row per (user, workout, block).
CREATE UNIQUE INDEX IF NOT EXISTS ares_session_logs_session_block_set_unique
  ON ares_session_logs (user_id, generated_workout_id, block_name, set_number)
  NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_ares_logs_user_week
  ON ares_session_logs (user_id, week_number, day_number);
CREATE INDEX IF NOT EXISTS idx_ares_logs_workout
  ON ares_session_logs (generated_workout_id) WHERE generated_workout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ares_logs_user_created
  ON ares_session_logs (user_id, created_at DESC);
ALTER TABLE ares_session_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ares_session_logs' AND policyname='Users manage own Ares logs') THEN
    CREATE POLICY "Users manage own Ares logs" ON ares_session_logs
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. daily_checkins (mind/spirit/growth/forge state)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date               date NOT NULL,
  mind_state         jsonb,
  spirit_state       jsonb,
  -- NEW: columns the app selects but the old DB never had (400 fixes)
  growth_state       jsonb,
  forge_state        jsonb,
  habit_completions  jsonb,
  sleep_quality      int,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_checkins' AND policyname='Users can manage own checkins') THEN
    CREATE POLICY "Users can manage own checkins" ON daily_checkins
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 9. daily_objectives + deep_work_sessions
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_objectives (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text       text NOT NULL DEFAULT '',
  completed  boolean DEFAULT false,
  date       date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_objectives_user_date ON daily_objectives (user_id, date);
ALTER TABLE daily_objectives ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_objectives' AND policyname='Users can manage own daily objectives') THEN
    CREATE POLICY "Users can manage own daily objectives" ON daily_objectives
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS deep_work_sessions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_minutes int NOT NULL DEFAULT 0,
  title            text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deep_work_sessions_user_created ON deep_work_sessions (user_id, created_at);
ALTER TABLE deep_work_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deep_work_sessions' AND policyname='Users can manage own deep work sessions') THEN
    CREATE POLICY "Users can manage own deep work sessions" ON deep_work_sessions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 10. muscle_group_feedback
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS muscle_group_feedback (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_slug  text NOT NULL,
  week_number   int NOT NULL,
  day_number    int NOT NULL,
  muscle_group  text NOT NULL,
  volume_rating text NOT NULL CHECK (volume_rating IN ('not_enough','about_right','bit_much','too_much')),
  pump_rating   text NOT NULL CHECK (pump_rating IN ('barely','mild','good','skin_splitting')),
  pain_rating   text NOT NULL CHECK (pain_rating IN ('none','mild','moderate','had_to_stop')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, program_slug, week_number, day_number, muscle_group)
);
ALTER TABLE muscle_group_feedback ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='muscle_group_feedback' AND policyname='Users can manage own muscle feedback') THEN
    CREATE POLICY "Users can manage own muscle feedback" ON muscle_group_feedback
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 11. body_composition
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_composition (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_lbs   numeric,
  body_fat_pct numeric,
  notes        text,
  recorded_at  timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_body_composition_user_recorded
  ON body_composition (user_id, recorded_at DESC);
ALTER TABLE body_composition ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='body_composition' AND policyname='Users manage own body composition') THEN
    CREATE POLICY "Users manage own body composition" ON body_composition
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 12. ai_request_logs (per-user AI rate limiting)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_request_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route      text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_route_time
  ON ai_request_logs (user_id, route, created_at DESC);
ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_request_logs' AND policyname='Users read own ai logs') THEN
    CREATE POLICY "Users read own ai logs" ON ai_request_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_request_logs' AND policyname='Users insert own ai logs') THEN
    CREATE POLICY "Users insert own ai logs" ON ai_request_logs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 13. stripe_webhook_events (idempotency; harmless if unused)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id   text PRIMARY KEY,
  event_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 14. brotherhood_contacts + family_pulse
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brotherhood_contacts (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  last_contacted_at timestamptz,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE brotherhood_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brotherhood_contacts' AND policyname='Users can manage their own brotherhood') THEN
    CREATE POLICY "Users can manage their own brotherhood" ON brotherhood_contacts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS family_pulse (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  marriage_vibe int CHECK (marriage_vibe BETWEEN 1 AND 5),
  kid_score     int CHECK (kid_score BETWEEN 1 AND 5),
  moments       text[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE family_pulse ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_pulse' AND policyname='Users can manage their own pulse') THEN
    CREATE POLICY "Users can manage their own pulse" ON family_pulse
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- DONE. After you SIGN UP in the app, run this to make yourself
-- permanently Pro (no Stripe needed):
--
--   UPDATE user_profiles SET founder_pass = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'broughsef@gmail.com');
--
-- (The row is created on first dashboard load; if it doesn't
-- exist yet, load the dashboard once, then run the UPDATE.)
-- ============================================================
