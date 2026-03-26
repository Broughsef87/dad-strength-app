-- ============================================================
-- Dad Strength — Dad Strong 5-Day Program Seed
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Insert program template
INSERT INTO program_templates (id, name, slug, style, days_per_week, description, equipment_required)
VALUES (
  gen_random_uuid(),
  'Dad Strong',
  'dad-strong-5',
  'strength',
  5,
  'Old man strength meets functional power. Carry the groceries. Move the couch. Outlift guys half your age.',
  ARRAY['barbell', 'rack', 'bench', 'cable_machine', 'dumbbells']
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert program days
WITH template AS (SELECT id FROM program_templates WHERE slug = 'dad-strong-5')
INSERT INTO program_days (id, template_id, day_number, day_name, focus)
SELECT gen_random_uuid(), template.id, d.day_number, d.day_name, d.focus
FROM template, (VALUES
  (1, 'Pressing',               'push'),
  (2, 'Legs - Quad Focused',    'legs'),
  (3, 'Shoulders and Arms',     'arms'),
  (4, 'Legs - Posterior Chain', 'legs'),
  (5, 'Pulling',                'pull')
) AS d(day_number, day_name, focus)
ON CONFLICT DO NOTHING;

-- 3. Insert exercises — Day 1: Pressing
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 1
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Bench Press',         'push_horizontal', 1, 3, 5,  8,  '{3,3,2}'::int[],   NULL, '{"db": "db bench", "bw": "weighted push ups", "cable": "cable press"}'::jsonb),
  ('Incline DB Press',            'push_horizontal', 2, 3, 8,  12, '{3,3,3}'::int[],   NULL, '{"bw": "decline push ups", "cable": "incline bench cable press"}'::jsonb),
  ('Cable Flyes',                 'push_fly',        3, 2, 12, 15, '{4,3}'::int[],     NULL, '{"db": "db flyes", "bw": "slide/towel push ups"}'::jsonb),
  ('Close-Grip Bench Press',      'push_tricep',     4, 2, 6,  10, '{4,4}'::int[],     NULL, '{"db": "close grip DB press", "bw": "diamond push ups"}'::jsonb),
  ('EZ Bar Skull Crushers',       'push_tricep',     5, 3, 8,  12, '{3,3,3}'::int[],   NULL, '{"db": "DB skull crushers", "bw": "bodyweight dips (off bench if no dip bar)"}'::jsonb),
  ('Cable Triceps Pushdown (Bar)','push_tricep',     6, 3, 6,  10, '{4,4,4}'::int[],   NULL, '{"db": "single arm db triceps extension", "bw": "bodyweight triceps extension"}'::jsonb),
  ('Farmer''s Carry',             'gpp',             7, 3, NULL, NULL, '{3,3,3}'::int[], '3 sets 50 yds', NULL)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 4. Insert exercises — Day 2: Legs (Quad Focused)
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 2
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Back Squat (High Bar)', 'squat',              1, 4, 5,  5,  '{3,3,3,2}'::int[],  NULL, '{"db": "db/kb suitcase squats", "bw": "air squats"}'::jsonb),
  ('Bulgarian Split Squat',         'squat_unilateral',   2, 2, 8,  12, '{2,2}'::int[],      NULL, '{"db": "db bulgarian split squats", "bw": "bw bulgarian split squats"}'::jsonb),
  ('Leg Press',                     'squat',              3, 2, 5,  8,  '{4,4}'::int[],      NULL, '{"db": "db lunges", "bw": "lunges"}'::jsonb),
  ('Leg Extension',                 'isolation_quad',     4, 3, 8,  12, '{4,3,2}'::int[],    NULL, '{"bw": "sissy squat or wall sit hold", "band": "banded leg extension"}'::jsonb),
  ('Hamstring Curl',                'isolation_hamstring',5, 2, 6,  10, '{3,3}'::int[],      NULL, '{"bw": "Nordic curl or lying towel leg curl", "band": "banded leg curl"}'::jsonb),
  ('Standing Calf Raise',           'isolation_calf',     6, 3, 6,  10, '{4,4,4}'::int[],    NULL, '{"bw": "single-leg BW calf raise"}'::jsonb),
  ('Sled Push / Prowler',           'gpp',                7, 3, NULL, NULL, '{3,3,2}'::int[], '3 sets of 30 yds', '{"db": "DB prowler drag (use resistance band)", "bw": "sprint 40 yds"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 5. Insert exercises — Day 3: Shoulders and Arms
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 3
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Overhead Press',          'push_vertical',      1, 3, 5,  10, '{3,3,2}'::int[],   NULL, '{"db": "DB Overhead Press", "bw": "pike push ups"}'::jsonb),
  ('DB Lateral Raise',                'isolation_shoulder', 2, 3, 12, 15, '{3,3,3}'::int[],   NULL, '{"band": "single-arm lateral band raise"}'::jsonb),
  ('Alternating DB Curls',            'isolation_bicep',    3, 3, 8,  12, '{3,3,2}'::int[],   NULL, NULL),
  ('Hammer Curl',                     'isolation_bicep',    4, 2, 5,  10, '{4,3}'::int[],     NULL, NULL),
  ('Dips (Triceps Focused)',          'push_tricep',        5, 2, 5,  15, '{3,2}'::int[],     NULL, '{"bw": "bench dips", "band": "band dips (assisted)"}'::jsonb),
  ('Cable Triceps Pushdown (Rope)',   'push_tricep',        6, 3, 8,  12, '{3,3,3}'::int[],   NULL, '{"db": "DB overhead tricep extension", "bw": "close-grip push ups", "band": "band tricep pushdown"}'::jsonb),
  ('Waiter''s Walk (overhead carry)', 'gpp',                7, 3, NULL, NULL, '{3,3,3}'::int[], '3 sets of 40 yds', '{"db": "single DB overhead carry", "bw": "BW overhead walk (light book/plate)"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 6. Insert exercises — Day 4: Legs (Posterior Chain)
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 4
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Deadlift',                  'hinge',            1, 6, 3,  3,  '{4,4,4,3,3,3}'::int[],  NULL,              '{"db": "DB Deadlift", "bw": "BW Romanian hinge"}'::jsonb),
  ('Barbell Good Morning',      'hinge',            2, 3, 6,  8,  '{3,3,3}'::int[],         NULL,              '{"db": "DB Good Morning", "bw": "BW good morning / hip hinge"}'::jsonb),
  ('DB Stiff Legged Deadlift',  'hinge',            3, 2, 12, 15, '{4,3}'::int[],           NULL,              '{"band": "banded Romanian deadlift"}'::jsonb),
  ('Hip Abduction Machine',     'isolation_hip',    4, 3, 15, 20, '{4,4,4}'::int[],         NULL,              '{"bw": "lying BW hip abduction", "band": "banded hip abduction"}'::jsonb),
  ('Walking Lunges',            'gpp',              5, 3, 8,  12, '{3,3,2}'::int[],         NULL,              '{"db": "DB walking lunges"}'::jsonb),
  ('Back Extension Machine',    'hinge_extension',  6, 4, 12, 15, '{4,4,4,4}'::int[],       NULL,              '{"bw": "superman hold or GHR"}'::jsonb),
  ('Trap Bar Carry',            'gpp',              7, 3, NULL, NULL, '{3,3,3}'::int[],     '3 sets 50 yds',   '{"db": "DB farmer carry", "bw": "BW walking carry (heavy backpack)"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 7. Insert exercises — Day 5: Pulling
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 5
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Barbell Rows',                 'pull_horizontal', 1, 3, 5,  5,  '{3,3,2}'::int[],   NULL, '{"db": "DB Rows", "bw": "inverted rows", "band": "band rows"}'::jsonb),
  ('Wide Grip Lat Pulldown',       'pull_vertical',   2, 3, 8,  12, '{4,3,3}'::int[],   NULL, '{"db": "DB pullover", "bw": "wide-grip pull ups", "band": "band lat pulldown"}'::jsonb),
  ('Kroc Rows (use straps if possible)', 'pull_horizontal', 3, 3, 12, 15, '{3,3,3}'::int[], NULL, '{"bw": "inverted rows", "band": "band rows"}'::jsonb),
  ('Straight Arm Lat Pulldown',    'pull_vertical',   4, 2, 15, 20, '{4,3}'::int[],     NULL, '{"db": "DB straight arm pullover", "band": "band straight arm pulldown"}'::jsonb),
  ('EZ Bar Curls',                 'isolation_bicep', 5, 3, 8,  12, '{4,4,4}'::int[],   NULL, '{"db": "DB curls", "bw": "chin ups", "band": "band curls"}'::jsonb),
  ('Cable Curls',                  'isolation_bicep', 6, 2, 12, 15, '{3,3}'::int[],     NULL, '{"db": "DB curls", "band": "band curls"}'::jsonb),
  ('Battle Ropes',                 'gpp',             7, 3, NULL, NULL, '{2,2,2}'::int[], '3 sets of 30 seconds', '{"band": "resistance band slams", "bw": "BW jump rope or box jumps"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify: should return 5 days + 35 total exercises
-- ============================================================
-- SELECT pd.day_name, count(pe.id) as exercise_count
-- FROM program_days pd
-- LEFT JOIN program_exercises pe ON pe.day_id = pd.id
-- JOIN program_templates pt ON pd.template_id = pt.id
-- WHERE pt.slug = 'dad-strong-5'
-- GROUP BY pd.day_number, pd.day_name
-- ORDER BY pd.day_number;
