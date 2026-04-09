'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '../../../../components/ui/motion'
import { ArrowLeft, ChevronDown, ChevronUp, Dumbbell, Timer, Zap, Wind, Trophy } from 'lucide-react'
import { getAresWeekNumber, formatAresWeek, formatTime } from '../../../../lib/aresWeek'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionLog {
  id: string
  user_id: string
  generated_workout_id: string | null
  week_number: number
  day_number: number
  log_type: 'strength_set' | 'build_to_max' | 'skill_work' | 'monostructural' | 'metcon'
  block_name: string
  // strength_set
  set_number?: number
  weight_lbs?: number
  reps?: number
  rir_actual?: number
  completed?: boolean
  // build_to_max
  peak_weight_lbs?: number
  climb_scheme?: string
  // skill_work
  skill_duration_minutes?: number
  // monostructural
  distance_meters?: number
  duration_seconds?: number
  // metcon
  metcon_format?: string
  metcon_time_seconds?: number
  metcon_rounds?: number
  metcon_partial_reps?: number
  metcon_rx?: boolean
  time_cap_hit?: boolean
  notes?: string
  created_at: string
}

interface GeneratedWorkout {
  id: string
  week_number: number
  day_number: number
  workout_data: WorkoutData | null
}

interface WorkoutData {
  days?: AresDayData[]
}

interface AresDayData {
  dayNumber: number
  dayName?: string
  archetype?: string
}

// ── Helper: extract day name from workout_data ────────────────────────────────

function getDayName(
  workouts: GeneratedWorkout[],
  weekNumber: number,
  dayNumber: number,
): string {
  const gw = workouts.find(
    (w) => w.week_number === weekNumber && w.day_number === dayNumber,
  )
  if (!gw || !gw.workout_data) return `Ares Day ${dayNumber}`
  const days = gw.workout_data.days ?? []
  const day = days.find((d) => d.dayNumber === dayNumber)
  return day?.dayName ?? `Ares Day ${dayNumber}`
}

// ── Helper: group logs by block_name within a type ────────────────────────────

function groupByBlock<T extends { block_name: string }>(
  logs: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const log of logs) {
    const existing = map.get(log.block_name) ?? []
    existing.push(log)
    map.set(log.block_name, existing)
  }
  return map
}

// ── Log type icon ──────────────────────────────────────────────────────────────

function LogTypeIcon({ type }: { type: SessionLog['log_type'] }) {
  switch (type) {
    case 'strength_set':
      return <Dumbbell size={13} className="text-muted-foreground shrink-0" />
    case 'build_to_max':
      return <Trophy size={13} className="text-yellow-400 shrink-0" />
    case 'skill_work':
      return <Wind size={13} className="text-sky-400 shrink-0" />
    case 'monostructural':
      return <Timer size={13} className="text-green-400 shrink-0" />
    case 'metcon':
      return <Zap size={13} className="text-brand shrink-0" />
  }
}

// ── Strength set summary ──────────────────────────────────────────────────────

function StrengthSetSummary({ logs }: { logs: SessionLog[] }) {
  const completed = logs.filter((l) => l.completed)
  if (completed.length === 0) return null

  const topSet = completed.reduce<SessionLog | null>((best, l) => {
    if (!best) return l
    const bVol = (best.weight_lbs ?? 0) * (best.reps ?? 0)
    const lVol = (l.weight_lbs ?? 0) * (l.reps ?? 0)
    return lVol > bVol ? l : best
  }, null)

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LogTypeIcon type="strength_set" />
      <span>
        <span className="text-foreground font-medium">{logs[0].block_name}</span>
        {' — '}
        {completed.length} set{completed.length !== 1 ? 's' : ''} logged
        {topSet && topSet.weight_lbs != null && topSet.reps != null && (
          <>, top set: <span className="text-foreground font-medium">{topSet.weight_lbs}lbs × {topSet.reps} reps</span></>
        )}
      </span>
    </div>
  )
}

// ── Build-to-max summary ──────────────────────────────────────────────────────

function BuildToMaxSummary({ logs }: { logs: SessionLog[] }) {
  const best = logs.reduce<SessionLog | null>((b, l) => {
    if (!b) return l
    return (l.peak_weight_lbs ?? 0) > (b.peak_weight_lbs ?? 0) ? l : b
  }, null)

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LogTypeIcon type="build_to_max" />
      <span>
        <span className="text-foreground font-medium">{logs[0].block_name}</span>
        {' — built to '}
        {best?.peak_weight_lbs != null ? (
          <span className="text-foreground font-medium">{best.peak_weight_lbs}lbs</span>
        ) : (
          <span className="italic">no weight recorded</span>
        )}
      </span>
    </div>
  )
}

