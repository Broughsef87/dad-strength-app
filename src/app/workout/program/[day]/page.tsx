'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Check, MoreVertical, X, ArrowUp, ArrowDown, Plus, SkipForward, Trash2 } from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'

// ── Types ──────────────────────────────────────────────────────────────────────

type SetStatus = 'idle' | 'logging' | 'done'

type SetLog = {
  setNumber: number
  targetWeight: number
  targetReps: number
  targetRir: number
  actualWeight: number
  actualReps: number
  actualRir: number | null
  status: SetStatus
}

type ExerciseLog = {
  name: string
  sets: SetLog[]
  progressionNote?: string
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
  targetWeight?: number       // legacy field name
  recommendedWeight?: number  // current API field name
  targetReps: number
  targetRir: number
  notes?: string
}

type GeneratedExercise = {
  name: string
  sets: GeneratedSet[]
  progressionNote?: string
}

type GeneratedDay = {
  dayNumber: number
  dayName: string
  exercises: GeneratedExercise[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function initExerciseLogs(exercises: GeneratedExercise[]): ExerciseLog[] {
  return exercises.map((ex) => ({
    name: ex.name,
    progressionNote: ex.progressionNote,
    sets: ex.sets.map((s) => {
      // API emits recommendedWeight; legacy cache rows may have targetWeight
      const weight = s.recommendedWeight ?? s.targetWeight ?? 0
      return {
        setNumber: s.setNumber,
        targetWeight: weight,
        targetReps: s.targetReps,
        targetRir: s.targetRir,
        actualWeight: weight,
        actualReps: s.targetReps,
        actualRir: null,
        status: 'idle' as SetStatus,
      }
    }),
  }))
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
        <p className="font-display text-2xl tracking-[0.12em] uppercase text-foreground">
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
        <p className="font-display text-2xl tracking-[0.1em] uppercase text-foreground">
          Generation Failed
        </p>
        <p className="text-sm text-muted-foreground">
          Could not reach the AI coach. Check your connection and try again.
        </p>
      </div>
      <button
        onClick={onBack}
        className="px-6 py-3 rounded-md bg-brand text-background font-semibold text-sm uppercase tracking-[0.1em] active:scale-95 brand-glow"
      >
        Go Back
      </button>
    </div>
  )
}

function SetRow({
  exerciseIndex,
  setLog,
  onWeightChange,
  onRepsChange,
  onLog,
  onRirSelect,
  onSkip,
}: {
  exerciseIndex: number
  setLog: SetLog
  onWeightChange: (val: number) => void
  onRepsChange: (val: number) => void
  onLog: () => void
  onRirSelect: (rir: number) => void
  onSkip: () => void
}) {
  const isDone = setLog.status === 'done'
  const isLogging = setLog.status === 'logging'

  return (
    <div
      className={`rounded-md border transition-all duration-200 overflow-hidden ${
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
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            min="0"
            value={setLog.actualWeight === 0 ? '' : setLog.actualWeight}
            onChange={(e) => onWeightChange(Math.max(0, parseFloat(e.target.value) || 0))}
            disabled={isDone}
            placeholder={setLog.targetWeight === 0 ? 'BW' : String(setLog.targetWeight)}
            className="stat-num w-16 bg-transparent text-sm font-bold text-foreground text-center outline-none border-b border-border/60 focus:border-brand py-0.5 disabled:opacity-60"
          />
          <span className="text-xs text-muted-foreground shrink-0">lbs</span>
        </div>

        {/* Reps input */}
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            min="0"
            value={setLog.actualReps}
            onChange={(e) => onRepsChange(Math.max(0, parseInt(e.target.value) || 0))}
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
            className="w-14 text-xs font-semibold uppercase tracking-wider px-2 py-1.5 rounded-md bg-brand text-background active:scale-95 shrink-0"
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
                className="py-3 rounded-md text-sm font-semibold border border-border/60 bg-surface-2 hover:border-brand hover:bg-brand/10 hover:text-brand active:scale-95 transition-all"
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

  // The saved workout row from generated_workouts (for FK on logs)
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

  // Skip workout confirmation dialog
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)

  // Exercise context menu
  const [menuExIndex, setMenuExIndex] = useState<number | null>(null)

  // Prevent re-initialization when Supabase re-emits auth
  const hasInitializedRef = useRef(false)

  // ── Timer ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Persist in-progress workout to localStorage on every change ──────────────
  useEffect(() => {
    if (exerciseLogs.length === 0 || !program) return
    const key = `dad-strength-wip-day${dayNumber}-week${program.currentWeek}-${program.slug}`
    localStorage.setItem(key, JSON.stringify({
      exerciseLogs, dayName, coachNote, weekTheme, savedWorkoutId, isCalibrationWeek,
      ts: Date.now(),
    }))
  }, [exerciseLogs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetch / AI generation ────────────────────────────────────────────────

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      if (!hasInitializedRef.current) window.location.assign('/login')
      return
    }

    // Guard: only initialize once — prevents Supabase re-auth from wiping live data
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const run = async () => {
      try {
        // 1. Read active program from localStorage
        const raw = localStorage.getItem('dad-strength-active-program')
        if (!raw) {
          router.push('/body')
          return
        }
        const prog: ActiveProgram = JSON.parse(raw)
        setProgram(prog)

        // 2. Restore in-progress workout if it exists (survives screen sleep / app close)
        const wipKey = `dad-strength-wip-day${dayNumber}-week${prog.currentWeek}-${prog.slug}`
        const wipRaw = localStorage.getItem(wipKey)
        if (wipRaw) {
          try {
            const wip = JSON.parse(wipRaw)
            const ageHours = (Date.now() - (wip.ts ?? 0)) / 3_600_000
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

        // 3. Check for existing generated workout
        const { data: existing } = await supabase
          .from('generated_workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('week_number', prog.currentWeek)
          .eq('day_number', dayNumber)
          .maybeSingle()

        if (existing) {
          // Use cached workout
          const exercises: GeneratedExercise[] = existing.exercises
          setDayName(existing.day_name ?? `Day ${dayNumber}`)
          setCoachNote(existing.ai_reasoning ?? '')
          setWeekTheme(existing.week_theme ?? '')
          setSavedWorkoutId(existing.id)
          setIsCalibrationWeek(existing.week_number === 1)
          setExerciseLogs(initExerciseLogs(exercises))
          setPageState('ready')
          return
        }

        // 3. Fetch recent logs for AI context
        const { data: recentLogs } = await supabase
          .from('workout_logs')
          .select('exercise_name, weight, reps, rir_actual, completed, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        // 4. Call AI generation API
        const oneRepMaxesRaw = localStorage.getItem('dad-strength-one-rep-maxes')
        const oneRepMaxes = oneRepMaxesRaw ? JSON.parse(oneRepMaxesRaw) : {}

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
          }),
        })

        if (!res.ok) {
          throw new Error(`AI API returned ${res.status}`)
        }

        const { program: generated } = await res.json()

        const generatedDay: GeneratedDay = generated.days[dayNumber - 1]

        // 5. Save full week to generated_workouts (one row per day)
        // We save all days but only activate the current one
        const currentDayData = generatedDay

        const { data: saved } = await supabase
          .from('generated_workouts')
          .insert({
            user_id: user.id,
            week_number: prog.currentWeek,
            day_number: dayNumber,
            day_name: currentDayData.dayName,
            week_theme: generated.weekTheme,
            exercises: currentDayData.exercises,
            ai_reasoning: generated.coachNote,
            generated_at: new Date().toISOString(),
          })
          .select()
          .single()

        setSavedWorkoutId(saved?.id ?? null)
        setDayName(currentDayData.dayName)
        setCoachNote(generated.coachNote)
        setWeekTheme(generated.weekTheme)
        setIsCalibrationWeek(generated.isCalibrationWeek ?? prog.currentWeek === 1)
        setExerciseLogs(initExerciseLogs(currentDayData.exercises))
        setPageState('ready')
      } catch (err) {
        console.error('Program workout generation error:', err)

        // Fallback: try to build from localStorage program data (template only, no weights)
        try {
          const raw = localStorage.getItem('dad-strength-active-program')
          if (raw) {
            const prog: ActiveProgram = JSON.parse(raw)
            setProgram(prog)
            setDayName(`Day ${dayNumber}`)
            setCoachNote('')
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

  // ── Check for completion ──────────────────────────────────────────────────────

  useEffect(() => {
    if (exerciseLogs.length === 0) return
    const allDone = exerciseLogs.every((ex) => ex.sets.every((s) => s.status === 'done'))
    if (allDone && !sessionComplete) {
      setSessionComplete(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [exerciseLogs, sessionComplete])

  // ── Set interactions ──────────────────────────────────────────────────────────

  const handleWeightChange = useCallback((exIndex: number, setIndex: number, val: number) => {
    setExerciseLogs((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIndex) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIndex ? { ...s, actualWeight: val } : s
          ),
        }
      })
      return next
    })
  }, [])

  const handleRepsChange = useCallback((exIndex: number, setIndex: number, val: number) => {
    setExerciseLogs((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIndex) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIndex ? { ...s, actualReps: val } : s
          ),
        }
      })
      return next
    })
  }, [])

  const handleLog = useCallback((exIndex: number, setIndex: number) => {
    setExerciseLogs((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIndex) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIndex ? { ...s, status: 'logging' as SetStatus } : s
          ),
        }
      })
      return next
    })
  }, [])

  const handleRirSelect = useCallback(
    async (exIndex: number, setIndex: number, rir: number) => {
      if (!user) return

      let updatedSet: SetLog | null = null

      setExerciseLogs((prev) => {
        const next = prev.map((ex, ei) => {
          if (ei !== exIndex) return ex
          return {
            ...ex,
            sets: ex.sets.map((s, si) => {
              if (si !== setIndex) return s
              updatedSet = { ...s, actualRir: rir, status: 'done' as SetStatus }
              return updatedSet
            }),
          }
        })
        return next
      })

      // Persist to Supabase after state update
      // Use a small timeout to let state settle so we have the latest values
      setTimeout(async () => {
        if (!updatedSet) return
        const set = updatedSet as SetLog
        const exerciseName = exerciseLogs[exIndex]?.name ?? 'Unknown'

        try {
          await supabase.from('workout_logs').insert({
            user_id: user.id,
            exercise_name: exerciseName,
            weight: set.actualWeight,
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

  const handleAddSet = useCallback((exIndex: number) => {
    setExerciseLogs((prev) =>
      prev.map((ex, ei) => {
        if (ei !== exIndex) return ex
        const lastSet = ex.sets[ex.sets.length - 1]
        const newSet: SetLog = {
          setNumber: ex.sets.length + 1,
          targetWeight: lastSet?.targetWeight ?? 0,
          targetReps: lastSet?.targetReps ?? 8,
          targetRir: lastSet?.targetRir ?? 3,
          actualWeight: lastSet?.actualWeight ?? lastSet?.targetWeight ?? 0,
          actualReps: lastSet?.actualReps ?? lastSet?.targetReps ?? 8,
          actualRir: null,
          status: 'idle' as SetStatus,
        }
        return { ...ex, sets: [...ex.sets, newSet] }
      })
    )
  }, [])

  const handleMoveUp = useCallback((exIndex: number) => {
    if (exIndex === 0) return
    setExerciseLogs((prev) => {
      const next = [...prev]
      ;[next[exIndex - 1], next[exIndex]] = [next[exIndex], next[exIndex - 1]]
      return next
    })
    setMenuExIndex(null)
  }, [])

  const handleMoveDown = useCallback((exIndex: number) => {
    setExerciseLogs((prev) => {
      if (exIndex >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[exIndex], next[exIndex + 1]] = [next[exIndex + 1], next[exIndex]]
      return next
    })
    setMenuExIndex(null)
  }, [])

  const handleRemoveExercise = useCallback((exIndex: number) => {
    setExerciseLogs((prev) => prev.filter((_, i) => i !== exIndex))
    setMenuExIndex(null)
  }, [])

  const handleSkipWorkout = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    window.location.assign('/body')
  }, [])

  const handleFinishSession = useCallback(async () => {
    if (!user) return

    // Save any sets not yet logged (idle/logging) as completed=false
    const saveTasks: Promise<unknown>[] = []
    for (const ex of exerciseLogs) {
      for (const s of ex.sets) {
        if (s.status === 'idle' || s.status === 'logging') {
          saveTasks.push(
            supabase.from('workout_logs').insert({
              user_id: user.id,
              exercise_name: ex.name,
              weight: s.actualWeight > 0 ? s.actualWeight : s.targetWeight,
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
    try { await Promise.all(saveTasks) } catch (e) { console.error('Failed to save partial sets:', e) }

    // Clear WIP cache — session is officially submitted
    if (program) {
      const wipKey = `dad-strength-wip-day${dayNumber}-week${program.currentWeek}-${program.slug}`
      localStorage.removeItem(wipKey)
    }

    window.location.assign('/body')
  }, [user, supabase, exerciseLogs, savedWorkoutId, program, dayNumber])

  // ── Derived stats ─────────────────────────────────────────────────────────────

  const totalSets = exerciseLogs.reduce((acc, ex) => acc + ex.sets.length, 0)
  const doneSets = exerciseLogs.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.status === 'done').length,
    0
  )
  const totalVolume = exerciseLogs.reduce(
    (acc, ex) =>
      acc +
      ex.sets.reduce(
        (a, s) => (s.status === 'done' ? a + s.actualWeight * s.actualReps : a),
        0
      ),
    0
  )

  // ── Renders ───────────────────────────────────────────────────────────────────

  if (userLoading || (pageState === 'loading' && !usedFallback)) {
    return <LoadingScreen />
  }

  if (pageState === 'error' && !usedFallback) {
    return <ErrorScreen onBack={() => router.back()} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 font-sans">
      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-surface-2 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={22} />
          </button>

          {/* Center: day name + week badge */}
          <div className="text-center flex-1 px-2">
            <p className="font-display text-xl tracking-[0.08em] uppercase text-foreground leading-none">
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

          {/* Timer */}
          <div className="stat-num text-sm font-bold text-muted-foreground w-14 text-right">
            {formatTime(timer)}
          </div>
        </div>

        {/* Coach note */}
        {coachNote && (
          <div className="mx-4 mb-3 max-w-md mx-auto">
            <div className="bg-brand/5 border-l-2 border-brand rounded-r-lg px-3 py-2">
              <p className="text-xs text-muted-foreground italic leading-relaxed">{coachNote}</p>
            </div>
          </div>
        )}

        {/* Calibration week banner */}
        {isCalibrationWeek && (
          <div className="mx-4 mb-2 bg-brand/10 border border-brand/30 rounded-xl p-3 flex gap-2.5">
            <span className="text-lg">🎯</span>
            <div>
              <p className="text-xs font-black text-brand uppercase tracking-wider mb-0.5">Calibration Week</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                These weights are your baseline. Focus on form and honest RIR — Week 2 weights will be optimized from your results today.
              </p>
            </div>
          </div>
        )}

        {/* Fallback warning */}
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
          <div className="ds-card p-6 text-center space-y-4 brand-glow">
            <p className="font-display text-4xl tracking-[0.1em] uppercase text-brand">
              Session Complete
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
              onClick={handleFinishSession}
              className="w-full py-3.5 rounded-md bg-brand text-background font-semibold text-sm uppercase tracking-[0.1em] active:scale-95 brand-glow"
            >
              Submit Workout
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise List ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-5 max-w-md mx-auto">
        {exerciseLogs.map((ex, exIndex) => {
          const exDone = ex.sets.every((s) => s.status === 'done')
          return (
            <div
              key={exIndex}
              className={`card-base p-4 space-y-3 transition-all duration-200 ${
                exDone ? 'opacity-75' : ''
              }`}
            >
              {/* Exercise header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-2xl tracking-[0.06em] uppercase text-foreground leading-none">
                    {ex.name}
                  </h3>
                  {ex.progressionNote && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ex.progressionNote}</p>
                  )}
                </div>
                <button
                  onClick={() => setMenuExIndex(exIndex)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-3 border border-border text-muted-foreground hover:text-foreground hover:border-brand/30 transition-colors flex-shrink-0"
                >
                  <MoreVertical size={15} />
                </button>
              </div>

              {/* Set rows */}
              <div className="space-y-2">
                {ex.sets.map((setLog, setIndex) => (
                  <SetRow
                    key={setIndex}
                    exerciseIndex={exIndex}
                    setLog={setLog}
                    onWeightChange={(val) => handleWeightChange(exIndex, setIndex, val)}
                    onRepsChange={(val) => handleRepsChange(exIndex, setIndex, val)}
                    onLog={() => handleLog(exIndex, setIndex)}
                    onRirSelect={(rir) => handleRirSelect(exIndex, setIndex, rir)}
                    onSkip={() => handleSkip(exIndex, setIndex)}
                  />
                ))}
              </div>

              {/* Add set button */}
              {!exDone && (
                <button
                  onClick={() => handleAddSet(exIndex)}
                  className="w-full py-2 rounded-md border border-dashed border-border/60 text-xs font-semibold text-muted-foreground hover:border-brand hover:text-brand transition-colors active:scale-95"
                >
                  + Add Set
                </button>
              )}
            </div>
          )
        })}

        {/* Empty state if fallback failed to load exercises */}
        {exerciseLogs.length === 0 && pageState !== 'loading' && (
          <div className="card-base p-8 text-center space-y-3">
            <p className="text-sm font-black uppercase tracking-tight text-muted-foreground">
              No exercises loaded
            </p>
            <p className="text-xs text-muted-foreground">
              Check your program settings and try again.
            </p>
            <button
              onClick={() => router.push('/body')}
              className="px-5 py-2.5 rounded-md bg-brand text-background text-xs font-semibold uppercase tracking-wider active:scale-95 brand-glow"
            >
              Back to Program
            </button>
          </div>
        )}
      </div>

      {/* ── Sticky Footer ─────────────────────────────────────────────────────── */}
      {exerciseLogs.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-surface-2 border-t border-border px-4 py-3 safe-area-pb">
          <div className="max-w-md mx-auto flex gap-3">
            {!sessionComplete && (
              <button
                onClick={() => setShowSkipConfirm(true)}
                className="flex-1 py-3 rounded-md border border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-border active:scale-95 transition-all"
              >
                Skip Workout
              </button>
            )}
            <button
              onClick={handleFinishSession}
              className={`py-3 rounded-md text-background text-xs font-semibold uppercase tracking-wider active:scale-95 brand-glow transition-all ${
                sessionComplete
                  ? 'flex-1 bg-brand scale-105'
                  : 'flex-1 bg-brand/80'
              }`}
            >
              {sessionComplete ? 'Submit Workout 💪' : `Finish — ${doneSets}/${totalSets} Sets`}
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise Context Menu ─────────────────────────────────────────────── */}
      {menuExIndex !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setMenuExIndex(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-2 border-t border-border rounded-t-2xl animate-float-up">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Exercise</p>
                <p className="font-display tracking-[0.06em] uppercase text-sm text-foreground">
                  {exerciseLogs[menuExIndex]?.name}
                </p>
              </div>
              <button
                onClick={() => setMenuExIndex(null)}
                className="w-7 h-7 rounded-lg bg-surface-3 border border-border flex items-center justify-center text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-1 max-w-md mx-auto pb-8">
              {/* Reorder + set controls */}
              <div className="ds-card overflow-hidden divide-y divide-border">
                <button onClick={() => handleAddSet(menuExIndex)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors">
                  <Plus size={16} className="flex-shrink-0" /> Add Set
                </button>
                <button onClick={() => { handleSkip(menuExIndex, exerciseLogs[menuExIndex]?.sets.findIndex(s => s.status !== 'done') ?? 0); setMenuExIndex(null) }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors">
                  <SkipForward size={16} className="flex-shrink-0" /> Skip Next Set
                </button>
              </div>
              <div className="ds-card overflow-hidden divide-y divide-border">
                <button onClick={() => handleMoveUp(menuExIndex)}
                  disabled={menuExIndex === 0}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors disabled:opacity-40">
                  <ArrowUp size={16} className="flex-shrink-0" /> Move Up
                </button>
                <button onClick={() => handleMoveDown(menuExIndex)}
                  disabled={menuExIndex >= exerciseLogs.length - 1}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors disabled:opacity-40">
                  <ArrowDown size={16} className="flex-shrink-0" /> Move Down
                </button>
              </div>
              <div className="ds-card overflow-hidden">
                <button onClick={() => handleRemoveExercise(menuExIndex)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-400 hover:bg-red-500/5 transition-colors">
                  <Trash2 size={16} className="flex-shrink-0" /> Remove Exercise
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Skip Workout Confirmation ──────────────────────────────────────────── */}
      {showSkipConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setShowSkipConfirm(false)}
        >
          <div
            className="w-full max-w-md bg-surface-2 rounded-t-xl p-6 pb-10 space-y-4 animate-float-up border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <p className="font-display text-3xl tracking-[0.08em] uppercase text-foreground">
                Skip Today&apos;s Workout?
              </p>
              <p className="text-sm text-muted-foreground">
                Your progress won&apos;t be saved. The AI coach will account for the missed session next week.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 py-3.5 rounded-md border border-border/60 text-sm font-semibold uppercase tracking-wider text-muted-foreground active:scale-95"
              >
                Keep Going
              </button>
              <button
                onClick={handleSkipWorkout}
                className="flex-1 py-3.5 rounded-md bg-destructive/90 text-foreground text-sm font-semibold uppercase tracking-wider active:scale-95"
              >
                Skip It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
