'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActiveProgramData {
  slug: string
  name: string
  startedAt: string
  currentWeek: number
  trainingAge: string
  primaryGoal: string
  equipment: Record<string, boolean>
  daysCount: number
  dayNames: string[]
}

export interface ProgramSelectorProps {
  activeSlug?: string | null
  onProgramSelected?: (data: ActiveProgramData) => void
  isOpen?: boolean
  onClose?: () => void
}

// ── Program data ──────────────────────────────────────────────────────────────

interface SampleDay {
  day: string
  name: string
  exercises: string[]
}

interface Program {
  slug: string
  name: string
  tagline: string
  description: string
  vibe: string
  icon: string
  gymTypes: readonly ('commercial' | 'home')[]
  availableDays: readonly number[]
  lockedDays?: number
  comingSoon?: boolean
  sampleWeek?: SampleDay[]
}

const PROGRAMS: readonly Program[] = [
  {
    slug: 'dad-strong',
    name: 'Dad Strong',
    tagline: 'Old Man Strength',
    description:
      'Functional power meets iron discipline. Carry all the groceries in one trip. Move the couch solo. Build the kind of strength that actually matters.',
    vibe: 'Strength + Function',
    icon: '🏋️',
    gymTypes: ['commercial', 'home'],
    availableDays: [3, 5],
    sampleWeek: [
      { day: 'Mon', name: 'Lower Body', exercises: ['Back Squat 3×5', 'Romanian Deadlift 3×8', 'Goblet Squat 3×10', 'Plank 3×45s'] },
      { day: 'Wed', name: 'Upper Body', exercises: ['Bench Press 3×5', 'Barbell Row 3×8', 'OHP 3×8', 'Farmer Carry 3×40yd'] },
      { day: 'Fri', name: 'Full Body', exercises: ['Deadlift 3×5', 'Push-up 3×12', 'DB Row 3×10', 'Conditioning Circuit'] },
    ],
  },
  {
    slug: 'hybrid',
    name: 'Hybrid Athlete',
    tagline: 'Built Different',
    description:
      'Bodybuilding + HIIT + circuits. CrossFit energy, bodybuilder physique. For the competitive dads who need a challenge.',
    vibe: 'Power + Conditioning',
    icon: '⚔️',
    gymTypes: ['commercial', 'home'],
    availableDays: [3, 5],
    sampleWeek: [
      { day: 'Mon', name: 'Strength Day', exercises: ['Squat 5×5', 'Bench Press 5×5', 'Deadlift 3×3', 'OHP 3×5'] },
      { day: 'Wed', name: 'HIIT + Upper', exercises: ['Tabata intervals', 'Push/Pull supersets 4×10', 'Core circuit 3 rounds'] },
      { day: 'Fri', name: 'Conditioning', exercises: ['AMRAP circuits', 'Sled push / carries', 'Bodybuilding pump finisher'] },
    ],
  },
  {
    slug: 'the-squeeze',
    name: 'The Squeeze',
    tagline: 'Short on time. Never short on effort.',
    description:
      '15-20 minute sessions. Any equipment, any place. When life is in total chaos, this keeps the habit alive and the body moving.',
    vibe: 'Minimal + Consistent',
    icon: '⚡',
    gymTypes: ['commercial', 'home'],
    availableDays: [3],
    lockedDays: 3,
    sampleWeek: [
      { day: 'Session 1', name: 'Hinge + Carry', exercises: ['Deadlift 3×5', 'KB Swing + Row superset 3 rounds', 'Farmer carry finisher 3min'] },
      { day: 'Session 2', name: 'Squat + Cond.', exercises: ['Goblet Squat 3×5', 'Box jump + Push superset', 'Sprint / bike finisher'] },
      { day: 'Session 3', name: 'Push + Core', exercises: ['DB Press 3×5', 'Push-up + Band pull-apart', 'Ab wheel / AMRAP 3min'] },
    ],
  },
  {
    slug: 'home-shred',
    name: 'Home Shred',
    tagline: 'Garage Gains',
    description:
      'Calisthenics-first with dumbbells and kettlebells. High reps, circuits, HIIT. Look shredded without leaving your garage.',
    vibe: 'Calisthenics + HIIT',
    icon: '🔥',
    gymTypes: ['home'],
    availableDays: [3, 5],
    comingSoon: true,
  },
  {
    slug: 'golden-era',
    name: 'Golden Era',
    tagline: 'Classic Bodybuilding',
    description:
      'For the dad who still has a gym membership and needs that third-place escape. Old school splits, peak contraction, full pumps.',
    vibe: 'Bodybuilding + Pump',
    icon: '🏆',
    gymTypes: ['commercial'],
    availableDays: [3, 5],
    comingSoon: true,
  },
]