// ── Skill work summary ────────────────────────────────────────────────────────

function SkillWorkSummary({ logs }: { logs: SessionLog[] }) {
  const total = logs.reduce((sum, l) => sum + (l.skill_duration_minutes ?? 0), 0)

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LogTypeIcon type="skill_work" />
      <span>
        <span className="text-foreground font-medium">{logs[0].block_name}</span>
        {total > 0 && (
          <> — <span className="text-foreground font-medium">{total} min</span></>
        )}
      </span>
    </div>
  )
}

// ── Monostructural summary ────────────────────────────────────────────────────

function MonostructuralSummary({ logs }: { logs: SessionLog[] }) {
  const log = logs[0]
  const hasDistance = log.distance_meters != null && log.distance_meters > 0
  const hasDuration = log.duration_seconds != null && log.duration_seconds > 0

  let detail = ''
  if (hasDistance && hasDuration) {
    detail = ` — ${log.distance_meters}m in ${formatTime(log.duration_seconds!)}`
  } else if (hasDuration) {
    detail = ` — ${formatTime(log.duration_seconds!)}`
  } else if (hasDistance) {
    detail = ` — ${log.distance_meters}m`
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LogTypeIcon type="monostructural" />
      <span>
        <span className="text-foreground font-medium">{log.block_name}</span>
        {detail}
      </span>
    </div>
  )
}

// ── MetCon result ─────────────────────────────────────────────────────────────

function MetconResult({ logs }: { logs: SessionLog[] }) {
  const log = logs[0]
  const isForTime =
    log.metcon_format === 'for_time' || log.metcon_format === 'for_time_with_cap'
  const isAmrap = log.metcon_format === 'amrap'

  return (
    <div className="mt-1 rounded-lg bg-brand/5 border border-brand/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LogTypeIcon type="metcon" />
          <span className="text-xs font-semibold text-brand uppercase tracking-wide">
            {log.block_name || 'MetCon'}
          </span>
        </div>
        {log.metcon_rx && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand border border-brand/40 rounded px-1.5 py-0.5">
            RX
          </span>
        )}
      </div>

      {isForTime && log.metcon_time_seconds != null && (
        <p className="mt-1.5 font-mono text-xl font-bold text-foreground tabular-nums">
          {formatTime(log.metcon_time_seconds)}
          {log.time_cap_hit && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(cap hit)</span>
          )}
        </p>
      )}

      {isAmrap && (
        <p className="mt-1.5 font-mono text-xl font-bold text-foreground tabular-nums">
          {log.metcon_rounds ?? 0} rds
          {log.metcon_partial_reps != null && log.metcon_partial_reps > 0 && (
            <span className="text-base font-semibold text-muted-foreground">
              {' '}+ {log.metcon_partial_reps} reps
            </span>
          )}
        </p>
      )}

      {!isForTime && !isAmrap && (
        <p className="mt-1 text-xs text-muted-foreground">
          {log.metcon_format ?? 'result logged'}
        </p>
      )}

      {log.notes && (
        <p className="mt-1 text-xs text-muted-foreground italic">{log.notes}</p>
      )}
    </div>
  )
}

// ── Day session card ──────────────────────────────────────────────────────────

interface DayCardProps {
  dayNumber: number
  dayName: string
  logs: SessionLog[]
}

function DayCard({ dayNumber, dayName, logs }: DayCardProps) {
  // Group by log_type then by block_name
  const strengthLogs = logs.filter((l) => l.log_type === 'strength_set')
  const buildLogs = logs.filter((l) => l.log_type === 'build_to_max')
  const skillLogs = logs.filter((l) => l.log_type === 'skill_work')
  const monoLogs = logs.filter((l) => l.log_type === 'monostructural')
  const metconLogs = logs.filter((l) => l.log_type === 'metcon')

  const strengthByBlock = groupByBlock(strengthLogs)
  const buildByBlock = groupByBlock(buildLogs)
  const skillByBlock = groupByBlock(skillLogs)
  const monoByBlock = groupByBlock(monoLogs)
  const metconByBlock = groupByBlock(metconLogs)

  return (
    <div className="ds-card rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
          Day {dayNumber}
        </span>
        <span className="text-sm font-semibold text-foreground">{dayName}</span>
      </div>

      <div className="space-y-2">
        {Array.from(strengthByBlock.entries()).map(([block, bLogs]) => (
          <StrengthSetSummary key={`s-${block}`} logs={bLogs} />
        ))}
        {Array.from(buildByBlock.entries()).map(([block, bLogs]) => (
          <BuildToMaxSummary key={`b-${block}`} logs={bLogs} />
        ))}
        {Array.from(skillByBlock.entries()).map(([block, bLogs]) => (
          <SkillWorkSummary key={`sk-${block}`} logs={bLogs} />
        ))}
        {Array.from(monoByBlock.entries()).map(([block, bLogs]) => (
          <MonostructuralSummary key={`m-${block}`} logs={bLogs} />
        ))}
        {Array.from(metconByBlock.entries()).map(([block, bLogs]) => (
          <MetconResult key={`mc-${block}`} logs={bLogs} />
        ))}
      </div>
    </div>
  )
}

