// ── Exercise library ───────────────────────────────────────────────────────────
// Authored, searchable substitution pool. Same discipline as the programming:
// curated domain knowledge in config, never AI-generated at runtime.
// Used by the workout page's swap feature — substitute any prescribed movement
// with a peer from its family (or anything, if you know what you're doing).

import { OLY_IMPORTS } from './exerciseImports/oly'
import { EXRX_IMPORTS, EXRX_AKAS } from './exerciseImports/exrx'

export interface LibraryExercise {
  name: string
  cat: ExerciseCategory
  equip: Equipment[]
  /** Other names a source uses for this same movement. Search matches them too. */
  aka?: string[]
  /** Lands or jumps (jump to split, rebound jerk, jumping pulls). */
  impact?: true
  /** Single-leg knee-dominant work: lunges, split squats, step-ups, pistols. */
  kneeLoad?: true
  /** The target muscles a source files it under (ExRx). */
  muscles?: string[]
}

export type ExerciseCategory =
  | 'squat' | 'hinge' | 'lunge'
  | 'push_h' | 'push_v' | 'pull_h' | 'pull_v'
  | 'ham_glute' | 'core' | 'carry' | 'arms' | 'shoulders'
  | 'snatch' | 'clean_jerk' | 'oly_pull'
  | 'calves' | 'neck'
  | 'plyo' | 'conditioning'

export type Equipment = 'bb' | 'db' | 'kb' | 'cable' | 'machine' | 'bw' | 'trap' | 'band' | 'sled'

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge / Unilateral',
  push_h: 'Horizontal Push', push_v: 'Vertical Push',
  pull_h: 'Horizontal Pull', pull_v: 'Vertical Pull',
  ham_glute: 'Hams / Glutes', core: 'Core', carry: 'Carries',
  arms: 'Arms', shoulders: 'Shoulders',
  snatch: 'Snatch Variations', clean_jerk: 'Clean & Jerk Variations', oly_pull: 'Oly Pulls',
  calves: 'Calves', neck: 'Neck',
  plyo: 'Jumps / Plyo', conditioning: 'Conditioning',
}

