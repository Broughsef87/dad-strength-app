'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Dumbbell, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

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

// Real per-set data lives in ares_session_logs — workout_logs only ever
// receives a zero-weight "streak shim" row per session, which is why the
// old version of this page summed 0 lbs for every session ever trained.
type SessionLog = {
  id: string
  generated_workout_id: string | null
  log_type: string
  block_name: string
  set_number: number | null
  weight_lbs: number | null
  reps: number | null
  rpe: number | null
  rir_actual: number | null
  completed: boolean | null
  peak_weight_lbs: number | null
  skill_duration_minutes: number | null
  distance_meters: number | null
  duration_seconds: number | null
  metcon_format: string | null
  metcon_time_seconds: number | null
  metcon_rounds: number | null
  created_at: string
}

type SessionSummary = {
  workout: GeneratedWorkout
  logs: SessionLog[]
  completedSets: number
  totalVolume: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isSetLike = (l: SessionLog) =>
  l.log_type === 'strength_set' || l.log_type === 'build_to_max'

// Tonnage counts strength sets only — the same rule the dashboard's weekly
// pulse uses (src/lib/analytics/training.ts), so the two surfaces agree.
const setVolume = (l: SessionLog) =>
  l.log_type === 'strength_set' ? (Number(l.weight_lbs) || 0) * (l.reps || 0) : 0

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function setLine(l: SessionLog): string {
  switch (l.log_type) {
    case 'strength_set':
      return `${l.weight_lbs && Number(l.weight_lbs) > 0 ? `${l.weight_lbs} lbs` : 'BW'} × ${l.reps ?? 0}`
    case 'build_to_max':
      return `top ${l.peak_weight_lbs ?? l.weight_lbs ?? '—'} lbs`
    case 'skill_work':
      return l.skill_duration_minutes ? `${l.skill_duration_minutes} min` : 'done'
    case 'monostructural': {
      const parts: string[] = []
      if (l.distance_meters) parts.push(`${l.distance_meters}m`)
      if (l.duration_seconds) parts.push(fmtDuration(l.duration_seconds))
      return parts.join(' · ') || 'done'
    }
    case 'metcon': {
      if (l.metcon_time_seconds) return `${l.metcon_format ?? 'metcon'} · ${fmtDuration(l.metcon_time_seconds)}`
      if (l.metcon_rounds) return `${l.metcon_format ?? 'metcon'} · ${l.metcon_rounds} rds`
      return l.metcon_format ?? 'metcon'
    }
    default:
      return 'done'
  }
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

      // 2. Fetch the real set data for those sessions
      const { data: logs, error: lErr } = await supabase
        .from('ares_session_logs')
        .select('id, generated_workout_id, log_type, block_name, set_number, weight_lbs, reps, rpe, rir_actual, completed, peak_weight_lbs, skill_duration_minutes, distance_meters, duration_seconds, metcon_format, metcon_time_seconds, metcon_rounds, created_at')
        .eq('user_id', user.id)
        .in('generated_workout_id', workoutIds)
        .order('created_at', { ascending: true })

      if (lErr) {
        console.error('Error fetching ares_session_logs:', lErr)
        setLoading(false)
        return
      }

      const allLogs: SessionLog[] = logs ?? []

      // 3. Group logs by workout id. The session_complete marker is kept OUT
      // of the per-set arrays (it has no weight/reps and would skew counts)
      // but tracked separately: a session finished without logging individual
      // blocks — every outside day, and any gym day you just tap done — has
      // ONLY that marker. Dropping it here made those sessions disappear from
      // the log entirely, even though the streak still counted them.
      const logsByWorkoutId: Record<string, SessionLog[]> = {}
      const completedWorkoutIds = new Set<string>()
      for (const log of allLogs) {
        if (!log.generated_workout_id) continue
        if (log.log_type === 'session_complete') {
          completedWorkoutIds.add(log.generated_workout_id)
          continue
        }
        if (!logsByWorkoutId[log.generated_workout_id]) {
          logsByWorkoutId[log.generated_workout_id] = []
        }
        logsByWorkoutId[log.generated_workout_id].push(log)
      }

      // 4. Build sessions — only include workouts with at least 1 completed log
      const built: SessionSummary[] = []
      for (const workout of allWorkouts) {
        const wLogs = (logsByWorkoutId[workout.id] ?? []).filter((l) => l.completed !== false)
        // A session you marked done still belongs in the log, even with no
        // sets behind it — it just shows zero volume, which is the truth.
        if (wLogs.length === 0 && !completedWorkoutIds.has(workout.id)) continue

        const completedSets = wLogs.filter(isSetLike).length
        const totalVolume = wLogs.reduce((sum, l) => sum + setVolume(l), 0)

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
          <p className="text-muted-foreground font-mono text-xs lowercase">Loading history...</p>
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
          <h1 className="font-display text-3xl lowercase leading-none">Battle Log</h1>
          <p className="text-[10px] text-muted-foreground lowercase font-semibold tracking-[0.18em] font-display mt-0.5">
            {sessions.length} Sessions
          </p>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto pb-28">
        {/* Empty state */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-brand/10 scale-150" />
              <div className="relative h-20 w-20 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto">
                <Dumbbell size={36} className="text-brand" strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-[10px] font-medium lowercase text-brand mb-3">Battle Log Empty</p>
            <h2 className="font-display text-4xl tracking-[0.08em] text-foreground mb-3 leading-none">
              The Log Is Empty.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-8">
              Iron only counts when it&apos;s recorded. Every rep, every set — this is where your legacy is built.
            </p>
            <button
              onClick={() => router.push('/train')}
              className="flex items-center gap-2 bg-brand text-[hsl(var(--brand-ink))] font-semibold text-xs lowercase px-8 py-3.5 rounded-md hover:bg-brand/90 transition-colors active:scale-[0.97]"
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
                        {/* A week heading is chrome. Oswald tops out at 600 in
                            this build, so font-black would have been faked by
                            the browser rather than drawn. */}
                        <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                          Week <span className="ink-printed">{weekNum}</span>
                        </p>
                        {weekTheme && (
                          <span className="text-xs text-muted-foreground font-bold">· {weekTheme}</span>
                        )}
                      </div>
                      {/* History is a LEDGER — a record of what you did, not of
                          what was asked. So the figures are the athlete's, in
                          ballpoint. But they stack down a list and have to
                          align, which is precisely the case my own rule sends
                          back to the printed face: colour says who wrote it,
                          the monospace keeps the column readable. The units
                          stay chrome; only the numbers carry ink. */}
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="eyebrow-mono">
                          <span className="ink-written-col">{weekSessions.length}</span>{' '}
                          session{weekSessions.length !== 1 ? 's' : ''}
                        </span>
                        <span className="eyebrow-mono">
                          <span className="ink-written-col">{weekCompletedSets}</span> sets
                        </span>
                        {weekVolume > 0 && (
                          <span className="eyebrow-mono">
                            <span className="ink-written-col">
                              {weekVolume >= 1000
                                ? `${(weekVolume / 1000).toFixed(1)}k`
                                : Math.round(weekVolume)}
                            </span>{' '}
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
                        const dateLabel = new Date(logs[0]?.created_at ?? workout.generated_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })

                        // Group logs by block for display
                        const byBlock: Record<string, SessionLog[]> = {}
                        for (const l of logs) {
                          if (!byBlock[l.block_name]) byBlock[l.block_name] = []
                          byBlock[l.block_name].push(l)
                        }

                        return (
                          <div
                            key={workout.id}
                            className="tile overflow-hidden"
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
                                    <span className="text-[10px] font-bold text-muted-foreground lowercase flex items-center gap-1">
                                      <Calendar size={9} /> {dateLabel}
                                    </span>
                                    <span className="text-[10px] font-bold text-brand lowercase">
                                      {completedSets} sets
                                    </span>
                                    {totalVolume > 0 && (
                                      <span className="text-[10px] font-bold text-muted-foreground lowercase">
                                        {totalVolume >= 1000
                                          ? `${(totalVolume / 1000).toFixed(1)}k`
                                          : Math.round(totalVolume)}{' '}
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

                            {/* Block breakdown */}
                            {isExpanded && (
                              <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                                {Object.entries(byBlock).map(([blockName, sets]) => (
                                  <div key={blockName}>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-black text-xs lowercase tracking-tight">{blockName}</p>
                                      {sets.filter(isSetLike).length > 0 && (
                                        <span className="text-[10px] font-bold text-muted-foreground">
                                          {sets.filter(isSetLike).length} sets
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-1.5">
                                      {sets.map((s, i) => (
                                        <div
                                          key={s.id}
                                          className="flex items-center justify-between bg-muted rounded-xl px-3 py-2"
                                        >
                                          <span className="text-[10px] font-black text-muted-foreground lowercase w-6">
                                            {s.set_number != null ? `S${s.set_number}` : `S${i + 1}`}
                                          </span>
                                          <span className="text-sm font-bold">{setLine(s)}</span>
                                          {s.log_type === 'strength_set' && (
                                            <span className="text-[10px] font-bold text-muted-foreground lowercase">
                                              {s.rpe != null
                                                ? `RPE ${s.rpe}`
                                                : s.rir_actual != null
                                                  ? `RIR ${s.rir_actual}`
                                                  : ''}
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
