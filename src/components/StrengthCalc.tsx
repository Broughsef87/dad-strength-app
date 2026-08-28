'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, ChevronDown, ChevronUp } from 'lucide-react'
import { e1rm, MAX_E1RM_REPS } from '../lib/analytics/training'

const STORAGE_KEY = 'dad-strength-1rm-calc'
const BW_KEY = 'dad-strength-bodyweight'

type Exercise = 'Bench Press' | 'Squat' | 'Deadlift' | 'Overhead Press' | 'Barbell Row' | 'Custom'

interface CalcState {
  exercise: Exercise
  weight: string
  reps: string
  bodyweight: string
}

interface Standards {
  beginner: number
  intermediate: number
  advanced: number
  elite: number
}

const STANDARDS: Record<Exclude<Exercise, 'Custom'>, Standards> = {
  'Bench Press':     { beginner: 0.5,  intermediate: 1.0,  advanced: 1.5,  elite: 2.0  },
  'Squat':           { beginner: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5  },
  'Deadlift':        { beginner: 1.0,  intermediate: 1.5,  advanced: 2.0,  elite: 2.75 },
  'Overhead Press':  { beginner: 0.35, intermediate: 0.65, advanced: 0.85, elite: 1.1  },
  'Barbell Row':     { beginner: 0.5,  intermediate: 0.75, advanced: 1.0,  elite: 1.25 },
}

const EXERCISES: Exercise[] = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Custom']

type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite' | null

// e1RM comes from src/lib/analytics/training.ts — there is exactly one estimator
// in the app now. The local copy here was the same Epley formula MISSING the
// >10-rep guard, so at 12 reps this card printed a confident number while
// Training Data, one screen away, printed nothing for the same set. Two answers
// to one question reads as a broken app, and a second copy of the rule would
// drift again. See FOR-183 §2 item 7.

function getLevel(oneRM: number, bw: number, exercise: Exercise): { level: Level; progress: number } {
  if (exercise === 'Custom' || bw <= 0 || oneRM <= 0) return { level: null, progress: 0 }
  const s = STANDARDS[exercise]
  const ratio = oneRM / bw

  if (ratio < s.beginner) {
    const progress = Math.max(0, (ratio / s.beginner) * 100)
    return { level: 'Beginner', progress }
  }
  if (ratio < s.intermediate) {
    const progress = ((ratio - s.beginner) / (s.intermediate - s.beginner)) * 100
    return { level: 'Intermediate', progress }
  }
  if (ratio < s.advanced) {
    const progress = ((ratio - s.intermediate) / (s.advanced - s.intermediate)) * 100
    return { level: 'Advanced', progress }
  }
  const progress = Math.min(100, ((ratio - s.advanced) / (s.elite - s.advanced)) * 100)
  return { level: ratio >= s.elite ? 'Elite' : 'Advanced', progress: ratio >= s.elite ? 100 : progress }
}

function getStrengthAge(level: Level): string {
  switch (level) {
    case 'Beginner':     return '50s'
    case 'Intermediate': return '40s'
    case 'Advanced':     return '30s'
    case 'Elite':        return '20s'
    default:             return '—'
  }
}

const LEVEL_COLORS: Record<NonNullable<Level>, string> = {
  Beginner:     'text-muted-foreground',
  Intermediate: 'text-brand',
  Advanced:     'text-brand',
  Elite:        'text-brand',
}

const LEVEL_ORDER: NonNullable<Level>[] = ['Beginner', 'Intermediate', 'Advanced', 'Elite']

