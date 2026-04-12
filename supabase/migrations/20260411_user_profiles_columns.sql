-- Add missing user_profiles columns that the app has been writing to
-- without these columns existing in production (writes silently failed).

ALTER TABLE user_profiles
  -- First-week checklist: JSONB blob tracking 4 onboarding items + dismissed state
  ADD COLUMN IF NOT EXISTS first_week_checklist JSONB,
  -- Mission tracker fields (used by /profile/mission page)
  ADD COLUMN IF NOT EXISTS mission_title        TEXT,
  ADD COLUMN IF NOT EXISTS mission_description  TEXT,
  ADD COLUMN IF NOT EXISTS mission_progress     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mission_milestone    TEXT,
  -- Legacy mission_data blob (used by /profile/edit-mission page)
  ADD COLUMN IF NOT EXISTS mission_data         JSONB;
