'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Check, X, AlertTriangle } from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOVEMENT_TO_MUSCLE: Record<string, string | null> = {
  push_horizontal: 'chest',
  push_fly: 'chest',
  push_vertical: 'shoulders',
  isolation_shoulder: 'shoulders',
  push_tricep: 'triceps',
  push_power: 'shoulders',
  pull_horizontal: 'back',
  pull_vertical: 'back',
  pull_rear_delt: 'back',
  isolation_bicep: 'biceps',
  squat: 'quads',
  squat_unilateral: 'quads',
  isolation_quad: 'quads',
  hinge: 'hamstrings',
  hinge_extension: 'hamstrings',
  isolation_hamstring: 'hamstrings',
  isolation_calf: 'calves',
  isolation_hip: 'glutes',
  gpp_hip: 'glutes',
  gpp: null,
  gpp_carry: null,
  gpp_push: null,
  gpp_conditioning: null,
  gpp_cardio: null,
  gpp_power: null,
  gpp_strongman: null,
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  glutes: 'Glutes',
}

const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
  'Barbell Bench Press': ['DB Bench Press', 'Machine Chest Press', 'Push-Up Variations'],
  'Incline DB Press': ['Incline Machine Press', 'Low-to-High Cable Fly', 'Incline Push-Ups'],
  'Cable Flyes': ['DB Chest Fly', 'Pec Deck Machine', 'Push-Up Plus'],
  'Barbell OHP': ['DB Shoulder Press', 'Machine Shoulder Press', 'Arnold Press'],
  'EZ Bar Skull Crushers': ['Cable Overhead Extension', 'DB Overhead Extension', 'Dip Machine'],
  'Cable Triceps Pushdown': ['Overhead DB Extension', 'Tricep Dip Machine', 'Band Pushdowns'],
  'Cable Triceps Pushdown (Bar)': ['Overhead DB Extension', 'Tricep Dip Machine', 'Band Pushdowns'],
  'Close-Grip Bench Press': ['Dip Machine', 'DB Close-Grip Press', 'Cable Pushdown'],
  'DB Lateral Raise': ['Cable Lateral Raise', 'Machine Lateral Raise', 'Face Pull'],
  'Barbell Back Squat': ['Leg Press', 'Goblet Squat', 'Hack Squat Machine'],
  'Leg Press': ['Hack Squat Machine', 'Goblet Squat', 'Smith Machine Squat'],
  'Leg Extension': ['Sissy Squat', 'Cyclist Squat', 'Terminal Knee Extension'],
  'Barbell Bulgarian Split Squat': ['Walking Lunge', 'Step-Up', 'Single-Leg Press'],
  'Lying Leg Curls': ['Seated Leg Curl', 'Nordic Curl', 'Romanian Deadlift (light)'],
  'Standing Calf Raise': ['Seated Calf Raise', 'Single-Leg Calf Raise', 'Calf Press on Leg Press'],
  'Deadlift': ['Trap Bar Deadlift', 'Romanian Deadlift', 'Cable Pull-Through'],
  'Barbell Good Morning': ['Back Extension', 'Romanian Deadlift', 'Cable Pull-Through'],
  'Barbell Rows': ['Cable Rows', 'DB Bent-Over Rows', 'Chest-Supported Row'],
  'Lat Pulldown': ['Assisted Pull-Ups', 'Straight-Arm Pulldown', 'Machine Pulldown'],
  'Wide Grip Lat Pulldown': ['Assisted Pull-Ups', 'Cable Pulldown', 'Machine Pulldown'],
  'Seated Cable Rows': ['DB Row', 'Machine Row', 'Chest-Supported Row'],
  'EZ Bar Curls': ['DB Curls', 'Machine Curls', 'Cable Curls'],
  'Alternating DB Curls': ['Hammer Curls', 'Preacher Curls', 'Cable Curls'],
  'Hammer Curls': ['DB Curls', 'Cable Curls', 'Preacher Curls'],
  'Face Pulls': ['Band Pull-Apart', 'Rear Delt Fly', 'Reverse Pec Deck'],
  'Weighted Pull-Ups': ['Assisted Pull-Ups', 'Lat Pulldown', 'Cable Straight-Arm Pulldown'],
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SetStatus = 'idle' | 'logging' | 'done'
type FeedbackStep = 'volume' | 'pump' | 'pain'

type SetLog = {
  setNumber: number
  recommendedWeight: number
  targetReps: number
  targetRir: number
  actualWeight: number
  actualReps: number
  actualRir: number | null
  status: SetStatus
}

