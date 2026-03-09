-- 1. Create a table for Workouts (The Templates)
create table workouts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  exercises jsonb not null, -- Stores the list of exercises (e.g. [{"name": "Squat", "sets": 3}])
  created_at timestamptz default now()
);

-- 2. Create a table for Logs (The History)
create table workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  workout_id uuid references workouts(id),
  exercise_name text not null,
  set_number int not null,
  weight_lbs numeric,
  reps int,
  completed boolean default false,
  created_at timestamptz default now()
);

-- 3. Insert a Sample Workout (Lower Body Hypertrophy)
insert into workouts (name, description, exercises)
values (
  'Lower Body Hypertrophy',
  'Focus on quads and hamstrings. Controlled tempo.',
  '[
    {"name": "Back Squat", "sets": 3, "reps": "6-8"},
    {"name": "RDL", "sets": 3, "reps": "8-10"},
    {"name": "Leg Extension", "sets": 3, "reps": "12-15"},
    {"name": "Leg Curl", "sets": 3, "reps": "12-15"},
    {"name": "Calf Raise", "sets": 4, "reps": "15-20"}
  ]'
);
