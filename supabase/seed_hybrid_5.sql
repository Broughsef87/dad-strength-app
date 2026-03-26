-- ============================================================
-- Dad Strength — Hybrid Athlete 5-Day Program Seed
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Insert program template
INSERT INTO program_templates (id, name, slug, style, days_per_week, description, equipment_required)
VALUES (
  gen_random_uuid(),
  'Hybrid Athlete 5',
  'hybrid-5',
  'hybrid',
  5,
  '5-day hybrid program: bodybuilding push/pull, metabolic conditioning, functional legs, and GPP/strongman days. The full hybrid experience.',
  ARRAY['barbell', 'rack', 'bench', 'cable_machine', 'dumbbells', 'kettlebell']
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert program days
WITH template AS (SELECT id FROM program_templates WHERE slug = 'hybrid-5')
INSERT INTO program_days (id, template_id, day_number, day_name, focus)
SELECT gen_random_uuid(), template.id, d.day_number, d.day_name, d.focus
FROM template, (VALUES
  (1, 'Bodybuilding Push',                 'push'),
  (2, 'Metabolic Conditioning',            'conditioning'),
  (3, 'Functional Legs + Conditioning',    'legs'),
  (4, 'GPP / Strongman',                   'gpp'),
  (5, 'Bodybuilding Pull',                 'pull')
) AS d(day_number, day_name, focus)
ON CONFLICT DO NOTHING;

-- 3. Insert exercises — Day 1: Bodybuilding Push
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-5' AND pd.day_number = 1
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Bench Press',          'push_horizontal', 1, 3, 5,  8,  '{3,3,2}'::int[],  NULL, '{"db": "DB Bench", "bw": "Weighted Push Ups", "cable": "Cable Press"}'::jsonb),
  ('Incline DB Press',             'push_horizontal', 2, 3, 8,  12, '{3,3,3}'::int[],  NULL, '{"bw": "Decline Push Ups", "cable": "Incline Cable Press"}'::jsonb),
  ('Cable Flyes',                  'push_fly',        3, 3, 12, 15, '{4,3,3}'::int[],  NULL, '{"db": "DB Flyes", "bw": "Slide/Towel Push Ups"}'::jsonb),
  ('Barbell OHP',                  'push_vertical',   4, 3, 8,  12, '{3,3,3}'::int[],  NULL, '{"db": "DB Overhead Press", "bw": "Pike Push Ups", "band": "Band Overhead Press"}'::jsonb),
  ('DB Lateral Raise',             'push_shoulder',   5, 3, 12, 15, '{4,3,3}'::int[],  NULL, '{"band": "Single-Arm Lateral Band Raise", "cable": "Cable Lateral Raise"}'::jsonb),
  ('Dips (Triceps Focused)',       'push_tricep',     6, 3, 8,  12, '{3,3,2}'::int[],  NULL, '{"bw": "Bench Dips", "band": "Band-Assisted Dips"}'::jsonb),
  ('KB/DB Push Press (explosive)', 'push_vertical',   7, 3, 5,  8,  '{3,3,3}'::int[],  NULL, '{"bw": "Explosive Pike Push Ups", "band": "Band Push Press"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 4. Insert exercises — Day 2: Metabolic Conditioning
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-5' AND pd.day_number = 2
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('DB/KB Hang Power Clean (strength primer)', 'hinge',   1, 4, 5,    5,    '{3,3,3,3}'::int[],  NULL,                     '{"db": "DB Power Clean", "bw": "Jump Squat"}'::jsonb),
  ('Row 500m / Bike 1km / Run 400m',          'cardio',  2, 4, 0, 0, '{2,2,2,2}'::int[],  '4 rounds (60s rest)',     '{"bw": "Run 400m"}'::jsonb),
  ('KB Swings',                               'hinge',   3, 4, 15,   15,   '{2,2,2,2}'::int[],  '4 rounds',               '{"db": "DB Swings", "bw": "Banded Hip Hinge", "band": "Banded Swings"}'::jsonb),
  ('Goblet Squat',                            'squat',   4, 4, 12,   12,   '{3,3,3,3}'::int[],  '4 rounds',               '{"bw": "BW Squat / Jump Squat"}'::jsonb),
  ('DB Push Press',                           'push_vertical', 5, 4, 10, 10, '{3,3,3,3}'::int[], '4 rounds',               '{"bw": "Explosive Push Ups", "band": "Band Push Press"}'::jsonb),
  ('Box Jumps',                               'plyometric',   6, 3, 8,  8,  '{2,2,2}'::int[],   NULL,                     '{"bw": "Jump Squats"}'::jsonb),
  ('Burpees',                                 'plyometric',   7, 3, 10, 10, '{2,2,2}'::int[],   NULL,                     '{"bw": "BW Burpees"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 5. Insert exercises — Day 3: Functional Legs + Conditioning
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-5' AND pd.day_number = 3
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Back Squat',             'squat',              1, 4, 4,  6,  '{3,3,3,2}'::int[],  NULL,               '{"db": "DB/KB Suitcase Squat", "bw": "Air Squat"}'::jsonb),
  ('Romanian Deadlift',              'hinge',              2, 3, 8,  10, '{3,3,3}'::int[],    NULL,               '{"db": "DB RDL", "bw": "Single-Leg BW RDL", "band": "Banded RDL"}'::jsonb),
  ('KB Front Rack Lunge',            'squat_unilateral',   3, 3, 8,  8,  '{3,3,3}'::int[],    'each leg',         '{"db": "DB Front Rack Lunge", "bw": "BW Lunge", "band": "Banded Lunge"}'::jsonb),
  ('Weighted Box Step-Up',           'squat_unilateral',   4, 3, 10, 10, '{3,3,3}'::int[],    'each leg',         '{"db": "DB Step-Up", "bw": "BW Step-Up"}'::jsonb),
  ('Nordic Curl / GHR',              'isolation_hamstring',5, 3, 5,  8,  '{3,3,3}'::int[],    NULL,               '{"bw": "BW Nordic Curl (assisted ok)"}'::jsonb),
  ('KB Swing (finisher)',            'hinge',              6, 3, 20, 20, '{2,2,2}'::int[],    NULL,               '{"db": "DB Swing", "bw": "Banded Hip Hinge", "band": "Banded Swing"}'::jsonb),
  ('Row 250m / Bike 500m / Run 200m','cardio',             7, 3, 0, 0, '{2,2,2}'::int[],  '3 intervals — paired with KB sets', '{"bw": "Run 200m or 30 Jumping Jacks"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 6. Insert exercises — Day 4: GPP / Strongman
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-5' AND pd.day_number = 4
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Deadlift (heavy)',                  'hinge',         1, 5, 3,    5,    '{3,3,3,2,2}'::int[],  NULL,               '{"db": "DB Deadlift", "bw": "BW Romanian Hinge"}'::jsonb),
  ('Farmer''s Carry',                   'carry',         2, 4, 0, 0, '{3,3,2,2}'::int[],    '50 yds',           '{"db": "DB Farmer Carry", "bw": "Heavy Backpack Carry"}'::jsonb),
  ('Trap Bar Carry',                    'carry',         3, 3, 0, 0, '{3,3,3}'::int[],      '40 yds',           '{"db": "DB Farmer Carry", "bw": "Sandbag Carry"}'::jsonb),
  ('Sled Push / Prowler',               'carry',         4, 4, 0, 0, '{2,2,2,2}'::int[],    '20 yds',           '{"bw": "Sprint Intervals 40 Yds"}'::jsonb),
  ('Sandbag Clean / KB Clean',          'hinge',         5, 4, 5,    5,    '{3,3,3,3}'::int[],    NULL,               '{"db": "DB Clean", "bw": "Med Ball Slam"}'::jsonb),
  ('Axle Bar / Log Press',              'push_vertical', 6, 3, 5,    8,    '{3,3,2}'::int[],      NULL,               '{"db": "DB OHP (heavy)", "bw": "Pike Push Ups", "band": "Band Overhead Press"}'::jsonb),
  ('Atlas Stone / Sandbag Loads',       'carry',         7, 3, 0, 0, '{2,2,2}'::int[],      '3 loads or 30 yds carry', '{"bw": "Bear Hug Carry or Heavy Sandbag"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 7. Insert exercises — Day 5: Bodybuilding Pull
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-5' AND pd.day_number = 5
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Rows',             'pull_horizontal', 1, 3, 5,  8,  '{3,3,2}'::int[],  NULL, '{"db": "DB Rows", "bw": "Inverted BW Rows", "band": "Band Rows"}'::jsonb),
  ('Weighted Pull-Ups',        'pull_vertical',   2, 3, 5,  8,  '{3,3,2}'::int[],  NULL, '{"db": "DB Pullover", "bw": "Pull Ups (BW)", "band": "Band-Assisted Pull Ups"}'::jsonb),
  ('Wide Grip Lat Pulldown',   'pull_vertical',   3, 3, 8,  12, '{4,3,3}'::int[],  NULL, '{"db": "DB Pullover", "bw": "Wide-Grip Pull Ups", "band": "Band Lat Pulldown"}'::jsonb),
  ('Seated Cable Rows',        'pull_horizontal', 4, 3, 10, 12, '{3,3,3}'::int[],  NULL, '{"db": "DB Rows (Single Arm)", "bw": "Inverted BW Rows", "band": "Band Rows"}'::jsonb),
  ('Face Pulls',               'pull_rear_delt',  5, 3, 15, 20, '{4,4,3}'::int[],  NULL, '{"db": "DB Rear Delt Fly", "band": "Band Face Pull", "cable": "Cable Face Pull"}'::jsonb),
  ('EZ Bar Curls',             'isolation_bicep', 6, 3, 8,  12, '{4,3,3}'::int[],  NULL, '{"db": "DB Curls", "bw": "Chin Ups", "band": "Band Curls"}'::jsonb),
  ('Hammer Curls',             'isolation_bicep', 7, 3, 10, 12, '{4,3,3}'::int[],  NULL, '{"band": "Band Hammer Curls", "cable": "Cable Hammer Curls"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify: should return 5 days + 35 total exercises
-- ============================================================
-- SELECT pd.day_name, count(pe.id) as exercise_count
-- FROM program_days pd
-- LEFT JOIN program_exercises pe ON pe.day_id = pd.id
-- JOIN program_templates pt ON pd.template_id = pt.id
-- WHERE pt.slug = 'hybrid-5'
-- GROUP BY pd.day_number, pd.day_name
-- ORDER BY pd.day_number;
