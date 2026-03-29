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
  BatteryLow,
  Moon,
  Footprints,
  Zap,
  Sun,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import BottomNav from '../../components/BottomNav'
import ProgramSelector from '../../components/ProgramSelector'
import Logo from '../../components/Logo'
import DadScore from '../../components/DadScore'
import DailyObjectivesCard from '../../components/DailyObjectivesCard'
import DailyForge from '../../components/DailyForge'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradeModal from '../../components/UpgradeModal'
import FirstWeekChecklist from '../../components/FirstWeekChecklist'

// Determines whether today is a training day based on program frequency
function isTodayTrainingDay(frequency: number): boolean {
  const dayOfWeek = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
  if (frequency >= 5) {
    // Mon–Fri
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }
  if (frequency === 4) {
    // Mon/Tue/Thu/Fri
    return [1, 2, 4, 5].includes(dayOfWeek)
  }
  // 3 days: Mon/Wed/Fri
  return [1, 3, 5].includes(dayOfWeek)
}

const REST_DAY_TIPS = [
  { icon: Moon, title: 'Prioritize Sleep', body: 'Aim for 7–9 hrs. Recovery happens when you rest, not when you grind.' },
  { icon: Footprints, title: 'Active Recovery', body: '20-min walk with your kids. Movement without intensity.' },
  { icon: BatteryLow, title: 'Mobility Work', body: 'Spend 10 mins on hips and thoracic spine. Your future self thanks you.' },
]

