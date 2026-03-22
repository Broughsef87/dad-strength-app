'use client'

import { useState, useEffect } from 'react'
import {
  Dumbbell, Check, ChevronRight, X, Zap, Home, BarChart2,
  Flame, Trophy, Calendar
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'

// ── Program data ─────────────────────────────────────────
const PROGRAMS = [
  {
    slug: 'dad-strong-5',
    name: 'Dad Strong',
    days: '5 days',
    daysCount: 5,
    description: 'Old man strength meets functional power. Carry the groceries. Move the couch. Outlift guys half your age.',
    tags: ['Barbell', 'Hypertrophy', 'Strength'],
    icon: Dumbbell,
    defaultEquipment: { barbell_rack: true, bench: true, cable_machine: true, dumbbells: true, kettlebell: true, pullup_bar: true, resistance_bands: true },
    needsEquipmentStep: true,
    dayNames: ['Day 1 — Pressing', 'Day 2 — Pulling', 'Day 3 — Legs', 'Day 4 — Shoulders & Arms', 'Day 5 — Full Body Power'],
  },
  {
    slug: 'the-squeeze-3',
    name: 'The Squeeze',
    days: '3 days',
    daysCount: 3,
    description: '15-20 min maintenance sessions. No excuses, no equipment. The bar is so low you can\'t say no.',
    tags: ['Bodyweight', 'Maintenance', 'No Equipment'],
    icon: Zap,
    defaultEquipment: {},
    needsEquipmentStep: false,
    dayNames: ['Day 1 — Upper Push', 'Day 2 — Lower Body', 'Day 3 — Full Body Circuit'],
  },
  {
    slug: 'shredded-home-5',
    name: 'Shredded from Home',
    days: '5 days',
    daysCount: 5,
    description: 'Calisthenics-first with DBs/KBs. High reps, circuits, HIIT. Look shredded without leaving your garage.',
    tags: ['Dumbbells', 'Calisthenics', 'Fat Loss'],
    icon: Flame,
    defaultEquipment: { dumbbells: true, kettlebell: true, pullup_bar: true, resistance_bands: true },
    needsEquipmentStep: true,
    dayNames: ['Day 1 — Push Circuit', 'Day 2 — HIIT Cardio', 'Day 3 — Pull Circuit', 'Day 4 — Lower Body', 'Day 5 — Full Body Burnout'],
  },
  {
    slug: 'golden-era-5',
    name: 'Golden Era',
    days: '5 days',
    daysCount: 5,
    description: 'Classic bodybuilding for the dad who still has a gym membership and needs that third-place escape.',
    tags: ['Full Gym', 'Bodybuilding', 'Hypertrophy'],
    icon: Trophy,
    defaultEquipment: { barbell_rack: true, bench: true, cable_machine: true, dumbbells: true, pullup_bar: true },
    needsEquipmentStep: true,
    dayNames: ['Day 1 — Chest & Triceps', 'Day 2 — Back & Biceps', 'Day 3 — Shoulders', 'Day 4 — Legs', 'Day 5 — Arms & Core'],
  },
  {
    slug: 'hybrid-athlete-5',
    name: 'Hybrid Athlete',
    days: '5 days',
    daysCount: 5,
    description: 'Bodybuilding + HIIT + circuits. CrossFit energy, bodybuilder physique. For the competitive dads.',
    tags: ['Full Gym', 'HIIT', 'Circuits'],
    icon: BarChart2,
    defaultEquipment: { barbell_rack: true, bench: true, cable_machine: true, dumbbells: true, kettlebell: true, pullup_bar: true, resistance_bands: true },
    needsEquipmentStep: true,
    dayNames: ['Day 1 — Strength + HIIT', 'Day 2 — Upper Circuits', 'Day 3 — Conditioning', 'Day 4 — Lower Power', 'Day 5 — MetCon'],
  },
]

const EQUIPMENT_OPTIONS = [
  { key: 'barbell_rack', label: 'Barbell + Rack' },
  { key: 'bench', label: 'Bench' },
  { key: 'cable_machine', label: 'Cable Machine' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'pullup_bar', label: 'Pull-up Bar' },
  { key: 'resistance_bands', label: 'Resistance Bands' },
]

const TRAINING_AGES = ['Under 1 year', '1-3 years', '3-5 years', '5+ years']
const PRIMARY_GOALS = ['Build Muscle', 'Get Stronger', 'Lose Fat', 'Stay Consistent']

type OnboardingStep = 1 | 2 | 3

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
}

