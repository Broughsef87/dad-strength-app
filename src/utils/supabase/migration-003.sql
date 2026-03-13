-- Add fields to user_profiles
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_program_config JSONB,
  ADD COLUMN IF NOT EXISTS mission_data JSONB;

-- Create daily_checkins table
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  mind_state JSONB,
  spirit_state JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- RLS for daily_checkins
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own checkins" ON daily_checkins
  FOR ALL USING (auth.uid() = user_id);

-- Also ensure user_profiles RLS exists
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
    AND policyname = 'Users can manage own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id)';
  END IF;
END
$$;