function RestDayCard() {
  const tip = REST_DAY_TIPS[new Date().getDay() % REST_DAY_TIPS.length]
  const Icon = tip.icon
  return (
    <div className="relative rounded-xl bg-card border border-border p-6 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/3 rounded-full blur-3xl -mr-10 -mt-10" />
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-3 font-display">
        <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />
        Rest Day
      </span>
      <div className="flex items-start gap-4">
        <div className="p-3 bg-brand/10 rounded-xl shrink-0">
          <Icon size={20} className="text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-tight leading-none mb-1">{tip.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{tip.body}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50 italic">
        "Strong dads raise strong kids." — rest is part of the protocol.
      </p>
    </div>
  )
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const { isPro, loading: subLoading } = useSubscription()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [showProgramSelector, setShowProgramSelector] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [streak, setStreak] = useState(0)
  const [isTrainingDay, setIsTrainingDay] = useState(true)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  useEffect(() => {
    // Check for post-upgrade redirect
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
        setIsTrainingDay(isTodayTrainingDay(program.frequency || 3))
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

      // Load active workout
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

      // Streak
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
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin opacity-30" />
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Loading...</p>
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
          className="fixed top-0 left-0 right-0 z-50 bg-brand text-foreground text-center text-xs font-black uppercase tracking-widest py-3 px-4"
        >
          ⚡ Welcome to Dad Strong+ — all features unlocked.
        </motion.div>
      )}

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-[30%] -right-[15%] w-[60vw] h-[60vw] rounded-full bg-brand/6 blur-[120px]" />
        <div className="absolute top-[60%] -left-[10%] w-[40vw] h-[40vw] rounded-full bg-brand/3 blur-[100px]" />
      </div>

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-background/90 px-8 py-4 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Logo className="w-9 h-9" />
          <span className="font-black text-base tracking-[0.08em] uppercase text-foreground" style={{ fontFamily: 'var(--font-orbitron, "Arial Black", sans-serif)' }}>
            Dad Strength
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
          <Logo className="w-9 h-9" />
          <div className="flex flex-col leading-none">
            <span className="font-black text-base tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--font-orbitron, "Arial Black", sans-serif)' }}>
              Dad Strength
            </span>
            <span className="text-[9px] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">
              by Forge OS
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand border border-brand/30 bg-brand/5 px-3 py-1.5 rounded-full hover:bg-brand/10 transition-colors"
            >
              <Zap size={10} /> Upgrade
            </button>
          )}
          <button onClick={() => router.push('/profile')} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 pt-6 space-y-5">

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-black italic uppercase tracking-tight mt-0.5 leading-none">
            {isTrainingDay ? "Train Day." : "Rest Day."}
            {streak > 0 && (
              <span className="text-brand ml-2 inline-flex items-center gap-1 text-lg">
                <Flame size={16} className="inline" /> {streak}
              </span>
            )}
          </h1>
        </motion.div>

        <motion.div
          className="space-y-5"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >

          {/* FIRST WEEK CHECKLIST — shown until complete or dismissed */}
          <motion.div variants={fadeUp} custom={-0.5}>
            <FirstWeekChecklist />
          </motion.div>

          {/* CARD 1: TODAY'S MISSION */}
          <motion.div variants={fadeUp} custom={0}>
            {isTrainingDay ? (
              // Training day — active workout card
              <div className="relative group">
                <div className="absolute inset-0 rounded-xl bg-brand/25 blur-3xl scale-95 translate-y-3 transition-all duration-500 group-hover:scale-100 group-hover:blur-2xl" />
                <div className="relative rounded-xl bg-foreground p-6 overflow-hidden">
                  <div className="absolute top-4 right-4 opacity-5">
                    <Dumbbell size={80} />
                  </div>
                  <div className="relative z-10 mb-5">
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-background/50 font-medium mb-3 font-display">
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
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (activeProgram) router.push('/workout/program/1')
                        else if (workout) router.push(`/workout/${workout.id}`)
                        else setShowProgramSelector(true)
                      }}
                      className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-background px-6 py-3.5 text-sm font-medium text-foreground hover:bg-background/90 transition-all active:scale-[0.98]"
                    >
                      <PlayCircle size={18} />
                      {activeProgram || workout ? 'Start Training' : 'Choose Program'}
                    </motion.button>
                    {workout && (
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowProgramSelector(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-6 py-2.5 text-xs text-background/60 hover:bg-white/10 hover:text-background/80 transition-all uppercase tracking-[0.1em]"
                      >
                        <Settings size={12} /> Change Program
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Rest day card
              <RestDayCard />
            )}
          </motion.div>

          {/* The Squeeze — always visible, gated for free users after 3 sessions */}
          <motion.div variants={fadeUp} custom={0.5}>
            <button
              onClick={() => {
                if (isPro) {
                  router.push('/workout/squeeze')
                } else {
                  setShowUpgrade(true)
                }
              }}
              className="w-full glass-card p-4 flex items-center justify-between group rounded-xl"
            >
              <div>
                <p className="text-xs font-display tracking-[0.1em] text-text-muted uppercase">Short on time?</p>
                <p className="font-display text-sm tracking-wide text-text-primary mt-0.5">
                  The Squeeze
                  <span className="text-muted-foreground font-normal ml-1.5 text-xs">18-min workout</span>
                  {!isPro && <span className="ml-2 text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">Pro</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPro
                  ? <span className="text-xs text-muted-foreground">Any equipment</span>
                  : <Zap size={14} className="text-brand" />
                }
                <ChevronRight className="w-4 h-4 text-brand group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </motion.div>

          {/* CARD 2: DAILY OBJECTIVES */}
          <motion.div variants={fadeUp} custom={1}>
            <DailyObjectivesCard />
          </motion.div>

          {/* MORNING PROTOCOL SHORTCUT */}
          <motion.div variants={fadeUp} custom={1.5}>
            <button
              onClick={() => router.push('/mind')}
              className="w-full glass-card p-4 flex items-center justify-between group rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                  <Sun size={16} className="text-brand" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-display tracking-[0.1em] text-muted-foreground uppercase">Morning Protocol</p>
                  <p className="font-display text-sm tracking-wide text-foreground mt-0.5">Build your morning</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-brand group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>
          </motion.div>

          {/* CARD 3: DAD SCORE */}
          <motion.div variants={fadeUp} custom={2}>
            <DadScore />
          </motion.div>

        </motion.div>
      </main>

      <BottomNav />

      <ProgramSelector
        isOpen={showProgramSelector}
        onClose={() => setShowProgramSelector(false)}
        onProgramSelected={() => setShowProgramSelector(false)}
      />

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  )
}