interface ProgramSelectorProps {
  activeSlug?: string | null
  onProgramSelected?: (data: ActiveProgramData) => void
}

function getNextMonday(): Date {
  const today = new Date()
  const day = today.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + (day === 1 ? 0 : daysUntilMonday))
  return monday
}

function formatMondayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function ProgramSelector({ activeSlug, onProgramSelected }: ProgramSelectorProps) {
  const supabase = createClient()
  const { user } = useUser()
  const [selectedProgram, setSelectedProgram] = useState<typeof PROGRAMS[0] | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(1)
  const [trainingAge, setTrainingAge] = useState('')
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [equipment, setEquipment] = useState<Record<string, boolean>>({})

  const handleSelectProgram = (program: typeof PROGRAMS[0]) => {
    setSelectedProgram(program)
    setEquipment({ ...program.defaultEquipment })
    setTrainingAge('')
    setPrimaryGoal('')
    setOnboardingStep(1)
    setShowOnboarding(true)
  }

  const handleCloseOnboarding = () => {
    setShowOnboarding(false)
    setSelectedProgram(null)
  }

  const handleNext = () => {
    if (onboardingStep === 1) {
      if (!selectedProgram) return
      if (selectedProgram.needsEquipmentStep) {
        setOnboardingStep(2)
      } else {
        setOnboardingStep(3)
      }
    } else if (onboardingStep === 2) {
      setOnboardingStep(3)
    }
  }

  const handleBack = () => {
    if (onboardingStep === 3) {
      if (selectedProgram?.needsEquipmentStep) {
        setOnboardingStep(2)
      } else {
        setOnboardingStep(1)
      }
    } else if (onboardingStep === 2) {
      setOnboardingStep(1)
    }
  }

  const handleStartProgram = () => {
    if (!selectedProgram) return
    const startMonday = getNextMonday()
    const data: ActiveProgramData = {
      slug: selectedProgram.slug,
      name: selectedProgram.name,
      startedAt: startMonday.toISOString(),
      currentWeek: 1,
      trainingAge,
      primaryGoal,
      equipment,
      daysCount: selectedProgram.daysCount,
      dayNames: selectedProgram.dayNames,
    }
    localStorage.setItem('dad-strength-active-program', JSON.stringify(data))
    // Persist to Supabase if user is authenticated
    if (user) {
      supabase.from('user_programs').upsert({
        user_id: user.id,
        slug: data.slug,
        started_at: data.startedAt,
        current_week: 1,
        status: 'active',
        equipment: data.equipment,
        preferences: { trainingAge: data.trainingAge, primaryGoal: data.primaryGoal },
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.error('Failed to save program to Supabase:', error)
      })
    }
    setShowOnboarding(false)
    onProgramSelected?.(data)
  }

  const step1Valid = trainingAge !== '' && primaryGoal !== ''
  const step3Valid = true
  const nextMonday = getNextMonday()

  const totalSteps = selectedProgram?.needsEquipmentStep ? 3 : 2
  const currentStepDisplay = onboardingStep === 3 ? totalSteps : onboardingStep === 2 ? 2 : 1

  return (
    <>
      {/* Program Grid */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
          Choose Your Protocol
        </p>
        {PROGRAMS.map((program) => {
          const Icon = program.icon
          const isActive = activeSlug === program.slug
          return (
            <div
              key={program.slug}
              className={`glass-card rounded-2xl p-5 border transition-all duration-200 ${
                isActive
                  ? 'border-brand/50 bg-brand/5'
                  : 'border-border/50 hover:border-brand/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl flex-shrink-0 ${isActive ? 'bg-brand text-foreground' : 'bg-brand/10 text-brand'}`}>
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-base uppercase italic tracking-tight leading-tight">
                        {program.name}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-black bg-brand/15 text-brand border border-brand/30 rounded-full px-2 py-0.5">
                          <Check size={8} strokeWidth={3} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 rounded-full px-2.5 py-1">
                  {program.days}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {program.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {program.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-bold uppercase tracking-widest bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={() => handleSelectProgram(program)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                  isActive
                    ? 'bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30'
                    : 'bg-card/80 text-muted-foreground border border-border hover:bg-brand hover:text-foreground hover:border-brand'
                }`}
              >
                {isActive ? (
                  <><Check size={12} strokeWidth={2.5} /> Running This Program</>
                ) : (
                  <><ChevronRight size={12} strokeWidth={2.5} /> Select Program</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Onboarding Bottom Sheet */}
      <AnimatePresence>
        {showOnboarding && selectedProgram && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={handleCloseOnboarding}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 rounded-t-3xl overflow-hidden"
              style={{ maxHeight: '90vh' }}
            >
              {/* Progress bar */}
              <div className="w-full h-0.5 bg-card">
                <div
                  className="h-full bg-brand transition-all duration-500"
                  style={{ width: `${(currentStepDisplay / totalSteps) * 100}%` }}
                />
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 2px)' }}>
                <div className="p-6 pb-safe-or-8">

                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[10px] font-black text-brand uppercase tracking-widest mb-0.5">
                        Step {currentStepDisplay} of {totalSteps}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {selectedProgram.name} · {selectedProgram.days}/week
                      </p>
                    </div>
                    <button
                      onClick={handleCloseOnboarding}
                      className="p-2 rounded-xl bg-card/80 text-muted-foreground hover:text-foreground border border-border transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Step 1 — Your Foundation */}
                  {onboardingStep === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Your Foundation</h2>
                        <p className="text-xs text-muted-foreground">Let's calibrate the program to where you are right now.</p>
                      </div>

                      {/* Training Age */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          How long have you been lifting seriously?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {TRAINING_AGES.map((age) => (
                            <button
                              key={age}
                              onClick={() => setTrainingAge(age)}
                              className={`py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all active:scale-95 ${
                                trainingAge === age
                                  ? 'bg-brand text-foreground border border-brand'
                                  : 'bg-card/60 text-muted-foreground border border-border hover:border-brand/40'
                              }`}
                            >
                              {age}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Primary Goal */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Primary goal
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {PRIMARY_GOALS.map((goal) => (
                            <button
                              key={goal}
                              onClick={() => setPrimaryGoal(goal)}
                              className={`py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all active:scale-95 ${
                                primaryGoal === goal
                                  ? 'bg-brand text-foreground border border-brand'
                                  : 'bg-card/60 text-muted-foreground border border-border hover:border-brand/40'
                              }`}
                            >
                              {goal}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={!step1Valid}
                        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                      >
                        Next <ChevronRight size={16} />
                      </button>
                    </div>
                  )}

                  {/* Step 2 — Your Equipment */}
                  {onboardingStep === 2 && selectedProgram.needsEquipmentStep && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Your Equipment</h2>
                        <p className="text-xs text-muted-foreground">Select everything you have access to.</p>
                      </div>

                      <div className="space-y-2">
                        {EQUIPMENT_OPTIONS.map(({ key, label }) => {
                          const checked = !!equipment[key]
                          return (
                            <button
                              key={key}
                              onClick={() => setEquipment(prev => ({ ...prev, [key]: !prev[key] }))}
                              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
                                checked
                                  ? 'bg-brand/10 border-brand/40 text-foreground'
                                  : 'bg-card/60 border-border text-muted-foreground hover:border-brand/30'
                              }`}
                            >
                              <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                              <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-all ${
                                checked ? 'bg-brand border-brand' : 'border-border'
                              }`}>
                                {checked && <Check size={10} strokeWidth={3} className="text-foreground" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleBack}
                          className="flex-1 py-4 rounded-2xl border border-border text-muted-foreground font-black text-xs uppercase tracking-widest hover:border-brand/30 transition-all"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleNext}
                          className="flex-[2] flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3 — Lock It In */}
                  {onboardingStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">Lock It In</h2>
                        <p className="text-xs text-muted-foreground">Your protocol is ready to deploy.</p>
                      </div>

                      {/* Summary card */}
                      <div className="glass-card rounded-2xl p-5 border border-brand/20 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-brand rounded-xl">
                            {(() => { const Icon = selectedProgram.icon; return <Icon size={18} className="text-foreground" /> })()}
                          </div>
                          <div>
                            <p className="font-black text-lg uppercase italic tracking-tight leading-tight">
                              {selectedProgram.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">{selectedProgram.days} / week</p>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Training age</span>
                            <span className="font-black text-foreground">{trainingAge}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Primary goal</span>
                            <span className="font-black text-brand">{primaryGoal}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Starting</span>
                            <span className="font-black text-foreground flex items-center gap-1">
                              <Calendar size={10} />
                              {formatMondayDate(nextMonday)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleStartProgram}
                        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-foreground font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand/20"
                      >
                        <Flame size={16} /> Start Program
                      </button>

                      <p className="text-center text-[10px] text-muted-foreground font-medium leading-relaxed px-4">
                        Your first week will be generated when you open your training
                      </p>

                      <button
                        onClick={handleBack}
                        className="w-full text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest hover:text-foreground transition-colors"
                      >
                        Go Back
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
