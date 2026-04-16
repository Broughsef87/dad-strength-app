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
import MorningProtocol from '../../components/MorningProtocol'
import ProgressRing from '../../components/ProgressRing'
import { SectionLabel } from '../../components/BarbellMark'
import ForgeLoader from '../../components/ForgeLoader'

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
  frequency?: number
}

interface WorkoutData {
  id: string
  name?: string
  description?: string
}

// Total weeks per program family — drives ProgressRing percentage
const PROGRAM_TOTAL_WEEKS: Record<string, number> = {
  ares: 12,
  zeus: 12,
  hercules: 12,
  apollo: 8,
  chronos: 4,
}

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
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [activeProgram, setActiveProgram] = useState<ActiveProgramData | null>(null)
  const [streak, setStreak] = useState(0)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const [checklistDone, setChecklistDone] = useState(false)

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

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // Check if first-week checklist is already fully complete so we can swap the card immediately
      const cl = profile?.first_week_checklist as { first_workout?: boolean; set_mission?: boolean; morning_protocol?: boolean; joined_brotherhood?: boolean } | null
      if (cl?.first_workout && cl?.set_mission && cl?.morning_protocol && cl?.joined_brotherhood) {
        setChecklistDone(true)
      }

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

      const uniqueDays: string[] = Array.from(new Set((logDates || []).map((l: { created_at: string }) => new Date(l.created_at).toDateString())))
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
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <ForgeLoader />
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
      <header className="md:hidden relative flex items-center justify-between px-5 pt-8 pb-4 overflow-hidden">
        {/* Large background "DS" — editorial depth mark */}
        <span
          className="absolute -top-4 -left-2 font-display leading-none pointer-events-none select-none"
          style={{ fontSize: '9rem', color: 'rgba(200,130,10,0.045)', letterSpacing: '0.05em' }}
          aria-hidden="true"
        >DS</span>
        <div className="relative">
          <p className="steel-label">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-[2.6rem] md:text-5xl tracking-[0.06em] uppercase text-foreground mt-0.5 leading-none">
            Train Day.
            {streak > 0 && (
              <span className="text-brand ml-3 inline-flex items-center gap-1 text-2xl align-middle">
                <Flame size={18} className="inline" strokeWidth={1.5} />
                <span className="stat-num">{streak}</span>
              </span>
            )}
          </h1>
          {/* Amber accent line — brand signature */}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-[2px] w-8 rounded-full bg-brand"
              style={{ boxShadow: '0 0 8px 1px rgba(200,130,10,0.55)' }} />
            <div className="h-[2px] w-4 rounded-full bg-brand/35" />
            <div className="h-[2px] w-2 rounded-full bg-brand/15" />
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
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

      <main className="max-w-lg mx-auto px-5 pt-2 space-y-4">

        {/* Removed separate date/greeting — now in header */}

        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* First week checklist → swaps to Morning Protocol once all done */}
          <motion.div variants={fadeUp} custom={-0.5}>
            {checklistDone
              ? <MorningProtocol />
              : <FirstWeekChecklist onComplete={() => setChecklistDone(true)} />
            }
          </motion.div>

          {/* I. ACTIVE PROTOCOL — hero forge card */}
          <motion.div variants={fadeUp} custom={0} className="space-y-2.5">
            <SectionLabel numeral="I" title="Active Protocol" />
            <div className="forge-card p-6 overflow-hidden">
              {/* Editorial background numeral — single depth mark */}
              <span
                className="absolute -top-3 right-3 font-display leading-none pointer-events-none select-none"
                style={{ fontSize: '8rem', color: 'rgba(200,130,10,0.05)', letterSpacing: '0.05em' }}
                aria-hidden="true"
              >01</span>

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold font-display">
                    <span className="w-1 h-1 bg-brand inline-block" />
                    Active Protocol
                  </span>
                  <h2 className="text-3xl text-foreground leading-none mt-1">
                    {activeProgram?.name || workout?.name || 'Load Program'}
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {streak > 0 && (
                    <div className="flex items-center gap-1.5 bg-brand/10 border border-brand/20 px-2.5 py-1.5 rounded-full">
                      <Flame size={11} className="text-brand" />
                      <span className="text-[11px] font-bold text-brand">{streak}</span>
                    </div>
                  )}
                  {activeProgram && (
                    <ProgressRing
                      value={Math.round(((activeProgram.currentWeek - 1) / (PROGRAM_TOTAL_WEEKS[activeProgram.slug.split('-')[0]] ?? 12)) * 100)}
                      size={58}
                      strokeWidth={6}
                      label={`W${activeProgram.currentWeek}`}
                      sublabel="week"
                    />
                  )}
                  {!activeProgram && (
                    <Dumbbell size={28} className="text-muted-foreground/20" strokeWidth={1} />
                  )}
                </div>
              </div>

              {/* Metadata rows */}
              {activeProgram && (
                <div className="border-t border-border relative z-10 mb-4">
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

              {!activeProgram && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 relative z-10">
                  {workout?.description || 'Deploy your first training protocol.'}
                </p>
              )}

              <div className="flex flex-col gap-2.5 relative z-10">
                <button
                  onClick={() => {
                    if (activeProgram) {
                      if (activeProgram.slug?.startsWith('chronos')) {
                        router.push('/workout/squeeze')
                      } else if (activeProgram.slug?.startsWith('ares')) {
                        const daysCount = activeProgram.daysCount || 4
                        const nextDay = getNextWorkoutDay(daysCount)
                        router.push(`/workout/ares/${nextDay}`)
                      } else if (activeProgram.slug?.startsWith('zeus')) {
                        const daysCount = activeProgram.daysCount || 4
                        const nextDay = getNextWorkoutDay(daysCount)
                        router.push(`/workout/zeus/${nextDay}`)
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
                  className="btn-forge-shimmer w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-semibold text-background uppercase tracking-[0.1em] transition-all active:scale-[0.98]"
                  style={{
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #d48a0a 0%, #8B5A00 100%)',
                    boxShadow: '0 0 20px 3px rgba(200,130,10,0.30), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)',
                  }}
                >
                  <PlayCircle size={16} strokeWidth={2} />
                  {activeProgram || workout ? 'Begin Session' : 'Choose Program'}
                </button>
                {(activeProgram || workout) && (
                  <button
                    onClick={() => router.push('/build')}
                    className="self-end inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-brand transition-colors uppercase tracking-[0.16em] font-display font-semibold mt-1 py-1"
                  >
                    Change Program <ChevronRight size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* II. THE SQUEEZE */}
          <motion.div variants={fadeUp} custom={0.5} className="space-y-2.5">
            <SectionLabel numeral="II" title="The Squeeze" />
            <button
              onClick={() => isPro ? router.push('/workout/squeeze') : setShowUpgrade(true)}
              className="w-full steel-edge rounded-2xl p-4 flex items-center justify-between group transition-all relative overflow-hidden"
              style={{
                background: 'linear-gradient(150deg, hsl(220 31% 13%) 0%, hsl(222 21% 8%) 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {/* Editorial depth numeral — matches section label II */}
              <span
                className="absolute -top-2 right-3 font-display leading-none pointer-events-none select-none"
                style={{ fontSize: '4.5rem', color: 'rgba(200,130,10,0.05)', letterSpacing: '0.05em' }}
                aria-hidden="true"
              >02</span>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Zap size={18} className="text-brand" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">Chronos</p>
                  <p className="text-[12px] text-muted-foreground">15–20 min · Any equipment
                    {!isPro && <span className="ml-2 text-[8px] bg-brand/10 text-brand px-1.5 py-0.5 uppercase tracking-widest font-semibold rounded" >Pro</span>}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors relative z-10" strokeWidth={1.5} />
            </button>
          </motion.div>

          {/* III. DAILY OBJECTIVES */}
          <motion.div variants={fadeUp} custom={1} className="space-y-2.5">
            <SectionLabel numeral="III" title="Daily Objectives" />
            <DailyObjectivesCard />
          </motion.div>

          {/* IV. DAD SCORE */}
          <motion.div variants={fadeUp} custom={2} className="space-y-2.5">
            <SectionLabel numeral="IV" title="Dad Score" />
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
