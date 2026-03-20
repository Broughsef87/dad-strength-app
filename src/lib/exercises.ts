export type ExerciseEntry = { name: string; sets: number; reps: string }

export const EXERCISE_SETS: Record<string, Record<string, ExerciseEntry[]>> = {
  full: {
    iron: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6-8' },
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Dips', sets: 3, reps: '10-12' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '10-12' },
      { name: 'Push-ups', sets: 4, reps: '15-20' },
      { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
    ],
  },
  upper: {
    iron: [
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Pull-ups', sets: 4, reps: '6-8' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Face Pulls', sets: 3, reps: '15' },
    ],
    home: [
      { name: 'Push-ups', sets: 4, reps: '20' },
      { name: 'Pike Push-ups', sets: 3, reps: '12-15' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Dumbbell Curl', sets: 3, reps: '12-15' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
      { name: 'Band Pull-Apart', sets: 3, reps: '20' },
    ],
  },
  lower: {
    iron: [
      { name: 'Back Squat', sets: 4, reps: '6-8' },
      { name: 'Romanian Deadlift', sets: 4, reps: '8-10' },
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Leg Curl', sets: 3, reps: '12-15' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '15-20' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '12-15' },
      { name: 'Romanian Deadlift', sets: 4, reps: '10-12' },
      { name: 'Reverse Lunge', sets: 3, reps: '12 each' },
      { name: 'Nordic Curl', sets: 3, reps: '8-10' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '20' },
    ],
  },
  cond: {
    iron: [
      { name: 'Barbell Thruster', sets: 4, reps: '10' },
      { name: 'Kettlebell Swing', sets: 4, reps: '15' },
      { name: 'Box Jump', sets: 3, reps: '10' },
      { name: 'Farmer Carry', sets: 3, reps: '30m' },
      { name: 'Sled Push', sets: 3, reps: '20m' },
    ],
    home: [
      { name: 'Burpees', sets: 4, reps: '10' },
      { name: 'Jump Squat', sets: 4, reps: '15' },
      { name: 'Mountain Climbers', sets: 3, reps: '30s' },
      { name: 'High Knees', sets: 3, reps: '30s' },
      { name: 'Plank', sets: 3, reps: '45s' },
    ],
  },
}
