-- ============================================================
-- RLS/security hardening (2026-08-23).
-- 1. SECURITY DEFINER functions were client-executable: anyone
--    (including anon) could probe is_premium(<any uuid>). No app
--    code calls these via RPC; they are server/trigger-side only.
-- 2. brotherhood_contacts ALL policy had no explicit WITH CHECK.
--    Semantics were identical (WITH CHECK defaults to USING) but
--    explicit is safer against future policy edits.
--
-- Applied to production 2026-08-23 via Supabase migration
-- "rls_hardening".
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_program_tier() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users can manage their own brotherhood" ON brotherhood_contacts;
CREATE POLICY "Users can manage their own brotherhood" ON brotherhood_contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
