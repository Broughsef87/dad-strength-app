-- ============================================================
-- Billing and entitlement columns are server-written only (2026-10-26).
--
-- "Users can manage own profile" is FOR ALL on every column, and Supabase
-- grants the authenticated role UPDATE on the whole table. So any signed-in
-- user could, with their own session and the public anon key:
--
--   * set founder_pass = true (lifetime Dad Strong+ for free) — is_premium(),
--     entitlements.ts and SubscriptionContext all trust it;
--   * set claimed_program_slug = NULL and switch programs on the free tier —
--     enforce_program_tier() reads it as "no claim yet";
--   * set stripe_customer_id / stripe_subscription_id to SOMEONE ELSE'S ids,
--     after which /api/billing-portal opens that customer's portal and
--     /api/account/delete cancels that customer's subscription.
--
-- Proven against a replay of revival.sql + every migration: all three
-- succeed as `authenticated` before this file, all three are refused after.
-- See scripts/checks/billing-columns-proof.sql.
--
-- The rule: these columns change only when the caller is not an API role.
-- The Stripe webhook and checkout use the service role; enforce_program_tier()
-- is SECURITY DEFINER and runs as its owner. Neither is `authenticated`/`anon`.
--
-- Additive: a trigger and a function. No row is read, rewritten or deleted.
-- ============================================================

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
     OR NEW.claimed_program_slug IS DISTINCT FROM OLD.claimed_program_slug THEN
    RAISE EXCEPTION 'Billing and program-claim fields are set by the server.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_billing_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_profiles_billing_guard ON user_profiles;
CREATE TRIGGER user_profiles_billing_guard
  BEFORE INSERT OR UPDATE OR DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_billing_columns();
