-- ============================================================
-- Program tier gate — FREE = one program, PRO = switch freely
--
-- user_programs.user_id is UNIQUE, so program_slug IS the user's program.
-- The tier rule: a free user claims one program and keeps it; a pro user
-- may change it.
--
-- Enforced with a trigger rather than an RLS policy because:
--   (a) the claim must survive a DELETE + re-INSERT (a free user could
--       otherwise drop their row and claim a different program), so the
--       claimed slug is persisted on user_profiles, not user_programs;
--   (b) a WITH CHECK that reads the pre-update row from the same table is
--       subtle under MVCC. A BEFORE trigger sees OLD/NEW plainly.
--
-- This runs on every write regardless of client, so it holds even if
-- someone calls PostgREST directly with their own access token.
-- ============================================================

-- Where the free user's one claim lives. Survives user_programs deletion.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS claimed_program_slug TEXT;

-- is_premium must be able to read user_profiles regardless of RLS, and must
-- not be hijackable via search_path. (It was previously plain SQL/INVOKER.)
CREATE OR REPLACE FUNCTION public.is_premium(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id
      AND (
        (subscription_tier = 'pro' AND subscription_status = 'active')
        OR founder_pass = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_program_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed TEXT;
BEGIN
  -- Pro users may run any program. Record whatever they're on now, so that if
  -- their subscription later lapses they keep the program they were using.
  IF public.is_premium(NEW.user_id) THEN
    INSERT INTO public.user_profiles (id, claimed_program_slug)
    VALUES (NEW.user_id, NEW.program_slug)
    ON CONFLICT (id) DO UPDATE SET claimed_program_slug = EXCLUDED.claimed_program_slug;
    RETURN NEW;
  END IF;

  SELECT claimed_program_slug INTO claimed
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  IF claimed IS NULL THEN
    -- First claim. The profile row may not exist yet (it is created lazily),
    -- so upsert rather than update.
    INSERT INTO public.user_profiles (id, claimed_program_slug)
    VALUES (NEW.user_id, NEW.program_slug)
    ON CONFLICT (id) DO UPDATE SET claimed_program_slug = EXCLUDED.claimed_program_slug;
    RETURN NEW;
  END IF;

  IF claimed IS DISTINCT FROM NEW.program_slug THEN
    RAISE EXCEPTION 'The free plan includes one program (%). Upgrade to Dad Strong+ to switch programs.', claimed
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_programs_tier_gate ON user_programs;
CREATE TRIGGER user_programs_tier_gate
  BEFORE INSERT OR UPDATE ON user_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_program_tier();

-- Backfill: existing users keep the program they are already on.
UPDATE user_profiles p
SET claimed_program_slug = up.program_slug
FROM user_programs up
WHERE up.user_id = p.id
  AND p.claimed_program_slug IS NULL;