type ExerciseLog = {
  name: string
  movementPattern: string
  sets: SetLog[]
  progressionNote?: string
  hasPainFlag?: boolean
}

type ActiveProgram = {
  slug: string
  name: string
  currentWeek: number
  daysCount: number
  equipment: Record<string, boolean>
  trainingAge?: string
  primaryGoal?: string
}

type GeneratedSet = {
  setNumber: number
  targetWeight?: number       // old schema (backward-compat)
  recommendedWeight?: number  // new schema
  targetReps: number
  targetRir: number
  notes?: string
}

type GeneratedExercise = {
  name: string
  movementPattern?: string
  sets: GeneratedSet[]
  progressionNote?: string
}

type GeneratedDay = {
  dayNumber: number
  dayName: string
  exercises: GeneratedExercise[]
}

type MuscleGroupFeedbackRow = {
  week_number: number
  day_number: number
  muscle_group: string
  volume_rating: string
  pump_rating: string
  pain_rating: string
}

type PendingFeedback = {
  muscle: string
  exIndex: number
  step: FeedbackStep
  volume?: string
  pump?: string
}

type SwapModal = {
  exIndex: number
  exerciseName: string
  alternatives: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function initExerciseLogs(exercises: GeneratedExercise[], painMuscles: Set<string>): ExerciseLog[] {
  return exercises.map((ex) => {
    const muscle = MOVEMENT_TO_MUSCLE[ex.movementPattern ?? ''] ?? null
    return {
      name: ex.name,
      movementPattern: ex.movementPattern ?? '',
      progressionNote: ex.progressionNote,
      hasPainFlag: muscle !== null && painMuscles.has(muscle),
      sets: ex.sets.map((s) => {
        const rec = s.recommendedWeight ?? s.targetWeight ?? 0
        return {
          setNumber: s.setNumber,
          recommendedWeight: rec,
          targetReps: s.targetReps,
          targetRir: s.targetRir,
          actualWeight: rec,
          actualReps: s.targetReps,
          actualRir: null,
          status: 'idle' as SetStatus,
        }
      }),
    }
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center brand-pulse">
          <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-brand" />
          </div>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-base font-black uppercase tracking-widest text-foreground">
          Building Your Session
        </p>
        <p className="text-sm text-muted-foreground">
          Analyzing your history and calculating optimal weights
        </p>
      </div>
    </div>
  )
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="space-y-2">
        <p className="text-base font-black uppercase tracking-tight text-foreground">
          Generation Failed
        </p>
        <p className="text-sm text-muted-foreground">
          Could not reach the AI coach. Check your connection and try again.
        </p>
      </div>
      <button
        onClick={onBack}
        className="px-6 py-3 rounded-xl bg-brand text-white font-black text-sm uppercase tracking-widest active:scale-95"
      >
        Go Back
      </button>
    </div>
  )
}

function SetRow({
  setLog,
  onWeightChange,
  onRepsChange,
  onLog,
  onRirSelect,
  onSkip,
}: {
  setLog: SetLog
  onWeightChange: (val: number) => void
  onRepsChange: (val: number) => void
  onLog: () => void
  onRirSelect: (rir: number) => void
  onSkip: () => void
}) {
  const isDone = setLog.status === 'done'
  const isLogging = setLog.status === 'logging'
  const showRec = setLog.recommendedWeight > 0

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isDone
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : isLogging
          ? 'bg-brand/5 border-brand/30'
          : 'bg-surface-3/50 border-border/50'
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Set pill */}
        <span className="text-xs font-black text-muted-foreground w-8 shrink-0 uppercase tracking-widest">
          S{setLog.setNumber}
        </span>

        {/* Weight input */}
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={setLog.actualWeight === 0 ? '' : setLog.actualWeight}
              onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
              disabled={isDone}
              placeholder={showRec ? String(setLog.recommendedWeight) : '0'}
              className="stat-num w-16 bg-transparent text-sm font-bold text-foreground text-center outline-none border-b border-border/60 focus:border-brand py-0.5 disabled:opacity-60"
            />
            <span className="text-xs text-muted-foreground shrink-0">lbs</span>
          </div>
          {showRec && (
            <p className="text-[10px] text-muted-foreground/50 leading-none mt-0.5 ml-1">
              rec {setLog.recommendedWeight}
            </p>
          )}
        </div>

        {/* Reps input */}
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            value={setLog.actualReps}
            onChange={(e) => onRepsChange(parseInt(e.target.value) || 0)}
            disabled={isDone}
            className="stat-num w-10 bg-transparent text-sm font-bold text-foreground text-center outline-none border-b border-border/60 focus:border-brand py-0.5 disabled:opacity-60"
          />
          <span className="text-xs text-muted-foreground shrink-0">reps</span>
        </div>

        {/* Target RIR badge */}
        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-brand/10 text-brand shrink-0">
          RIR {setLog.targetRir}
        </span>

        {/* Action button / done check */}
        {isDone ? (
          <div className="w-14 flex justify-center">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check size={14} className="text-emerald-500" />
            </div>
          </div>
        ) : (
          <button
            onClick={onLog}
            className="w-14 text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-brand text-white active:scale-95 shrink-0"
          >
            LOG
          </button>
        )}
      </div>

      {/* RIR expander */}
      {isLogging && (
        <div className="px-3 pb-3 pt-1 border-t border-brand/20 space-y-2 animate-float-up">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
            How many reps left in the tank?
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((rir) => (
              <button
                key={rir}
                onClick={() => onRirSelect(rir)}
                className="py-3 rounded-xl text-sm font-black border border-border/60 bg-surface-2 hover:border-brand hover:bg-brand/10 hover:text-brand active:scale-95 transition-all"
              >
                {rir === 3 ? '3+' : rir}
              </button>
            ))}
          </div>
          <button
            onClick={onSkip}
            className="w-full text-center text-xs text-muted-foreground/60 py-1 hover:text-muted-foreground transition-colors"
          >
            Skip this set
          </button>
        </div>
      )}
    </div>
  )
}

