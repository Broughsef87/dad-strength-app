-- ============================================================
-- Proof for supabase/migrations/20261026_protect_billing_columns.sql.
--
-- Run against a database built from supabase/revival.sql + every migration,
-- with Supabase's roles (anon, authenticated, service_role) and auth.uid():
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/checks/billing-columns-proof.sql
--
-- Everything happens inside one transaction that is rolled back. Each case
-- prints PASS or raises. Before the migration the first case raises
-- ("a free user granted himself founder_pass"); after it, all pass.
-- NEVER run this against production.
-- ============================================================
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('b1111111-0000-4000-8000-000000000001', 'proof-free@example.invalid'),
  ('b1111111-0000-4000-8000-000000000002', 'proof-payer@example.invalid'),
  ('b1111111-0000-4000-8000-000000000003', 'proof-new@example.invalid');
INSERT INTO user_profiles (id, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status)
  VALUES ('b1111111-0000-4000-8000-000000000002', 'cus_proof_payer', 'sub_proof_payer', 'pro', 'active');

CREATE TEMP TABLE proof_case (name text) ON COMMIT DROP;
GRANT ALL ON proof_case TO authenticated;

-- Runs one statement as a signed-in user (default: the free user); returns the SQLSTATE or 'ok'.
CREATE OR REPLACE FUNCTION pg_temp.as_free(stmt text, who text DEFAULT 'b1111111-0000-4000-8000-000000000001') RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN SQLSTATE;
  END;
  RESET ROLE;
  RETURN 'ok';
END $$;

DO $$
DECLARE r text;
BEGIN
  -- Legitimate: the lazy profile bootstrap the dashboard and LegalGate do.
  r := pg_temp.as_free($q$INSERT INTO user_profiles (id, display_name) VALUES (auth.uid(), 'Proof') ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name$q$);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL profile bootstrap refused (%)', r; END IF;
  RAISE NOTICE 'PASS a user can still create and edit his own profile';

  r := pg_temp.as_free($q$UPDATE user_profiles SET founder_pass = true WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a free user granted himself founder_pass'; END IF;
  r := pg_temp.as_free($q$UPDATE user_profiles SET subscription_tier = 'pro' WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a free user set his tier to pro'; END IF;
  r := pg_temp.as_free($q$UPDATE user_profiles SET subscription_status = 'active' WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a free user set his status to active'; END IF;
  RAISE NOTICE 'PASS a free user cannot grant himself Pro (%)', r;

  -- One column per statement, so each is proven refused on its own.
  r := pg_temp.as_free($q$UPDATE user_profiles SET stripe_customer_id = 'cus_proof_payer' WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a user pointed his profile at another customer'; END IF;
  r := pg_temp.as_free($q$UPDATE user_profiles SET stripe_subscription_id = 'sub_proof_payer' WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a user pointed his profile at another subscription'; END IF;
  RAISE NOTICE 'PASS a user cannot point his profile at another customer (%)', r;

  -- Legitimate: the tier trigger records the free user's first claim (SECURITY DEFINER).
  r := pg_temp.as_free($q$INSERT INTO user_programs (user_id, program_slug) VALUES (auth.uid(), 'dad-built')$q$);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL first program claim refused (%)', r; END IF;
  RAISE NOTICE 'PASS the first program claim still records';

  r := pg_temp.as_free($q$UPDATE user_profiles SET claimed_program_slug = NULL WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a free user cleared his program claim'; END IF;
  r := pg_temp.as_free($q$UPDATE user_programs SET program_slug = 'hybrid-power' WHERE user_id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a free user switched programs'; END IF;
  RAISE NOTICE 'PASS a free user cannot clear his claim or switch programs';

  r := pg_temp.as_free($q$DELETE FROM user_profiles WHERE id = auth.uid()$q$);
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a user deleted his profile row (and with it the claim)'; END IF;
  RAISE NOTICE 'PASS a user cannot delete his profile row (%)', r;

  -- His OWN row, so row-level security allows the insert and only the guard
  -- can refuse it (a random id is refused by RLS and would prove nothing).
  r := pg_temp.as_free($q$INSERT INTO user_profiles (id, founder_pass) VALUES (auth.uid(), true)$q$, 'b1111111-0000-4000-8000-000000000003');
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a new user created his profile with founder_pass'; END IF;
  r := pg_temp.as_free($q$INSERT INTO user_profiles (id, stripe_customer_id) VALUES (auth.uid(), 'cus_proof_payer')$q$, 'b1111111-0000-4000-8000-000000000003');
  IF r = 'ok' THEN RAISE EXCEPTION 'FAIL a new user created his profile linked to another customer'; END IF;
  RAISE NOTICE 'PASS an insert cannot carry billing fields (%)', r;
END $$;

-- The server paths still work: the webhook (service role) and account deletion.
SET LOCAL ROLE service_role;
UPDATE user_profiles SET founder_pass = true, subscription_tier = 'pro', subscription_status = 'active'
  WHERE id = 'b1111111-0000-4000-8000-000000000001';
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT founder_pass FROM user_profiles WHERE id = 'b1111111-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FAIL the service role could not set founder_pass';
  END IF;
  RAISE NOTICE 'PASS the webhook (service role) still writes billing fields';
END $$;
DELETE FROM auth.users WHERE id = 'b1111111-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = 'b1111111-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FAIL account deletion did not cascade to the profile';
  END IF;
  RAISE NOTICE 'PASS account deletion still cascades';
END $$;

ROLLBACK;
