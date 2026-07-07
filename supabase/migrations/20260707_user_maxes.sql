-- ============================================================
-- user_maxes: per-user 1RMs, keyed by lift.
--
-- Collected at program creation (each path declares which maxes it
-- needs) and updated after test weeks. Percent-based prescriptions
-- compute off these — deterministically, in program config code.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_maxes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lift_key text NOT NULL,          -- 'snatch' | 'clean_jerk' | 'back_squat' | ...
  value_lbs numeric NOT NULL CHECK (value_lbs > 0),
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, lift_key)
);

ALTER TABLE user_maxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own maxes" ON user_maxes;
CREATE POLICY "Users manage own maxes" ON user_maxes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