function MuscleGroupFeedbackCard({
  feedback,
  onSelect,
}: {
  feedback: PendingFeedback
  onSelect: (val: string) => void
}) {
  const label = MUSCLE_LABELS[feedback.muscle] ?? feedback.muscle

  const configs: Record<FeedbackStep, {
    stepLabel: string
    question: string
    options: { value: string; label: string; emoji: string }[]
  }> = {
    volume: {
      stepLabel: '1 of 3 · Volume',
      question: `Was the volume right for ${label}?`,
      options: [
        { value: 'not_enough', label: 'Not Enough', emoji: '😐' },
        { value: 'about_right', label: 'About Right', emoji: '✅' },
        { value: 'bit_much', label: 'A Bit Much', emoji: '😅' },
        { value: 'too_much', label: 'Too Much', emoji: '🥵' },
      ],
    },
    pump: {
      stepLabel: '2 of 3 · Pump',
      question: 'How was the pump?',
      options: [
        { value: 'barely', label: 'Barely Any', emoji: '😑' },
        { value: 'mild', label: 'Mild', emoji: '💪' },
        { value: 'good', label: 'Good Pump', emoji: '🔥' },
        { value: 'skin_splitting', label: 'Skin Splitting', emoji: '💥' },
      ],
    },
    pain: {
      stepLabel: '3 of 3 · Pain',
      question: 'Any joint pain or discomfort?',
      options: [
        { value: 'none', label: 'None', emoji: '✅' },
        { value: 'mild', label: 'Mild', emoji: '⚠️' },
        { value: 'moderate', label: 'Moderate', emoji: '🚨' },
        { value: 'had_to_stop', label: 'Had to Stop', emoji: '🛑' },
      ],
    },
  }

  const config = configs[feedback.step]

  return (
    <div className="animate-float-up">
      <div className="rounded-2xl border border-brand/40 bg-brand/5 p-4 space-y-3">
        <div>
          <span className="text-[10px] font-black text-brand uppercase tracking-[0.15em]">
            {config.stepLabel}
          </span>
          <p className="text-sm font-bold text-foreground mt-0.5">{config.question}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {config.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className="flex items-center gap-2 p-3 rounded-xl border border-border/60 bg-background hover:border-brand hover:bg-brand/10 active:scale-95 transition-all text-left"
            >
              <span className="text-base leading-none">{opt.emoji}</span>
              <span className="text-xs font-bold text-foreground leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExerciseSwapModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: SwapModal
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-background rounded-t-3xl p-6 pb-10 space-y-4 animate-float-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.15em] mb-0.5">
              Exercise Swap
            </p>
            <p className="text-base font-black text-foreground">{modal.exerciseName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pain flagged 2+ weeks — choose an alternative:
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {modal.alternatives.map((alt) => (
            <button
              key={alt}
              onClick={() => onConfirm(alt)}
              className="w-full py-4 px-4 rounded-xl border border-border/60 bg-surface-2 hover:border-brand hover:bg-brand/10 active:scale-95 transition-all text-left"
            >
              <span className="text-sm font-bold text-foreground">{alt}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl border border-border/60 text-muted-foreground text-sm font-bold active:scale-95 transition-all"
        >
          Keep Current Exercise
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProgramWorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()

  const dayNumber = parseInt((params?.day as string) ?? '1', 10)

  // Loading / error state
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [usedFallback, setUsedFallback] = useState(false)

  // Program meta
  const [program, setProgram] = useState<ActiveProgram | null>(null)
  const [dayName, setDayName] = useState('')
  const [coachNote, setCoachNote] = useState('')
  const [weekTheme, setWeekTheme] = useState('')

  // The saved workout row id (for FK on logs)
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null)

  // Exercise logs (the live state of the session)
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])

  // Session timer
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Completion
  const [sessionComplete, setSessionComplete] = useState(false)

  // Calibration week
  const [isCalibrationWeek, setIsCalibrationWeek] = useState(false)

  // Muscle group feedback state
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null)
  const feedbackDoneRef = useRef<Set<string>>(new Set())

  // Exercise swap modal
  const [swapModal, setSwapModal] = useState<SwapModal | null>(null)

  // Finish session confirmation
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)

  // Prevent re-initialization when auth re-emits
  const hasInitializedRef = useRef(false)

  // ── Timer ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Screen sleep / visibility protection ─────────────────────────────────────
  // Refresh auth session when user returns to the app (screen wake / tab switch)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [supabase])

  // ── Persist in-progress workout to localStorage ───────────────────────────────
  useEffect(() => {
    if (exerciseLogs.length === 0 || !program) return
    const key = `dad-strength-wip-day${dayNumber}-week${program.currentWeek}-${program.slug}`
    localStorage.setItem(key, JSON.stringify({
      exerciseLogs,
      dayName,
      coachNote,
      weekTheme,
      savedWorkoutId,
      isCalibrationWeek,
      ts: Date.now(),
    }))
  }, [exerciseLogs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetch / AI generation ────────────────────────────────────────────────

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      // Don't redirect mid-workout — session may be briefly null on screen wake
      if (!hasInitializedRef.current) {
        router.push('/login')
      }
      return
    }

    // Prevent re-initialization when Supabase re-emits auth (the #1 cause of data loss)
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const run = async () => {
      try {
        // 1. Read active program from localStorage
        const raw = localStorage.getItem('dad-strength-active-program')
        if (!raw) {
          window.location.assign('/body')
          return
        }
        const prog: ActiveProgram = JSON.parse(raw)
        setProgram(prog)

        // 2. Restore in-progress workout if it exists (survives screen sleep / back navigation)
        const wipKey = `dad-strength-wip-day${dayNumber}-week${prog.currentWeek}-${prog.slug}`
        const wipRaw = localStorage.getItem(wipKey)
        if (wipRaw) {
          try {
            const wip = JSON.parse(wipRaw)
            const ageHours = (Date.now() - (wip.ts ?? 0)) / 3600000
            if (ageHours < 6 && Array.isArray(wip.exerciseLogs) && wip.exerciseLogs.length > 0) {
              setDayName(wip.dayName ?? '')
              setCoachNote(wip.coachNote ?? '')
              setWeekTheme(wip.weekTheme ?? '')
              setSavedWorkoutId(wip.savedWorkoutId ?? null)
              setIsCalibrationWeek(wip.isCalibrationWeek ?? false)
              setExerciseLogs(wip.exerciseLogs)
              setPageState('ready')
              return
            }
          } catch { /* ignore corrupt data */ }
        }

        // 4. Read 1RMs from localStorage (support both key names)
        const rmsRaw =
          localStorage.getItem('dad-strength-one-rep-maxes') ||
          localStorage.getItem('dad-strength-calibration-weights')
        const oneRepMaxes: Record<string, number> = rmsRaw ? JSON.parse(rmsRaw) : {}

        // 3. Fetch muscle group feedback history for this program
        const { data: feedbackData } = await supabase
          .from('muscle_group_feedback')
          .select('week_number, day_number, muscle_group, volume_rating, pump_rating, pain_rating')
          .eq('user_id', user.id)
          .eq('program_slug', prog.slug)
          .order('week_number', { ascending: true })

        const muscleGroupFeedback: MuscleGroupFeedbackRow[] = feedbackData ?? []

        // Compute muscles with 2+ weeks of pain (for swap flag)
        const painByMuscle: Record<string, number> = {}
        for (const fb of muscleGroupFeedback) {
          if (fb.pain_rating !== 'none') {
            painByMuscle[fb.muscle_group] = (painByMuscle[fb.muscle_group] || 0) + 1
          }
        }
        const painMuscles = new Set(
          Object.entries(painByMuscle)
            .filter(([, count]) => count >= 2)
            .map(([muscle]) => muscle)
        )

        // 4. Check for existing generated workout (cached)
        const { data: existing } = await supabase
          .from('generated_workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('week_number', prog.currentWeek)
          .eq('day_number', dayNumber)
          .maybeSingle()

        if (existing) {
          const exercises: GeneratedExercise[] = existing.exercises
          setDayName(existing.day_name ?? `Day ${dayNumber}`)
          setCoachNote(existing.ai_reasoning ?? '')
          setWeekTheme(existing.week_theme ?? '')
          setSavedWorkoutId(existing.id)
          setIsCalibrationWeek(existing.week_number === 1)
          setExerciseLogs(initExerciseLogs(exercises, painMuscles))
          setPageState('ready')
          return
        }

        // 5. Fetch recent logs for AI context
        const { data: recentLogs } = await supabase
          .from('workout_logs')
          .select('exercise_name, weight, reps, rir_actual, completed, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        // 6. Call AI generation API
        const res = await fetch('/api/ai/program-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            weekNumber: prog.currentWeek,
            programSlug: prog.slug,
            userProfile: {
              trainingAge: prog.trainingAge ?? 'intermediate',
              primaryGoal: prog.primaryGoal ?? 'strength',
              equipment: prog.equipment ?? {},
            },
            recentLogs: recentLogs ?? [],
            oneRepMaxes,
            muscleGroupFeedback,
          }),
        })

        if (!res.ok) {
          throw new Error(`AI API returned ${res.status}`)
        }

        const { program: generated } = await res.json()
        const generatedDay: GeneratedDay = generated.days[dayNumber - 1]

        // 7. Save to generated_workouts cache
        const { data: saved } = await supabase
          .from('generated_workouts')
          .insert({
            user_id: user.id,
            week_number: prog.currentWeek,
            day_number: dayNumber,
            day_name: generatedDay.dayName,
            week_theme: generated.weekTheme,
            exercises: generatedDay.exercises,
            ai_reasoning: generated.coachNote,
            generated_at: new Date().toISOString(),
          })
          .select()
          .single()

        setSavedWorkoutId(saved?.id ?? null)
        setDayName(generatedDay.dayName)
        setCoachNote(generated.coachNote)
        setWeekTheme(generated.weekTheme)
        setIsCalibrationWeek(generated.isCalibrationWeek ?? prog.currentWeek === 1)
        setExerciseLogs(initExerciseLogs(generatedDay.exercises, painMuscles))
        setPageState('ready')
      } catch (err) {
        console.error('Program workout generation error:', err)

        try {
          const raw = localStorage.getItem('dad-strength-active-program')
          if (raw) {
            const prog: ActiveProgram = JSON.parse(raw)
            setProgram(prog)
            setDayName(`Day ${dayNumber}`)
            setUsedFallback(true)
            setExerciseLogs([])
          }
        } catch {
          // ignore
        }

        setPageState('error')
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading, dayNumber])

  // ── Watch exerciseLogs for completion / muscle feedback triggers ───────────────

  useEffect(() => {
    if (exerciseLogs.length === 0) return

    // Session complete?
    const allDone = exerciseLogs.every((ex) => ex.sets.every((s) => s.status === 'done'))
    if (allDone) {
      setSessionComplete(true)
      setPendingFeedback(null)
      if (timerRef.current) clearInterval(timerRef.current)
      // Clear in-progress state — session is done
      if (program) {
        const wipKey = `dad-strength-wip-day${dayNumber}-week${program.currentWeek}-${program.slug}`
        localStorage.removeItem(wipKey)
      }
      return
    }

    // Check for muscle group feedback triggers
    setPendingFeedback((prev) => {
      if (prev !== null) return prev // already showing feedback

      // Find the last exercise index for each muscle group
      const lastIdxByMuscle: Record<string, number> = {}
      exerciseLogs.forEach((ex, i) => {
        const muscle = MOVEMENT_TO_MUSCLE[ex.movementPattern]
        if (muscle) lastIdxByMuscle[muscle] = i
      })

      for (const [muscle, i] of Object.entries(lastIdxByMuscle)) {
        const ex = exerciseLogs[i]
        if (!ex) continue
        const allSetsDone = ex.sets.every((s) => s.status === 'done')
        if (allSetsDone && !feedbackDoneRef.current.has(muscle)) {
          return { muscle, exIndex: i, step: 'volume' }
        }
      }
      return null
    })
  }, [exerciseLogs])

  // ── Set interactions ───────────────────────────────────────────────────────────

  const handleWeightChange = useCallback((exIndex: number, setIndex: number, val: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, ei) =>
        ei !== exIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIndex ? { ...s, actualWeight: val } : s
              ),
            }
      )
    )
  }, [])

  const handleRepsChange = useCallback((exIndex: number, setIndex: number, val: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, ei) =>
        ei !== exIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIndex ? { ...s, actualReps: val } : s
              ),
            }
      )
    )
  }, [])

  const handleLog = useCallback((exIndex: number, setIndex: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, ei) =>
        ei !== exIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIndex ? { ...s, status: 'logging' as SetStatus } : s
              ),
            }
      )
    )
  }, [])

  const handleSkip = useCallback((exIndex: number, setIndex: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, ei) => {
        if (ei !== exIndex) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIndex ? { ...s, actualRir: null, status: 'done' as SetStatus } : s
          ),
        }
      })
    )
  }, [])

  const handleRirSelect = useCallback(
    async (exIndex: number, setIndex: number, rir: number) => {
      if (!user) return

      let updatedSet: SetLog | null = null

      // Capture current weight/reps BEFORE state update for auto-fill
      const loggedWeight = exerciseLogs[exIndex]?.sets[setIndex]?.actualWeight ?? 0
      const loggedReps = exerciseLogs[exIndex]?.sets[setIndex]?.actualReps ?? 0

      setExerciseLogs((prev) =>
        prev.map((ex, ei) => {
          if (ei !== exIndex) return ex
          return {
            ...ex,
            sets: ex.sets.map((s, si) => {
              if (si === setIndex) {
                updatedSet = { ...s, actualRir: rir, status: 'done' as SetStatus }
                return updatedSet
              }
              // Auto-fill all subsequent idle sets with the same weight/reps
              if (si > setIndex && s.status === 'idle') {
                return {
                  ...s,
                  actualWeight: loggedWeight > 0 ? loggedWeight : s.recommendedWeight,
                  actualReps: loggedReps > 0 ? loggedReps : s.targetReps,
                }
              }
              return s
            }),
          }
        })
      )

      // Persist set to Supabase
      setTimeout(async () => {
        if (!updatedSet) return
        const set = updatedSet as SetLog
        const exerciseName = exerciseLogs[exIndex]?.name ?? 'Unknown'
        // Use actual weight (if 0, fall back to recommended)
        const loggedWeight = set.actualWeight > 0 ? set.actualWeight : set.recommendedWeight

        try {
          await supabase.from('workout_logs').insert({
            user_id: user.id,
            exercise_name: exerciseName,
            weight: loggedWeight,
            reps: set.actualReps,
            rir_actual: rir,
            completed: true,
            generated_workout_id: savedWorkoutId,
            created_at: new Date().toISOString(),
          })
        } catch (e) {
          console.error('Failed to save set log:', e)
        }
      }, 0)
    },
    [user, supabase, exerciseLogs, savedWorkoutId]
  )

  // ── Muscle group feedback ──────────────────────────────────────────────────────

  const handleFeedbackSelect = useCallback(
    async (value: string) => {
      if (!pendingFeedback || !user || !program) return

      if (pendingFeedback.step === 'volume') {
        setPendingFeedback((prev) =>
          prev ? { ...prev, step: 'pump', volume: value } : null
        )
      } else if (pendingFeedback.step === 'pump') {
        setPendingFeedback((prev) =>
          prev ? { ...prev, step: 'pain', pump: value } : null
        )
      } else {
        // Pain step — save and finish
        const { muscle, volume, pump } = pendingFeedback
        feedbackDoneRef.current.add(muscle)
        setPendingFeedback(null)

        try {
          await supabase.from('muscle_group_feedback').upsert(
            {
              user_id: user.id,
              program_slug: program.slug,
              week_number: program.currentWeek,
              day_number: dayNumber,
              muscle_group: muscle,
              volume_rating: volume ?? 'about_right',
              pump_rating: pump ?? 'mild',
              pain_rating: value,
            },
            { onConflict: 'user_id,program_slug,week_number,day_number,muscle_group' }
          )
        } catch (e) {
          console.error('Failed to save muscle feedback:', e)
        }
      }
    },
    [pendingFeedback, user, program, dayNumber, supabase]
  )

  // ── Exercise swap ──────────────────────────────────────────────────────────────

  const handleOpenSwap = useCallback((exIndex: number) => {
    const ex = exerciseLogs[exIndex]
    if (!ex) return
    const alts = EXERCISE_ALTERNATIVES[ex.name] ?? [
      'DB Variation',
      'Machine Variation',
      'Cable Variation',
    ]
    setSwapModal({ exIndex, exerciseName: ex.name, alternatives: alts })
  }, [exerciseLogs])

  const handleConfirmSwap = useCallback((newName: string) => {
    if (!swapModal) return
    setExerciseLogs((prev) =>
      prev.map((ex, i) => (i === swapModal.exIndex ? { ...ex, name: newName } : ex))
    )
    setSwapModal(null)
  }, [swapModal])

  // ── Finish Session ─────────────────────────────────────────────────────────────

  const handleFinishSession = useCallback(async () => {
    if (!user) return

    // Save any un-logged (idle or logging) sets to Supabase with completed=false
    const saveTasks: Promise<unknown>[] = []
    for (const ex of exerciseLogs) {
      for (const s of ex.sets) {
        if (s.status === 'idle' || s.status === 'logging') {
          const w = s.actualWeight > 0 ? s.actualWeight : s.recommendedWeight
          saveTasks.push(
            supabase.from('workout_logs').insert({
              user_id: user.id,
              exercise_name: ex.name,
              weight: w,
              reps: s.actualReps,
              rir_actual: null,
              completed: false,
              generated_workout_id: savedWorkoutId,
              created_at: new Date().toISOString(),
            })
          )
        }
      }
    }
    try {
      await Promise.all(saveTasks)
    } catch (e) {
      console.error('Failed to save partial sets on finish:', e)
    }

    // Clear WIP localStorage
    if (program) {
      const wipKey = `dad-strength-wip-day${dayNumber}-week${program.currentWeek}-${program.slug}`
      localStorage.removeItem(wipKey)
    }

    window.location.assign('/body')
  }, [user, supabase, exerciseLogs, savedWorkoutId, program, dayNumber])

  // ── Derived stats ──────────────────────────────────────────────────────────────

  const totalSets = exerciseLogs.reduce((acc, ex) => acc + ex.sets.length, 0)
  const doneSets = exerciseLogs.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.status === 'done').length,
    0
  )
  const totalVolume = exerciseLogs.reduce(
    (acc, ex) =>
      acc +
      ex.sets.reduce(
        (a, s) => {
          if (s.status !== 'done') return a
          const w = s.actualWeight > 0 ? s.actualWeight : s.recommendedWeight
          return a + w * s.actualReps
        },
        0
      ),
    0
  )

  // ── Renders ────────────────────────────────────────────────────────────────────

  if (userLoading || (pageState === 'loading' && !usedFallback)) {
    return <LoadingScreen />
  }

  if (pageState === 'error' && !usedFallback) {
    return <ErrorScreen onBack={() => window.location.assign('/body')} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 font-sans">
      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          <button
            onClick={() => window.location.assign('/body')}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="text-center flex-1 px-2">
            <p className="text-sm font-black uppercase tracking-tight text-foreground leading-none">
              Day {dayNumber}
              {dayName ? ` — ${dayName}` : ''}
            </p>
            {program && (
              <span className="text-xs font-bold text-brand mt-0.5 inline-block">
                Week {program.currentWeek}
                {weekTheme ? ` · ${weekTheme}` : ''}
              </span>
            )}
          </div>

          <div className="stat-num text-sm font-bold text-muted-foreground w-14 text-right">
            {formatTime(timer)}
          </div>
        </div>

        {coachNote && (
          <div className="mx-4 mb-3 max-w-md mx-auto">
            <div className="bg-brand/5 border-l-2 border-brand rounded-r-lg px-3 py-2">
              <p className="text-xs text-muted-foreground italic leading-relaxed">{coachNote}</p>
            </div>
          </div>
        )}

        {isCalibrationWeek && (
          <div className="mx-4 mb-2 bg-brand/10 border border-brand/30 rounded-xl p-3 flex gap-2.5">
            <span className="text-lg">🎯</span>
            <div>
              <p className="text-xs font-black text-brand uppercase tracking-wider mb-0.5">
                Calibration Week
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pick a weight that feels right. The recommendations are estimates from your 1RM — adjust freely.
              </p>
            </div>
          </div>
        )}

        {usedFallback && (
          <div className="mx-4 mb-3">
            <div className="bg-amber-500/5 border-l-2 border-amber-500 rounded-r-lg px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                Using template weights — log your session to unlock AI programming
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Session Complete Banner ────────────────────────────────────────────── */}
      {sessionComplete && (
        <div className="mx-4 mt-4 max-w-md mx-auto animate-float-up">
          <div className="glass-card rounded-2xl p-6 text-center space-y-4 accent-border-top brand-glow">
            <p className="text-2xl font-black uppercase tracking-tight text-brand">
              Session Complete 💪
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-0.5">
                <p className="stat-num text-xl font-black text-foreground">{doneSets}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Sets</p>
              </div>
              <div className="space-y-0.5">
                <p className="stat-num text-xl font-black text-foreground">
                  {totalVolume >= 1000
                    ? `${(totalVolume / 1000).toFixed(1)}k`
                    : totalVolume}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Volume</p>
              </div>
              <div className="space-y-0.5">
                <p className="stat-num text-xl font-black text-foreground">{formatTime(timer)}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Time</p>
              </div>
            </div>
            <button
              onClick={() => window.location.assign('/body')}
              className="w-full py-3.5 rounded-xl bg-brand text-white font-black text-sm uppercase tracking-widest active:scale-95 brand-glow"
            >
              Back to Program
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise List ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-3 max-w-md mx-auto">
        {exerciseLogs.map((ex, exIndex) => {
          const exDone = ex.sets.every((s) => s.status === 'done')
          const showFeedbackAfter =
            pendingFeedback !== null && pendingFeedback.exIndex === exIndex

          return (
            <div key={exIndex} className="space-y-3">
              <div
                className={`glass-card rounded-2xl p-4 space-y-3 transition-all duration-200 ${
                  exDone ? 'opacity-75' : ''
                }`}
              >
                {/* Exercise header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black uppercase tracking-tight text-foreground leading-tight">
                      {ex.name}
                    </h3>
                    {ex.progressionNote && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {ex.progressionNote}
                      </p>
                    )}
                  </div>

                  {/* Swap button for pain-flagged exercises */}
                  {ex.hasPainFlag && (
                    <button
                      onClick={() => handleOpenSwap(exIndex)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase tracking-widest shrink-0 active:scale-95 transition-all"
                    >
                      <AlertTriangle size={10} />
                      Swap
                    </button>
                  )}
                </div>

                {/* Set rows */}
                <div className="space-y-2">
                  {ex.sets.map((setLog, setIndex) => (
                    <SetRow
                      key={setIndex}
                      setLog={setLog}
                      onWeightChange={(val) => handleWeightChange(exIndex, setIndex, val)}
                      onRepsChange={(val) => handleRepsChange(exIndex, setIndex, val)}
                      onLog={() => handleLog(exIndex, setIndex)}
                      onRirSelect={(rir) => handleRirSelect(exIndex, setIndex, rir)}
                      onSkip={() => handleSkip(exIndex, setIndex)}
                    />
                  ))}
                </div>
              </div>

              {/* Muscle group feedback card — appears after last exercise of each muscle */}
              {showFeedbackAfter && (
                <MuscleGroupFeedbackCard
                  feedback={pendingFeedback}
                  onSelect={handleFeedbackSelect}
                />
              )}
            </div>
          )
        })}

        {/* Finish Session */}
        {exerciseLogs.length > 0 && !sessionComplete && (
          <div className="pt-2 pb-4">
            {showFinishConfirm ? (
              <div className="glass-card rounded-2xl p-4 border border-border/50 space-y-3">
                <p className="text-sm font-bold text-foreground text-center">End session early?</p>
                <p className="text-xs text-muted-foreground text-center">Your logged sets are already saved.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowFinishConfirm(false)}
                    className="py-3 rounded-xl border border-border/60 text-muted-foreground text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Keep Going
                  </button>
                  <button
                    onClick={handleFinishSession}
                    className="py-3 rounded-xl bg-brand/10 border border-brand/40 text-brand text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Yes, Finish
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="w-full py-3.5 rounded-xl border border-border/60 text-muted-foreground text-sm font-bold uppercase tracking-widest active:scale-95 transition-all"
              >
                Finish Session
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {exerciseLogs.length === 0 && pageState !== 'loading' && (
          <div className="glass-card rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm font-black uppercase tracking-tight text-muted-foreground">
              No exercises loaded
            </p>
            <p className="text-xs text-muted-foreground">
              Check your program settings and try again.
            </p>
            <button
              onClick={() => window.location.assign('/body')}
              className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-black uppercase tracking-widest active:scale-95"
            >
              Back to Program
            </button>
          </div>
        )}
      </div>

      {/* ── Exercise Swap Modal ────────────────────────────────────────────────── */}
      {swapModal && (
        <ExerciseSwapModal
          modal={swapModal}
          onConfirm={handleConfirmSwap}
          onClose={() => setSwapModal(null)}
        />
      )}
    </div>
  )
}
