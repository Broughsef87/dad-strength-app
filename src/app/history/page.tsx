'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Dumbbell, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import WeeklyDebrief from '../../components/WeeklyDebrief'
import WeeklyMissionBrief from '../../components/WeeklyMissionBrief'
import QuarterlyReview from '../../components/QuarterlyReview'

// ── Types ──────────────────────────────────────────────────────────────────────

type GeneratedWorkout = {
  id: string
  week_number: number
  day_number: number
  day_name: string
  week_theme?: string
  ai_reasoning?: string
  generated_at: string
}

type WorkoutLog = {
  id: string
  exercise_name: string
  weight: number
  reps: number
  rir_actual: number | null
  completed: boolean
  generated_workout_id: string
  created_at: string
}

type SessionSummary = {
  workout: GeneratedWorkout
  logs: WorkoutLog[]
  completedSets: number
  totalVolume: number
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function History() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // 1. Fetch generated_workouts ordered by generated_at desc
      const { data: workouts, error: wErr } = await supabase
        .from('generated_workouts')
        .select('id, week_number, day_number, day_name, week_theme, ai_reasoning, generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(100)

      if (wErr) {
        console.error('Error fetching generated_workouts:', wErr)
        setLoading(false)
        return
      }

      const allWorkouts: GeneratedWorkout[] = workouts ?? []
      if (allWorkouts.length === 0) {
        setLoading(false)
        return
      }

      const workoutIds = allWorkouts.map((w) => w.id)

      // 2. Fetch workout_logs for those workout IDs
      const { data: logs, error: lErr } = await supabase
        .from('workout_logs')
        .select('id, exercise_name, weight, reps, rir_actual, completed, generated_workout_id, created_at')
        .in('generated_workout_id', workoutIds)
        .order('created_at', { ascending: true })

      if (lErr) {
        console.error('Error fetching workout_logs:', lErr)
        setLoading(false)
        return
      }

      const allLogs: WorkoutLog[] = logs ?? []

      // 3. Group logs by workout id
      const logsByWorkoutId: Record<string, WorkoutLog[]> = {}
      for (const log of allLogs) {
        if (!logsByWorkoutId[log.generated_workout_id]) {
          logsByWorkoutId[log.generated_workout_id] = []
        }
        logsByWorkoutId[log.generated_workout_id].push(log)
      }

      // 4. Build sessions — only include workouts with at least 1 completed log
      const built: SessionSummary[] = []
      for (const workout of allWorkouts) {
        const wLogs = logsByWorkoutId[workout.id] ?? []
        const hasCompleted = wLogs.some((l) => l.completed)
        if (!hasCompleted) continue

        const completedSets = wLogs.filter((l) => l.completed).length
        const totalVolume = wLogs
          .filter((l) => l.completed)
          .reduce((sum, l) => sum + (l.weight || 0) * (l.reps || 0), 0)

        built.push({ workout, logs: wLogs, completedSets, totalVolume })
      }

      setSessions(built)

      // Auto-expand most recent week
      if (built.length > 0) {
        const maxWeek = Math.max(...built.map((s) => s.workout.week_number))
        setExpandedWeeks(new Set([maxWeek]))
      }

      setLoading(false)
    }

    fetchHistory()
  }, [router])

  // ── Group by week ──────────────────────────────────────────────────────────────

  const weekNumbers = Array.from(new Set(sessions.map((s) => s.workout.week_number))).sort(
    (a, b) => b - a
  )

  const sessionsByWeek: Record<number, SessionSummary[]> = {}
  for (const s of sessions) {
    const w = s.workout.week_number
    if (!sessionsByWeek[w]) sessionsByWeek[w] = []
    sessionsByWeek[w].push(s)
  }

  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      next.has(week) ? next.delete(week) : next.add(week)
      return next
    })
  }

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Loading ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading history...</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-[20%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-20 bg-surface-2 border-b border-border p-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft />
        </button>
        <div>
          <h1 className="font-display text-3xl tracking-[0.1em] uppercase leading-none">Battle Log</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-[0.18em] font-display mt-0.5">
            {sessions.length} Sessions
          </p>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto pb-28">
        {/* Quarterly Review */}
        <div>
          <QuarterlyReview />
        </div>

        {/* Weekly Mission Brief */}
        <div>
          <WeeklyMissionBrief />
        </div>

        {/* AI Weekly Debrief */}
        <div className="ds-card p-6">
          <WeeklyDebrief />
        </div>

        {/* Empty state */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-brand/10 scale-150" />
              <div className="relative h-20 w-20 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto">
                <Dumbbell size={36} className="text-brand" strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-brand mb-3">Battle Log Empty</p>
            <h2 className="font-display text-4xl tracking-[0.08em] text-foreground mb-3 leading-none">
              The Log Is Empty.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-8">
              Iron only counts when it&apos;s recorded. Every rep, every set — this is where your legacy is built.
            </p>
            <button
              onClick={() => router.push('/body')}
              className="flex items-center gap-2 bg-brand text-background font-semibold text-xs uppercase tracking-[0.14em] px-8 py-3.5 rounded-md hover:bg-brand/90 transition-colors active:scale-[0.97] brand-glow"
            >
              <Dumbbell size={14} />
              Start First Session
            </button>
          </div>
        ) : (
          <>
            {weekNumbers.map((weekNum) => {
              const weekSessions = sessionsByWeek[weekNum] ?? []
              const isWeekExpanded = expandedWeeks.has(weekNum)
              const weekTheme = weekSessions[0]?.workout.week_theme

              // Aggregate week stats
              const weekCompletedSets = weekSessions.reduce((s, x) => s + x.completedSets, 0)
              const weekVolume = weekSessions.reduce((s, x) => s + x.totalVolume, 0)

              return (
                <div key={weekNum} className="space-y-2">
                  {/* Week header */}
                  <button
                    onClick={() => toggleWeek(weekNum)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-card/60 rounded-md border border-border/60 hover:bg-muted/40 transition-all"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-brand uppercase tracking-[0.15em]">
                          Week {weekNum}
                        </p>
                        {weekTheme && (
                          <span className="text-xs text-muted-foreground font-bold">· {weekTheme}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {weekCompletedSets} sets
                        </span>
                        {weekVolume > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {weekVolume >= 1000
                              ? `${(weekVolume / 1000).toFixed(1)}k`
                              : weekVolume}{' '}
                            lbs
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground flex-shrink-0">
                      {isWeekExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Sessions within week */}
                  {isWeekExpanded && (
                    <div className="space-y-2 pl-2">
                      {weekSessions.map((session) => {
                        const { workout, logs, completedSets, totalVolume } = session
                        const isExpanded = expandedSessions.has(workout.id)
                        const dateLabel = new Date(workout.generated_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })

                        // Group completed logs by exercise name for display
                        const completedLogs = logs.filter((l) => l.completed)
                        const byExercise: Record<string, WorkoutLog[]> = {}
                        for (const l of completedLogs) {
                          if (!byExercise[l.exercise_name]) byExercise[l.exercise_name] = []
                          byExercise[l.exercise_name].push(l)
                        }

                        return (
                          <div
                            key={workout.id}
                            className="card-base overflow-hidden"
                          >
                            {/* Session header */}
                            <button
                              onClick={() => toggleSession(workout.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-all"
                            >
                              <div className="flex items-center gap-3 text-left">
                                <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                                  <Dumbbell size={16} className="text-brand" />
                                </div>
                                <div>
                                  <p className="font-black text-sm tracking-tight">
                                    Day {workout.day_number}
                                    {workout.day_name ? ` — ${workout.day_name}` : ''}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                      <Calendar size={9} /> {dateLabel}
                                    </span>
                                    <span className="text-[10px] font-bold text-brand uppercase">
                                      {completedSets} sets
                                    </span>
                                    {totalVolume > 0 && (
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                        {totalVolume >= 1000
                                          ? `${(totalVolume / 1000).toFixed(1)}k`
                                          : totalVolume}{' '}
                                        lbs
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-muted-foreground flex-shrink-0">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>

                            {/* Exercise breakdown */}
                            {isExpanded && (
                              <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                                {Object.entries(byExercise).map(([exerciseName, sets]) => (
                                  <div key={exerciseName}>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-black text-xs uppercase tracking-tight">{exerciseName}</p>
                                      <span className="text-[10px] font-bold text-muted-foreground">
                                        {sets.length} sets
                                      </span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {sets.map((s, i) => (
                                        <div
                                          key={s.id}
                                          className="flex items-center justify-between bg-muted rounded-xl px-3 py-2"
                                        >
                                          <span className="text-[10px] font-black text-muted-foreground uppercase w-6">
                                            S{i + 1}
                                          </span>
                                          <span className="text-sm font-bold">
                                            {s.weight > 0 ? `${s.weight} lbs` : 'BW'}
                                          </span>
                                          <span className="text-sm font-bold text-brand">× {s.reps}</span>
                                          {s.rir_actual !== null && (
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                              RIR {s.rir_actual}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
