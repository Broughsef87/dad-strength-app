-- ============================================================
-- Recovery protocol v2 — count-based weekly target
--
-- The week's target is 4 TOTAL sessions in any combination (3 cold
-- plunges + 1 stretch counts), not one of each. Each (user, week,
-- modality) row now carries a count. Also adds the UPDATE policy the
-- original migration lacked (needed to increment counts).
-- Idempotent; safe whether or not 20260718_recovery_checks ran already.
-- ============================================================

alter table public.user_recovery_checks
  add column if not exists count int not null default 1;

drop policy if exists "recovery owner update" on public.user_recovery_checks;
create policy "recovery owner update" on public.user_recovery_checks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
