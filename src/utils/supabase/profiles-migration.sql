-- 1. Create a Profiles table for user metadata
create table if not exists user_profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  bodyweight_lbs numeric,
  streak_days int default 0,
  last_workout_date timestamptz,
  weekly_goal_sessions int default 3,
  created_at timestamptz default now()
);

-- 2. Create a Programs table to organize multiple workouts
create table if not exists programs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  is_public boolean default false,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- 3. Link Workouts to Programs
alter table workouts add column if not exists program_id uuid references programs(id);

-- 4. Sample Program Data
insert into programs (name, description) 
values ('Dad Strength Foundations', 'A 4-week strength block for building capacity.');
