'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame,
  Settings,
  ChevronRight,
  Dumbbell,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
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
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-8 relative">
      <DailyForge />

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-brand text-background text-center text-[10px] font-display tracking-[0.2em] uppercase py-3 px-4"
        >
          Welcome to Dad Strong+ — All Features Unlocked
        </motion.div>
      )}

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-surface-2 px-8 py-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-0.5 h-7 bg-brand" />
          <span className="font-display text-xl tracking-[0.08em] uppercase text-foreground">Dad Strength</span>
        </div>
        <nav className="flex gap-8 text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
          <button className="text-brand font-semibold">HQ</button>
          <button onClick={() => router.push('/body')} className="hover:text-foreground transition-colors">Train</button>
          <button onClick={() => router.push('/history')} className="hover:text-foreground transition-colors">History</button>
          <button onClick={() => router.push('/profile')} className="hover:text-foreground transition-colors">Profile</button>
          <button onClick={handleSignOut} className="text-muted-foreground/50 hover:text-destructive transition-colors">Sign Out</button>
        </nav>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between px-5 pt-8 pb-4">
        <div>
          <p className="steel-label mb-0.5">Dad Strength</p>
          <h1 className="font-display text-2xl tracking-wide text-foreground leading-none">
            HEADQUARTERS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-[10px] font-semibold uppercase tracking-wider"
            >
              <Zap size={10} /> Pro
            </button>
          )}
          <button
            onClick={() => router.push('/profile')}
            className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-brand/30 transition-colors"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-5">

        {/* Date + greeting */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
          <div className="flex items-center justify-between">
            <p className="steel-label">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand/25 bg-brand/8">
                <Flame size={11} className="text-brand" strokeWidth={2} />
                <span className="stat-num text-xs text-brand font-semibold">{streak}</span>
                <span className="text-[9px] text-brand/70 uppercase tracking-wide">streak</span>
              </div>
            )}
          </div>
          <h2 className="font-display text-[3.5rem] leading-none mt-2 text-foreground tracking-wide">
            TRAIN DAY.
          </h2>
          <div className="divider-brand mt-3" />
        </motion.div>

        <motion.div
          className="space-y-5"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* First week checklist */}
          <motion.div variants={fadeUp} custom={-0.5}>
            <FirstWeekChecklist />
          </motion.div>

          {/* ACTIVE PROTOCOL */}
          <motion.div variants={fadeUp} custom={0}>
            <div className="ds-card p-6">
              {/* Header row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="steel-label mb-2">Active Protocol</p>
                  <h3 className="font-display text-[2.25rem] leading-none text-foreground tracking-wide">
                    {activeProgram?.name?.toUpperCase() || workout?.name?.toUpperCase() || 'NO PROGRAM'}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center">
                  <Dumbbell size={18} className="text-muted-foreground/40" strokeWidth={1.5} />
                </div>
              </div>

              {/* Program meta */}
              {activeProgram && (
                <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
                  {[
                    { label: 'Days', value: `${activeProgram.daysCount}/wk` },
                    { label: 'Week', value: `${activeProgram.currentWeek}` },
                    { label: 'Type', value: activeProgram.slug?.startsWith('ares') ? 'Functional' : 'Strength' },
                  ].map((item) => (
                    <div key={item.label} className="flex-1">
                      <p className="steel-label">{item.label}</p>
                      <p className="font-semibold text-sm text-foreground mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {!activeProgram && workout && (
                <p className="text-sm text-muted-foreground mb-5">{workout.description}</p>
              )}
              {!activeProgram && !workout && (
                <p className="text-sm text-muted-foreground mb-5">Deploy your first training protocol.</p>
              )}

              {/* CTA */}
              <div className="flex flex-col gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
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
                  }}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-brand text-white font-semibold text-sm uppercase tracking-[0.08em] hover:bg-brand/90 transition-colors group"
                >
                  <span>{activeProgram || workout ? 'Start Training' : 'Choose Program'}</span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
                {(activeProgram || workout) && (
                  <button
                    onClick={() => router.push('/build')}
                    className="w-full py-2.5 text-[11px] text-muted-foreground hover:text-foreground uppercase tracking-[0.1em] font-medium transition-colors"
                  >
                    Change Program
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* CHRONOS */}
          <motion.div variants={fadeUp} custom={0.5}>
            <button
              onClick={() => isPro ? router.push('/workout/squeeze') : setShowUpgrade(true)}
              className="w-full card-base p-4 flex items-center justify-between group hover:border-brand/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center shrink-0 group-hover:border-brand/30 transition-colors">
                  <Zap size={16} className="text-muted-foreground group-hover:text-brand transition-colors" strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <p className="steel-label mb-0.5">Short on Time?</p>
                  <p className="font-display text-xl tracking-wide text-foreground leading-none">
                    CHRONOS
                    {!isPro && <span className="ml-2 text-[9px] bg-brand/10 text-brand px-2 py-0.5 rounded-md uppercase tracking-widest font-sans font-semibold">Pro</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">15–20 min · Any equipment</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-brand group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2} />
            </button>
          </motion.div>

          {/* Daily Objectives */}
          <motion.div variants={fadeUp} custom={1}>
            <DailyObjectivesCard />
          </motion.div>

          {/* Dad Score */}
          <motion.div variants={fadeUp} custom={2}>
            <DadScore />
          </motion.div>

        </motion.div>
      </main>

      <BottomNav />

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  )
}