type ProgramSlug = string

const CALIBRATION_LIFTS: Record<string, Array<{ key: string; label: string; hint: string; unit: 'lbs' | 'reps' }>> = {
  'dad-strong': [
    { key: 'bench', label: 'Barbell Bench Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'squat', label: 'Barbell Back Squat', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'row', label: 'Barbell Row', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
  ],
  'the-squeeze': [
    { key: 'pushups', label: 'Push-ups', hint: 'Max reps in one set right now', unit: 'reps' },
    { key: 'pullups', label: 'Pull-ups (or Rows)', hint: 'Max reps in one set right now', unit: 'reps' },
    { key: 'squats', label: 'Bodyweight Squats', hint: 'Max reps in one set right now', unit: 'reps' },
  ],
  'home-shred': [
    { key: 'db_press', label: 'DB Press 1RM (each hand)', hint: 'Max single rep estimate', unit: 'lbs' },
    { key: 'db_row', label: 'DB Row 1RM (each hand)', hint: 'Max single rep estimate', unit: 'lbs' },
    { key: 'db_rdl', label: 'DB Romanian Deadlift 1RM (each)', hint: 'Max single rep estimate', unit: 'lbs' },
  ],
  'golden-era': [
    { key: 'bench', label: 'Barbell Bench Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'squat', label: 'Barbell Back Squat', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'row', label: 'Barbell Row', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
  ],
  'hybrid': [
    { key: 'bench', label: 'Barbell Bench Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'squat', label: 'Barbell Back Squat', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
    { key: 'row', label: 'Barbell Row', hint: 'Best weight you can lift for 5 clean reps', unit: 'lbs' },
  ],
}

const HOME_EQUIPMENT = [
  { key: 'dumbbells', label: 'Dumbbells', icon: '🏋️' },
  { key: 'kettlebell', label: 'Kettlebell', icon: '🔔' },
  { key: 'pullup_bar', label: 'Pull-up Bar', icon: '🔝' },
  { key: 'resistance_bands', label: 'Resistance Bands', icon: '🔗' },
  { key: 'bench', label: 'Bench / Sturdy Chair', icon: '🪑' },
  { key: 'barbell_rack', label: 'Barbell + Rack', icon: '⚙️' },
  { key: 'cable_machine', label: 'Cable Machine', icon: '🔧' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNextMonday(): Date {
  const today = new Date()
  const day = today.getDay()
  const daysUntilMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntilMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Step types ────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgramSelector({ activeSlug, onProgramSelected, isOpen, onClose }: ProgramSelectorProps) {
  const supabase = createClient()
  const { user } = useUser()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen !== undefined) setOpen(isOpen)
  }, [isOpen])

  // Reset scroll to top whenever sheet opens
  useEffect(() => {
    if (open && sheetRef.current) {
      sheetRef.current.scrollTop = 0
    }
  }, [open])
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [selectedSlug, setSelectedSlug] = useState<ProgramSlug | null>(() => {
    if (!activeSlug) return null
    const base = activeSlug.replace(/-\d+$/, '') as ProgramSlug
    return PROGRAMS.find(p => p.slug === base)?.slug ?? null
  })

  // Step 2
  const [gymType, setGymType] = useState<'commercial' | 'home' | null>(null)
  const [equipment, setEquipment] = useState<Record<string, boolean>>({
    dumbbells: true,
    pullup_bar: true,
  })

  // Step 3
  const [days, setDays] = useState<3 | 5 | null>(null)

  // Step 4
  const [weeks, setWeeks] = useState<4 | 5 | 6 | null>(null)

  // Step 5
  const [calibrationWeights, setCalibrationWeights] = useState<Record<string, string>>({})

  const selectedProgram = PROGRAMS.find(p => p.slug === selectedSlug) ?? null

  // ── Derived ─────────────────────────────────────────────────────────────────

  const autoGymType: 'commercial' | 'home' | null = selectedProgram
    ? selectedProgram.gymTypes.length === 1
      ? (selectedProgram.gymTypes[0] as 'commercial' | 'home')
      : null
    : null

  const effectiveGymType = autoGymType ?? gymType

  const lockedDays: number | null = selectedProgram?.lockedDays ?? null

  const effectiveDays = lockedDays ?? days

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openSheet() {
    // Reset to step 1 but keep pre-selected slug if there's an active program
    setStep(1)
    setGymType(null)
    setDays(null)
    setWeeks(null)
    setOpen(true)
  }

  function closeSheet() {
    setOpen(false)
    onClose?.()
  }

  function goBack() {
    setStep(prev => (prev > 1 ? ((prev - 1) as Step) : prev))
  }

  function goNext() {
    setStep(prev => (prev < 6 ? ((prev + 1) as Step) : prev))
  }

  function toggleEquipment(key: string) {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleConfirm() {
    if (!selectedProgram || !effectiveDays || !weeks) return

    const finalSlug = `${selectedProgram.slug}-${effectiveDays}`
    const startMonday = getNextMonday()

    const data: ActiveProgramData = {
      slug: finalSlug,
      name: selectedProgram.name,
      startedAt: startMonday.toISOString(),
      currentWeek: 1,
      trainingAge: '',
      primaryGoal: '',
      equipment: effectiveGymType === 'home' ? equipment : {},
      daysCount: effectiveDays,
      dayNames: [],
    }

    // Convert 5RM entries to 1RM using Epley formula (5RM × 1.167)
    const currentLifts = CALIBRATION_LIFTS[selectedProgram.slug] ?? []
    const oneRepMaxes: Record<string, number> = {}
    for (const [key, value] of Object.entries(calibrationWeights)) {
      const lift = currentLifts.find(l => l.key === key)
      const num = parseFloat(value) || 0
      if (lift?.unit === 'lbs' && num > 0) {
        oneRepMaxes[key] = Math.round((num * 1.167) / 2.5) * 2.5
      } else {
        oneRepMaxes[key] = num
      }
    }

    localStorage.setItem('dad-strength-active-program', JSON.stringify(data))
    localStorage.setItem('dad-strength-one-rep-maxes', JSON.stringify(oneRepMaxes))

    if (user) {
      supabase
        .from('user_programs')
        .upsert(
          {
            user_id: user.id,
            slug: data.slug,
            started_at: data.startedAt,
            current_week: 1,
            status: 'active',
            equipment: data.equipment,
            preferences: {
              gymType: effectiveGymType,
              weeks,
              calibrationWeights,
            },
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('Failed to save program to Supabase:', error)
        })
    }

    closeSheet()
    onProgramSelected?.(data)
    router.push('/workout/program/1')
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const TOTAL_STEPS = 6
  const nextMonday = getNextMonday()

  return (
    <>
      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40"
              onClick={closeSheet}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              ref={sheetRef}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-2 border-t border-border rounded-t-xl max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 pt-2 pb-1">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i + 1 === step
                        ? 'w-4 h-2 bg-brand'
                        : i + 1 < step
                        ? 'w-2 h-2 bg-brand/40'
                        : 'w-2 h-2 bg-border'
                    }`}
                  />
                ))}
              </div>

              <div className="px-5 pt-3 pb-24">
                {/* Back button (steps 2–6) */}
                {step > 1 && (
                  <button
                    onClick={goBack}
                    className="mb-4 flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back
                  </button>
                )}

                {/* ── Step 1: Choose Your Program ── */}
                {step === 1 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase mb-1">
                        Choose Your Program
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Built for dads who refuse to quit
                      </p>
                    </div>

                    <div className="space-y-3">
                      {PROGRAMS.map((program) => {
                        const isSelected = selectedSlug === program.slug
                        const isActive = activeSlug?.startsWith(program.slug)
                        const isComingSoon = !!program.comingSoon
                        return (
                          <div
                            key={program.slug}
                            className={`relative card-base overflow-hidden transition-all duration-200 ${
                              isComingSoon
                                ? 'opacity-40 pointer-events-none border-border/50'
                                : isSelected
                                ? 'border-brand bg-brand/5'
                                : 'border-border/50'
                            }`}
                          >
                            <button
                              onClick={() => !isComingSoon && setSelectedSlug(isSelected ? null : program.slug)}
                              disabled={isComingSoon}
                              className="relative w-full text-left p-4 active:scale-[0.98] transition-transform"
                            >
                              {isComingSoon && (
                                <span className="absolute top-3 right-3 text-[9px] font-display tracking-[0.12em] px-2 py-0.5 rounded-full bg-surface-3 text-text-muted border border-border/40">
                                  COMING SOON
                                </span>
                              )}
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xl flex-shrink-0">{program.icon}</span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-lg font-display tracking-[0.06em] uppercase leading-tight">
                                        {program.name}
                                      </span>
                                      {isActive && (
                                        <span className="text-[9px] uppercase tracking-widest font-black bg-brand/15 text-brand border border-brand/30 rounded-sm px-2 py-0.5">
                                          Active
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                      {program.tagline}
                                    </p>
                                  </div>
                                </div>
                                {!isComingSoon && (
                                  <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 rounded-sm px-2.5 py-1 whitespace-nowrap">
                                    {program.vibe}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {program.description}
                              </p>
                            </button>

                            {/* Sample week — expands when selected */}
                            {isSelected && program.sampleWeek && (
                              <div className="mx-4 mb-4 rounded-lg border border-brand/20 bg-brand/5 p-3">
                                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-brand mb-2.5">
                                  Sample Week
                                </p>
                                <div className="space-y-2.5">
                                  {program.sampleWeek.map((d) => (
                                    <div key={d.day}>
                                      <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-brand">{d.day}</span>
                                        <span className="text-[11px] font-semibold text-foreground">{d.name}</span>
                                      </div>
                                      <ul className="space-y-0.5">
                                        {d.exercises.map((ex) => (
                                          <li key={ex} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-brand/50 flex-shrink-0" />
                                            {ex}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <button
                      onClick={goNext}
                      disabled={!selectedSlug}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-background font-semibold py-4 rounded-md uppercase tracking-wider transition-all active:scale-95"
                    >
                      Next →
                    </button>

                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">or</span>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>

                    <button
                      onClick={() => { closeSheet(); router.push('/build') }}
                      className="w-full flex items-center justify-center gap-2 border border-brand/30 hover:border-brand/60 bg-brand/5 hover:bg-brand/10 text-brand font-black text-sm py-4 rounded-md uppercase tracking-widest transition-all active:scale-95"
                    >
                      ✨ Build Custom Program
                    </button>
                  </div>
                )}

                {/* ── Step 2: Your Setup ── */}
                {step === 2 && selectedProgram && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase mb-1">
                        Your Setup
                      </h2>
                      {autoGymType && (
                        <p className="text-xs text-brand font-medium">
                          This program is designed for{' '}
                          {autoGymType === 'home' ? 'home gym' : 'commercial gym'}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Commercial */}
                      <button
                        onClick={() => setGymType('commercial')}
                        disabled={!!autoGymType && autoGymType !== 'commercial'}
                        className={`flex flex-col items-center gap-2 p-5 rounded-md border transition-all active:scale-95 ${
                          effectiveGymType === 'commercial'
                            ? 'border-brand bg-brand/10 text-foreground'
                            : autoGymType && autoGymType !== 'commercial'
                            ? 'border-border/30 opacity-30 cursor-not-allowed text-muted-foreground'
                            : 'border-border/50 hover:border-brand/30 text-muted-foreground'
                        }`}
                      >
                        <span className="text-3xl">🏢</span>
                        <span className="font-black text-sm uppercase tracking-wider">
                          Commercial Gym
                        </span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          Full rack, cables, machines
                        </span>
                      </button>

                      {/* Home */}
                      <button
                        onClick={() => setGymType('home')}
                        disabled={!!autoGymType && autoGymType !== 'home'}
                        className={`flex flex-col items-center gap-2 p-5 rounded-md border transition-all active:scale-95 ${
                          effectiveGymType === 'home'
                            ? 'border-brand bg-brand/10 text-foreground'
                            : autoGymType && autoGymType !== 'home'
                            ? 'border-border/30 opacity-30 cursor-not-allowed text-muted-foreground'
                            : 'border-border/50 hover:border-brand/30 text-muted-foreground'
                        }`}
                      >
                        <span className="text-3xl">🏠</span>
                        <span className="font-black text-sm uppercase tracking-wider">
                          Home Gym
                        </span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          Training on your terms
                        </span>
                      </button>
                    </div>

                    {/* Equipment checklist (home only) */}
                    <AnimatePresence>
                      {effectiveGymType === 'home' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                              What do you have?
                            </p>
                            {HOME_EQUIPMENT.map(({ key, label, icon }) => {
                              const checked = !!equipment[key]
                              return (
                                <button
                                  key={key}
                                  onClick={() => toggleEquipment(key)}
                                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-md border transition-all active:scale-[0.98] ${
                                    checked
                                      ? 'bg-brand/10 border-brand/40 text-foreground'
                                      : 'bg-card/60 border-border text-muted-foreground hover:border-brand/30'
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider">
                                    <span>{icon}</span>
                                    {label}
                                  </span>
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-all ${
                                      checked ? 'bg-brand border-brand' : 'border-border'
                                    }`}
                                  >
                                    {checked && (
                                      <span className="text-foreground text-[10px] leading-none">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={goNext}
                      disabled={!effectiveGymType}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-background font-semibold py-4 rounded-md uppercase tracking-wider transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 3: Your Schedule ── */}
                {step === 3 && selectedProgram && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase mb-1">
                        Your Schedule
                      </h2>
                      {lockedDays && (
                        <p className="text-xs text-brand font-medium">
                          The Squeeze is designed as a 3-day program
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* 3-day */}
                      {(selectedProgram.availableDays as readonly number[]).includes(3) && (
                        <button
                          onClick={() => setDays(3)}
                          disabled={!!lockedDays && lockedDays !== 3}
                          className={`w-full text-left flex items-center justify-between p-5 rounded-md border transition-all active:scale-[0.98] ${
                            effectiveDays === 3
                              ? 'border-brand bg-brand/10'
                              : 'border-border/50 hover:border-brand/30'
                          }`}
                        >
                          <div>
                            <p className="font-black text-base uppercase tracking-wider">
                              3 Days / Week
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Mon / Wed / Fri — maximum recovery
                            </p>
                          </div>
                          {effectiveDays === 3 && (
                            <span className="text-brand text-lg">●</span>
                          )}
                        </button>
                      )}

                      {/* 5-day */}
                      {(selectedProgram.availableDays as readonly number[]).includes(5) && (
                        <button
                          onClick={() => setDays(5)}
                          disabled={!!lockedDays && lockedDays !== 5}
                          className={`w-full text-left flex items-center justify-between p-5 rounded-md border transition-all active:scale-[0.98] ${
                            effectiveDays === 5
                              ? 'border-brand bg-brand/10'
                              : 'border-border/50 hover:border-brand/30'
                          }`}
                        >
                          <div>
                            <p className="font-black text-base uppercase tracking-wider">
                              5 Days / Week
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Mon–Fri — full commitment
                            </p>
                          </div>
                          {effectiveDays === 5 && (
                            <span className="text-brand text-lg">●</span>
                          )}
                        </button>
                      )}
                    </div>

                    <button
                      onClick={goNext}
                      disabled={!effectiveDays}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-background font-semibold py-4 rounded-md uppercase tracking-wider transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 4: Program Length ── */}
                {step === 4 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase mb-1">
                        How Long?
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Pick your mesocycle length
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {([4, 5, 6] as const).map((w) => {
                        const labels: Record<number, string> = {
                          4: 'Focused blast',
                          5: 'Balanced build',
                          6: 'Full mesocycle',
                        }
                        return (
                          <button
                            key={w}
                            onClick={() => setWeeks(w)}
                            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all active:scale-95 ${
                              weeks === w
                                ? 'border-brand bg-brand/10 text-foreground'
                                : 'border-border/50 hover:border-brand/30 text-muted-foreground'
                            }`}
                          >
                            <span className={`text-2xl font-black ${weeks === w ? 'text-brand' : ''}`}>
                              {w}
                            </span>
                            <span className="font-black text-xs uppercase tracking-wider">
                              Weeks
                            </span>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">
                              {labels[w]}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* AI deload info box */}
                    <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 text-sm text-muted-foreground">
                      🧠 Your AI coach will call a deload automatically based on how your body responds — no manual tracking needed.
                    </div>

                    <button
                      onClick={goNext}
                      disabled={!weeks}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-background font-semibold py-4 rounded-md uppercase tracking-wider transition-all active:scale-95"
                    >
                      Lock It In →
                    </button>
                  </div>
                )}

                {/* ── Step 5: Starting Weights ── */}
                {step === 5 && selectedProgram && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase mb-1">
                        Your Starting Weights
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Enter the most weight you can lift for 5 solid reps. We handle the math from there.
                      </p>
                    </div>

                    {/* Calibration info box */}
                    <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 text-sm text-muted-foreground">
                      🎯 <strong className="text-foreground">Use your 5-rep max — not your true max.</strong> We convert these numbers automatically so your first workout starts at the right intensity. You always pick the exact weight on the day — we just give you a smart starting point.
                    </div>

                    <div className="space-y-3">
                      {(CALIBRATION_LIFTS[selectedProgram.slug] ?? []).map(({ key, label, hint, unit }) => (
                        <div key={key} className="glass-card rounded-xl p-4 border border-border/50">
                          <label className="block text-xs font-black uppercase tracking-wider mb-1">{label}</label>
                          <p className="text-[10px] text-muted-foreground mb-3">{hint}</p>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              inputMode="numeric"
                              placeholder={unit === 'lbs' ? '135' : '10'}
                              value={calibrationWeights[key] ?? ''}
                              onChange={e => setCalibrationWeights(prev => ({ ...prev, [key]: e.target.value }))}
                              className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-lg font-black stat-num text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand transition-colors"
                            />
                            <span className="text-sm font-black text-muted-foreground uppercase tracking-wider w-8">{unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Skip option */}
                    <p className="text-center text-[10px] text-muted-foreground">
                      Not sure? Leave blank and adjust during your first session.
                    </p>

                    <button
                      onClick={goNext}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-background font-semibold py-4 rounded-md uppercase tracking-wider transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 6: Confirmation ── */}
                {step === 6 && selectedProgram && effectiveDays && weeks && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Program hero */}
                    <div className="flex flex-col items-center text-center gap-2 pt-2 pb-4">
                      <span className="text-5xl">{selectedProgram.icon}</span>
                      <h2 className="text-2xl font-display tracking-[0.08em] uppercase">
                        {selectedProgram.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">{selectedProgram.tagline}</p>
                    </div>

                    {/* Summary pills */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="glass-card rounded-xl p-3 border border-border/50 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Gym
                        </p>
                        <p className="text-sm font-black">
                          {effectiveGymType === 'home' ? '🏠 Home' : '🏢 Commercial'}
                        </p>
                      </div>
                      <div className="glass-card rounded-xl p-3 border border-border/50 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Days / Week
                        </p>
                        <p className="text-sm font-black">{effectiveDays} Days</p>
                      </div>
                      <div className="glass-card rounded-xl p-3 border border-border/50 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Length
                        </p>
                        <p className="text-sm font-black">{weeks} Weeks</p>
                      </div>
                      <div className="glass-card rounded-xl p-3 border border-border/50 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                          Starts
                        </p>
                        <p className="text-sm font-black">{formatDate(nextMonday)}</p>
                      </div>
                    </div>

                    <button
                      onClick={handleConfirm}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-foreground font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand/20"
                    >
                      Start Program
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
