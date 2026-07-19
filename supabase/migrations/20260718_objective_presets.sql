-- ============================================================
-- Objective library — tap-first daily objectives
--
-- Daily objectives become a chip picker instead of free text. Custom
-- objectives a user writes once are saved here as reusable chips;
-- use_count floats the most-used to the front. Seeded presets live in
-- app code (static), so this table holds only the user's own.
-- ============================================================

create table if not exists public.user_objective_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists user_objective_presets_unique
  on public.user_objective_presets (user_id, label);

alter table public.user_objective_presets enable row level security;

drop policy if exists "objpresets owner select" on public.user_objective_presets;
create policy "objpresets owner select" on public.user_objective_presets
  for select using (auth.uid() = user_id);

drop policy if exists "objpresets owner insert" on public.user_objective_presets;
create policy "objpresets owner insert" on public.user_objective_presets
  for insert with check (auth.uid() = user_id);

drop policy if exists "objpresets owner update" on public.user_objective_presets;
create policy "objpresets owner update" on public.user_objective_presets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "objpresets owner delete" on public.user_objective_presets;
create policy "objpresets owner delete" on public.user_objective_presets
  for delete using (auth.uid() = user_id);
