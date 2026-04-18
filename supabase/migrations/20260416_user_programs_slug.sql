-- ============================================================
-- user_programs: add program_slug column
--
-- The table was created via the Supabase UI without a slug column.
-- The app identifies programs by string slug ('zeus', 'ares-5',
-- 'chronos', etc.) — not by the existing template_id uuid — so
-- every insert in build/page.tsx, ProgramSelector, and forge was
-- silently failing (or landing with slug as an unknown column
-- that PostgREST dropped). This migration adds the column and
-- a helpful index for the common ".eq('status','active')" query.
-- ============================================================

ALTER TABLE user_programs
  ADD COLUMN IF NOT EXISTS program_slug TEXT;

-- Partial index: one active program per user, fast lookup
CREATE INDEX IF NOT EXISTS user_programs_user_active_idx
  ON user_programs (user_id)
  WHERE status = 'active';

-- Non-null going forward — any existing rows (should be zero
-- given the silent-fail history) get a sentinel so the constraint
-- can be added without breaking.
UPDATE user_programs SET program_slug = 'legacy-unknown'
  WHERE program_slug IS NULL;

ALTER TABLE user_programs
  ALTER COLUMN program_slug SET NOT NULL;
