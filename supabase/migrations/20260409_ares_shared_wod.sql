-- Ares WOD sharing: allow all authenticated users to read any generated_workouts row.
-- Ares workouts are date-keyed and shared across all users — one generation per day
-- serves everyone. Without this, users could only read their own rows.

-- Drop the existing SELECT policy if it only allows own rows, then add a shared read policy.
-- (If the table has no RLS yet, enable it and add both policies.)

ALTER TABLE generated_workouts ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read any workout (Ares WODs are public within the app)
DROP POLICY IF EXISTS "generated_workouts_select" ON generated_workouts;
CREATE POLICY "generated_workouts_select"
  ON generated_workouts FOR SELECT
  TO authenticated
  USING (true);

-- Only the row owner can insert/update/delete
DROP POLICY IF EXISTS "generated_workouts_insert" ON generated_workouts;
CREATE POLICY "generated_workouts_insert"
  ON generated_workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_workouts_modify" ON generated_workouts;
CREATE POLICY "generated_workouts_modify"
  ON generated_workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "generated_workouts_delete" ON generated_workouts;
CREATE POLICY "generated_workouts_delete"
  ON generated_workouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
