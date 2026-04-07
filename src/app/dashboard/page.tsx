'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlayCircle,
  Flame,
  Settings,
  ChevronRight,
  Dumbbell,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import BottomNav from '../../components/BottomNav'
import Logo from '../../components/Logo'
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
  const supabase = createClient()
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
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-[9px] uppercase tracking-[0.2em] font-display">Loading</p>
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
          <Logo className="w-8 h-8" />
          <span className="font-display text-lg tracking-[0.1em] uppercase text-foreground">
            Dad Strength
          </span>
        </div>
        <nav className="flex gap-8 text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
          <button className="text-brand font-semibold">HQ</button>
          <button onClick={() => router.push('/body')} className="hover:text-foreground transition-colors">Train</button>
          <button onClick={() => router.push('/history')} className="hover:text-foreground transition-colors">History</button>
          <button onClick={() => router.push('/profile')} className="hover:text-foreground transition-colors">Profile</button>
          <button onClick={handleSignOut} className="text-destructive/60 hover:text-destructive transition-colors">Sign Out</button>
        </nav>
      </header>

      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between px-5 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <Logo className="w-8 h-8" />
          <span className="font-display text-xl tracking-[0.08em] uppercase text-foreground">
            Dad Strength
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 text-[9px] font-display uppercase tracking-[0.16em] text-brand border border-brand/30 bg-brand/8 px-3 py-1.5 rounded-md hover:bg-brand/15 transition-colors"
            >
              <Zap size={10} /> Upgrade
            </button>
          )}
          <button
            onClick={() => router.push('/profile')}
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-brand/30 transition-colors"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-5 space-y-4">

        {/* Date + greeting */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-4xl text-foreground leading-none mt-1">
            Train Day.
            {streak > 0 && (
              <span className="text-brand ml-3 inline-flex items-center gap-1 text-2xl">
                <Flame size={18} className="inline" strokeWidth={1.5} />
                <span className="stat-num">{streak}</span>
              </span>
            )}
          </h1>
        </motion.div>

        <motion.div
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* First week checklist */}
          <motion.div variants={fadeUp} custom={-0.5}>
            <FirstWeekChecklist />
          </motion.div>

          {/* TODAY'S MISSION */}
          <motion.div variants={fadeUp} custom={0}>
            <div className="ds-card p-6 overflow-hidden">
              <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-4 font-display">
                <span className="w-1 h-1 bg-brand inline-block" />
                Active Protocol
              </span>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-3xl text-foreground leading-none mb-2">
                    {workout?.name || 'Load Program'}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {workout?.description || 'Deploy your first training protocol.'}
                  </p>
                </div>
                <Dumbbell size={28} className="text-muted-foreground/20 shrink-0 mt-1" strokeWidth={1} />
              </div>
              <div className="flex flex-col gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (activeProgram) {
                      if (activeProgram.slug?.startsWith('chronos')) {
                        router.push('/workout/squeeze')
                      } else {
                        const daysCount = activeProgram.daysCount || activeProgram.frequency || 3
                        const nextDay = getNextWorkoutDay(daysCount)
                        router.push(`/workout/program/${nextDay}`)
                      }
                    } else if (workout) {
                      router.push(`/workout/${workout.id}`)
                    } else {
                      router.push('/build')
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 rounded-md bg-brand px-6 py-3.5 text-sm font-semibold text-background hover:bg-brand/90 transition-all brand-glow uppercase tracking-[0.1em]"
                  style={{ borderRadius: '6px' }}
                >
                  <PlayCircle size={16} strokeWidth={2} />
                  {activeProgram || workout ? 'Start Training' : 'Choose Program'}
                </motion.button>
                {(activeProgram || workout) && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => router.push('/build')}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-[10px] text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.12em] border border-border hover:border-brand/30 font-semibold"
                    style={{ borderRadius: '6px' }}
                  >
                    <Settings size={11} /> Change Program
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {/* The Squeeze */}
          <motion.div variants={fadeUp} custom={0.5}>
            <button
              onClick={() => isPro ? router.push('/workout/squeeze') : setShowUpgrade(true)}
              className="w-full ds-card p-4 flex items-center justify-between group"
            >
              <div>
                <p className="text-[9px] font-display tracking-[0.14em] text-muted-foreground uppercase mb-0.5">Short on time?</p>
                <p className="font-display text-xl tracking-wide text-foreground leading-none">
                  Chronos
                  <span className="text-muted-foreground font-sans text-xs font-normal ml-2 tracking-normal">15–20 min</span>
                  {!isPro && <span className="ml-2 text-[8px] bg-brand/10 text-brand px-1.5 py-0.5 uppercase tracking-widest font-semibold font-sans" style={{ borderRadius: '3px' }}>Pro</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPro
                  ? <span className="text-[10px] text-muted-foreground">Any equipment</span>
                  : <Zap size={13} className="text-brand" strokeWidth={1.5} />
                }
                <ChevronRight className="w-4 h-4 text-brand group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
              </div>
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
