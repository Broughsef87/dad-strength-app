'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Check } from 'lucide-react'
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
  targetWeight: number
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
    sets: ex.sets.map((s) => ({
      setNumber: s.setNumber,
      targetWeight: s.targetWeight,
      targetReps: s.targetReps,
      targetRir: s.targetRir,
      actualWeight: s.targetWeight,
      actualReps: s.targetReps,
      actualRir: null,
      status: 'idle' as SetStatus,
    })),
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
  exerciseIndex,
  setLog,
  onWeightChange,
  onRepsChange,
  onLog,
  onRirSelect,
}: {
  exerciseIndex: number
  setLog: SetLog
  onWeightChange: (val: number) => void
  onRepsChange: (val: number) => void
  onLog: () => void
  onRirSelect: (rir: number) => void
}) {
  const isDone = setLog.status === 'done'
  const isLogging = setLog.status === 'logging'

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
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            value={setLog.actualWeight === 0 ? '' : setLog.actualWeight}
            onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
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

  // ── Timer ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ── Data fetch / AI generation ────────────────────────────────────────────────

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push('/login')
      return
    }

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

        // 2. Check for existing generated workout
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
        const calibrationRaw = localStorage.getItem('dad-strength-calibration-weights')
        const calibrationWeights = calibrationRaw ? JSON.parse(calibrationRaw) : {}

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
            calibrationWeights,
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
    if (allDone) {
      setSessionComplete(true)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [exerciseLogs])

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
    return <ErrorScreen onBack={() => router.push('/body')} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 font-sans">
      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          {/* Back */}
          <button
            onClick={() => router.push('/body')}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={22} />
          </button>

          {/* Center: day name + week badge */}
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
              onClick={() => router.push('/body')}
              className="w-full py-3.5 rounded-xl bg-brand text-white font-black text-sm uppercase tracking-widest active:scale-95 brand-glow"
            >
              Back to Program
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
              className={`glass-card rounded-2xl p-4 space-y-3 transition-all duration-200 ${
                exDone ? 'opacity-75' : ''
              }`}
            >
              {/* Exercise header */}
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-foreground">
                  {ex.name}
                </h3>
                {ex.progressionNote && (
                  <p className="text-xs text-muted-foreground mt-0.5">{ex.progressionNote}</p>
                )}
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
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Empty state if fallback failed to load exercises */}
        {exerciseLogs.length === 0 && pageState !== 'loading' && (
          <div className="glass-card rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm font-black uppercase tracking-tight text-muted-foreground">
              No exercises loaded
            </p>
            <p className="text-xs text-muted-foreground">
              Check your program settings and try again.
            </p>
            <button
              onClick={() => router.push('/body')}
              className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-black uppercase tracking-widest active:scale-95"
            >
              Back to Program
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