// ── Week group ────────────────────────────────────────────────────────────────

interface WeekGroupProps {
  weekNumber: number
  isCurrentWeek: boolean
  dayEntries: Array<{ dayNumber: number; logs: SessionLog[] }>
  workouts: GeneratedWorkout[]
  defaultExpanded: boolean
}

function WeekGroup({
  weekNumber,
  isCurrentWeek,
  dayEntries,
  workouts,
  defaultExpanded,
}: WeekGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <motion.div variants={fadeUp} className="space-y-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 py-1"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-foreground">
            {formatAresWeek(weekNumber)}
          </span>
          {isCurrentWeek && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-background bg-brand px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
          <span className="text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">
            {dayEntries.length} day{dayEntries.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 pl-0.5">
          {dayEntries.map(({ dayNumber, logs }) => (
            <DayCard
              key={dayNumber}
              dayNumber={dayNumber}
              dayName={getDayName(workouts, weekNumber, dayNumber)}
              logs={logs}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AresHistoryPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([])

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      // 1. Fetch all session logs for this user
      const { data: logData, error: logErr } = await supabase
        .from('ares_session_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('week_number', { ascending: false })
        .order('day_number', { ascending: true })
        .order('created_at', { ascending: true })

      if (logErr) {
        console.error('Error fetching ares_session_logs:', logErr)
        setLoading(false)
        return
      }

      const allLogs: SessionLog[] = logData ?? []
      setLogs(allLogs)

      if (allLogs.length === 0) {
        setLoading(false)
        return
      }

      // 2. Get unique week numbers to fetch generated_workouts for context
      const uniqueWeekNumbers = Array.from(new Set(allLogs.map((l) => l.week_number)))

      const { data: workoutData, error: workoutErr } = await supabase
        .from('generated_workouts')
        .select('id, week_number, day_number, workout_data')
        .eq('program_slug', 'ares')
        .in('week_number', uniqueWeekNumbers)

      if (workoutErr) {
        console.error('Error fetching generated_workouts:', workoutErr)
      }

      setWorkouts((workoutData ?? []) as GeneratedWorkout[])
      setLoading(false)
    }

    load()
  }, [router, supabase])

  // ── Derive week → day → logs structure ────────────────────────────────────────

  const currentWeekNumber = getAresWeekNumber()

  // Build: weekNumber → dayNumber → SessionLog[]
  const weekMap = new Map<number, Map<number, SessionLog[]>>()
  for (const log of logs) {
    let dayMap = weekMap.get(log.week_number)
    if (!dayMap) {
      dayMap = new Map<number, SessionLog[]>()
      weekMap.set(log.week_number, dayMap)
    }
    const existing = dayMap.get(log.day_number) ?? []
    existing.push(log)
    dayMap.set(log.day_number, existing)
  }

  // Sorted week numbers descending
  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => b - a)

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center brand-pulse">
            <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-brand" />
            </div>
          </div>
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Loading history...
        </p>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Page */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest text-foreground leading-none">
            My Ares History
          </h1>
        </div>

        {/* Empty state */}
        {logs.length === 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col items-center justify-center py-20 px-4 text-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand/10 scale-150" />
              <div className="relative h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto">
                <Dumbbell size={28} className="text-brand" strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              No sessions logged yet. Complete an Ares workout to see your history here.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="space-y-6"
          >
            {sortedWeeks.map((weekNum) => {
              const dayMap = weekMap.get(weekNum)!
              const sortedDays = Array.from(dayMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([dayNumber, dayLogs]) => ({ dayNumber, logs: dayLogs }))

              return (
                <WeekGroup
                  key={weekNum}
                  weekNumber={weekNum}
                  isCurrentWeek={weekNum === currentWeekNumber}
                  dayEntries={sortedDays}
                  workouts={workouts}
                  defaultExpanded={weekNum === currentWeekNumber || weekNum === sortedWeeks[0]}
                />
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}
