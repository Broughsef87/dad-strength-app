-- ============================================================
-- Ares Program: flexible session logging
-- Run in Supabase SQL Editor
--
-- Single table handles all Ares recording types:
--   strength_set   → weight_lbs + reps + rir_actual
--   build_to_max   → peak_weight_lbs (the weight they hit)
--   skill_work     → skill_duration_minutes + notes
--   monostructural → distance_meters + duration_seconds
--   metcon         → format + time/rounds/reps result
-- ============================================================

CREATE TABLE IF NOT EXISTS ares_session_logs (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  generated_workout_id    uuid,
  week_number             int         NOT NULL,
  day_number              int         NOT NULL,

  -- What kind of record this is
  log_type                text        NOT NULL
    CHECK (log_type IN ('strength_set', 'build_to_max', 'skill_work', 'monostructural', 'metcon')),
  block_name              text        NOT NULL,   -- exercise name, 'MetCon', 'Row EMOM', etc.

  -- strength_set
  set_number              int,
  weight_lbs              numeric,
  reps                    int,
  rir_actual              int,
  completed               boolean     DEFAULT true,

  -- build_to_max
  peak_weight_lbs         numeric,
  climb_scheme            text,                   -- e.g. '5-4-3-2-2-1'

  -- skill_work
  skill_duration_minutes  int,

  -- monostructural
  distance_meters         numeric,
  duration_seconds        int,

  -- metcon
  metcon_format           text
    CHECK (metcon_format IN ('for_time', 'amrap', 'emom', 'chipper', NULL)),
  metcon_time_seconds     int,                    -- time to complete (for_time) OR time cap (amrap/emom)
  metcon_rounds           int,                    -- amrap: rounds completed
  metcon_partial_reps     int,                    -- amrap: partial round reps
  metcon_rx               boolean     DEFAULT true,
  time_cap_hit            boolean     DEFAULT false,

  notes                   text,
  created_at              timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ares_logs_user_week
  ON ares_session_logs (user_id, week_number, day_number);

CREATE INDEX IF NOT EXISTS idx_ares_logs_workout
  ON ares_session_logs (generated_workout_id)
  WHERE generated_workout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ares_logs_user_created
  ON ares_session_logs (user_id, created_at DESC);

-- RLS
ALTER TABLE ares_session_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ares_session_logs' AND policyname = 'Users manage own Ares logs'
  ) THEN
    CREATE POLICY "Users manage own Ares logs"
      ON ares_session_logs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
