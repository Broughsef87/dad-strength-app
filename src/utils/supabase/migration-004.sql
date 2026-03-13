-- migration-004: deep_work_sessions and daily_objectives tables

-- Deep Work Sessions: tracks individual focus sessions from the Mind timer
CREATE TABLE IF NOT EXISTS deep_work_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE deep_work_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deep_work_sessions' AND policyname = 'Users can manage own deep work sessions') THEN
    CREATE POLICY "Users can manage own deep work sessions" ON deep_work_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Index for fast user+date queries
CREATE INDEX IF NOT EXISTS deep_work_sessions_user_created ON deep_work_sessions(user_id, created_at);


-- Daily Objectives: per-row tracking for individual objectives
CREATE TABLE IF NOT EXISTS daily_objectives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  completed BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_objectives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_objectives' AND policyname = 'Users can manage own daily objectives') THEN
    CREATE POLICY "Users can manage own daily objectives" ON daily_objectives FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Index for fast user+date queries
CREATE INDEX IF NOT EXISTS daily_objectives_user_date ON daily_objectives(user_id, date);
CREATE INDEX IF NOT EXISTS daily_objectives_user_created ON daily_objectives(user_id, created_at);
