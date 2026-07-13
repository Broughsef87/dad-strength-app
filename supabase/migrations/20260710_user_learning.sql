-- ============================================================
-- Currently Learning — growth-mindset skill tracker (Neural tab)
--
-- Personal growth is core to the ethos: track the skills you're actively
-- developing (hobby or professional), the milestone you're working toward,
-- and log practice sessions. Deliberately lightweight — a couple words and
-- a tap, not a journal.
-- ============================================================

create table if not exists public.user_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  category text not null default 'hobby',        -- 'hobby' | 'professional'
  milestone text,                                -- current target, a couple words
  sessions int not null default 0,               -- practice sessions logged
  milestones_hit int not null default 0,         -- growth loop: targets reached
  last_practiced date,
  active boolean not null default true,          -- false = archived / mastered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_learning_user_active_idx
  on public.user_learning (user_id) where active;

alter table public.user_learning enable row level security;

drop policy if exists "learning owner select" on public.user_learning;
create policy "learning owner select" on public.user_learning
  for select using (auth.uid() = user_id);

drop policy if exists "learning owner insert" on public.user_learning;
create policy "learning owner insert" on public.user_learning
  for insert with check (auth.uid() = user_id);

drop policy if exists "learning owner update" on public.user_learning;
create policy "learning owner update" on public.user_learning
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "learning owner delete" on public.user_learning;
create policy "learning owner delete" on public.user_learning
  for delete using (auth.uid() = user_id);
