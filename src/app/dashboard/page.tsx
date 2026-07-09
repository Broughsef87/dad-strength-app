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
import { useSubscription } from '../../contexts/SubscriptionContext'
import UpgradeModal from '../../components/UpgradeModal'
import FirstWeekChecklist from '../../components/FirstWeekChecklist'
import MorningProtocol from '../../components/MorningProtocol'
import ProgressRing from '../../components/ProgressRing'
import { SectionLabel, HeroAccent } from '../../components/BarbellMark'
import ForgeLoader from '../../components/ForgeLoader'
import { getProgram } from '../../lib/programs'

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

export default function Dashboard() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const { isPro, loading: subLoading } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<WorkoutData | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [activeProgram, setActiveProgram] = useState<ActiveProgramData | null>(null)
  // Zeus progression from user_programs (done_days is int[], current_week is int).
  // Source of truth — replaces the old per-device dad-strength-week-progress-*
  // localStorage for Zeus.
  const [zeusDoneDays, setZeusDoneDays] = useState<number[]>([])
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
      const cl = profile?.first_week_checklist as { first_workout?: boolean; set_mission?: boolean; morning_protocol?: boolean } | null
      if (cl?.first_workout && cl?.set_mission && cl?.morning_protocol) {
        setChecklistDone(true)
      }

      const onboardingLocal = typeof window !== 'undefined' ? localStorage.getItem('onboardingComplete') === 'true' : false
      const onboardingDB = profile?.onboarding_complete || false

      if (!onboardingLocal && !onboardingDB) { router.push('/build'); return }

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
        const dbSlug: string = dbProgram.program_slug ?? dbProgram.slug ?? ''
        const programName = dbSlug
          .replace(/-\d+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
        const registryProgram = getProgram(dbSlug)
        const programData = {
          slug: dbSlug,
          name: registryProgram?.name ?? programName,
          startedAt: dbProgram.started_at,
          currentWeek: dbProgram.current_week,
          daysCount: registryProgram?.daysPerWeek ?? parseInt(dbSlug.split('-').pop() ?? '4'),
          dayNames: [],
          trainingAge: dbProgram.preferences?.trainingAge ?? '',
          primaryGoal: dbProgram.preferences?.primaryGoal ?? '',
          equipment: dbProgram.equipment ?? {},
        }
        setActiveProgram(programData)
        // Registry programs derive done_days from session_complete sentinel
        // rows — canonical, consistent across devices.
        if (registryProgram) {
          const currentWeek = dbProgram.current_week ?? 1
          const { data: weekWorkouts } = await supabase
            .from('generated_workouts')
            .select('id')
            .eq('user_id', user.id)
            .eq('program_slug', dbSlug)
            .eq('week_number', currentWeek)
          const ids: string[] = (weekWorkouts ?? []).map((w: { id: string }) => w.id)
          if (ids.length > 0) {
            const { data: completionRows } = await supabase
              .from('ares_session_logs')
              .select('day_number')
              .eq('user_id', user.id)
              .in('generated_workout_id', ids)
              .eq('log_type', 'session_complete')
            const done = [...new Set(
              (completionRows ?? []).map((l: { day_number: number }) => l.day_number),
            )] as number[]
            setZeusDoneDays(done.sort())
          } else {
            setZeusDoneDays([])
          }
        }
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
          style={{ fontSize: '9rem', color: 'rgba(234,11,47,0.045)', letterSpacing: '0.05em' }}
          aria-hidden="true"
        >DS</span>
        <div className="relative">
          <p className="steel-label">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-[2.6rem] md:text-5xl tracking-[0.06em] uppercase text-foreground mt-0.5 leading-none">
            Train <HeroAccent>Day.</HeroAccent>
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
              style={{ boxShadow: '0 0 8px 1px rgba(234,11,47,0.55)' }} />
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

          {/* I. ACTIVE PROTOCOL — mobile suit status board */}
          <motion.div variants={fadeUp} custom={0} className="space-y-2.5">
            <SectionLabel numeral="I" title="Active Protocol" />
            <div className="panel-cut hud-frame relative bg-card border border-border p-6 pt-8 overflow-hidden">
              <span className="panel-id">UNIT-01 // {(activeProgram?.slug ?? 'standby').replace(/-/g, '.').toUpperCase()}</span>

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="livery-slash pl-4">
                  <span className="telemetry">Active Protocol</span>
                  <h2 className="font-display text-3xl text-foreground leading-none mt-1 uppercase tracking-wide">
                    {activeProgram?.name || 'Choose Program'}
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {streak > 0 && (
                    <div className="panel-cut-sm flex items-center gap-1.5 bg-brand/10 border border-brand/30 px-2.5 py-1.5">
                      <Flame size={11} className="text-brand" />
                      <span className="readout-num text-[12px] text-brand">{streak}</span>
                    </div>
                  )}
                  {activeProgram && (
                    <div className="text-right">
                      <p className="readout-num text-4xl text-brand" style={{ textShadow: '0 0 16px hsl(var(--brand) / 0.4)' }}>
                        {String(activeProgram.currentWeek).padStart(2, '0')}
                      </p>
                      <p className="telemetry-dim">WEEK</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Week LED bar — done days */}
              {activeProgram && getProgram(activeProgram.slug ?? '') && (
                <div className="relative z-10 mb-4">
                  <div className="led-bar">
                    {Array.from({ length: getProgram(activeProgram.slug ?? '')!.daysPerWeek }).map((_, i) => (
                      <span key={i} className={`led-cell ${zeusDoneDays.includes(i + 1) ? 'lit' : ''}`} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <p className="telemetry-dim">SESSIONS THIS WEEK</p>
                    <p className="telemetry">{zeusDoneDays.length}/{getProgram(activeProgram.slug ?? '')!.daysPerWeek}</p>
                  </div>
                </div>
              )}

              {/* Metadata readout */}
              {activeProgram && (
                <div className="border-t border-border/60 relative z-10 mb-4">
                  <div className="data-row">
                    <span className="telemetry-dim">LOADOUT</span>
                    <span className="text-sm font-semibold text-foreground">{getProgram(activeProgram.slug ?? '')?.tagline ?? 'Strength'}</span>
                  </div>
                  <div className="data-row">
                    <span className="telemetry-dim">FREQUENCY</span>
                    <span className="readout-num text-sm text-foreground">{activeProgram.daysCount} / WK</span>
                  </div>
                </div>
              )}

              {!activeProgram && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 relative z-10">
                  No unit deployed. Select a training path.
                </p>
              )}

              <div className="flex flex-col gap-2.5 relative z-10">
                <button
                  onClick={() => {
                    const registryProgram = activeProgram ? getProgram(activeProgram.slug ?? '') : null
                    if (activeProgram && registryProgram) {
                      // Server-derived done days → first unfinished day this week.
                      let nextDay = 1
                      for (let i = 1; i <= registryProgram.daysPerWeek; i++) {
                        if (!zeusDoneDays.includes(i)) { nextDay = i; break }
                      }
                      router.push(`/train/${activeProgram.slug}/${nextDay}`)
                    } else {
                      // No active program (or a retired legacy slug) → path select.
                      router.push('/build')
                    }
                  }}
                  className="panel-cut carbon mecha-glow w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-semibold text-brand border border-brand/60 uppercase tracking-[0.14em] transition-all active:scale-[0.98] hover:border-brand"
                >
                  <PlayCircle size={16} strokeWidth={2} />
                  {activeProgram ? 'Launch Session' : 'Select Path'}
                </button>
                {activeProgram && (
                  <div className="flex items-center justify-between mt-1">
                    <button
                      onClick={() => router.push(`/train/${activeProgram.slug}`)}
                      className="inline-flex items-center gap-1 telemetry hover:text-brand transition-colors py-1"
                    >
                      MISSION SCHEDULE <ChevronRight size={11} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => router.push('/build')}
                      className="inline-flex items-center gap-1 telemetry-dim hover:text-brand transition-colors py-1"
                    >
                      CHANGE UNIT <ChevronRight size={11} strokeWidth={2} />
                    </button>
                  </div>
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
                style={{ fontSize: '4.5rem', color: 'rgba(234,11,47,0.05)', letterSpacing: '0.05em' }}
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
