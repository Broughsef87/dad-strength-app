'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
}

// ── Program data ──────────────────────────────────────────────────────────────

const PROGRAMS = [
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
  },
  {
    slug: 'the-squeeze',
    name: 'The Squeeze',
    tagline: 'Maintenance Mode',
    description:
      '15-20 minute sessions. No equipment. No excuses. When life is in total chaos, this keeps the habit alive and the joints moving.',
    vibe: 'Minimal + Consistent',
    icon: '⚡',
    gymTypes: ['commercial', 'home'],
    availableDays: [3],
    lockedDays: 3,
  },
  {
    slug: 'shredded-home',
    name: 'Shredded from Home',
    tagline: 'Garage Gains',
    description:
      'Calisthenics-first with dumbbells and kettlebells. High reps, circuits, HIIT. Look shredded without leaving your garage.',
    vibe: 'Calisthenics + HIIT',
    icon: '🔥',
    gymTypes: ['home'],
    availableDays: [3, 5],
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
  },
  {
    slug: 'hybrid-athlete',
    name: 'Hybrid Athlete',
    tagline: 'Built Different',
    description:
      'Bodybuilding + HIIT + circuits. CrossFit energy, bodybuilder physique. For the competitive dads who need a challenge.',
    vibe: 'Power + Conditioning',
    icon: '⚔️',
    gymTypes: ['commercial', 'home'],
    availableDays: [3, 5],
  },
] as const

type ProgramSlug = typeof PROGRAMS[number]['slug']

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

type Step = 1 | 2 | 3 | 4 | 5

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProgramSelector({ activeSlug, onProgramSelected }: ProgramSelectorProps) {
  const supabase = createClient()
  const { user } = useUser()

  const [open, setOpen] = useState(false)
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

  const selectedProgram = PROGRAMS.find(p => p.slug === selectedSlug) ?? null

  // ── Derived ─────────────────────────────────────────────────────────────────

  const autoGymType: 'commercial' | 'home' | null = selectedProgram
    ? selectedProgram.gymTypes.length === 1
      ? (selectedProgram.gymTypes[0] as 'commercial' | 'home')
      : null
    : null

  const effectiveGymType = autoGymType ?? gymType

  const lockedDays = selectedProgram && 'lockedDays' in selectedProgram
    ? (selectedProgram as typeof PROGRAMS[1]).lockedDays
    : null

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
  }

  function goBack() {
    setStep(prev => (prev > 1 ? ((prev - 1) as Step) : prev))
  }

  function goNext() {
    setStep(prev => (prev < 5 ? ((prev + 1) as Step) : prev))
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

    localStorage.setItem('dad-strength-active-program', JSON.stringify(data))

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
            },
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save program to Supabase:', error)
        })
    }

    closeSheet()
    onProgramSelected?.(data)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const TOTAL_STEPS = 5
  const nextMonday = getNextMonday()

  return (
    <>
      {/* Trigger */}
      <div className="glass-card rounded-2xl p-5 border border-border/50">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
          Training Program
        </p>
        <button
          onClick={openSheet}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-foreground font-black py-4 rounded-2xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand/20"
        >
          Choose Your Program →
        </button>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              onClick={closeSheet}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-3xl max-h-[90vh] overflow-y-auto"
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
                {/* Back button (steps 2–5) */}
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
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">
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
                        return (
                          <button
                            key={program.slug}
                            onClick={() => setSelectedSlug(program.slug)}
                            className={`w-full text-left glass-card rounded-2xl p-4 border transition-all duration-200 active:scale-[0.98] ${
                              isSelected
                                ? 'border-brand bg-brand/5'
                                : 'border-border/50 hover:border-brand/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xl flex-shrink-0">{program.icon}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-lg font-black uppercase italic tracking-tight leading-tight">
                                      {program.name}
                                    </span>
                                    {isActive && (
                                      <span className="text-[9px] uppercase tracking-widest font-black bg-brand/15 text-brand border border-brand/30 rounded-full px-2 py-0.5">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-medium">
                                    {program.tagline}
                                  </p>
                                </div>
                              </div>
                              <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 rounded-full px-2.5 py-1 whitespace-nowrap">
                                {program.vibe}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {program.description}
                            </p>
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={goNext}
                      disabled={!selectedSlug}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 2: Your Setup ── */}
                {step === 2 && selectedProgram && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">
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
                        className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-95 ${
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
                        className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-95 ${
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
                                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] ${
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
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 3: Your Schedule ── */}
                {step === 3 && selectedProgram && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">
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
                          className={`w-full text-left flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98] ${
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
                          className={`w-full text-left flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98] ${
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
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                    >
                      Next →
                    </button>
                  </div>
                )}

                {/* ── Step 4: Program Length ── */}
                {step === 4 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-1">
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
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95"
                    >
                      Lock It In →
                    </button>
                  </div>
                )}

                {/* ── Step 5: Confirmation ── */}
                {step === 5 && selectedProgram && effectiveDays && weeks && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Program hero */}
                    <div className="flex flex-col items-center text-center gap-2 pt-2 pb-4">
                      <span className="text-5xl">{selectedProgram.icon}</span>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter">
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
