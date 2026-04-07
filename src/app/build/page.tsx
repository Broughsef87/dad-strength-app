'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { useUser } from '../../contexts/UserContext'
import { createClient } from '../../utils/supabase/client'
import type { ActiveProgramData } from '../../components/ProgramSelector'

// ── Types ─────────────────────────────────────────────────────────────────────

type God = 'adonis' | 'ares' | 'hercules' | 'atlas' | 'chronos'
type Days = 3 | 4 | 5
type Weeks = 4 | 5 | 6
type GymType = 'commercial' | 'home'

interface CustomConfig {
  god: God
  focusGroups: string[]
  gymType: GymType
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GODS = [
  {
    id: 'atlas' as God,
    name: 'Atlas',
    title: 'Titan of Strength',
    tagline: 'Carry the World.',
    description: 'Functional lifting meets strongman. Carries mandatory every session. Built to move heavy things in the real world.',
    attributes: ['3–6 Reps', 'Strongman', 'Functional'],
    avatar: '🌍',
    avatarSrc: '/gods/atlas.jpg',
    color: 'text-amber-400',
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/20',
    dot: 'bg-amber-400',
    sampleDays: [
      { day: 'Day 1', name: 'Squat + Carries', exercises: ['Back Squat 4×5', 'Zercher Carry 3×40yd', 'Bulgarian Split Squat 3×6', 'Farmer Carry finisher 3×50yd'] },
      { day: 'Day 2', name: 'Press + Strongman', exercises: ['Log Press / Barbell OHP 4×5', 'Push Press 3×5', 'Sandbag Carry 3×40yd', 'Suitcase Carry finisher'] },
      { day: 'Day 3', name: 'Deadlift + Carries', exercises: ['Deadlift 4×4', 'Romanian DL 3×6', 'Farmer Carry 3×50yd', 'Tire flip sub 3×5'] },
      { day: 'Day 4', name: 'Pull + Conditioning', exercises: ['Barbell Row 4×5', 'Weighted Pull-ups 3×6', 'Overhead Carry 3×40yd', 'Loaded carry medley finisher'] },
    ],
  },
  {
    id: 'adonis' as God,
    name: 'Adonis',
    title: 'God of Beauty',
    tagline: 'The Physique Above All.',
    description: 'High volume. Full pumps. Cables, machines, isolation finishers. Built for the mirror.',
    attributes: ['8–15 Reps', 'High Volume', 'Pump-Focused'],
    avatar: '🏛️',
    avatarSrc: '/gods/adonis.jpg',
    color: 'text-brand',
    border: 'border-brand',
    bg: 'bg-brand/10',
    glow: 'shadow-brand/20',
    dot: 'bg-brand',
    sampleDays: [
      { day: 'Day 1', name: 'Chest + Triceps', exercises: ['Barbell Bench Press 4×10', 'Incline DB Press 3×12', 'Cable Fly 3×15', 'Tricep Pushdown 3×12', 'Lateral Raise 3×15'] },
      { day: 'Day 2', name: 'Back + Biceps', exercises: ['Pull-ups 4×10', 'Barbell Row 3×10', 'Cable Row 3×12', 'Face Pulls 3×15', 'Barbell Curl 3×12'] },
      { day: 'Day 3', name: 'Shoulders + Arms', exercises: ['DB OHP 4×12', 'Machine Lateral Raise 3×15', 'Rear Delt Fly 3×15', 'Hammer Curl 3×12', 'Skull Crushers 3×12'] },
      { day: 'Day 4', name: 'Legs', exercises: ['Back Squat 4×10', 'Leg Press 3×12', 'Leg Extension 3×15', 'Leg Curl 3×12', 'Standing Calf Raise 4×15'] },
    ],
  },
  {
    id: 'ares' as God,
    name: 'Ares',
    title: 'God of War',
    tagline: 'Train Like You Fight.',
    description: 'Explosive primers. Heavy compounds. MetCon finishers. Functional and fierce — works in any gym or garage.',
    attributes: ['3–10 Reps', 'Hybrid + CrossFit', 'Any Gym'],
    avatar: '⚔️',
    avatarSrc: '/gods/ares.jpg',
    color: 'text-red-400',
    border: 'border-red-500/50',
    bg: 'bg-red-500/10',
    glow: 'shadow-red-500/20',
    dot: 'bg-red-400',
    sampleDays: [
      { day: 'Day 1', name: 'Strength + MetCon', exercises: ['Back Squat 5×4 (strength)', 'AMRAP 12: 5 pull-ups / 10 push-ups / 15 air squats'] },
      { day: 'Day 2', name: 'Pure MetCon', exercises: ['For Time — 5 rounds: Run 400m / Power Clean 9 / Bar Muscle-Up 6'] },
      { day: 'Day 3', name: 'EMOM', exercises: ['EMOM 18: Min 1 — Deadlift 5 / Min 2 — Ring Muscle-Up 3 / Min 3 — Hollow Rock 10'] },
      { day: 'Day 4', name: 'Barbell + Gymnastics', exercises: ['Deadlift 5×3 (strength)', 'For Time 21-15-9: Thrusters / Pull-ups (Fran)'] },
    ],
  },
  {
    id: 'hercules' as God,
    name: 'Hercules',
    title: 'God of Strength',
    tagline: 'Move Mountains.',
    description: 'One primary barbell lift per day. Heavy and technical. Accessory work with DBs, cables, and machines to protect the joints.',
    attributes: ['2–6 Reps', 'Barbell Core', 'Raw Power'],
    avatar: '🗿',
    avatarSrc: '/gods/hercules.jpg',
    color: 'text-slate-300',
    border: 'border-slate-500/40',
    bg: 'bg-slate-500/10',
    glow: 'shadow-slate-500/20',
    dot: 'bg-slate-400',
    sampleDays: [
      { day: 'Day 1', name: 'Squat Day', exercises: ['Back Squat 5×3 @ RIR 1', 'Leg Press 3×10', 'Bulgarian Split Squat 3×10', 'Leg Curl 3×10', 'Calf Raise 3×15'] },
      { day: 'Day 2', name: 'Bench Day', exercises: ['Bench Press 5×3 @ RIR 1', 'Incline DB Press 3×10', 'Cable Fly 3×12', 'Tricep Pushdown 3×10', 'Face Pulls 3×12'] },
      { day: 'Day 3', name: 'Deadlift Day', exercises: ['Deadlift 5×3 @ RIR 1', 'Barbell Row 3×8', 'Pull-ups 3×8', 'DB Row 3×10', 'Back Extension 3×12'] },
      { day: 'Day 4', name: 'OHP Day', exercises: ['Barbell OHP 5×3 @ RIR 1', 'DB Shoulder Press 3×10', 'Lateral Raise 3×15', 'Rear Delt Fly 3×15', 'Barbell Curl 3×12'] },
    ],
  },
  {
    id: 'chronos' as God,
    name: 'Chronos',
    title: 'God of Time',
    tagline: '15 Minutes. No Excuses.',
    description: 'Time-crunched sessions for busy dads. A1 compound + A2 superset + finisher. Any equipment, any place.',
    attributes: ['15–20 Min', 'Daily', 'Any Gym'],
    avatar: '⏳',
    avatarSrc: '/gods/chronos.jpg',
    color: 'text-yellow-400',
    border: 'border-yellow-500/50',
    bg: 'bg-yellow-500/10',
    glow: 'shadow-yellow-500/20',
    dot: 'bg-yellow-400',
    sampleDays: [
      { day: 'Session 1', name: 'Hinge + Carry', exercises: ['Deadlift 3×5 (A1)', 'KB Swing + Row superset × 3 rounds (A2)', 'Farmer carry AMRAP 3min (Finisher)'] },
      { day: 'Session 2', name: 'Squat + Cond.', exercises: ['Goblet Squat 3×5 (A1)', 'Box jump + Push-up superset × 3 rounds (A2)', 'Sprint / bike finisher'] },
      { day: 'Session 3', name: 'Push + Core', exercises: ['DB Press 3×5 (A1)', 'Push-up + Band pull-apart × 3 rounds (A2)', 'Ab wheel AMRAP 3min (Finisher)'] },
    ],
  },
]

const FOCUS_MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Core',
]

