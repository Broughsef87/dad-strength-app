-- workout_logs RLS policy was never created.
-- The table has had ROW LEVEL SECURITY enabled since 20260408 but with
-- zero policies, meaning every INSERT and SELECT from the client is silently
-- blocked by Postgres. This is why workout completions never persisted.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workout_logs' AND policyname = 'Users manage own workout logs'
  ) THEN
    CREATE POLICY "Users manage own workout logs"
      ON workout_logs
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
