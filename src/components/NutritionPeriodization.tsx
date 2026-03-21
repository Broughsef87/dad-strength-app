'use client'

import { useState, useEffect } from 'react'
import { Zap, Scale, Scissors } from 'lucide-react'

const PHASE_KEY = 'dad-strength-nutrition-phase'
const BW_KEY = 'dad-strength-bodyweight'
const PROTEIN_GOAL_KEY = 'dad-strength-protein-goal'

type Phase = 'build' | 'cut' | 'maintain'

interface PhaseConfig {
  id: Phase
  label: string
  emoji: string
  Icon: React.ElementType
  description: string
  proteinMultiplier: number
  kcalRange: [number, number]
}

const PHASES: PhaseConfig[] = [
  {
    id: 'build',
    label: 'Build',
    emoji: '🔥',
    Icon: Zap,
    description: 'Muscle Gain',
    proteinMultiplier: 1.0,
    kcalRange: [16, 18],
  },
  {
    id: 'cut',
    label: 'Cut',
    emoji: '✂️',
    Icon: Scissors,
    description: 'Fat Loss',
    proteinMultiplier: 1.2,
    kcalRange: [12, 14],
  },
  {
    id: 'maintain',
    label: 'Maintain',
    emoji: '⚖️',
    Icon: Scale,
    description: 'Body Recomp',
    proteinMultiplier: 0.8,
    kcalRange: [14, 16],
  },
]

interface StoredPhase {
  phase: Phase
  startDate: string
  bodyweight: string
}

function getDaysSince(dateStr: string): number {
  try {
    const start = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff + 1)
  } catch {
    return 1
  }
}

export default function NutritionPeriodization() {
  const [phase, setPhase] = useState<Phase>('maintain')
  const [startDate, setStartDate] = useState<string>(new Date().toISOString())
  const [bodyweight, setBodyweight] = useState('')
  const [justUpdated, setJustUpdated] = useState(false)

  useEffect(() => {
    try {
      const savedPhase = localStorage.getItem(PHASE_KEY)
      const savedBw = localStorage.getItem(BW_KEY)

      if (savedPhase) {
        const data: StoredPhase = JSON.parse(savedPhase)
        setPhase(data.phase)
        setStartDate(data.startDate)
        setBodyweight(data.bodyweight ?? '')
      }
      if (savedBw && !savedPhase) {
        setBodyweight(savedBw)
      } else if (savedPhase) {
        const data: StoredPhase = JSON.parse(savedPhase)
        if (!data.bodyweight && savedBw) setBodyweight(savedBw)
      }
    } catch {}
  }, [])

  const persist = (newPhase: Phase, newBw: string, newStartDate?: string) => {
    const date = newStartDate ?? startDate
    try {
      localStorage.setItem(PHASE_KEY, JSON.stringify({
        phase: newPhase,
        startDate: date,
        bodyweight: newBw,
      }))
      localStorage.setItem(BW_KEY, newBw)

      const bwNum = parseFloat(newBw)
      const config = PHASES.find(p => p.id === newPhase)!
      if (bwNum > 0) {
        const proteinGoal = Math.round(bwNum * config.proteinMultiplier)
        localStorage.setItem(PROTEIN_GOAL_KEY, String(proteinGoal))
        setJustUpdated(true)
        setTimeout(() => setJustUpdated(false), 2500)
      }
    } catch {}
  }

  const selectPhase = (p: Phase) => {
    const now = new Date().toISOString()
    setPhase(p)
    setStartDate(now)
    persist(p, bodyweight, now)
  }

  const updateBodyweight = (val: string) => {
    setBodyweight(val)
    persist(phase, val)
  }

  const bwNum = parseFloat(bodyweight)
  const config = PHASES.find(p => p.id === phase)!
  const proteinTarget = bwNum > 0 ? Math.round(bwNum * config.proteinMultiplier) : null
  const kcalLow = bwNum > 0 ? Math.round(bwNum * config.kcalRange[0]) : null
  const kcalHigh = bwNum > 0 ? Math.round(bwNum * config.kcalRange[1]) : null
  const dayNumber = getDaysSince(startDate)

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          Nutrition Phase
        </p>
        {bwNum > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Day {dayNumber} of {config.label}
          </span>
        )}
      </div>

      {/* Phase selector */}
      <div className="grid grid-cols-3 gap-2">
        {PHASES.map(p => {
          const isSelected = phase === p.id
          return (
            <button
              key={p.id}
              onClick={() => selectPhase(p.id)}
              className={`relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl border transition-all ${
                isSelected
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border/50 bg-muted/50 text-muted-foreground hover:border-brand/30 hover:text-foreground'
              }`}
            >
              <p.Icon className="w-4 h-4" strokeWidth={isSelected ? 2.5 : 1.75} />
              <span className="text-xs font-semibold">{p.label}</span>
              <span className="text-[9px] opacity-70">{p.description}</span>
              {isSelected && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand" />
              )}
            </button>
          )
        })}
      </div>

      {/* Bodyweight */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          Bodyweight (lbs)
        </label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="e.g. 185"
          value={bodyweight}
          onChange={e => updateBodyweight(e.target.value)}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Targets */}
      {bwNum > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {/* Protein */}
          <div className="bg-brand/8 border border-brand/20 rounded-xl p-3 space-y-0.5">
            <p className="text-[9px] uppercase tracking-wider text-brand font-medium">Protein</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-light stat-num">{proteinTarget}</span>
              <span className="text-xs text-brand mb-0.5">g/day</span>
            </div>
            <p className="text-[9px] text-muted-foreground">{config.proteinMultiplier}g per lb</p>
          </div>
          {/* Calories */}
          <div className="bg-muted/70 border border-border/50 rounded-xl p-3 space-y-0.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Calories</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-light stat-num">{kcalLow}–{kcalHigh}</span>
            </div>
            <p className="text-[9px] text-muted-foreground">{config.kcalRange[0]}–{config.kcalRange[1]}× BW</p>
          </div>
        </div>
      )}

      {/* Integration note */}
      {proteinTarget && (
        <p className={`text-[10px] transition-colors duration-300 ${justUpdated ? 'text-brand' : 'text-muted-foreground'}`}>
          {justUpdated
            ? `Protein tracker updated to ${proteinTarget}g`
            : `Your protein target in the tracker above has been updated to ${proteinTarget}g`
          }
        </p>
      )}
    </div>
  )
}