const DAY_NAMES: Record<God, Record<number, string[]>> = {
  adonis: {
    3: ['Push', 'Pull', 'Legs'],
    4: ['Chest + Triceps', 'Back + Biceps', 'Shoulders + Arms', 'Legs'],
    5: ['Chest', 'Back', 'Shoulders + Arms', 'Legs', 'Glutes + Calves'],
  },
  ares: {
    3: ['Upper Strength', 'Lower Power', 'Full Body Conditioning'],
    4: ['Upper Push', 'Lower Squat', 'Upper Pull', 'Lower Hinge'],
    5: ['Upper Push', 'Lower Squat', 'MetCon', 'Upper Pull', 'Lower Hinge'],
  },
  hercules: {
    3: ['Squat Day', 'Bench Day', 'Deadlift Day'],
    4: ['Squat Day', 'Bench Day', 'Deadlift Day', 'OHP Day'],
    5: ['Squat Day', 'Bench Day', 'Deadlift Day', 'OHP Day', 'Weak Points'],
  },
  atlas: {
    4: ['Squat + Carries', 'Press + Strongman', 'Deadlift + Carries', 'Pull + Conditioning'],
  },
  chronos: {
    4: ['Session 1', 'Session 2', 'Session 3', 'Session 4'],
  },
}

