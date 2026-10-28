-- 7-day past-due grace. The Stripe webhook keeps subscription_tier = 'pro'
-- for 7 days after a renewal fails (paidUp in src/lib/stripeWebhook.ts) and
-- drops it to 'free' on the first event after that. is_premium() must accept
-- past_due too, or the program-switch gate would refuse a dad mid-grace.
-- Same status list as src/lib/proStatus.ts.
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
        (subscription_tier = 'pro' AND subscription_status IN ('active', 'past_due'))
        OR founder_pass = true
      )
  );
$$;
