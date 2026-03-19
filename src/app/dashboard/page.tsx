'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlayCircle,
  Flame,
  Trophy,
  Dumbbell,
  Settings
} from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import Leaderboard from '../../components/Leaderboard'
import EmpireWidget from '../../components/EmpireWidget'
import DailyQuote from '../../components/DailyQuote'
import MorningProtocol from '../../components/MorningProtocol'
import MindVitals from '../../components/MindVitals'
import SpiritVitals from '../../components/SpiritVitals'
import AutomationHook from '../../components/AutomationHook'
import BodyVitals from '../../components/BodyVitals'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [stats, setStats] = useState({ streak: 0, totalWorkouts: 0, lastPR: 'None yet' })

  // Mind Vitals State
  const [deepWorkMinutes, setDeepWorkMinutes] = useState(0)
  const [completedObjectives, setCompletedObjectives] = useState(0)
  const [totalObjectives, setTotalObjectives] = useState(0)

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const onboardingCompleteLocal = typeof window !== 'undefined' ? localStorage.getItem('onboardingComplete') === 'true' : false
      const onboardingCompleteDB = profile?.onboarding_complete || false

      if (!onboardingCompleteLocal && !onboardingCompleteDB) {
        router.push('/onboarding')
        return
      }

      if (onboardingCompleteLocal && !onboardingCompleteDB) {
        const localConfig = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('activeProgramConfig') || '{}') : {}
        await supabase.from('user_profiles').upsert({
          id: user.id,
          onboarding_complete: true,
          active_program_config: localConfig
        }, { onConflict: 'id' })
      } else if (!profile) {
        await supabase.from('user_profiles').upsert({ id: user.id }, { onConflict: 'id' })
      }

      const activeWorkoutId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkoutId') : null
      let workoutData = null
      if (activeWorkoutId) {
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .eq('id', activeWorkoutId)
          .maybeSingle()
        workoutData = data
      }

      if (!workoutData) {
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        workoutData = data
        if (workoutData && typeof window !== 'undefined') {
          localStorage.setItem('activeWorkoutId', workoutData.id)
        }
      }
      setWorkout(workoutData)

      const { data: logDates } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      const uniqueDays = Array.from(
        new Set((logDates || []).map((l: any) => new Date(l.created_at).toDateString()))
      )

      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = 0; i < uniqueDays.length; i++) {
        const dayDate = new Date(uniqueDays[i])
        dayDate.setHours(0, 0, 0, 0)
        const diffDays = Math.round((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === i || (i === 0 && diffDays <= 1)) {
          streak++
        } else {
          break
        }
      }

      const { data: prData } = await supabase
        .from('workout_logs')
        .select('exercise_name, weight_lbs')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('weight_lbs', { ascending: false })
        .limit(1)
        .maybeSingle()

      setStats({
        streak,
        totalWorkouts: uniqueDays.length,
        lastPR: prData ? `${prData.exercise_name} ${prData.weight_lbs}lbs` : 'None yet'
      })

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      const { data: deepWorkSessions } = await supabase
        .from('deep_work_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      const totalMins = (deepWorkSessions || []).reduce((acc, session) => acc + (session.duration_minutes || 0), 0)
      setDeepWorkMinutes(totalMins)

      const { data: objectivesData } = await supabase
        .from('daily_objectives')
        .select('completed')
        .eq('user_id', user.id)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      if (objectivesData) {
        setTotalObjectives(objectivesData.length)
        setCompletedObjectives(objectivesData.filter(o => o.completed).length)
      }

      setLoading(false)
    }
    loadDashboard()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin opacity-30" />
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-8">

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-background/90 px-8 py-4 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background font-semibold text-xs">D</span>
          </div>
          <span className="font-light text-base tracking-tight">
            Dad Strength <span className="text-muted-foreground">/ Forge OS</span>
          </span>
        </div>
        <nav className="flex gap-8 text-xs text-muted-foreground uppercase tracking-[0.12em]">
          <button className="text-foreground font-medium">HQ</button>
          <button onClick={() => router.push('/body')} className="hover:text-foreground transition-colors">Train</button>
          <button onClick={() => router.push('/history')} className="hover:text-foreground transition-colors">History</button>
          <button onClick={() => router.push('/profile')} className="hover:text-foreground transition-colors">Profile</button>
          <button onClick={handleSignOut} className="text-red-500/60 hover:text-red-500 transition-colors">Sign Out</button>
        </nav>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background font-semibold text-sm">D</span>
          </div>
          <span className="font-light text-base tracking-tight">Dad Strength</span>
        </div>
        <button onClick={() => router.push('/profile')} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <Settings size={16} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-3 space-y-6 order-3 lg:order-1">
          <EmpireWidget />
          <AutomationHook />
          <BodyVitals />
          <MindVitals
            deepWorkMinutes={deepWorkMinutes}
            completedObjectives={completedObjectives}
            totalObjectives={totalObjectives}
          />
          <SpiritVitals />
        </div>

        {/* CENTER COLUMN */}
        <div className="lg:col-span-6 space-y-6 order-2 lg:order-2">

          {/* ACTIVE WORKOUT CARD */}
          <div className="rounded-xl bg-foreground p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 opacity-5">
              <Dumbbell size={80} />
            </div>

            <div className="relative z-10 mb-6">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-background/50 font-medium mb-3">
                <span className="w-1 h-1 rounded-full bg-brand inline-block" />
                Active Protocol
              </span>
              <h2 className="text-2xl font-light text-background leading-tight tracking-tight">
                {workout?.name || 'Load Program'}
              </h2>
              <p className="text-background/50 text-sm mt-1.5 font-light">
                {workout?.description || 'Access the training library to deploy your first protocol.'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 relative z-10">
              <button
                onClick={() => workout ? router.push(`/workout/${workout.id}`) : router.push('/body')}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-background px-6 py-3.5 text-sm font-medium text-foreground hover:bg-background/90 transition-all active:scale-[0.98]"
              >
                <PlayCircle size={18} />
                {workout ? 'Start Training' : 'Browse Programs'}
              </button>

              <button
                onClick={() => router.push('/edit-program')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-6 py-2.5 text-xs text-background/60 hover:bg-white/10 hover:text-background/80 transition-all uppercase tracking-[0.1em]"
              >
                <Settings size={12} />
                Change Program
              </button>
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-card border border-border p-5 hover:border-foreground/20 transition-colors">
              <div className="flex items-center gap-2 mb-3 text-brand">
                <Flame size={14} />
                <p className="text-[10px] uppercase tracking-[0.15em] font-medium">Streak</p>
              </div>
              <p className="text-2xl font-light tabular-nums">{stats.streak} <span className="text-sm text-muted-foreground">days</span></p>
            </div>
            <div className="rounded-xl bg-card border border-border p-5 hover:border-foreground/20 transition-colors">
              <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                <Trophy size={14} />
                <p className="text-[10px] uppercase tracking-[0.15em] font-medium">Top Lift</p>
              </div>
              <p className="text-sm font-medium truncate leading-relaxed">{stats.lastPR}</p>
            </div>
          </div>

          <Leaderboard />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-3 space-y-6 order-1 lg:order-3">
          <MorningProtocol />
          <DailyQuote />
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
