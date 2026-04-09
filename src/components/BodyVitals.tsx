'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Dumbbell, Flame, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getMondayOfWeek, getSundayOfWeek, toLocalDateString, calcStreak } from '../lib/utils'
import CircularProgress from './ui/CircularProgress'
import { useCountUp } from '../hooks/useCountUp'
import { motion } from 'framer-motion'
import { fadeUp } from './ui/motion'

const DEFAULT_WEEKLY_TARGET = 4

export default function BodyVitals() {
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [streak, setStreak] = useState(0)
  const [weeklyTarget, setWeeklyTarget] = useState(DEFAULT_WEEKLY_TARGET)
  const [workoutId, setWorkoutId] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    const load = async () => {
      if (!user) { setLoading(false); return }

      // Try to pull weekly target from user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('program_data')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.program_data?.frequency) {
        setWeeklyTarget(profile.program_data.frequency)
      }

      const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
      if (workouts && workouts.length > 0) setWorkoutId(workouts[0].id)

      const monday = getMondayOfWeek(new Date())
      const sunday = getSundayOfWeek(monday)

      const { data: weekLogs } = await supabase
        .from('workout_logs')
        .select('created_at, workout_id, generated_workout_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', monday.toISOString())
        .lte('created_at', sunday.toISOString())

      // Count unique sessions (date + workout_id combos) not individual set rows
      const uniqueSessions = new Set(
        (weekLogs || []).map((l: any) =>
          `${toLocalDateString(new Date(l.created_at))}__${l.workout_id ?? l.generated_workout_id ?? 'standalone'}`
        )
      )
      setSessionsThisWeek(uniqueSessions.size)

      const { data: allLogs } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      if (allLogs && allLogs.length > 0) {
        const localDates = allLogs.map((l: any) =>
          toLocalDateString(new Date(l.created_at))
        )
        setStreak(calcStreak(localDates))
      }

      setLoading(false)
    }
    load()
  }, [user, userLoading])

  const onTrack = sessionsThisWeek >= Math.floor(weeklyTarget * 0.5)
  const crushing = sessionsThisWeek >= weeklyTarget

  const streakDisplay = useCountUp(streak)
  const sessionsDisplay = useCountUp(sessionsThisWeek)

  const streakPercent = Math.min((streak / 7) * 100, 100)
  const sessionsPercent = Math.min((sessionsThisWeek / weeklyTarget) * 100, 100)

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border animate-pulse">
        <div className="h-3 bg-muted rounded w-1/2 mb-3" />
        <div className="h-7 bg-muted rounded w-1/3" />
      </div>
    )
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="ds-card p-5 cursor-pointer group active:scale-[0.98] transition-all duration-300 hover:border-brand/25"
      onClick={() => router.push(workoutId ? `/workout/${workoutId}` : '/body')}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand/10 rounded-lg text-brand">
            <Dumbbell size={16} strokeWidth={1.5} />
          </div>
          <h3 className="font-medium text-sm font-display tracking-[0.06em]">Body Vitals</h3>
        </div>
        <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      <div className="flex items-center justify-around mb-4 py-2">
        <div className="flex flex-col items-center gap-2">
          <CircularProgress
            value={streakPercent}
            size={80}
            strokeWidth={6}
            color="hsl(16 80% 54%)"
            trackColor="hsl(240 5% 16%)"
            label={`${streakDisplay}`}
            sublabel="days"
          />
          <div className="flex items-center gap-1 text-muted-foreground">
            <Flame size={10} strokeWidth={1.5} />
            <span className="text-[9px] uppercase tracking-[0.1em] font-medium font-display">Streak</span>
          </div>
        </div>

        <div className="w-px h-16 bg-border" />

        <div className="flex flex-col items-center gap-2">
          <CircularProgress
            value={sessionsPercent}
            size={80}
            strokeWidth={6}
            color={crushing ? 'hsl(142 76% 36%)' : onTrack ? 'hsl(48 96% 53%)' : 'hsl(16 80% 54%)'}
            trackColor="hsl(240 5% 16%)"
            label={`${sessionsDisplay}/${weeklyTarget}`}
            sublabel="sessions"
          />
          <div className="flex items-center gap-1 text-muted-foreground">
            <Dumbbell size={10} strokeWidth={1.5} />
            <span className="text-[9px] uppercase tracking-[0.1em] font-medium font-display">This Week</span>
          </div>
        </div>
      </div>

      {crushing ? (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2.5">
          <CheckCircle size={12} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-600 uppercase tracking-[0.1em] font-medium">
            Weekly target hit.
          </p>
        </div>
      ) : onTrack ? (
        <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg flex items-center gap-2.5">
          <Flame size={12} className="text-yellow-600 shrink-0" />
          <p className="text-xs text-yellow-600 uppercase tracking-[0.1em] font-medium">
            {weeklyTarget - sessionsThisWeek} session{weeklyTarget - sessionsThisWeek !== 1 ? 's' : ''} to go.
          </p>
        </div>
      ) : sessionsThisWeek === 0 ? (
        <div className="p-3 bg-brand/8 border border-brand/20 rounded-lg flex items-center gap-2.5">
          <Dumbbell size={12} className="text-brand shrink-0" />
          <p className="text-xs text-brand uppercase tracking-[0.1em] font-medium">
            The iron waits. First session starts the streak.
          </p>
        </div>
      ) : (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-lg flex items-center gap-2.5">
          <AlertTriangle size={12} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-500 uppercase tracking-[0.1em] font-medium">
            Behind on the week.
          </p>
        </div>
      )}
    </motion.div>
  )
}
