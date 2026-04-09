-- Open ares_session_logs for community reads — required for the WOD leaderboard.
-- Workout results aren't sensitive; all authenticated users can see all rows.
-- Write operations remain scoped to the row owner.

ALTER TABLE ares_session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ares_session_logs_select" ON ares_session_logs;
CREATE POLICY "ares_session_logs_select"
  ON ares_session_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ares_session_logs_insert" ON ares_session_logs;
CREATE POLICY "ares_session_logs_insert"
  ON ares_session_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ares_session_logs_modify" ON ares_session_logs;
CREATE POLICY "ares_session_logs_modify"
  ON ares_session_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ares_session_logs_delete" ON ares_session_logs;
CREATE POLICY "ares_session_logs_delete"
  ON ares_session_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
