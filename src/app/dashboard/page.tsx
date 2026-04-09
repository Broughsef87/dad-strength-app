'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Zap } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import DadScore from '../../components/DadScore'
import DailyObjectivesCard from '../../components/DailyObjectivesCard'
import DailyForge from '../../components/DailyForge'
import { useSubscription } from '../../contexts/SubscriptionContext'
import UpgradeModal from '../../components/UpgradeModal'
import FirstWeekChecklist from '../../components/FirstWeekChecklist'

function getCurrentWeekKey(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getNextWorkoutDay(daysCount: number): number {
  try {
    const weekKey = getCurrentWeekKey()
    const raw = localStorage.getItem(`dad-strength-week-progress-${weekKey}`)
    if (raw) {
      const progress = JSON.parse(raw)
      for (let i = 0; i < daysCount; i++) {
        if (progress[i] !== 'complete') return i + 1
      }
      // All days complete — start week fresh at Day 1
    }
  } catch {}
  return 1
}

export default function Dashboard() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const { isPro, loading: subLoading } = useSubscription()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [streak, setStreak] = useState(0)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('upgrade') === 'success') {
        setUpgradeSuccess(true)
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('dad-strength-active-program')
      if (raw) {
        const program = JSON.parse(raw)
        setActiveProgram(program)
      }
    }
  }, [])

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const onboardingLocal = typeof window !== 'undefined' ? localStorage.getItem('onboardingComplete') === 'true' : false
      const onboardingDB = profile?.onboarding_complete || false

      if (!onboardingLocal && !onboardingDB) { router.push('/onboarding'); return }

      if (onboardingLocal && !onboardingDB) {
        const localConfig = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('activeProgramConfig') || '{}') : {}
        await supabase.from('user_profiles').upsert({
          id: user.id,
          onboarding_complete: true,
          active_program_config: localConfig,
        }, { onConflict: 'id' })
      } else if (!profile) {
        await supabase.from('user_profiles').upsert({ id: user.id }, { onConflict: 'id' })
      }

      // Load active program from user_programs (Greek god system)
      const { data: dbProgram } = await supabase
        .from('user_programs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (dbProgram) {
        const programName = dbProgram.slug
          .replace(/-\d+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
        const programData = {
          slug: dbProgram.slug,
          name: programName,
          startedAt: dbProgram.started_at,
          currentWeek: dbProgram.current_week,
          daysCount: parseInt(dbProgram.slug.split('-').pop() ?? '4'),
          dayNames: [],
          trainingAge: dbProgram.preferences?.trainingAge ?? '',
          primaryGoal: dbProgram.preferences?.primaryGoal ?? '',
          equipment: dbProgram.equipment ?? {},
        }
        setActiveProgram(programData)
        if (typeof window !== 'undefined') {
          localStorage.setItem('dad-strength-active-program', JSON.stringify(programData))
        }
      }

      const activeWorkoutId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkoutId') : null
      let workoutData = null
      if (activeWorkoutId) {
        const { data } = await supabase.from('workouts').select('*').eq('id', activeWorkoutId).maybeSingle()
        workoutData = data
      }
      if (!workoutData) {
        const { data } = await supabase.from('workouts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        workoutData = data
        if (workoutData && typeof window !== 'undefined') localStorage.setItem('activeWorkoutId', workoutData.id)
      }
      setWorkout(workoutData)

      const { data: logDates } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('created_at', { ascending: false })

      const uniqueDays: string[] = Array.from(new Set((logDates || []).map((l: any) => new Date(l.created_at).toDateString())))
      let s = 0
      const today = new Date(); today.setHours(0, 0, 0, 0)
      for (let i = 0; i < uniqueDays.length; i++) {
        const d = new Date(uniqueDays[i]); d.setHours(0, 0, 0, 0)
        const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
        if (diff === i || (i === 0 && diff <= 1)) s++; else break
      }
      setStreak(s)
      setLoading(false)
    }
    loadDashboard()
  }, [router])

  const handleStart = () => {
    if (activeProgram) {
      if (activeProgram.slug?.startsWith('chronos')) router.push('/workout/squeeze')
      else if (activeProgram.slug?.startsWith('ares')) {
        const nextDay = getNextWorkoutDay(activeProgram.daysCount || 4)
        router.push(`/workout/ares/${nextDay}`)
      } else {
        const nextDay = getNextWorkoutDay(activeProgram.daysCount || activeProgram.frequency || 3)
        router.push(`/workout/program/${nextDay}`)
      }
    } else if (workout) {
      router.push(`/workout/${workout.id}`)
    } else {
      router.push('/build')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="steel-label">Loading</p>
        </div>
      </div>
    )
  }

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()

  const programLabel = activeProgram?.name?.toUpperCase() || workout?.name?.toUpperCase() || 'NO PROTOCOL'
  const weekFreqLabel = activeProgram
    ? `WEEK ${activeProgram.currentWeek ?? 1} · ${activeProgram.daysCount ?? '—'} DAYS/WK`
    : null

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <DailyForge />

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-brand text-background text-center text-[10px] font-display tracking-[0.2em] uppercase py-3 px-4">
          Welcome to Dad Strong+ — All Features Unlocked
        </div>
      )}

      {/* HEADER — ultra thin, no background */}
      <header className="flex items-center justify-between px-5 md:px-8 py-4">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground/50 uppercase">Dad Strength</span>
        <div className="flex items-center gap-3">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-[10px] font-semibold uppercase tracking-wider"
            >
              <Zap size={10} /> Pro
            </button>
          )}
          <button
            onClick={() => router.push('/profile')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* SINGLE RED RULE */}
      <div className="h-px bg-brand" />

      {/* HERO — day name + headline */}
      <section className="px-5 md:px-8 pt-10 pb-8">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground/40 uppercase mb-3">
          {dayName}
        </p>
        <h1 className="font-display text-[clamp(5rem,18vw,10rem)] leading-[0.85] text-foreground">
          TRAIN<br />DAY.
        </h1>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-border/30" />
          {streak > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/40 tracking-[0.2em]">{streak}D STREAK</span>
          )}
        </div>
      </section>

      {/* ACTIVE PROTOCOL */}
      <section className="border-t border-border/30 px-5 md:px-8 py-8">
        <p className="text-[9px] font-semibold tracking-[0.3em] text-muted-foreground/40 uppercase mb-4">Active Protocol</p>
        <h2 className="font-display text-[clamp(2.5rem,8vw,5rem)] leading-none text-foreground mb-1">
          {programLabel}
        </h2>
        {weekFreqLabel && (
          <p className="font-mono text-[11px] text-muted-foreground/50 tracking-[0.15em] uppercase mb-6">
            {weekFreqLabel}
          </p>
        )}
        {!weekFreqLabel && (
          <p className="font-mono text-[11px] text-muted-foreground/50 tracking-[0.15em] uppercase mb-6">
            {activeProgram || workout ? '' : 'DEPLOY YOUR FIRST PROTOCOL'}
          </p>
        )}
        <div className="h-px bg-border/30 mb-6" />
        {/* BEGIN button */}
        <button onClick={handleStart} className="group flex items-center gap-4 hover:opacity-70 transition-opacity">
          <div className="w-0.5 h-10 bg-brand" />
          <span className="font-display text-3xl tracking-[0.08em] text-foreground">BEGIN</span>
          <span className="font-mono text-sm text-muted-foreground/40 group-hover:text-brand transition-colors">→</span>
        </button>
        {(activeProgram || workout) && (
          <button
            onClick={() => router.push('/build')}
            className="mt-4 ml-4 text-[9px] tracking-[0.2em] text-muted-foreground/30 uppercase hover:text-muted-foreground/60 transition-colors"
          >
            Change Protocol
          </button>
        )}
      </section>

      {/* CHRONOS */}
      <section className="border-t border-border/30 px-5 md:px-8 py-6">
        <button
          onClick={() => isPro ? router.push('/workout/squeeze') : setShowUpgrade(true)}
          className="group flex items-center justify-between w-full hover:opacity-70 transition-opacity"
        >
          <div>
            <p className="text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase mb-1">Short on time?</p>
            <p className="font-display text-2xl text-foreground tracking-wide">
              CHRONOS
              {!isPro && (
                <span className="ml-2 text-[9px] text-brand/60 font-sans font-semibold uppercase tracking-widest">Pro</span>
              )}
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground/30">→</span>
        </button>
      </section>

      {/* FIRST WEEK CHECKLIST */}
      <section className="border-t border-border/30 px-5 md:px-8 py-6">
        <FirstWeekChecklist />
      </section>

      {/* DAILY OBJECTIVES */}
      <section className="border-t border-border/30 px-5 md:px-8 py-6">
        <DailyObjectivesCard />
      </section>

      {/* DAD SCORE */}
      <section className="border-t border-border/30 px-5 md:px-8 py-8 pb-4">
        <DadScore />
      </section>

      <BottomNav />

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  )
}
