'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dumbbell, ChevronDown, ChevronUp, CheckCircle2, Clock,
  PlayCircle, RefreshCcw, RotateCcw, Zap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'

interface ActiveProgramData {
  slug: string
  name: string
  startedAt: string
  currentWeek: number
  trainingAge: string
  primaryGoal: string
  equipment: Record<string, boolean>
  daysCount: number
  dayNames: string[]
}

type DayStatus = 'not_started' | 'in_progress' | 'complete'

interface WeekProgress {
  [dayIndex: number]: DayStatus
}

function getNextWorkoutDay(daysCount: number, weekKey: string, progress: WeekProgress): number {
  for (let i = 0; i < daysCount; i++) {
    if (progress[i] !== 'complete') return i + 1
  }
  return 1 // all done — loop back
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekKey(date: Date): string {
  const monday = getMondayOfWeek(date)
  return monday.toISOString().split('T')[0]
}

function loadWeekProgress(weekKey: string): WeekProgress {
  try {
    const raw = localStorage.getItem(`dad-strength-week-progress-${weekKey}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveWeekProgress(weekKey: string, progress: WeekProgress) {
  localStorage.setItem(`dad-strength-week-progress-${weekKey}`, JSON.stringify(progress))
}

const STATUS_CONFIG: Record<DayStatus, { label: string; color: string; Icon: React.ElementType }> = {
  not_started: { label: 'Not started', color: 'text-muted-foreground', Icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-brand', Icon: PlayCircle },
  complete: { label: 'Complete', color: 'text-green-500', Icon: CheckCircle2 },
}

export default function ActiveProgram() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [program, setProgram] = useState<ActiveProgramData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [weekKey, setWeekKey] = useState('')
  const [weekProgress, setWeekProgress] = useState<WeekProgress>({})

  const loadProgram = useCallback(async () => {
    // Try Supabase first if user is logged in
    if (user) {
      const { data: dbProgram } = await supabase
        .from('user_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (dbProgram) {
        const data: ActiveProgramData = {
          slug: dbProgram.slug,
          name: dbProgram.slug.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          startedAt: dbProgram.started_at,
          currentWeek: dbProgram.current_week,
          trainingAge: dbProgram.preferences?.trainingAge ?? '',
          primaryGoal: dbProgram.preferences?.primaryGoal ?? '',
          equipment: dbProgram.equipment ?? {},
          daysCount: parseInt(dbProgram.slug.split('-').pop() ?? '5'),
          dayNames: [],
        }
        // Sync to localStorage
        localStorage.setItem('dad-strength-active-program', JSON.stringify(data))
        setProgram(data)
        const key = getWeekKey(new Date())
        setWeekKey(key)
        setWeekProgress(loadWeekProgress(key))
        setLoaded(true)
        return
      }
    }
    // Fall back to localStorage
    try {
      const raw = localStorage.getItem('dad-strength-active-program')
      if (raw) {
        const data = JSON.parse(raw) as ActiveProgramData
        setProgram(data)
        const key = getWeekKey(new Date())
        setWeekKey(key)
        setWeekProgress(loadWeekProgress(key))
      } else {
        setProgram(null)
      }
    } catch {
      setProgram(null)
    }
    setLoaded(true)
  }, [user])

  useEffect(() => {
    loadProgram()
  }, [loadProgram])

  const cycleStatus = (dayIndex: number) => {
    const current = weekProgress[dayIndex] ?? 'not_started'
    const next: DayStatus =
      current === 'not_started' ? 'in_progress' :
      current === 'in_progress' ? 'complete' :
      'not_started'
    const newProgress = { ...weekProgress, [dayIndex]: next }
    setWeekProgress(newProgress)
    saveWeekProgress(weekKey, newProgress)

    // When all days are marked complete, increment current_week
    if (next === 'complete' && program) {
      const allDone = Object.values(newProgress).filter(v => v === 'complete').length === program.daysCount
      if (allDone && user) {
        const newWeek = (program.currentWeek || 1) + 1
        // Update localStorage
        const updated = { ...program, currentWeek: newWeek }
        localStorage.setItem('dad-strength-active-program', JSON.stringify(updated))
        setProgram(updated)
        // Update Supabase
        supabase.from('user_programs')
          .update({ current_week: newWeek })
          .eq('user_id', user.id)
          .eq('status', 'active')
          .then(({ error }: { error: unknown }) => { if (error) console.error(error) })
      }
    }
  }

  const completedCount = Object.values(weekProgress).filter(s => s === 'complete').length
  const inProgressCount = Object.values(weekProgress).filter(s => s === 'in_progress').length
  const totalDays = program?.daysCount ?? 5
  const progressPercent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0

  // Not loaded yet — skeleton
  if (!loaded) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-border/50 animate-pulse">
        <div className="h-3 bg-muted rounded w-2/3 mb-3" />
        <div className="h-6 bg-muted rounded w-1/2" />
      </div>
    )
  }

  // No program — route to build page
  if (!program) {
    return (
      <div className="glass-card rounded-2xl border border-border/50 p-6 text-center space-y-4">
        <div className="p-3 bg-brand/10 rounded-xl w-fit mx-auto">
          <Dumbbell size={24} className="text-brand" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-black text-base uppercase italic tracking-tight mb-1">No Program Active</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Choose your god and build your program.
          </p>
        </div>
        <button
          onClick={() => router.push('/build')}
          className="w-full bg-brand hover:bg-brand/90 text-foreground font-black py-3 rounded-xl uppercase tracking-widest text-sm transition-all active:scale-95"
        >
          Build My Program
        </button>
      </div>
    )
  }

  const isChronos = program.slug?.startsWith('chronos')
  const isAres = program.slug?.startsWith('ares')
  const workoutRoute = (day: number) =>
    isChronos ? '/workout/squeeze' : isAres ? `/workout/ares/${day}` : `/workout/program/${day}`
  const dayNames = program.dayNames ?? Array.from({ length: totalDays }, (_, i) => `Day ${i + 1}`)

  return (
    <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
      {/* Brand accent top bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-brand/60 via-brand to-brand/60" />

      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-brand/10 rounded-xl text-brand flex-shrink-0">
            <Dumbbell size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 font-display">
              Active Program
            </p>
            <h3 className="font-black text-base uppercase italic tracking-[0.06em] leading-tight truncate font-display">
              {program.name.replace(/\s+[35]$/, '')}
              <span className="text-muted-foreground font-medium normal-case italic text-sm">
                {' '}— Week {program.currentWeek}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Mini progress pill */}
          <span className="text-[10px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 rounded-full px-2.5 py-1 hidden sm:inline">
            {completedCount}/{totalDays}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Week progress bar (always visible) */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase tracking-widest font-medium text-muted-foreground font-display">
            Week {program.currentWeek} Progress
          </span>
          <span className="text-[9px] font-black text-brand">{completedCount}/{totalDays} days</span>
        </div>
        <div className="w-full h-1.5 bg-card rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
      </div>

      {/* Collapsed summary */}
      {!expanded && (
        <div className="px-5 pb-4">
          <p className="text-xs text-muted-foreground font-medium">
            {completedCount === totalDays
              ? 'Week complete. Great work.'
              : inProgressCount > 0
              ? `${inProgressCount} session${inProgressCount !== 1 ? 's' : ''} in progress`
              : completedCount > 0
              ? `${completedCount} of ${totalDays} sessions done`
              : 'No sessions started yet this week.'}
          </p>
        </div>
      )}

      {/* Expanded: day cards */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-2 space-y-2">
              {dayNames.map((dayName, i) => {
                const status: DayStatus = weekProgress[i] ?? 'not_started'
                const { label, color, Icon: StatusIcon } = STATUS_CONFIG[status]
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      status === 'complete'
                        ? 'bg-green-500/5 border-green-500/20'
                        : status === 'in_progress'
                        ? 'bg-brand/5 border-brand/20'
                        : 'bg-card/40 border-border/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-widest flex-shrink-0 w-6 text-center ${
                        status === 'complete' ? 'text-green-500' : 'text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <p className={`text-xs font-bold truncate ${
                        status === 'complete' ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}>
                        {dayName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider hidden sm:flex ${color}`}>
                        <StatusIcon size={9} strokeWidth={2.5} />
                        {label}
                      </span>
                      {/* Navigate to workout — always available for all statuses */}
                      <button
                        onClick={() => router.push(workoutRoute(i + 1))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                          status === 'complete'
                            ? 'bg-green-500/15 text-green-500 border border-green-500/30 hover:bg-green-500/25'
                            : status === 'in_progress'
                            ? 'bg-brand text-foreground border border-brand hover:bg-brand/90'
                            : 'bg-brand/10 text-brand border border-brand/25 hover:bg-brand hover:text-foreground'
                        }`}
                      >
                        {status === 'complete' ? (
                          <><CheckCircle2 size={9} strokeWidth={2.5} /> Edit</>
                        ) : status === 'in_progress' ? (
                          <><PlayCircle size={9} strokeWidth={2.5} /> Resume</>
                        ) : (
                          <><PlayCircle size={9} strokeWidth={2.5} /> Start</>
                        )}
                      </button>
                      {/* Manual status reset — only shown for in-progress or complete */}
                      {status !== 'not_started' && (
                        <button
                          onClick={() => cycleStatus(i)}
                          title="Reset status"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <RotateCcw size={11} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Start Training CTA */}
            <div className="px-5 pt-3 pb-1">
              <button
                onClick={() => {
                  if (!program) return
                  const nextDay = getNextWorkoutDay(program.daysCount, weekKey, weekProgress)
                  router.push(workoutRoute(nextDay))
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-md bg-brand text-background text-sm font-semibold uppercase tracking-[0.1em] active:scale-95 brand-glow transition-all hover:bg-brand/90"
              >
                <Zap size={14} strokeWidth={2} />
                {completedCount === totalDays ? 'Start Next Week' : completedCount > 0 ? 'Continue Training' : 'Start Training'}
              </button>
            </div>

            {/* Stats row */}
            <div className="px-5 py-4 border-t border-border/30 mt-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-black text-brand leading-none font-display">{completedCount}</p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mt-0.5 font-display">Done</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-foreground leading-none font-display">{totalDays - completedCount}</p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mt-0.5 font-display">Left</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-foreground leading-none font-display">{program.currentWeek}</p>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mt-0.5 font-display">Week</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/build')}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCcw size={10} strokeWidth={2} />
                Change Program
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
