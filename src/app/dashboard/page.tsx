'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Zap, Flame, ChevronRight } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <DailyForge />

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-brand text-white text-center text-[10px] font-semibold tracking-[0.2em] uppercase py-3 px-4">
          Welcome to Dad Strong+ — All Features Unlocked
        </div>
      )}

      {/* HEADER */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4 md:pt-6 md:px-8">
        <div>
          <p className="text-[11px] text-muted-foreground font-medium tracking-wide">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">Good morning</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand text-white text-[11px] font-semibold"
            >
              Upgrade
            </button>
          )}
          <button
            onClick={() => router.push('/profile')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
          >
            <Settings size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      <main className="px-5 md:px-8 space-y-5 max-w-lg mx-auto md:max-w-2xl">

        {/* ACTIVE PROGRAM CARD — hero */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="section-label mt-0">Active Protocol</p>
              <h2 className="text-xl font-bold text-foreground leading-tight mt-1">
                {activeProgram?.name || workout?.name || 'No Program'}
              </h2>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-full">
                <Flame size={12} className="text-brand" />
                <span className="text-[12px] font-bold text-brand">{streak}</span>
              </div>
            )}
          </div>

          {/* Metadata rows */}
          {activeProgram && (
            <div className="border-t border-border">
              <div className="data-row">
                <span className="text-sm text-muted-foreground">Week</span>
                <span className="text-sm font-semibold text-foreground">{activeProgram.currentWeek}</span>
              </div>
              <div className="data-row">
                <span className="text-sm text-muted-foreground">Frequency</span>
                <span className="text-sm font-semibold text-foreground">{activeProgram.daysCount} days / week</span>
              </div>
              <div className="data-row">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="text-sm font-semibold text-foreground">
                  {activeProgram.slug?.startsWith('ares') ? 'Functional' : 'Strength'}
                </span>
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleStart}
            className="w-full mt-4 py-3.5 rounded-xl bg-brand text-white font-semibold text-[15px] flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors"
          >
            {activeProgram || workout ? 'Begin Session' : 'Choose Program'}
            <ChevronRight size={18} />
          </button>

          {(activeProgram || workout) && (
            <button
              onClick={() => router.push('/build')}
              className="w-full mt-2 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Change Program
            </button>
          )}
        </div>

        {/* CHRONOS */}
        <button
          onClick={() => isPro ? router.push('/workout/squeeze') : setShowUpgrade(true)}
          className="w-full bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:border-brand/30 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Zap size={18} className="text-brand" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">Chronos</p>
              <p className="text-[12px] text-muted-foreground">15–20 min · Any equipment</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground group-hover:text-brand transition-colors" />
        </button>

        {/* FIRST WEEK CHECKLIST */}
        <FirstWeekChecklist />

        {/* DAILY OBJECTIVES */}
        <DailyObjectivesCard />

        {/* DAD SCORE */}
        <DadScore />

      </main>

      <BottomNav />
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
