-- Exercise substitutions: user swaps a prescribed movement for a peer from the
-- exercise library (or a custom name). Keyed to (program, slot, original name)
-- so a swap persists across weeks — "always give me X instead of Y here" —
-- and reverting is just deleting the row.

create table if not exists public.user_exercise_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_slug text not null,
  slot text not null,
  original_name text not null,
  sub_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_exercise_subs_unique
  on public.user_exercise_subs (user_id, program_slug, slot, original_name);

alter table public.user_exercise_subs enable row level security;

drop policy if exists "subs owner select" on public.user_exercise_subs;
create policy "subs owner select" on public.user_exercise_subs
  for select using (auth.uid() = user_id);

drop policy if exists "subs owner insert" on public.user_exercise_subs;
create policy "subs owner insert" on public.user_exercise_subs
  for insert with check (auth.uid() = user_id);

drop policy if exists "subs owner update" on public.user_exercise_subs;
create policy "subs owner update" on public.user_exercise_subs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subs owner delete" on public.user_exercise_subs;
create policy "subs owner delete" on public.user_exercise_subs
  for delete using (auth.uid() = user_id);