const CALIBRATION_LIFTS = [
  { key: 'bench',    label: 'Bench Press',    hint: 'Heaviest set of 5 clean reps' },
  { key: 'squat',    label: 'Back Squat',     hint: 'Heaviest set of 5 clean reps' },
  { key: 'deadlift', label: 'Deadlift',       hint: 'Heaviest set of 5 clean reps' },
  { key: 'ohp',      label: 'Overhead Press', hint: 'Heaviest set of 5 clean reps' },
  { key: 'row',      label: 'Barbell Row',    hint: 'Heaviest set of 5 clean reps' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuildPage() {
  const router = useRouter()
  const { user, loading } = useUser()
  const supabase = createClient()

  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Selections
  const [selectedGod, setSelectedGod] = useState<God | null>(null)
  const [focusGroups, setFocusGroups] = useState<string[]>([])
  const [daysPerWeek, setDaysPerWeek] = useState<Days>(4)
  const [weeks, setWeeks] = useState<Weeks>(6)
  const [gymType, setGymType] = useState<GymType>('commercial')
  const [weights, setWeights] = useState({ bench: '', squat: '', deadlift: '', ohp: '', row: '' })
  const [activating, setActivating] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || loading) return <div className="min-h-screen bg-background" />
  if (!user) { router.push('/'); return null }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleFocus(muscle: string) {
    setFocusGroups(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : prev.length >= 2 ? prev : [...prev, muscle]
    )
  }

  function getNextMonday(): Date {
    const today = new Date()
    const day = today.getDay()
    const daysUntil = day === 1 ? 0 : day === 0 ? 1 : 8 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + daysUntil)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  async function activate() {
    if (!user || !selectedGod) return
    setActivating(true)

    const slug = selectedGod === 'chronos' ? 'chronos-4' : `${selectedGod}-4`
    const startMonday = getNextMonday()

    // Convert 5RMs → 1RMs (Epley: 5RM × 1.167)
    const oneRepMaxes: Record<string, number> = {}
    for (const [key, val] of Object.entries(weights)) {
      const num = parseFloat(val) || 0
      if (num > 0) oneRepMaxes[key] = Math.round((num * 1.167) / 2.5) * 2.5
    }

    const godMeta = GODS.find(g => g.id === selectedGod)!

    const primaryGoal =
      selectedGod === 'adonis' ? 'hypertrophy' :
      selectedGod === 'hercules' ? 'strength' :
      selectedGod === 'chronos' ? 'conditioning' :
      'athletic'

    const data: ActiveProgramData = {
      slug,
      name: godMeta.name,
      startedAt: startMonday.toISOString(),
      currentWeek: 1,
      trainingAge: 'intermediate',
      primaryGoal,
      equipment: {},
      daysCount: 4,
      dayNames: DAY_NAMES[selectedGod][4],
    }

    const config: CustomConfig = { god: selectedGod, focusGroups, gymType }

    // Persist
    localStorage.setItem('dad-strength-active-program', JSON.stringify(data))
    localStorage.setItem('dad-strength-one-rep-maxes', JSON.stringify(oneRepMaxes))
    localStorage.setItem('dad-strength-custom-config', JSON.stringify(config))

    // Clear old caches
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('dad-strength-wip-') || k?.startsWith('dad-strength-week-progress-')) {
        localStorage.removeItem(k)
      }
    }

    // Save to Supabase
    await supabase.from('user_programs').upsert(
      {
        user_id: user.id,
        slug: data.slug,
        started_at: data.startedAt,
        current_week: 1,
        status: 'active',
        equipment: {},
        preferences: { gymType, weeks, focusGroups, calibrationWeights: weights },
      },
      { onConflict: 'user_id' }
    )

    setActivating(false)
    setDone(true)
    setTimeout(() => router.push('/workout/program/1'), 1200)
  }

  const isChronos = selectedGod === 'chronos'
  const allWeightsFilled = isChronos || CALIBRATION_LIFTS.every(l => parseFloat(weights[l.key as keyof typeof weights]) > 0)
  const godMeta = selectedGod ? GODS.find(g => g.id === selectedGod)! : null
  const TOTAL_STEPS = 3

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-2 border-b border-border flex-shrink-0">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : router.back()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 flex-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i + 1 === step ? 'w-6 h-2 bg-brand' :
                  i + 1 < step  ? 'w-2 h-2 bg-brand/40' :
                                  'w-2 h-2 bg-border'
                }`}
              />
            ))}
          </div>

          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em]">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 pb-28 pt-6">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Choose Your God ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold font-display mb-1">
                  Custom Program
                </p>
                <h1 className="font-display text-5xl tracking-[0.1em] uppercase leading-none">
                  Choose Your God
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Your god defines the philosophy. Rep ranges, exercise selection, and structure all follow.
                </p>
              </div>

              <div className="space-y-3">
                {GODS.map((god) => {
                  const isSelected = selectedGod === god.id
                  return (
                    <div key={god.id} className={`ds-card border-2 transition-all duration-200 overflow-hidden ${
                      isSelected ? `${god.border} shadow-lg ${god.glow}` : 'border-transparent hover:border-border'
                    }`}>
                      <button
                        onClick={() => setSelectedGod(isSelected ? null : god.id)}
                        className="w-full text-left p-5"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            {/* Animated avatar */}
                            <motion.div
                              animate={isSelected ? { y: [0, -4, 0], scale: [1, 1.04, 1] } : { y: 0, scale: 1 }}
                              transition={isSelected ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                              className={`relative w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden border-2 transition-all duration-300 ${god.border} ${isSelected ? `shadow-xl` : ''}`}
                            >
                              <Image
                                src={god.avatarSrc}
                                alt={god.name}
                                fill
                                className="object-cover object-top"
                                sizes="64px"
                              />
                            </motion.div>
                            <div>
                              <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5 ${god.color}`}>
                                {god.title}
                              </p>
                              <h2 className="font-display text-4xl tracking-[0.1em] uppercase leading-none text-foreground">
                                {god.name}
                              </h2>
                              <p className={`text-xs font-semibold mt-0.5 ${god.color}`}>{god.tagline}</p>
                            </div>
                          </div>
                          <CheckCircle2 size={20} className={`flex-shrink-0 mt-1 transition-opacity ${isSelected ? `${god.color} opacity-100` : 'opacity-0'}`} />
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          {god.description}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {god.attributes.map(attr => (
                            <span
                              key={attr}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider ${god.color} ${god.bg} ${god.border}`}
                            >
                              {attr}
                            </span>
                          ))}
                        </div>
                      </button>

                      {/* Sample programming — shown when selected */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className={`mx-5 mb-5 rounded-xl border ${god.border} ${god.bg} p-4`}>
                              <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-3 ${god.color}`}>
                                Sample Week
                              </p>
                              <div className="space-y-3">
                                {god.sampleDays.map((d) => (
                                  <div key={d.day}>
                                    <div className="flex items-baseline gap-2 mb-1">
                                      <span className={`text-[10px] font-black uppercase tracking-widest ${god.color}`}>{d.day}</span>
                                      <span className="text-xs font-semibold text-foreground">{d.name}</span>
                                    </div>
                                    <ul className="space-y-0.5">
                                      {d.exercises.map((ex) => (
                                        <li key={ex} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${god.dot}`} />
                                          {ex}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!selectedGod}
                className={`w-full py-4 rounded-xl font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2 transition-all ${
                  selectedGod
                    ? `${godMeta?.bg ?? 'bg-brand/10'} ${godMeta?.color ?? 'text-brand'} border ${godMeta?.border ?? 'border-brand'}`
                    : 'bg-surface-3 text-muted-foreground border border-border cursor-not-allowed'
                }`}
              >
                Continue <ChevronRight size={15} />
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Focus Muscles ───────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <p className={`text-[10px] uppercase tracking-[0.25em] font-semibold font-display mb-1 ${godMeta?.color}`}>
                  {godMeta?.name}
                </p>
                <h1 className="font-display text-5xl tracking-[0.1em] uppercase leading-none">
                  Focus
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Pick up to 2 muscle groups to bias. They get extra sets and priority placement.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {FOCUS_MUSCLES.map((muscle) => {
                  const isSelected = focusGroups.includes(muscle)
                  const isDisabled = !isSelected && focusGroups.length >= 2
                  return (
                    <button
                      key={muscle}
                      onClick={() => !isDisabled && toggleFocus(muscle)}
                      disabled={isDisabled}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                        isSelected
                          ? `${godMeta?.color} ${godMeta?.bg} ${godMeta?.border}`
                          : isDisabled
                          ? 'text-muted-foreground/40 bg-surface-3/40 border-border/40 cursor-not-allowed'
                          : 'text-foreground bg-surface-3 border-border hover:border-brand/40'
                      }`}
                    >
                      {muscle}
                    </button>
                  )
                })}
              </div>

              {focusGroups.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Skip focus for a balanced program with no specific bias.
                </p>
              )}

              {focusGroups.length > 0 && (
                <div className="ds-card p-4 space-y-1">
                  <p className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${godMeta?.color}`}>
                    Your Focus
                  </p>
                  {focusGroups.map(m => (
                    <p key={m} className="text-sm text-foreground font-medium">
                      + {m} — extra sets &amp; priority placement
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => setStep(3)}
                className={`w-full py-4 rounded-xl font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2 ${godMeta?.bg} ${godMeta?.color} border ${godMeta?.border}`}
              >
                {focusGroups.length > 0 ? 'Continue' : 'Skip — Balanced Program'} <ChevronRight size={15} />
              </button>
            </motion.div>
          )}

          {/* ── Step 3: Calibrate + Activate ───────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <p className={`text-[10px] uppercase tracking-[0.25em] font-semibold font-display mb-1 ${godMeta?.color}`}>
                  {godMeta?.name}
                </p>
                <h1 className="font-display text-5xl tracking-[0.1em] uppercase leading-none">
                  {isChronos ? 'Launch' : 'Calibrate'}
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  {isChronos
                    ? 'No calibration needed — Chronos sessions work with any equipment. Just launch.'
                    : 'Your 5RM — heaviest weight you can lift for 5 clean reps. The AI uses these to calculate your starting weights.'}
                </p>
              </div>

              {/* Summary card */}
              <div className={`ds-card p-4 border ${godMeta?.border}`}>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className={`font-display text-xl tracking-widest uppercase ${godMeta?.color}`}>{godMeta?.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">God</p>
                  </div>
                  <div>
                    <p className={`font-display text-xl tracking-widest ${godMeta?.color}`}>4</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days</p>
                  </div>
                  <div>
                    <p className={`font-display text-xl tracking-widest ${godMeta?.color}`}>{weeks}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Weeks</p>
                  </div>
                </div>
                {focusGroups.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
                    {focusGroups.map(m => (
                      <span key={m} className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${godMeta?.color} ${godMeta?.bg} ${godMeta?.border}`}>
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Gym type */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold font-display">
                  Gym Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['commercial', 'home'] as GymType[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGymType(g)}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                        gymType === g
                          ? `${godMeta?.border} ${godMeta?.bg} ${godMeta?.color}`
                          : 'border-border bg-surface-3 text-muted-foreground'
                      }`}
                    >
                      {g === 'commercial' ? '🏋️ Commercial' : '🏠 Home'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weeks */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold font-display">
                  Program Length
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([4, 5, 6] as Weeks[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeeks(w)}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                        weeks === w
                          ? `${godMeta?.border} ${godMeta?.bg} ${godMeta?.color}`
                          : 'border-border bg-surface-3 text-muted-foreground'
                      }`}
                    >
                      {w} Weeks
                    </button>
                  ))}
                </div>
              </div>

              {/* Calibration inputs — hidden for Chronos */}
              {!isChronos && (
                <div className="ds-card divide-y divide-border overflow-hidden">
                  {CALIBRATION_LIFTS.map((lift) => (
                    <div key={lift.key} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{lift.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{lift.hint}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="0"
                          value={weights[lift.key as keyof typeof weights]}
                          onChange={e => setWeights(prev => ({ ...prev, [lift.key]: e.target.value }))}
                          className="w-16 text-right bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-brand transition-colors"
                        />
                        <span className="text-xs text-muted-foreground w-6">lbs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Activate */}
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`w-full py-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-display tracking-[0.08em] uppercase ${godMeta?.bg} ${godMeta?.color} ${godMeta?.border}`}
                  >
                    <CheckCircle2 size={16} /> Activated — Loading Day 1
                  </motion.div>
                ) : (
                  <motion.button
                    key="activate"
                    onClick={activate}
                    disabled={activating || !allWeightsFilled}
                    className={`w-full py-4 rounded-xl font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                      allWeightsFilled && !activating
                        ? `${godMeta?.bg} ${godMeta?.color} border ${godMeta?.border} shadow-lg ${godMeta?.glow}`
                        : 'bg-surface-3 text-muted-foreground border border-border cursor-not-allowed'
                    }`}
                  >
                    {activating ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-current/40 border-t-current animate-spin" />
                        Building Your Program…
                      </>
                    ) : (
                      <>Activate {godMeta?.name} <ChevronRight size={15} /></>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {!allWeightsFilled && !activating && !isChronos && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Fill in all 5 lifts to continue
                </p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
