-- 7-day past-due grace with a stored end (Codex r1 on PR #69).
--
-- The Stripe webhook keeps subscription_tier = 'pro' while a renewal has
-- failed, and stamps grace_until: 7 days from the FIRST unpaid invoice
-- (src/lib/stripeWebhook.ts). Every check then compares against it, so the
-- grace ends on time even if Stripe never sends another event. The same rule
-- lives in src/lib/proStatus.ts; change both together.
--
-- Additive: one nullable column, and two functions replaced. No row is read,
-- rewritten or deleted. grace_until joins the server-written billing columns
-- so a signed-in user cannot extend their own grace.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.guard_profile_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- current_user is the role PostgREST switched to for this request, or the
  -- owner inside a SECURITY DEFINER function. Only the two client roles are held.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Deleting the row would drop the customer link (orphaning a live
    -- subscription from its webhooks) and the free-tier program claim.
    -- Account deletion goes through auth.admin.deleteUser, which cascades as
    -- the table owner and is not stopped here.
    RAISE EXCEPTION 'Profiles are not deleted directly.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.subscription_tier IS DISTINCT FROM 'free'
       OR NEW.subscription_status IS NOT NULL
       OR NEW.founder_pass IS DISTINCT FROM false
       OR NEW.stripe_customer_id IS NOT NULL
       OR NEW.stripe_subscription_id IS NOT NULL
       OR NEW.subscription_updated_at IS NOT NULL
       OR NEW.grace_until IS NOT NULL
       OR NEW.claimed_program_slug IS NOT NULL THEN
      RAISE EXCEPTION 'Billing and program-claim fields are set by the server.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.founder_pass IS DISTINCT FROM OLD.founder_pass
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_updated_at IS DISTINCT FROM OLD.subscription_updated_at
     OR NEW.grace_until IS DISTINCT FROM OLD.grace_until
     OR NEW.claimed_program_slug IS DISTINCT FROM OLD.claimed_program_slug THEN
    RAISE EXCEPTION 'Billing and program-claim fields are set by the server.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_billing_columns() FROM PUBLIC, anon, authenticated;

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
        (subscription_tier = 'pro' AND (
          subscription_status IN ('active', 'trialing')
          OR (subscription_status = 'past_due' AND grace_until > now())
        ))
        OR founder_pass = true
      )
  );
$$;
