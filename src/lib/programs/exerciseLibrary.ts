// ── Exercise library ───────────────────────────────────────────────────────────
// Authored, searchable substitution pool. Same discipline as the programming:
// curated domain knowledge in config, never AI-generated at runtime.
// Used by the workout page's swap feature — substitute any prescribed movement
// with a peer from its family (or anything, if you know what you're doing).

export interface LibraryExercise {
  name: string
  cat: ExerciseCategory
  equip: Equipment[]
}

export type ExerciseCategory =
  | 'squat' | 'hinge' | 'lunge'
  | 'push_h' | 'push_v' | 'pull_h' | 'pull_v'
  | 'ham_glute' | 'core' | 'carry' | 'arms' | 'shoulders'
  | 'snatch' | 'clean_jerk' | 'oly_pull'
  | 'plyo' | 'conditioning'

export type Equipment = 'bb' | 'db' | 'kb' | 'cable' | 'machine' | 'bw' | 'trap' | 'band' | 'sled'

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge / Unilateral',
  push_h: 'Horizontal Push', push_v: 'Vertical Push',
  pull_h: 'Horizontal Pull', pull_v: 'Vertical Pull',
  ham_glute: 'Hams / Glutes', core: 'Core', carry: 'Carries',
  arms: 'Arms', shoulders: 'Shoulders',
  snatch: 'Snatch Variations', clean_jerk: 'Clean & Jerk Variations', oly_pull: 'Oly Pulls',
  plyo: 'Jumps / Plyo', conditioning: 'Conditioning',
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // ── Squat ──
  { name: 'Back Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Front Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Pause Back Squat (2s)', cat: 'squat', equip: ['bb'] },
  { name: 'Pause Front Squat (2s)', cat: 'squat', equip: ['bb'] },
  { name: 'Tempo Squat (3s down)', cat: 'squat', equip: ['bb'] },
  { name: 'Box Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Speed Box Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Safety Bar Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Goblet Squat', cat: 'squat', equip: ['db', 'kb'] },
  { name: 'Trap Bar Squat', cat: 'squat', equip: ['trap'] },
  { name: 'Leg Press', cat: 'squat', equip: ['machine'] },
  { name: 'Hack Squat', cat: 'squat', equip: ['machine'] },
  // ── Hinge ──
  { name: 'Deadlift', cat: 'hinge', equip: ['bb'] },
  { name: 'Trap Bar Deadlift', cat: 'hinge', equip: ['trap'] },
  { name: 'Romanian Deadlift', cat: 'hinge', equip: ['bb', 'db'] },
  { name: 'Deficit Deadlift (1-2")', cat: 'hinge', equip: ['bb'] },
  { name: 'Block Pull (below knee)', cat: 'hinge', equip: ['bb'] },
  { name: 'Snatch-Grip Deadlift', cat: 'hinge', equip: ['bb'] },
  { name: 'Good Morning', cat: 'hinge', equip: ['bb'] },
  { name: 'Single-Leg RDL', cat: 'hinge', equip: ['db', 'kb'] },
  { name: 'KB Swing', cat: 'hinge', equip: ['kb'] },
  { name: 'Hip Thrust', cat: 'hinge', equip: ['bb', 'machine'] },
  // ── Lunge / unilateral ──
  { name: 'Walking Lunge', cat: 'lunge', equip: ['db', 'bb', 'bw'] },
  { name: 'Bulgarian Split Squat', cat: 'lunge', equip: ['db', 'bb'] },
  { name: 'Reverse Lunge', cat: 'lunge', equip: ['db', 'bb'] },
  { name: 'Step-Up (knee-height box)', cat: 'lunge', equip: ['db', 'bb'] },
  { name: 'Front-Foot-Elevated Split Squat', cat: 'lunge', equip: ['db'] },
  { name: 'Cossack Squat', cat: 'lunge', equip: ['kb', 'bw'] },
  { name: 'Single-Leg Leg Press', cat: 'lunge', equip: ['machine'] },
  // ── Horizontal push ──
  { name: 'Bench Press', cat: 'push_h', equip: ['bb'] },
  { name: 'Close-Grip Bench Press', cat: 'push_h', equip: ['bb'] },
  { name: 'Incline Bench Press', cat: 'push_h', equip: ['bb'] },
  { name: 'DB Bench Press', cat: 'push_h', equip: ['db'] },
  { name: 'Incline DB Press', cat: 'push_h', equip: ['db'] },
  { name: 'Weighted Dip', cat: 'push_h', equip: ['bw'] },
  { name: 'Push-Up (weighted or deficit)', cat: 'push_h', equip: ['bw'] },
  { name: 'Machine Chest Press', cat: 'push_h', equip: ['machine'] },
  { name: 'Cable Fly', cat: 'push_h', equip: ['cable'] },
  // ── Vertical push ──
  { name: 'Overhead Press', cat: 'push_v', equip: ['bb'] },
  { name: 'Push Press', cat: 'push_v', equip: ['bb'] },
  { name: 'Seated DB Press', cat: 'push_v', equip: ['db'] },
  { name: 'Standing DB Press', cat: 'push_v', equip: ['db'] },
  { name: 'Z Press', cat: 'push_v', equip: ['bb', 'db'] },
  { name: 'Landmine Press', cat: 'push_v', equip: ['bb'] },
  { name: 'KB Push Press', cat: 'push_v', equip: ['kb'] },
  // ── Horizontal pull ──
  { name: 'Bent-Over Row', cat: 'pull_h', equip: ['bb'] },
  { name: 'Pendlay Row', cat: 'pull_h', equip: ['bb'] },
  { name: 'One-Arm DB Row', cat: 'pull_h', equip: ['db'] },
  { name: 'Chest-Supported Row', cat: 'pull_h', equip: ['db', 'machine'] },
  { name: 'Seal Row', cat: 'pull_h', equip: ['bb', 'db'] },
  { name: 'Cable Row', cat: 'pull_h', equip: ['cable'] },
  { name: 'TRX / Ring Row', cat: 'pull_h', equip: ['bw'] },
  { name: 'T-Bar Row', cat: 'pull_h', equip: ['machine', 'bb'] },
  // ── Vertical pull ──
  { name: 'Pull-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Weighted Pull-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Chin-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Lat Pulldown', cat: 'pull_v', equip: ['cable', 'machine'] },
  { name: 'Neutral-Grip Pulldown', cat: 'pull_v', equip: ['cable', 'machine'] },
  // ── Hams / glutes ──
  { name: 'Leg Curl', cat: 'ham_glute', equip: ['machine'] },
  { name: 'Nordic Curl (negatives OK)', cat: 'ham_glute', equip: ['bw'] },
  { name: 'Glute Ham Raise', cat: 'ham_glute', equip: ['machine', 'bw'] },
  { name: 'Back Extension', cat: 'ham_glute', equip: ['machine', 'bw'] },
  { name: 'Reverse Hyper', cat: 'ham_glute', equip: ['machine'] },
  { name: 'Slider / Ball Leg Curl', cat: 'ham_glute', equip: ['bw'] },
  // ── Core ──
  { name: 'Hanging Leg Raises', cat: 'core', equip: ['bw'] },
  { name: 'Hanging Knee Raise', cat: 'core', equip: ['bw'] },
  { name: 'Plank', cat: 'core', equip: ['bw'] },
  { name: 'Side Plank', cat: 'core', equip: ['bw'] },
  { name: 'Dead Bug', cat: 'core', equip: ['bw'] },
  { name: 'Ab Wheel Rollout', cat: 'core', equip: ['bw'] },
  { name: 'Cable Crunch', cat: 'core', equip: ['cable'] },
  { name: 'Pallof Press', cat: 'core', equip: ['cable', 'band'] },
  { name: 'Weighted Sit-Up', cat: 'core', equip: ['db'] },
  { name: 'V-Up', cat: 'core', equip: ['bw'] },
  { name: 'Russian Twist', cat: 'core', equip: ['db', 'kb'] },
  { name: 'Back-Rack Carry March', cat: 'core', equip: ['bb'] },
  // ── Carries ──
  { name: 'Farmer Carry', cat: 'carry', equip: ['db', 'trap', 'kb'] },
  { name: 'Suitcase Carry', cat: 'carry', equip: ['db', 'kb'] },
  { name: 'Front-Rack KB Carry', cat: 'carry', equip: ['kb'] },
  { name: 'Overhead Carry', cat: 'carry', equip: ['db', 'kb'] },
  { name: 'Bear-Hug Sandbag Carry', cat: 'carry', equip: ['bw'] },
  // ── Arms ──
  { name: 'Barbell Curl', cat: 'arms', equip: ['bb'] },
  { name: 'DB Curl', cat: 'arms', equip: ['db'] },
  { name: 'Hammer Curl', cat: 'arms', equip: ['db'] },
  { name: 'Cable Curl', cat: 'arms', equip: ['cable'] },
  { name: 'Triceps Pressdown', cat: 'arms', equip: ['cable'] },
  { name: 'Overhead Triceps Extension', cat: 'arms', equip: ['db', 'cable'] },
  { name: 'Skull Crusher', cat: 'arms', equip: ['bb', 'db'] },
  // ── Shoulders ──
  { name: 'Lateral Raise', cat: 'shoulders', equip: ['db', 'cable'] },
  { name: 'Rear Delt Fly', cat: 'shoulders', equip: ['db', 'cable'] },
  { name: 'Face Pull', cat: 'shoulders', equip: ['cable', 'band'] },
  { name: 'Upright Row (wide grip)', cat: 'shoulders', equip: ['bb', 'db'] },
  { name: 'DB Shoulder Press, Standing', cat: 'shoulders', equip: ['db'] },
  // ── Snatch variations ──
  { name: 'Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Power Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Hang Snatch, Above Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Hang Power Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Pause Snatch, At Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Pause Snatch, Below Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Block Snatch, Below Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Muscle Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Tall Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Snatch Balance', cat: 'snatch', equip: ['bb'] },
  { name: 'Drop Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Overhead Squat', cat: 'snatch', equip: ['bb'] },
  { name: 'Sots Press', cat: 'snatch', equip: ['bb'] },
  // ── Clean & jerk variations ──
  { name: 'Clean & Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Power Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Hang Clean, Above Knee', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Hang Power Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Pause Clean, At Knee', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Block Clean, Below Knee', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Muscle Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Tall Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk from Rack', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Push Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Split Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk Balance', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Behind-the-Neck Jerk', cat: 'clean_jerk', equip: ['bb'] },
  // ── Oly pulls ──
  { name: 'Snatch Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch High Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Pull w/ Pause Below Knee', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean High Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Pull w/ Pause Below Knee', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Deadlift', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Deadlift', cat: 'oly_pull', equip: ['bb'] },
  // ── Jumps / plyo ──
  { name: 'Box Jumps', cat: 'plyo', equip: ['bw'] },
  { name: 'Broad Jumps', cat: 'plyo', equip: ['bw'] },
  { name: 'Depth Jumps', cat: 'plyo', equip: ['bw'] },
  { name: 'Depth Drops', cat: 'plyo', equip: ['bw'] },
  { name: 'Trap Bar Jump', cat: 'plyo', equip: ['trap'] },
  { name: 'DB Jump Squat', cat: 'plyo', equip: ['db'] },
  { name: 'Hurdle Hops', cat: 'plyo', equip: ['bw'] },
  { name: 'Seated Box Jump', cat: 'plyo', equip: ['bw'] },
  { name: 'Med-Ball Rotational Throw', cat: 'plyo', equip: ['bw'] },
  { name: 'Med-Ball Slam', cat: 'plyo', equip: ['bw'] },
  { name: 'Med-Ball Chest Pass', cat: 'plyo', equip: ['bw'] },
  // ── Conditioning ──
  { name: 'Sled Push', cat: 'conditioning', equip: ['sled'] },
  { name: 'Sled Drag (backward)', cat: 'conditioning', equip: ['sled'] },
  { name: 'Rower (cal)', cat: 'conditioning', equip: ['machine'] },
  { name: 'Aerodyne / Assault Bike (cal)', cat: 'conditioning', equip: ['machine'] },
  { name: 'Ski Erg (cal)', cat: 'conditioning', equip: ['machine'] },
  { name: 'Burpee', cat: 'conditioning', equip: ['bw'] },
  { name: 'DB Thruster', cat: 'conditioning', equip: ['db'] },
  { name: 'DB Snatch', cat: 'conditioning', equip: ['db'] },
  { name: 'KB Clean & Press', cat: 'conditioning', equip: ['kb'] },
]
