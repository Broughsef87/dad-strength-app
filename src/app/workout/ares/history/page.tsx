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

// ── Log type badge ─────────────────────────────────────────────────────────────

function LogTypeBadge({ type }: { type: SessionLog['log_type'] }) {
  const config: Record<SessionLog['log_type'], { label: string; className: string }> = {
    strength_set: {
      label: 'Strength',
      className: 'bg-surface-2 text-muted-foreground border border-border',
    },
    metcon: {
      label: 'MetCon',
      className: 'bg-brand text-white',
    },
    build_to_max: {
      label: 'Build to Max',
      className: 'bg-[#1A1A1A] text-foreground border border-border',
    },
    skill_work: {
      label: 'Skill',
      className: 'bg-sky-950/60 text-sky-400 border border-sky-900/40',
    },
    monostructural: {
      label: 'Cardio',
      className: 'bg-green-950/60 text-green-400 border border-green-900/40',
    },
  }
  const { label, className } = config[type]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest ${className}`}>
      {label}
    </span>
  )
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
    <div className="flex items-start gap-2.5">
      <LogTypeIcon type="strength_set" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{logs[0].block_name}</span>
        <span className="text-xs text-muted-foreground">
          {' — '}{completed.length} set{completed.length !== 1 ? 's' : ''}
        </span>
        {topSet && topSet.weight_lbs != null && topSet.reps != null && (
          <span className="text-xs text-muted-foreground">
            {', top: '}
            <span className="stat-num text-foreground">
              {topSet.weight_lbs}
            </span>
            <span className="steel-label ml-0.5">lbs</span>
            <span className="text-muted-foreground"> × {topSet.reps}</span>
          </span>
        )}
      </div>
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
    <div className="flex items-start gap-2.5">
      <LogTypeIcon type="build_to_max" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{logs[0].block_name}</span>
        <span className="text-xs text-muted-foreground">{' — built to '}</span>
        {best?.peak_weight_lbs != null ? (
          <>
            <span className="stat-num text-foreground">{best.peak_weight_lbs}</span>
            <span className="steel-label ml-0.5">lbs</span>
          </>
        ) : (
          <span className="text-xs italic text-muted-foreground">no weight recorded</span>
        )}
      </div>
    </div>
  )
}

// ── Skill work summary ────────────────────────────────────────────────────────

function SkillWorkSummary({ logs }: { logs: SessionLog[] }) {
  const total = logs.reduce((sum, l) => sum + (l.skill_duration_minutes ?? 0), 0)

  return (
    <div className="flex items-start gap-2.5">
      <LogTypeIcon type="skill_work" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{logs[0].block_name}</span>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {' — '}
            <span className="stat-num text-foreground">{total}</span>
            <span className="steel-label ml-0.5">min</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Monostructural summary ────────────────────────────────────────────────────

function MonostructuralSummary({ logs }: { logs: SessionLog[] }) {
  const log = logs[0]
  const hasDistance = log.distance_meters != null && log.distance_meters > 0
  const hasDuration = log.duration_seconds != null && log.duration_seconds > 0

  return (
    <div className="flex items-start gap-2.5">
      <LogTypeIcon type="monostructural" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground">{log.block_name}</span>
        {hasDistance && hasDuration && (
          <span className="text-xs text-muted-foreground">
            {' — '}
            <span className="stat-num text-foreground">{log.distance_meters}</span>
            <span className="steel-label ml-0.5">m</span>
            {' in '}
            <span className="stat-num text-foreground">{formatTime(log.duration_seconds!)}</span>
          </span>
        )}
        {!hasDistance && hasDuration && (
          <span className="text-xs text-muted-foreground">
            {' — '}
            <span className="stat-num text-foreground">{formatTime(log.duration_seconds!)}</span>
          </span>
        )}
        {hasDistance && !hasDuration && (
          <span className="text-xs text-muted-foreground">
            {' — '}
            <span className="stat-num text-foreground">{log.distance_meters}</span>
            <span className="steel-label ml-0.5">m</span>
          </span>
        )}
      </div>
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
    <div className="mt-1 rounded-xl bg-brand/5 border border-brand/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-brand shrink-0" />
          <span className="steel-label text-brand">{log.block_name || 'MetCon'}</span>
        </div>
        {log.metcon_rx && (
          <span className="text-[9px] uppercase tracking-widest bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold border border-brand/30">
            RX
          </span>
        )}
      </div>

      {isForTime && log.metcon_time_seconds != null && (
        <div className="flex items-baseline gap-1.5">
          <span className="stat-num text-2xl text-brand">
            {formatTime(log.metcon_time_seconds)}
          </span>
          {log.time_cap_hit && (
            <span className="steel-label text-muted-foreground">cap hit</span>
          )}
        </div>
      )}

      {isAmrap && (
        <div className="flex items-baseline gap-1.5">
          <span className="stat-num text-2xl text-brand">
            {log.metcon_rounds ?? 0}
          </span>
          <span className="steel-label text-muted-foreground">rds</span>
          {log.metcon_partial_reps != null && log.metcon_partial_reps > 0 && (
            <>
              <span className="stat-num text-lg text-brand/70">+{log.metcon_partial_reps}</span>
              <span className="steel-label text-muted-foreground">reps</span>
            </>
          )}
        </div>
      )}

      {!isForTime && !isAmrap && (
        <p className="text-xs text-muted-foreground">{log.metcon_format ?? 'result logged'}</p>
      )}

      {log.notes && (
        <p className="mt-1.5 text-xs text-muted-foreground italic leading-relaxed">{log.notes}</p>
      )}
    </div>
  )
}

// ── Day session card ──────────────────────────────────────────────────────────

interface DayCardProps {
  dayNumber: number
  dayName: string
  logs: SessionLog[]
  date?: string
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

  // Collect unique log types for badge row
  const types = Array.from(
    new Set(logs.map((l) => l.log_type)),
  ) as SessionLog['log_type'][]

  // Derive date from first log
  const firstLog = logs[0]
  const logDate = firstLog
    ? new Date(firstLog.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="ds-card overflow-hidden mb-3">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl text-foreground leading-none">
            Day {dayNumber}
          </span>
          <span className="text-sm font-medium text-muted-foreground leading-none">
            {dayName}
          </span>
        </div>
        {logDate && <span className="steel-label shrink-0">{logDate}</span>}
      </div>

      {/* Badge row */}
      {types.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {types.map((t) => (
            <LogTypeBadge key={t} type={t} />
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border mx-4" />

      {/* Log summaries */}
      <div className="px-4 py-3 space-y-2.5">
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
    <motion.div variants={fadeUp} className="space-y-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 py-2"
      >
        <div className="flex items-center gap-2.5">
          <span className="steel-label text-foreground">
            {formatAresWeek(weekNumber)}
          </span>
          {isCurrentWeek && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-brand px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
          <span className="text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">
            {dayEntries.length} day{dayEntries.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={15} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="pt-1">
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-4xl text-foreground leading-none tracking-wide uppercase">
              IRON LOG
            </h1>
            <p className="steel-label mt-0.5">Your Ares History</p>
          </div>
        </div>

        {/* Empty state */}
        {logs.length === 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col items-center justify-center py-20 px-4 text-center gap-5"
          >
            <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto">
              <Dumbbell size={28} className="text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">No sessions logged yet</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Complete an Ares workout to see your history here.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="space-y-4"
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