const CORE_LIBRARY: LibraryExercise[] = [
  // ── Squat ──
  { name: 'Back Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Front Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Pause Back Squat (2s)', cat: 'squat', equip: ['bb'], aka: ['Pause Back Squat'] },
  { name: 'Pause Front Squat (2s)', cat: 'squat', equip: ['bb'], aka: ['Pause Front Squat', 'Front Squat with Pause'] },
  { name: 'Tempo Squat (3s down)', cat: 'squat', equip: ['bb'], aka: ['Back Squat with Slow Descent'] },
  { name: 'Box Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Speed Box Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Safety Bar Squat', cat: 'squat', equip: ['bb'] },
  { name: 'Goblet Squat', cat: 'squat', equip: ['db', 'kb'] },
  { name: 'Trap Bar Squat', cat: 'squat', equip: ['trap'] },
  { name: 'Leg Press', cat: 'squat', equip: ['machine'] },
  { name: 'Hack Squat', cat: 'squat', equip: ['machine'] },
  { name: 'Belt Squat', cat: 'squat', equip: ['machine'] },
  { name: 'Leg Extension', cat: 'squat', equip: ['machine'] },
  // ── Hinge ──
  { name: 'Deadlift', cat: 'hinge', equip: ['bb'] },
  { name: 'Trap Bar Deadlift', cat: 'hinge', equip: ['trap'] },
  { name: 'Romanian Deadlift', cat: 'hinge', equip: ['bb', 'db'], aka: ['RDL', 'Romanian Deadlift (RDL)'] },
  { name: 'Deficit Deadlift (1-2")', cat: 'hinge', equip: ['bb'] },
  { name: 'Block Pull (below knee)', cat: 'hinge', equip: ['bb'] },
  { name: 'Snatch-Grip Deadlift', cat: 'hinge', equip: ['bb'] },
  { name: 'Good Morning', cat: 'hinge', equip: ['bb'], aka: ['Good Morning Exercise'] },
  { name: 'Single-Leg RDL', cat: 'hinge', equip: ['db', 'kb'], aka: ['One-Legged Deadlift'] },
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
  { name: 'Overhead Press', cat: 'push_v', equip: ['bb'], aka: ['Press', 'Strict Press', 'Shoulder Press or Strict Press'] },
  { name: 'Push Press', cat: 'push_v', equip: ['bb'] },
  { name: 'Seated DB Press', cat: 'push_v', equip: ['db'], aka: ['Seated Dumbbell Press'] },
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
  { name: 'Seated Cable Row', cat: 'pull_h', equip: ['cable'] },
  { name: 'TRX / Ring Row', cat: 'pull_h', equip: ['bw'] },
  { name: 'T-Bar Row', cat: 'pull_h', equip: ['machine', 'bb'] },
  // ── Vertical pull ──
  { name: 'Pull-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Weighted Pull-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Chin-Up', cat: 'pull_v', equip: ['bw'] },
  { name: 'Lat Pulldown', cat: 'pull_v', equip: ['cable', 'machine'] },
  { name: 'Neutral-Grip Pulldown', cat: 'pull_v', equip: ['cable', 'machine'] },
  { name: 'Straight-Arm Lat Pulldown', cat: 'pull_v', equip: ['cable'] },
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
  { name: 'Hang Snatch, Above Knee', cat: 'snatch', equip: ['bb'], aka: ['Hang Snatch'] },
  { name: 'Hang Power Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Pause Snatch, At Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Pause Snatch, Below Knee', cat: 'snatch', equip: ['bb'] },
  { name: 'Block Snatch, Below Knee', cat: 'snatch', equip: ['bb'], aka: ['Block Snatch', 'Snatch from Blocks'] },
  { name: 'Muscle Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Tall Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Snatch Balance', cat: 'snatch', equip: ['bb'] },
  { name: 'Drop Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Overhead Squat', cat: 'snatch', equip: ['bb'] },
  { name: 'Sots Press', cat: 'snatch', equip: ['bb'], aka: ['Press In Snatch (Sots Press)', 'Press In Snatch Sots Press'] },
  // FOR-349: positions and no-jump work for Platform Dad (named as Catalyst
  // Athletics and Training Weightlifting name them; no jumping or impact drills).
  { name: 'Snatch With No Jump', cat: 'snatch', equip: ['bb'] },
  { name: 'Snatch With No Pull', cat: 'snatch', equip: ['bb'] },
  { name: '2-Position Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Floating Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Segment Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Hip Snatch', cat: 'snatch', equip: ['bb'] },
  { name: 'Pressing Snatch Balance', cat: 'snatch', equip: ['bb'] },
  { name: 'Snatch Balance, No Dip', cat: 'snatch', equip: ['bb'] },
  { name: 'Snatch Push Press', cat: 'snatch', equip: ['bb'] },
  // ── Clean & jerk variations ──
  { name: 'Clean & Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Power Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Hang Clean, Above Knee', cat: 'clean_jerk', equip: ['bb'], aka: ['Hang Clean'] },
  { name: 'Hang Power Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Pause Clean, At Knee', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Block Clean, Below Knee', cat: 'clean_jerk', equip: ['bb'], aka: ['Block Clean', 'Clean from Blocks'] },
  { name: 'Muscle Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Tall Clean', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk from Rack', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Push Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Split Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk Balance', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Behind-the-Neck Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean With No Jump + 2 Jerks', cat: 'clean_jerk', equip: ['bb'] },
  { name: '3-Position Clean + Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean With No Jump', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean With No Pull', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Clean Rack Delivery', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Power Clean + Front Squat', cat: 'clean_jerk', equip: ['bb'], aka: ['Power Clean Into Front Squat'] },
  { name: 'Pause Split Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Split Jerk Behind the Neck', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk with Paused Dip', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk with Long Hold', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Power Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Tall Split Jerk', cat: 'clean_jerk', equip: ['bb'] },
  { name: 'Jerk Dip Squat', cat: 'clean_jerk', equip: ['bb'] },
  // ── Oly pulls ──
  { name: 'Snatch Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch High Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Pull w/ Pause Below Knee', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean High Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Pull w/ Pause Below Knee', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Deadlift', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Deadlift', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Halting Snatch Deadlift + Snatch Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Halting Snatch Deadlift', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Segment Pull', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Snatch Pull, Slowly Lowered', cat: 'oly_pull', equip: ['bb'] },
  { name: 'Clean Pull, Triple Pause', cat: 'oly_pull', equip: ['bb'] },
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

/** Every exercise the swap and add sheets offer: the core, then the imports. */
export const EXERCISE_LIBRARY: LibraryExercise[] = [
  ...CORE_LIBRARY.map((e) => (EXRX_AKAS[e.name] ? { ...e, aka: [...(e.aka ?? []), ...EXRX_AKAS[e.name]] } : e)),
  ...OLY_IMPORTS,
  ...EXRX_IMPORTS,
]

/** Lowercase words with punctuation, joiners and plural pulls/racks folded, so
 *  "Snatch Pulls, from the Knee" and "Snatch Pull from Knee" read the same. */
export function normalizeExerciseName(name: string): string {
  return name.toLowerCase()
    .replace(/[&+]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'and' && w !== 'with' && w !== 'the')
    .map((w) => (w === 'pulls' ? 'pull' : w === 'racks' ? 'rack' : w))
    .join(' ')
}

/** Search the library: every word typed must appear in the name or an aka. */
export function searchLibrary(
  query: string,
  cat: ExerciseCategory | null,
  limit = 40,
  library: LibraryExercise[] = EXERCISE_LIBRARY,
): { items: LibraryExercise[]; total: number } {
  const words = normalizeExerciseName(query).split(' ').filter(Boolean)
  const hit = (e: LibraryExercise) => {
    if (cat != null && e.cat !== cat) return false
    if (words.length === 0) return true
    const hay = [e.name, ...(e.aka ?? [])].map(normalizeExerciseName).join(' | ').split(/\s+/)
    return words.every((w) => hay.some((h) => h.startsWith(w)))
  }
  const all = library.filter(hit)
  return { items: all.slice(0, limit), total: all.length }
}
