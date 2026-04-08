'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Dumbbell, ChevronRight, Flame, CheckCircle2 } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { createClient } from '../../utils/supabase/client'
import type { ActiveProgramData } from '../../types/program'

// ── Constants ────────────────────────────────────────────────────────────────

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL

const CALIBRATION_LIFTS = [
  { key: 'bench',    label: 'Bench Press',   hint: '5RM — heaviest set of 5 clean reps' },
  { key: 'squat',    label: 'Back Squat',    hint: '5RM — heaviest set of 5 clean reps' },
  { key: 'deadlift', label: 'Deadlift',      hint: '5RM — heaviest set of 5 clean reps' },
  { key: 'ohp',      label: 'Overhead Press',hint: '5RM — heaviest set of 5 clean reps' },
  { key: 'row',      label: 'Barbell Row',   hint: '5RM — heaviest set of 5 clean reps' },
]

const DAY_STRUCTURES: Record<number, string[]> = {
  3: ['Chest & Triceps', 'Back & Biceps', 'Legs & Shoulders'],
  5: ['Chest', 'Back', 'Shoulders & Arms', 'Legs', 'Arms & Weak Points'],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ForgePage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [mounted, setMounted] = useState(false)
  const [days, setDays] = useState<3 | 5>(5)
  const [weights, setWeights] = useState<Record<string, string>>({
    bench: '', squat: '', deadlift: '', ohp: '', row: '',
  })
  const [activating, setActivating] = useState(false)
  const [done, setDone] = useState(false)
  const [existingProgram, setExistingProgram] = useState<ActiveProgramData | null>(null)

  useEffect(() => {
    setMounted(true)
    // Check if golden-era already active
    try {
      const raw = localStorage.getItem('dad-strength-active-program')
      if (raw) {
        const p = JSON.parse(raw) as ActiveProgramData
        if (p.slug?.startsWith('golden-era')) {
          setExistingProgram(p)
        }
      }
    } catch { /* noop */ }
  }, [])

  // ── Gate: not logged in ───────────────────────────────────────────────────
  if (!mounted || loading) {
    return <div className="min-h-screen bg-background" />
  }

  // ── Gate: not the owner — render nothing, not even a 404 ─────────────────
  if (!user || (OWNER_EMAIL && user.email !== OWNER_EMAIL)) {
    return <div className="min-h-screen bg-background" />
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getNextMonday(): Date {
    const today = new Date()
    const day = today.getDay()
    const daysUntilMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + daysUntilMonday)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  async function activate() {
    if (!user) return
    setActivating(true)

    const slug = `golden-era-${days}` as const
    const startMonday = getNextMonday()

    // Convert 5RMs → 1RMs (Epley: 5RM × 1.167)
    const oneRepMaxes: Record<string, number> = {}
    for (const [key, val] of Object.entries(weights)) {
      const num = parseFloat(val) || 0
      if (num > 0) {
        oneRepMaxes[key] = Math.round((num * 1.167) / 2.5) * 2.5
      }
    }

    const data: ActiveProgramData = {
      slug,
      name: 'Golden Era',
      startedAt: startMonday.toISOString(),
      currentWeek: 1,
      trainingAge: 'intermediate',
      primaryGoal: 'hypertrophy',
      equipment: {},
      daysCount: days,
      dayNames: DAY_STRUCTURES[days],
    }

    // Save to localStorage
    localStorage.setItem('dad-strength-active-program', JSON.stringify(data))
    localStorage.setItem('dad-strength-one-rep-maxes', JSON.stringify(oneRepMaxes))
    // Clear any cached workouts from a previous program
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('dad-strength-wip-') || k?.startsWith('dad-strength-week-progress-')) {
        localStorage.removeItem(k)
        i--
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
        preferences: {
          gymType: 'commercial',
          weeks: 6,
          calibrationWeights: weights,
        },
      },
      { onConflict: 'user_id' }
    )

    setActivating(false)
    setDone(true)

    setTimeout(() => {
      router.push('/workout/program/1')
    }, 1200)
  }

  const allWeightsFilled = CALIBRATION_LIFTS.every(l => parseFloat(weights[l.key]) > 0)

  // ── Already active — Continue state ───────────────────────────────────────
  if (existingProgram) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <ForgeHeader onBack={() => router.back()} />
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20 gap-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-brand font-semibold font-display mb-4">
              Active Program
            </div>
            <h2 className="font-display text-5xl tracking-[0.12em] uppercase text-foreground">
              Golden Era
            </h2>
            <p className="text-muted-foreground text-sm">
              Week {existingProgram.currentWeek} · {existingProgram.daysCount}-day split
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="ds-card w-full max-w-sm p-5 space-y-2"
          >
            {DAY_STRUCTURES[existingProgram.daysCount as 3 | 5].map((name, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-surface-3 border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
                  {i + 1}
                </span>
                {name}
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="flex flex-col gap-3 w-full max-w-sm"
          >
            <button
              onClick={() => router.push('/workout/program/1')}
              className="w-full py-4 rounded-xl bg-brand text-background font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2"
            >
              <Flame size={16} />
              Continue Training
            </button>
            <button
              onClick={() => setExistingProgram(null)}
              className="w-full py-3 rounded-xl border border-border text-muted-foreground text-xs font-medium"
            >
              Reconfigure
            </button>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── Setup flow ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ForgeHeader onBack={() => router.back()} />

      <main className="flex-1 max-w-md mx-auto w-full px-6 pb-28 pt-2 space-y-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-brand font-semibold font-display mb-2">
            Hidden Program
          </div>
          <h1 className="font-display text-5xl tracking-[0.1em] uppercase leading-none mb-3">
            Golden Era
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Classic bodybuilding. Full pumps. Peak contraction. The physique-first program
            your commercial gym was built for.
          </p>
        </motion.div>

        {/* Day split selector */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-3"
        >
          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold font-display">
            Days per Week
          </label>

          <div className="grid grid-cols-2 gap-3">
            {([3, 5] as const).map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`ds-card p-4 text-left transition-all duration-200 border-2 ${
                  days === d
                    ? 'border-brand'
                    : 'border-transparent'
                }`}
              >
                <div className={`font-display text-3xl tracking-widest mb-1 ${days === d ? 'text-brand' : 'text-foreground'}`}>
                  {d}
                </div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
                  Days / Week
                </div>
                <div className="mt-3 space-y-0.5">
                  {DAY_STRUCTURES[d].map((name, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-surface-3 border border-border flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-foreground">
                        {i + 1}
                      </span>
                      {name}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Calibration weights */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="space-y-3"
        >
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold font-display">
              Calibration
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your 5RM — the heaviest weight you can lift for exactly 5 clean reps.
            </p>
          </div>

          <div className="ds-card divide-y divide-border overflow-hidden">
            {CALIBRATION_LIFTS.map((lift, i) => (
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
                    value={weights[lift.key]}
                    onChange={e => setWeights(prev => ({ ...prev, [lift.key]: e.target.value }))}
                    className="w-16 text-right bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-brand transition-colors"
                  />
                  <span className="text-xs text-muted-foreground w-6">lbs</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Activate button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full py-4 rounded-xl bg-brand/10 border border-brand/30 text-brand font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                Activated — Loading Day 1
              </motion.div>
            ) : (
              <motion.button
                key="activate"
                onClick={activate}
                disabled={activating || !allWeightsFilled}
                className={`w-full py-4 rounded-xl font-display tracking-[0.08em] uppercase text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                  allWeightsFilled && !activating
                    ? 'bg-brand text-background shadow-lg shadow-brand/20'
                    : 'bg-surface-3 text-muted-foreground cursor-not-allowed'
                }`}
              >
                {activating ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-background/40 border-t-background animate-spin" />
                    Forging…
                  </>
                ) : (
                  <>
                    <Dumbbell size={16} />
                    Forge It
                    <ChevronRight size={14} />
                  </>
                )}
              </motion.button>
            )}
          </AnimatePresence>

          {!allWeightsFilled && !activating && (
            <p className="text-center text-[11px] text-muted-foreground mt-2">
              Fill in all 5 calibration lifts to continue
            </p>
          )}
        </motion.div>

        {/* Small note */}
        <p className="text-center text-[10px] text-muted-foreground/50 pb-4">
          This program is only visible to you.
        </p>

      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ForgeHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-surface-2 border-b border-border">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="font-display tracking-[0.2em] uppercase text-xs text-muted-foreground">
          The Forge
        </span>
      </div>
    </header>
  )
}
