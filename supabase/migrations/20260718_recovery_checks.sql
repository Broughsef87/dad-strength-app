-- ============================================================
-- Recovery protocol checks — Chassis page weekly recovery card
--
-- 3-4 recommended recovery sessions per week (cold plunge, stretching,
-- foam rolling, sauna/breathwork rotation). One row per completed
-- session per week; unchecking deletes the row. week_key = Monday date.
-- ============================================================

create table if not exists public.user_recovery_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key date not null,
  session_key text not null,
  completed_at timestamptz not null default now()
);

create unique index if not exists user_recovery_checks_unique
  on public.user_recovery_checks (user_id, week_key, session_key);

alter table public.user_recovery_checks enable row level security;

drop policy if exists "recovery owner select" on public.user_recovery_checks;
create policy "recovery owner select" on public.user_recovery_checks
  for select using (auth.uid() = user_id);

drop policy if exists "recovery owner insert" on public.user_recovery_checks;
create policy "recovery owner insert" on public.user_recovery_checks
  for insert with check (auth.uid() = user_id);

drop policy if exists "recovery owner delete" on public.user_recovery_checks;
create policy "recovery owner delete" on public.user_recovery_checks
  for delete using (auth.uid() = user_id);
