-- migration-005: subscription tiers, mission goals, first-week checklist

-- Add subscription + Stripe fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS founder_pass BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ;

-- Add mission/goal fields (replaces hardcoded Empire page)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS mission_title TEXT,
  ADD COLUMN IF NOT EXISTS mission_description TEXT,
  ADD COLUMN IF NOT EXISTS mission_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mission_milestone TEXT;

-- Add first-week checklist state
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS first_week_checklist JSONB NOT NULL DEFAULT '{
    "first_workout": false,
    "set_mission": false,
    "morning_protocol": false,
    "joined_brotherhood": false,
    "dismissed": false,
    "dismissed_at": null
  }'::jsonb;

-- Add life context (replaces baby sleep framing — used to adapt daily protocols)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS life_context JSONB NOT NULL DEFAULT '{
    "sleep_quality": null,
    "energy_level": null,
    "time_available": null,
    "updated_date": null
  }'::jsonb;

-- Helper function: check if user is premium (pro tier or founder pass)
CREATE OR REPLACE FUNCTION is_premium(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id
      AND (
        (subscription_tier = 'pro' AND subscription_status = 'active')
        OR founder_pass = true
      )
  );
$$;