export default function StrengthCalc() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CalcState>({
    exercise: 'Bench Press',
    weight: '',
    reps: '',
    bodyweight: '',
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const bw = localStorage.getItem(BW_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        setState(prev => ({
          ...prev,
          exercise: data.exercise ?? prev.exercise,
          weight: data.weight ?? prev.weight,
          reps: data.reps ?? prev.reps,
          bodyweight: data.bodyweight ?? (bw ?? prev.bodyweight),
        }))
      } else if (bw) {
        setState(prev => ({ ...prev, bodyweight: bw }))
      }
    } catch {}
  }, [])

  const update = (field: keyof CalcState, value: string) => {
    const next = { ...state, [field]: value }
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        exercise: next.exercise,
        weight: next.weight,
        reps: next.reps,
        bodyweight: next.bodyweight,
      }))
      if (field === 'bodyweight') {
        localStorage.setItem(BW_KEY, value)
      }
    } catch {}
  }

  const w = parseFloat(state.weight)
  const r = parseFloat(state.reps)
  const bw = parseFloat(state.bodyweight)
  // Three states, not two: nothing entered yet, a usable estimate, or a set too
  // long for Epley to mean anything. The old code collapsed the last two into 0
  // and silently rendered nothing, which is why the disagreement went unnoticed.
  const hasInput = !isNaN(w) && !isNaN(r) && w > 0 && r > 0
  const oneRM = hasInput ? e1rm(w, r) : null
  const overRepCap = hasInput && r > MAX_E1RM_REPS
  const { level, progress } = getLevel(oneRM ?? 0, bw, state.exercise)
  const strengthAge = getStrengthAge(level)
  const standards = state.exercise !== 'Custom' ? STANDARDS[state.exercise] : null

  return (
    <div className="tile rounded-xl overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Dumbbell className="w-4 h-4 text-brand" strokeWidth={2} />
          <span className="text-sm font-medium tracking-tight">1RM Calculator</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Bodyweight */}
          <div className="space-y-1.5">
            <label className="text-[10px] lowercase text-muted-foreground font-medium">
              Your Bodyweight (lbs)
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 185"
              value={state.bodyweight}
              onChange={e => update('bodyweight', e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Exercise + inputs row */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] lowercase text-muted-foreground font-medium">
                Exercise
              </label>
              <select
                value={state.exercise}
                onChange={e => update('exercise', e.target.value as Exercise)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50"
              >
                {EXERCISES.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] lowercase text-muted-foreground font-medium">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 225"
                  value={state.weight}
                  onChange={e => update('weight', e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] lowercase text-muted-foreground font-medium">
                  Reps
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 5"
                  value={state.reps}
                  onChange={e => update('reps', e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </div>

          {/* Past the rep cap Epley stops estimating and starts guessing, so the
              card says so instead of printing a number it cannot stand behind. */}
          {overRepCap && (
            <div className="row-recessed rounded-xl p-4 space-y-1">
              <p className="eyebrow-mono">estimate unavailable</p>
              <p className="text-sm text-muted-foreground">
                Over {MAX_E1RM_REPS} reps — the estimate isn&apos;t reliable that far out.
                Work up to a heavier set and try again.
              </p>
            </div>
          )}

          {/* 1RM Result */}
          {oneRM != null && (
            <div className="bg-brand/8 border border-brand/20 rounded-xl p-4 space-y-1">
              <p className="text-[10px] lowercase text-brand font-medium">Estimated 1RM</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-light stat-num text-foreground">{Math.round(oneRM)}</span>
                <span className="text-sm text-brand mb-1">lbs</span>
              </div>
              {level && (
                <p className="text-xs text-muted-foreground">
                  Your {state.exercise} strength is that of a strong person in their{' '}
                  <span className="text-brand font-medium">{strengthAge}</span>.
                </p>
              )}
            </div>
          )}

          {/* Level + progress */}
          {oneRM != null && level && standards && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] lowercase text-muted-foreground font-medium">
                  Strength Level
                </p>
                <span className={`text-xs font-semibold ${LEVEL_COLORS[level]}`}>
                  {level}
                </span>
              </div>

              {/* 4-segment progress bar */}
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {LEVEL_ORDER.map((lvl) => {
                    const isActive = LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(level)
                    const isCurrent = lvl === level
                    return (
                      <div key={lvl} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                        {isActive && (
                          <div
                            className="h-full bg-brand rounded-full transition-all duration-500"
                            style={{ width: isCurrent ? `${progress}%` : '100%' }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between">
                  {LEVEL_ORDER.map(lvl => (
                    <span
                      key={lvl}
                      className={`text-[9px] lowercase ${lvl === level ? 'text-brand font-semibold' : 'text-muted-foreground/60'}`}
                    >
                      {lvl}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Benchmarks table */}
          {standards && bw > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] lowercase text-muted-foreground font-medium">
                {state.exercise} Standards at {bw}lbs BW
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {LEVEL_ORDER.map(lvl => {
                  const multiplier = standards[lvl.toLowerCase() as keyof Standards]
                  const target = Math.round(bw * multiplier)
                  const isReached = oneRM != null && Math.round(oneRM) >= target
                  return (
                    <div
                      key={lvl}
                      className={`rounded-lg p-2 text-center border transition-colors ${
 isReached
 ? 'border-brand/30 bg-brand/8'
 : 'border-border/50 bg-muted/50'
 }`}
                    >
                      <p className={`text-[9px] lowercase font-medium mb-0.5 ${isReached ? 'text-brand' : 'text-muted-foreground/60'}`}>
                        {lvl.slice(0, 3)}
                      </p>
                      <p className={`text-sm font-semibold stat-num ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {target}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60">{multiplier}×</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
