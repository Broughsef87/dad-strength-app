-- ============================================================
-- Dad Strength — Hybrid Athlete 3-Day Program Seed
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Insert program template
INSERT INTO program_templates (id, name, slug, style, days_per_week, description, equipment_required)
VALUES (
  gen_random_uuid(),
  'Hybrid Athlete 3',
  'hybrid-3',
  'hybrid',
  3,
  '3-day hybrid program combining strength, bodybuilding, and GPP/strongman conditioning. Built for dads who want to be strong and capable.',
  ARRAY['barbell', 'rack', 'bench', 'cable_machine', 'dumbbells', 'kettlebell']
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert program days
WITH template AS (SELECT id FROM program_templates WHERE slug = 'hybrid-3')
INSERT INTO program_days (id, template_id, day_number, day_name, focus)
SELECT gen_random_uuid(), template.id, d.day_number, d.day_name, d.focus
FROM template, (VALUES
  (1, 'Upper Body Strength (Push + Pull)', 'upper'),
  (2, 'Legs + Metabolic Conditioning',     'legs'),
  (3, 'GPP / Strongman + Full Body Conditioning', 'gpp')
) AS d(day_number, day_name, focus)
ON CONFLICT DO NOTHING;

-- 3. Insert exercises — Day 1: Upper Body Strength (Push + Pull)
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-3' AND pd.day_number = 1
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Bench Press',      'push_horizontal',  1,  4, 4,  6,  '{3,3,3,2}'::int[],  NULL, '{"db": "DB Bench", "bw": "Weighted Push Ups", "cable": "Cable Press"}'::jsonb),
  ('Barbell Rows',             'pull_horizontal',  2,  4, 4,  6,  '{3,3,3,2}'::int[],  NULL, '{"db": "DB Rows", "bw": "Inverted BW Rows", "band": "Band Rows"}'::jsonb),
  ('Barbell OHP',              'push_vertical',    3,  3, 6,  10, '{3,3,3}'::int[],    NULL, '{"db": "DB Overhead Press", "bw": "Pike Push Ups", "band": "Band Overhead Press"}'::jsonb),
  ('Weighted Pull-Ups',        'pull_vertical',    4,  3, 6,  8,  '{3,3,2}'::int[],    NULL, '{"db": "DB Pullover", "bw": "Pull Ups (BW)", "band": "Band-Assisted Pull Ups"}'::jsonb),
  ('Incline DB Press',         'push_horizontal',  5,  2, 8,  12, '{3,3}'::int[],      NULL, '{"bw": "Decline Push Ups", "cable": "Incline Cable Press"}'::jsonb),
  ('Seated Cable Rows',        'pull_horizontal',  6,  2, 10, 12, '{3,3}'::int[],      NULL, '{"db": "DB Rows (Single Arm)", "bw": "Inverted BW Rows", "band": "Band Rows"}'::jsonb),
  ('Face Pulls',               'pull_rear_delt',   7,  3, 15, 20, '{4,4,3}'::int[],    NULL, '{"db": "DB Rear Delt Fly", "band": "Band Face Pull", "cable": "Cable Face Pull"}'::jsonb),
  ('DB Lateral Raise',         'push_shoulder',    8,  3, 12, 15, '{4,3,3}'::int[],    NULL, '{"band": "Single-Arm Lateral Band Raise", "cable": "Cable Lateral Raise"}'::jsonb),
  ('EZ Bar Curls',             'isolation_bicep',  9,  3, 8,  12, '{4,3,3}'::int[],    NULL, '{"db": "DB Curls", "bw": "Chin Ups", "band": "Band Curls"}'::jsonb),
  ('Cable Triceps Pushdown',   'push_tricep',      10, 2, 10, 12, '{4,3}'::int[],      NULL, NULL)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 4. Insert exercises — Day 2: Legs + Metabolic Conditioning
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-3' AND pd.day_number = 2
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Back Squat',            'squat',              1, 4, 4,    6,    '{3,3,3,2}'::int[],  NULL,               '{"db": "DB/KB Suitcase Squat", "bw": "Air Squat"}'::jsonb),
  ('Romanian Deadlift',             'hinge',              2, 3, 8,    10,   '{3,3,3}'::int[],    NULL,               '{"db": "DB RDL", "bw": "Single-Leg BW RDL", "band": "Banded RDL"}'::jsonb),
  ('KB Front Rack Lunge',           'squat_unilateral',   3, 3, 8,    8,    '{3,3,3}'::int[],    'each leg',         '{"db": "DB Front Rack Lunge", "bw": "BW Lunge", "band": "Banded Lunge"}'::jsonb),
  ('Nordic Curl / GHR',             'isolation_hamstring',4, 2, 5,    8,    '{3,3}'::int[],      NULL,               '{"bw": "BW Nordic Curl (assisted ok)"}'::jsonb),
  ('Standing Calf Raise',           'isolation_calf',     5, 3, 10,   15,   '{4,4,4}'::int[],    NULL,               '{"bw": "Single-Leg BW Calf Raise"}'::jsonb),
  ('KB Swings — Metcon Finisher',   'hinge',              6, 3, 15,   15,   '{2,2,2}'::int[],    '3 rounds',         '{"db": "DB Swings", "bw": "Banded Hip Hinge", "band": "Banded Swings"}'::jsonb),
  ('Row 400m / Bike 800m / Run 400m','cardio',            7, 3, NULL, NULL, '{2,2,2}'::int[],    '3 rounds — paired with KB rounds', '{"bw": "Run 400m or 40 Jumping Jacks"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 5. Insert exercises — Day 3: GPP / Strongman + Full Body Conditioning
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'hybrid-3' AND pd.day_number = 3
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Deadlift (heavy)',                    'hinge',          1, 5, 3,    5,    '{3,3,3,2,2}'::int[],  NULL,               '{"db": "DB Deadlift", "bw": "BW Romanian Hinge"}'::jsonb),
  ('Farmer''s Carry',                     'carry',          2, 4, NULL, NULL, '{3,3,2,2}'::int[],    '50 yds',           '{"db": "DB Farmer Carry", "bw": "Heavy Backpack Carry"}'::jsonb),
  ('Sled Push / Prowler',                 'carry',          3, 4, NULL, NULL, '{2,2,2,2}'::int[],    '20 yds',           '{"bw": "Sprint Intervals 40 Yds"}'::jsonb),
  ('Axle Bar / Log Press',                'push_vertical',  4, 3, 5,    8,    '{3,3,2}'::int[],      NULL,               '{"db": "DB OHP (heavy)", "bw": "Pike Push Ups", "band": "Band Overhead Press"}'::jsonb),
  ('Sandbag Clean / KB Clean',            'hinge',          5, 4, 5,    5,    '{3,3,3,3}'::int[],    NULL,               '{"db": "DB Clean", "bw": "Med Ball Slam"}'::jsonb),
  ('Atlas Stone / Sandbag Loads',         'carry',          6, 3, NULL, NULL, '{2,2,2}'::int[],      '3 loads or 30 yds carry', '{"bw": "Bear Hug Carry or Heavy Sandbag"}'::jsonb),
  ('DB/KB Hang Power Clean (finisher)',   'hinge',          7, 3, 8,    8,    '{2,2,2}'::int[],      '3 rounds',         '{"db": "DB Power Clean", "bw": "Jump Squat"}'::jsonb),
  ('Row 250m / Bike 500m / Run 200m',    'cardio',         8, 3, NULL, NULL, '{2,2,2}'::int[],      '3 rounds — paired with cleans', '{"bw": "Run 200m or 25 Jumping Jacks"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify: should return 3 days + 25 total exercises
-- ============================================================
-- SELECT pd.day_name, count(pe.id) as exercise_count
-- FROM program_days pd
-- LEFT JOIN program_exercises pe ON pe.day_id = pd.id
-- JOIN program_templates pt ON pd.template_id = pt.id
-- WHERE pt.slug = 'hybrid-3'
-- GROUP BY pd.day_number, pd.day_name
-- ORDER BY pd.day_number;
