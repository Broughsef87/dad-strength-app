-- Family Pulse: weekly relationship health check-in
-- Migration: 20260312_family_pulse

create table if not exists family_pulse (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  marriage_vibe int check (marriage_vibe between 1 and 5),
  kid_score int check (kid_score between 1 and 5),
  moments text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table family_pulse enable row level security;

create policy "Users can manage their own pulse"
  on family_pulse
  for all
  using (auth.uid() = user_id);
