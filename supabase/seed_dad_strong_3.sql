-- ============================================================
-- Dad Strength — Dad Strong 3-Day Program Seed
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Insert program template
INSERT INTO program_templates (id, name, slug, style, days_per_week, description, equipment_required)
VALUES (
  gen_random_uuid(),
  'Dad Strong 3',
  'dad-strong-3',
  'strength',
  3,
  '3-day Push/Pull/Legs strength program. Heavy compound movements, bodybuilding accessories, and GPP finishers.',
  ARRAY['barbell', 'rack', 'bench', 'cable_machine', 'dumbbells']
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert program days
WITH template AS (SELECT id FROM program_templates WHERE slug = 'dad-strong-3')
INSERT INTO program_days (id, template_id, day_number, day_name, focus)
SELECT gen_random_uuid(), template.id, d.day_number, d.day_name, d.focus
FROM template, (VALUES
  (1, 'Push', 'push'),
  (2, 'Legs', 'legs'),
  (3, 'Pull', 'pull')
) AS d(day_number, day_name, focus)
ON CONFLICT DO NOTHING;

-- 3. Insert exercises — Day 1: Push
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-3' AND pd.day_number = 1
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Bench',               'push_horizontal',   1, 4, 5,    8,    '{3,3,3,2}'::int[],   NULL,         '{"db": "DB Bench", "bw": "Weighted Push Ups"}'::jsonb),
  ('Incline DB Press',            'push_horizontal',   2, 2, 6,    10,   '{3,3}'::int[],       NULL,         '{"bw": "Decline Push Ups", "cable": "Incline Bench Cable Press"}'::jsonb),
  ('Cable Flyes',                 'push_fly',          3, 2, 6,    10,   '{4,3}'::int[],       NULL,         '{"db": "DB Flyes", "bw": "Slide/Towel Push Ups"}'::jsonb),
  ('Barbell OHP',                 'push_vertical',     4, 2, 6,    10,   '{3,3}'::int[],       NULL,         '{"db": "DB Overhead Press", "bw": "Pike Push Ups", "band": "Band Overhead Press"}'::jsonb),
  ('EZ Bar Skull Crushers',       'push_tricep',       5, 3, 6,    10,   '{3,3,3}'::int[],     NULL,         '{"db": "DB Skull Crushers", "bw": "Bodyweight Dips (off bench if no dip bar)"}'::jsonb),
  ('Cable Triceps Pushdown (Bar)','push_tricep',       6, 2, 6,    10,   '{4,4}'::int[],       NULL,         '{"db": "Single Arm DB Triceps Extension", "bw": "Bodyweight Triceps Extension"}'::jsonb),
  ('DB Lateral Raise',            'push_shoulder',     7, 3, 6,    10,   '{4,3,3}'::int[],     NULL,         '{"band": "Single Arm Lateral Band Raise"}'::jsonb),
  ('Farmer''s Carry',             'carry',             8, 3, 0, 0, '{3,3,3}'::int[],     '50 yds',     NULL),
  ('Sled Push / Prowler',         'carry',             9, 3, 0, 0, '{3,3,2}'::int[],     '30 yds',     '{"db": "DB Prowler Drag (use resistance band)", "bw": "Sprint 40 Yds"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 4. Insert exercises — Day 2: Legs
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-3' AND pd.day_number = 2
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Squat (Low or High Bar)', 'squat',              1, 4, 4,    6,    '{3,3,3,2}'::int[], NULL,               '{"db": "Suitcase Squat", "bw": "Air Squats (loaded if possible)"}'::jsonb),
  ('Leg Press',                       'squat',              2, 2, 6,    10,   '{4,4}'::int[],     NULL,               '{"db": "DB Goblet Squat", "bw": "BW Squat or Goblet Squat"}'::jsonb),
  ('Leg Extensions',                  'isolation_quad',     3, 3, 8,    12,   '{4,3,3}'::int[],   NULL,               '{"bw": "Sissy Squat or Wall Sit Hold", "band": "Banded Leg Extension"}'::jsonb),
  ('Barbell Bulgarian Split Squat',   'squat_unilateral',   4, 2, 6,    10,   '{3,3}'::int[],     NULL,               '{"db": "DB Bulgarian Split Squat", "bw": "BW Bulgarian Split Squat"}'::jsonb),
  ('Lying Leg Curls',                 'isolation_hamstring',5, 2, 6,    10,   '{3,3}'::int[],     NULL,               '{"bw": "Nordic Curl or Lying Towel Leg Curl", "band": "Banded Leg Curl"}'::jsonb),
  ('Standing Calf Raise',             'isolation_calf',     6, 3, 6,    10,   '{4,4,4}'::int[],   NULL,               '{"bw": "Single-Leg BW Calf Raise"}'::jsonb),
  ('Hip Abduction / Banded Hip Abduction', 'isolation_hip', 7, 2, 15,   20,   '{4,3}'::int[],     NULL,               '{"bw": "Lying BW Hip Abduction", "band": "Banded Hip Abduction"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 5. Insert exercises — Day 3: Pull
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-3' AND pd.day_number = 3
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Deadlift',                  'hinge',            1, 5, 5,    5,    '{4,4,3,3,3}'::int[],   NULL,               '{"db": "DB Deadlift"}'::jsonb),
  ('Barbell Good Morning',      'hinge',            2, 3, 8,    12,   '{3,3,3}'::int[],       NULL,               '{"db": "DB Good Morning", "bw": "BW Good Morning / Hip Hinge"}'::jsonb),
  ('Barbell Rows',              'pull_horizontal',  3, 3, 8,    12,   '{3,3,3}'::int[],       NULL,               '{"db": "Incline DB Rows", "band": "Banded Rows"}'::jsonb),
  ('Lat Pulldown',              'pull_vertical',    4, 2, 12,   15,   '{4,3}'::int[],         NULL,               '{"bw": "Pull Up", "band": "Band Assisted Pull Up"}'::jsonb),
  ('Seated Cable Rows',         'pull_horizontal',  5, 2, 15,   20,   '{4,3}'::int[],         NULL,               '{"db": "Single Arm DB Rows", "bw": "Inverted BW Rows"}'::jsonb),
  ('EZ Bar Curls',              'isolation_bicep',  6, 3, 8,    12,   '{4,4,3}'::int[],       NULL,               '{"bw": "DB Curls"}'::jsonb),
  ('Alternating DB Curls',      'isolation_bicep',  7, 2, 12,   15,   '{4,3}'::int[],         NULL,               '{"band": "Band Curls"}'::jsonb),
  ('Face Pulls',                'pull_rear_delt',   8, 3, 15,   20,   '{4,4,3}'::int[],       NULL,               '{"db": "DB Rear Delt Fly", "band": "Band Face Pull", "cable": "Cable Face Pull"}'::jsonb),
  ('Battle Ropes',              'carry',            9, 3, 0, 0, '{4,4,3}'::int[],       '45 seconds',       NULL)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify: should return 3 days + 25 total exercises
-- ============================================================
-- SELECT pd.day_name, count(pe.id) as exercise_count
-- FROM program_days pd
-- LEFT JOIN program_exercises pe ON pe.day_id = pd.id
-- JOIN program_templates pt ON pd.template_id = pt.id
-- WHERE pt.slug = 'dad-strong-3'
-- GROUP BY pd.day_number, pd.day_name
-- ORDER BY pd.day_number;
