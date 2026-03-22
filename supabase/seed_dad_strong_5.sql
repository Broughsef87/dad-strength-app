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
  (3, 'Arms',                   'arms'),
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
  ('Barbell Bench Press',        'push_horizontal', 1, 3, 5,  8,  '{3,3,2}'::int[],   NULL,                              NULL),
  ('Incline DB Press',           'push_horizontal', 2, 3, 8,  12, '{3,3,3}'::int[],   NULL,                              '{"no_incline_bench": "Flat DB Press"}'::jsonb),
  ('Cable Flyes',                'push_fly',        3, 2, 12, 15, '{2,1}'::int[],     NULL,                              '{"no_cable": "DB Flyes"}'::jsonb),
  ('JM Press',                   'push_tricep',     4, 2, 6,  10, '{4,4}'::int[],     NULL,                              '{"no_barbell": "Close Grip DB Press"}'::jsonb),
  ('Skull Crushers',             'push_tricep',     5, 3, 8,  12, '{3,3,3}'::int[],   NULL,                              '{"no_ez_bar": "DB Skull Crushers"}'::jsonb),
  ('Cable Triceps Pushdown (Bar)','push_tricep',    6, 3, 6,  10, '{4,4,4}'::int[],   NULL,                              '{"no_cable": "DB Tricep Kickback"}'::jsonb)
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
  ('Barbell Back Squat (High Bar)', 'squat',             1, 3, 5,  5,  '{3,3,3}'::int[],   NULL,                              '{"no_barbell": "Goblet Squat"}'::jsonb),
  ('Bulgarian Split Squat',         'squat_unilateral',  2, 2, 8,  12, '{2,2}'::int[],     NULL,                              NULL),
  ('Leg Press',                     'squat',             3, 2, 5,  8,  '{4,4}'::int[],     NULL,                              '{"no_leg_press": "DB Goblet Squat"}'::jsonb),
  ('Leg Extension',                 'isolation_quad',    4, 3, 8,  12, '{4,3,2}'::int[],   NULL,                              '{"no_machine": "Wall Sit"}'::jsonb),
  ('Hamstring Curl',                'isolation_hamstring',5, 2, 6, 10, '{3,3}'::int[],     NULL,                              '{"no_machine": "Nordic Curl"}'::jsonb),
  ('Standing Calf Raise',           'isolation_calf',    6, 3, 6,  10, '{4,4,4}'::int[],   NULL,                              NULL)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 5. Insert exercises — Day 3: Arms
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 3
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Chin Ups',                         'pull_vertical',  1, 3, 5,  10, '{3,3,2}'::int[],   'Use assistance if needed', '{"no_pullup_bar": "Cable Pulldown"}'::jsonb),
  ('Alternating DB Curl',              'isolation_bicep',2, 3, 12, 15, '{4,4,4}'::int[],   NULL,                       NULL),
  ('Hammer Curl',                      'isolation_bicep',3, 3, 8,  12, '{3,3,3}'::int[],   NULL,                       NULL),
  ('Dips (Triceps Focused)',           'push_tricep',    4, 2, 5,  10, '{2,2}'::int[],     NULL,                       '{"no_dip_bar": "Close Grip Pushup"}'::jsonb),
  ('Behind Head Triceps Extension',    'push_tricep',    5, 2, 15, 20, '{3,2}'::int[],     NULL,                       '{"no_cable": "DB Overhead Extension"}'::jsonb),
  ('Cable Triceps Pushdown (Rope)',    'push_tricep',    6, 3, 8,  12, '{4,4,4}'::int[],   NULL,                       '{"no_cable": "DB Kickback"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- 6. Insert exercises — Day 4: Posterior Chain
WITH day AS (
  SELECT pd.id FROM program_days pd
  JOIN program_templates pt ON pd.template_id = pt.id
  WHERE pt.slug = 'dad-strong-5' AND pd.day_number = 4
)
INSERT INTO program_exercises (id, day_id, exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
SELECT gen_random_uuid(), day.id, e.exercise_name, e.movement_pattern, e.set_order, e.sets, e.rep_min, e.rep_max, e.per_set_rir, e.notes, e.substitutions
FROM day, (VALUES
  ('Deadlift',                  'hinge',            1, 6, 3,  3,  '{4,4,4,3,3,3}'::int[],  NULL,                              '{"no_barbell": "DB Romanian Deadlift"}'::jsonb),
  ('Barbell Good Morning',      'hinge',            2, 3, 6,  8,  '{3,3,3}'::int[],         NULL,                              '{"no_barbell": "DB Romanian Deadlift"}'::jsonb),
  ('DB Stiff Legged Deadlift',  'hinge',            3, 2, 12, 15, '{2,4}'::int[],            NULL,                              NULL),
  ('Hip Abduction Machine',     'isolation_hip',    4, 3, 15, 20, '{4,4,4}'::int[],          NULL,                              '{"no_machine": "Banded Clamshell"}'::jsonb),
  ('Walking Lunges',            'squat_unilateral', 5, 3, 8,  12, '{3,3,2}'::int[],          NULL,                              NULL),
  ('Back Extension',            'hinge_extension',  6, 4, 12, 15, '{4,4,4,4}'::int[],        NULL,                              '{"no_machine": "Superman Hold"}'::jsonb)
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
  ('Barbell Rows',               'pull_horizontal', 1, 3, 5,  5,  '{2,2,3}'::int[],   NULL,                              '{"no_barbell": "DB Bent Over Row"}'::jsonb),
  ('Wide Grip Lat Pulldown',     'pull_vertical',   2, 3, 8,  12, '{4,3,3}'::int[],   NULL,                              '{"no_cable": "Resistance Band Pulldown"}'::jsonb),
  ('Seated Cable Row',           'pull_horizontal', 3, 3, 12, 15, '{3,3,3}'::int[],   NULL,                              '{"no_cable": "DB Row"}'::jsonb),
  ('Straight Arm Lat Pulldown',  'pull_vertical',   4, 2, 15, 20, '{4,2}'::int[],     NULL,                              '{"no_cable": "DB Pullover"}'::jsonb),
  ('EZ Bar Curls',               'isolation_bicep', 5, 3, 8,  12, '{4,4,4}'::int[],   NULL,                              '{"no_ez_bar": "DB Curl"}'::jsonb),
  ('Cable Curls',                'isolation_bicep', 6, 2, 12, 15, '{3,3}'::int[],     NULL,                              '{"no_cable": "DB Curl"}'::jsonb)
) AS e(exercise_name, movement_pattern, set_order, sets, rep_min, rep_max, per_set_rir, notes, substitutions)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Verify: should return 5 days + 31 total exercises
-- ============================================================
-- SELECT pd.day_name, count(pe.id) as exercise_count
-- FROM program_days pd
-- LEFT JOIN program_exercises pe ON pe.day_id = pd.id
-- JOIN program_templates pt ON pd.template_id = pt.id
-- WHERE pt.slug = 'dad-strong-5'
-- GROUP BY pd.day_number, pd.day_name
-- ORDER BY pd.day_number;
