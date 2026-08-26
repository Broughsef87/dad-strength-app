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
import { useSubscription } from '../../contexts/SubscriptionContext'
import UpgradeModal from '../../components/UpgradeModal'
import FirstWeekChecklist from '../../components/FirstWeekChecklist'
import MorningProtocol from '../../components/MorningProtocol'
import WeekPulse from '../../components/WeekPulse'
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
  const [firstName, setFirstName] = useState('')

  // ?protocol=1 forces the Morning Protocol open even while the first-week
  // checklist is still running. Without it the getting-started flow deadlocks:
  // "Run your morning protocol" is itself a checklist item, but the protocol
  // only replaces the checklist once EVERY item is done, so its CTA would
  // navigate straight back to the checklist. /spirit used to be the way out.
  // Read from window rather than useSearchParams to keep this page off the
  // Suspense requirement that hook imposes at build time.
  const [forceProtocol, setForceProtocol] = useState(false)
  useEffect(() => {
    try {
      setForceProtocol(new URLSearchParams(window.location.search).get('protocol') === '1')
    } catch {}
  }, [])

  // Time-of-day greeting — the header's whole job is to sound like a person.
  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  }

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

      // Greeting name: profile first, then the auth metadata, then the local
      // part of the email — whichever exists, first word only.
      const raw = (profile?.full_name || profile?.name
        || (user.user_metadata?.full_name as string | undefined)
        || (user.user_metadata?.name as string | undefined)
        || user.email?.split('@')[0] || '') as string
      if (raw) setFirstName(raw.trim().split(/[\s._-]+/)[0].toLowerCase())

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
          className="fixed top-0 left-0 right-0 z-50 bg-brand text-background text-center text-[10px] font-display lowercase py-3 px-4"
        >
          Welcome to Dad Strong+ — All Features Unlocked
        </motion.div>
      )}

      {/* DESKTOP HEADER */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-surface-2 px-8 py-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="font-display text-lg lowercase text-foreground">
            Dad Strength
          </span>
        </div>
        <nav className="flex gap-8 text-[10px] text-muted-foreground lowercase">
          <button className="text-brand font-semibold">HQ</button>
          <button onClick={() => router.push('/train')} className="hover:text-foreground transition-colors">Train</button>
          <button onClick={() => router.push('/history')} className="hover:text-foreground transition-colors">History</button>
          <button onClick={() => router.push('/profile')} className="hover:text-foreground transition-colors">Profile</button>
          <button onClick={handleSignOut} className="text-destructive/60 hover:text-destructive transition-colors">Sign Out</button>
        </nav>
      </header>

      {/* MOBILE HEADER — quiet date line, then the greeting doing the talking */}
      <header className="md:hidden flex items-start justify-between px-5 pt-8 pb-3">
        <div>
          <p className="eyebrow-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()}
          </p>
          <h1 className="font-display text-[2rem] lowercase text-foreground mt-1 leading-none">
            {greeting()}{firstName && `, ${firstName}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && !subLoading && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="pill-volt flex items-center gap-1.5 text-[10px] lowercase px-3 py-1.5"
            >
              <Zap size={10} /> upgrade
            </button>
          )}
          <button
            onClick={() => router.push('/profile')}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="settings"
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
            {checklistDone || forceProtocol
              ? <MorningProtocol />
              : <FirstWeekChecklist onComplete={() => setChecklistDone(true)} />
            }
          </motion.div>

          {/* The bento's hero tile: program, the week numeral, the week strip,
              and the one volt action. Everything else on the page is quieter. */}
          <motion.div variants={fadeUp} custom={0}>
            <div className="tile-lg p-5">

              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="eyebrow-mono">active program</span>
                  <h2 className="font-display text-2xl text-foreground leading-tight mt-1 lowercase">
                    {activeProgram?.name?.toLowerCase() || 'choose a program'}
                  </h2>
                  {activeProgram && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 lowercase">
                      {getProgram(activeProgram.slug ?? '')?.tagline?.toLowerCase() ?? 'strength'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {streak > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Flame size={12} />
                      <span className="stat-num text-[13px]">{streak}</span>
                    </div>
                  )}
                  {activeProgram && (
                    <div className="text-right">
                      <p className="stat-num text-[44px]">
                        {String(activeProgram.currentWeek).padStart(2, '0')}
                      </p>
                      <p className="eyebrow-mono">week</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Week strip — one pill per day, volt for done */}
              {activeProgram && getProgram(activeProgram.slug ?? '') && (
                <div className="mb-4">
                  <div className="day-pills">
                    {Array.from({ length: getProgram(activeProgram.slug ?? '')!.daysPerWeek }).map((_, i) => (
                      <span key={i} className={`day-pill ${zeusDoneDays.includes(i + 1) ? 'on' : ''}`} />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 data-mono">
                    <span>sessions</span>
                    <span className="v">{zeusDoneDays.length}/{getProgram(activeProgram.slug ?? '')!.daysPerWeek}</span>
                  </div>
                </div>
              )}

              {!activeProgram && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 lowercase">
                  nothing running yet. pick a path and start.
                </p>
              )}

              <div className="flex flex-col gap-2.5">
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
                  className="pill-volt w-full flex items-center justify-center gap-2.5 py-3.5 text-sm lowercase transition-all active:scale-[0.98] hover:opacity-90"
                >
                  <PlayCircle size={16} strokeWidth={2} />
                  {activeProgram ? 'start session' : 'pick a path'}
                </button>
                {activeProgram && (
                  <div className="flex items-center justify-between mt-1">
                    <button
                      onClick={() => router.push(`/train/${activeProgram.slug}`)}
                      className="inline-flex items-center gap-1 eyebrow-mono hover:text-foreground transition-colors py-1"
                    >
                      the week <ChevronRight size={11} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => router.push('/build')}
                      className="inline-flex items-center gap-1 eyebrow-mono hover:text-foreground transition-colors py-1"
                    >
                      change program <ChevronRight size={11} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Load, right under the plan: what the week has actually cost. */}
          <motion.div variants={fadeUp} custom={0.5}>
            <WeekPulse compact />
          </motion.div>

          {/* II. DAILY OBJECTIVES */}

          {/* III. DAD SCORE */}
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
