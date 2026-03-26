'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronDown, ChevronUp, Check, Plus } from 'lucide-react'
import { createClient } from '../../../utils/supabase/client'
import { useUser } from '../../../contexts/UserContext'

// ── Types ──────────────────────────────────────────────────────────────────

type A1Block = {
  blockId: 'A1'
  label: string
  type: 'straight_sets'
  sets: number
  reps: string
  restSeconds: number
  exercise: string
  targetWeight?: string
  scaleUp: string
  scaleDown: string
}

type A2Exercise = {
  name: string
  reps: string
  scaleDown?: string
}

type A2Block = {
  blockId: 'A2'
  label: string
  type: 'superset'
  rounds: number
  restBetweenRoundsSeconds: number
  exercises: A2Exercise[]
}

type FinisherBlock = {
  blockId: 'F'
  label: string
  type: 'amrap' | 'max_reps' | 'for_time'
  durationSeconds: number
  exercise: string
  instructions: string
  progressionNote: string
}

type CircuitExercise = {
  name: string
  reps: string
  scaleDown?: string
}

type CircuitBlock = {
  blockId: 'CIRCUIT'
  label: string
  type: 'circuit'
  rounds: number
  for_time: boolean
  exercises: CircuitExercise[]
}

type RecoveryExercise = {
  name: string
  duration: string
  notes?: string
}

type RecoveryBlock = {
  blockId: 'RECOVERY'
  label: string
  type: 'recovery'
  exercises: RecoveryExercise[]
}

type SqueezeBlock = A1Block | A2Block | FinisherBlock | CircuitBlock | RecoveryBlock

type SqueezeSession = {
  sessionTitle: string
  estimatedMinutes: number
  dayPattern: string
  isSubstitute: boolean
  coachNote: string
  blocks: SqueezeBlock[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getPatternPreview(dayNumber: number): string {
  const patterns: Record<number, string> = {
    1: 'Hinge + Push/Pull + Carry',
    2: 'Squat + Conditioning + Sprint',
    3: 'Push + Pull/Hinge + Core',
    4: 'Pull + Squat + Carry',
    5: 'Hinge + Push/Squat + AMRAP',
    6: 'Full Body Circuit',
    0: 'Active Recovery',
  }
  return patterns[(dayNumber + 1) % 7] ?? 'Hinge + Push/Pull + Carry'
}

// ── Sub-components ────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center brand-pulse">
          <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-brand" />
          </div>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="font-display text-base font-black uppercase tracking-widest text-foreground">
          Mixing your Squeeze...
        </p>
        <p className="text-sm text-muted-foreground">
          Building your 15-min session
        </p>
      </div>
    </div>
  )
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="space-y-2">
        <p className="text-base font-black uppercase tracking-tight text-foreground">Generation Failed</p>
        <p className="text-sm text-muted-foreground">
          Could not reach the AI coach. Check your connection and try again.
        </p>
      </div>
      <button
        onClick={onBack}
        className="px-6 py-3 rounded-xl bg-brand text-white font-black text-sm uppercase tracking-widest active:scale-95"
      >
        Go Back
      </button>
    </div>
  )
}

// ── A1 Block ──────────────────────────────────────────────────────────────

function A1BlockView({ block }: { block: A1Block }) {
  const [completedSets, setCompletedSets] = useState<boolean[]>(Array(block.sets).fill(false))
  const [weights, setWeights] = useState<string[]>(Array(block.sets).fill(''))
  const [reps, setReps] = useState<string[]>(Array(block.sets).fill(''))
  const [showScale, setShowScale] = useState(false)

  const toggleSet = (i: number) => {
    setCompletedSets(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-display font-black text-brand uppercase tracking-[0.15em]">A1</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{block.label}</span>
        </div>
        <h3 className="font-display text-xl font-black uppercase tracking-tight text-foreground">
          {block.exercise}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {block.sets} sets · {block.reps} reps · {block.restSeconds}s rest
        </p>
      </div>

      {/* Target weight badge */}
      {block.targetWeight && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
          <span className="text-xs font-black text-brand uppercase tracking-wider">{block.targetWeight}</span>
        </div>
      )}

      {/* Set cards */}
      <div className="space-y-2">
        {Array.from({ length: block.sets }, (_, i) => (
          <div
            key={i}
            className={`rounded-xl border transition-all duration-200 ${
              completedSets[i]
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-surface-3/50 border-border/50'
            }`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-xs font-black text-muted-foreground w-8 shrink-0 uppercase tracking-widest">
                S{i + 1}
              </span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={weights[i]}
                  onChange={e => {
                    const next = [...weights]
                    next[i] = e.target.value
                    setWeights(next)
                  }}
                  disabled={completedSets[i]}
                  placeholder="lbs"
                  className="stat-num w-16 bg-transparent text-sm font-bold text-foreground text-center outline-none border-b border-border/60 focus:border-brand py-0.5 disabled:opacity-60"
                />
                <span className="text-xs text-muted-foreground shrink-0">lbs</span>
              </div>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  value={reps[i]}
                  onChange={e => {
                    const next = [...reps]
                    next[i] = e.target.value
                    setReps(next)
                  }}
                  disabled={completedSets[i]}
                  placeholder={block.reps}
                  className="stat-num w-10 bg-transparent text-sm font-bold text-foreground text-center outline-none border-b border-border/60 focus:border-brand py-0.5 disabled:opacity-60"
                />
                <span className="text-xs text-muted-foreground shrink-0">reps</span>
              </div>
              {completedSets[i] ? (
                <button
                  onClick={() => toggleSet(i)}
                  className="w-14 flex justify-center"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check size={14} className="text-emerald-500" />
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => toggleSet(i)}
                  className="w-14 text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-lg bg-brand text-white active:scale-95 shrink-0"
                >
                  LOG
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Scale notes */}
      <button
        onClick={() => setShowScale(s => !s)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showScale ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span className="uppercase tracking-widest">Scale Options</span>
      </button>
      {showScale && (
        <div className="space-y-2 text-xs animate-float-up">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
            <span className="font-black text-emerald-500 uppercase tracking-wider">Scale Up: </span>
            <span className="text-muted-foreground">{block.scaleUp}</span>
          </div>
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
            <span className="font-black text-amber-500 uppercase tracking-wider">Scale Down: </span>
            <span className="text-muted-foreground">{block.scaleDown}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── A2 Block ──────────────────────────────────────────────────────────────

function A2BlockView({ block }: { block: A2Block }) {
  const [completedRounds, setCompletedRounds] = useState<boolean[]>(Array(block.rounds).fill(false))
  const [restCountdown, setRestCountdown] = useState<number | null>(null)
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const completeRound = (i: number) => {
    setCompletedRounds(prev => {
      const next = [...prev]
      next[i] = true
      return next
    })
    // Start rest timer if not last round
    if (i < block.rounds - 1) {
      setRestCountdown(block.restBetweenRoundsSeconds)
    }
  }

  useEffect(() => {
    if (restCountdown === null) return
    if (restCountdown <= 0) {
      setRestCountdown(null)
      return
    }
    restTimerRef.current = setInterval(() => {
      setRestCountdown(prev => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current)
    }
  }, [restCountdown])

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-display font-black text-brand uppercase tracking-[0.15em]">A2</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{block.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {block.rounds} ROUNDS · No rest between exercises · {block.restBetweenRoundsSeconds}s rest between rounds
        </p>
      </div>

      {/* Exercise pair display */}
      <div className="grid grid-cols-2 gap-2">
        {block.exercises.map((ex, i) => (
          <div key={i} className="rounded-xl bg-surface-3/50 border border-border/50 px-3 py-2.5">
            <p className="text-xs font-black text-foreground uppercase tracking-tight">{ex.name}</p>
            <p className="text-xs text-brand mt-0.5 font-bold">{ex.reps}</p>
            {ex.scaleDown && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{ex.scaleDown}</p>
            )}
          </div>
        ))}
      </div>

      {/* Round buttons */}
      <div className="space-y-2">
        {Array.from({ length: block.rounds }, (_, i) => (
          <div key={i}>
            {completedRounds[i] ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-xs font-black text-emerald-500 uppercase tracking-wider">
                  Round {i + 1} — Done
                </span>
                <Check size={16} className="text-emerald-500" />
              </div>
            ) : (
              <button
                onClick={() => completeRound(i)}
                disabled={i > 0 && !completedRounds[i - 1]}
                className="w-full py-3 rounded-xl bg-brand/10 border border-brand/30 text-brand font-black text-sm uppercase tracking-widest active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Round {i + 1} Complete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Rest countdown */}
      {restCountdown !== null && (
        <div className="text-center py-2 animate-float-up">
          <p className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-1">Rest</p>
          <p className="stat-num text-4xl font-black text-brand">{restCountdown}s</p>
        </div>
      )}
    </div>
  )
}

// ── Finisher Block ────────────────────────────────────────────────────────

function FinisherBlockView({ block }: { block: FinisherBlock }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [timeLeft, setTimeLeft] = useState(block.durationSeconds)
  const [repsCount, setRepsCount] = useState(0)
  const [resultText, setResultText] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setPhase('running')
    if (block.type === 'for_time') return // no timer for for_time
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setPhase('done')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="text-center">
        <span className="font-display text-sm font-black text-brand uppercase tracking-[0.2em]">
          FINISHER
        </span>
        <h3 className="font-display text-xl font-black uppercase tracking-tight text-foreground mt-1">
          {block.exercise}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{block.instructions}</p>
      </div>

      {block.type !== 'for_time' && phase !== 'done' && (
        <div className="text-center">
          <p className="stat-num text-5xl font-black text-foreground">
            {formatTime(timeLeft)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
            {block.type === 'amrap' ? 'AMRAP' : 'Max Reps'}
          </p>
        </div>
      )}

      {phase === 'idle' && (
        <button
          onClick={startTimer}
          className="w-full py-4 rounded-xl bg-brand text-white font-display font-black text-sm uppercase tracking-widest active:scale-95 brand-glow"
        >
          START
        </button>
      )}

      {phase === 'running' && block.type === 'amrap' && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setRepsCount(r => Math.max(0, r - 1))}
            className="w-12 h-12 rounded-full bg-surface-3 border border-border font-black text-xl active:scale-95"
          >
            −
          </button>
          <div className="text-center">
            <p className="stat-num text-3xl font-black text-foreground">{repsCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">reps</p>
          </div>
          <button
            onClick={() => setRepsCount(r => r + 1)}
            className="w-12 h-12 rounded-full bg-brand text-white font-black text-xl active:scale-95"
          >
            <Plus size={20} className="mx-auto" />
          </button>
        </div>
      )}

      {phase === 'running' && block.type === 'for_time' && (
        <button
          onClick={() => setPhase('done')}
          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-black text-sm uppercase tracking-widest active:scale-95"
        >
          Done — Log Time
        </button>
      )}

      {phase === 'done' && (
        <div className="space-y-3 animate-float-up">
          <p className="text-center text-sm font-black uppercase tracking-tight text-foreground">Log your result</p>
          <input
            type="text"
            value={resultText}
            onChange={e => setResultText(e.target.value)}
            placeholder={
              block.type === 'amrap'
                ? 'Rounds + reps (e.g. 4+12)'
                : block.type === 'max_reps'
                ? 'Total reps'
                : 'Time (mm:ss)'
            }
            className="w-full bg-surface-3/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand"
          />
          <p className="text-xs text-muted-foreground text-center">{block.progressionNote}</p>
        </div>
      )}
    </div>
  )
}

// ── Circuit Block ─────────────────────────────────────────────────────────

function CircuitBlockView({ block }: { block: CircuitBlock }) {
  const [completedRounds, setCompletedRounds] = useState<boolean[]>(Array(block.rounds).fill(false))
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = () => {
    setStartTime(Date.now())
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - Date.now()) / 1000))
    }, 1000)
  }

  useEffect(() => {
    if (startTime === null) return
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime])

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-display font-black text-brand uppercase tracking-[0.15em]">CIRCUIT</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">{block.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">{block.rounds} rounds · For time</p>
      </div>
      <div className="space-y-2">
        {block.exercises.map((ex, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-surface-3/50 border border-border/50 px-3 py-2.5">
            <span className="text-sm font-black text-foreground uppercase tracking-tight">{ex.name}</span>
            <span className="text-xs text-brand font-bold">{ex.reps}</span>
          </div>
        ))}
      </div>
      {startTime && (
        <div className="text-center">
          <p className="stat-num text-4xl font-black text-foreground">{formatTime(elapsed)}</p>
        </div>
      )}
      {!startTime && (
        <button
          onClick={start}
          className="w-full py-4 rounded-xl bg-brand text-white font-display font-black text-sm uppercase tracking-widest active:scale-95"
        >
          START CIRCUIT
        </button>
      )}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: block.rounds }, (_, i) => (
          <button
            key={i}
            onClick={() => setCompletedRounds(prev => { const n = [...prev]; n[i] = true; return n })}
            className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              completedRounds[i]
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                : 'bg-surface-3/50 border border-border/50 text-muted-foreground active:scale-95'
            }`}
          >
            Rd {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Recovery Block ────────────────────────────────────────────────────────

function RecoveryBlockView({ block }: { block: RecoveryBlock }) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div>
        <span className="text-xs font-display font-black text-brand uppercase tracking-[0.15em]">RECOVERY</span>
        <p className="text-xs text-muted-foreground mt-1">{block.label}</p>
      </div>
      <div className="space-y-2">
        {block.exercises.map((ex, i) => (
          <div key={i} className="rounded-xl bg-surface-3/50 border border-border/50 px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground uppercase tracking-tight">{ex.name}</span>
              <span className="text-xs text-brand font-bold">{ex.duration}</span>
            </div>
            {ex.notes && <p className="text-xs text-muted-foreground mt-1">{ex.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Complete Screen ───────────────────────────────────────────────────────

function CompleteScreen({
  session,
  timer,
  dayNumber,
  onDone,
}: {
  session: SqueezeSession
  timer: number
  dayNumber: number
  onDone: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 gap-6 animate-float-up">
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm text-center space-y-4 accent-border-top brand-glow">
        <p className="font-display text-2xl font-black uppercase tracking-tight text-brand">
          Squeezed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="stat-num text-2xl font-black text-foreground">{formatTime(timer)}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Time</p>
          </div>
          <div>
            <p className="stat-num text-2xl font-black text-foreground">{session.estimatedMinutes}min</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Target</p>
          </div>
        </div>
        <div className="rounded-xl bg-surface-3/50 border border-border/50 p-3 text-left space-y-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">What you did</p>
          <p className="text-sm text-foreground">{session.sessionTitle}</p>
          <p className="text-xs text-muted-foreground">{session.dayPattern}</p>
        </div>
        <div className="rounded-xl bg-brand/5 border border-brand/20 p-3 text-left">
          <p className="text-xs font-black text-brand uppercase tracking-wider mb-0.5">Next Session</p>
          <p className="text-xs text-muted-foreground">{getPatternPreview(dayNumber)}</p>
        </div>
        <button
          onClick={onDone}
          className="w-full py-4 rounded-xl bg-brand text-white font-display font-black text-sm uppercase tracking-widest active:scale-95 brand-glow"
        >
          Log it
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SqueezePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()

  const [pageState, setPageState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [session, setSession] = useState<SqueezeSession | null>(null)
  const [dayNumber, setDayNumber] = useState(1)
  const [timer, setTimer] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Load and generate
  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push('/login')
      return
    }

    const run = async () => {
      try {
        // Read day from localStorage
        const storedDay = parseInt(localStorage.getItem('dad-strength-squeeze-day') ?? '1', 10)
        const safeDay = isNaN(storedDay) || storedDay < 1 ? 1 : storedDay
        setDayNumber(safeDay)

        // Read equipment from user profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        const equipment: string[] = []
        if (profile?.equipment) {
          const eq = profile.equipment as Record<string, boolean>
          Object.entries(eq).forEach(([k, v]) => { if (v) equipment.push(k) })
        }
        // Fallback: try localStorage active program equipment
        if (equipment.length === 0) {
          try {
            const raw = localStorage.getItem('dad-strength-active-program')
            if (raw) {
              const prog = JSON.parse(raw)
              if (prog.equipment) {
                Object.entries(prog.equipment as Record<string, boolean>).forEach(([k, v]) => {
                  if (v) equipment.push(k)
                })
              }
            }
          } catch { /* ignore */ }
        }

        // Read recent A1 movements
        const recentRaw = localStorage.getItem('dad-strength-squeeze-recent-movements')
        const recentSqueezeMovements: string[] = recentRaw ? JSON.parse(recentRaw) : []

        // Call AI generation
        const res = await fetch('/api/ai/squeeze-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            dayNumber: safeDay,
            equipment,
            recentSqueezeMovements,
          }),
        })

        if (!res.ok) throw new Error(`AI API returned ${res.status}`)

        const { session: generated } = await res.json()
        setSession(generated)
        setPageState('ready')
      } catch (err) {
        console.error('Squeeze generation error:', err)
        setPageState('error')
      }
    }

    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading])

  const handleDone = useCallback(async () => {
    if (!user || !session) return

    try {
      // Find A1 exercise to save to recent movements
      const a1Block = session.blocks.find((b): b is A1Block => b.blockId === 'A1')
      if (a1Block) {
        const recentRaw = localStorage.getItem('dad-strength-squeeze-recent-movements')
        const recent: string[] = recentRaw ? JSON.parse(recentRaw) : []
        const updated = [a1Block.exercise, ...recent].slice(0, 2)
        localStorage.setItem('dad-strength-squeeze-recent-movements', JSON.stringify(updated))
      }

      // Save to workout_logs
      await supabase.from('workout_logs').insert({
        user_id: user.id,
        exercise_name: session.sessionTitle,
        weight: 0,
        reps: 0,
        completed: true,
        notes: JSON.stringify({ squeeze: true, blocks: session.blocks, dayPattern: session.dayPattern }),
        created_at: new Date().toISOString(),
      })

      // Increment day counter (wraps 1-7, then keeps going)
      const nextDay = dayNumber >= 7 ? dayNumber + 1 : dayNumber + 1
      localStorage.setItem('dad-strength-squeeze-day', String(nextDay))

      router.push('/dashboard')
    } catch (err) {
      console.error('Failed to save squeeze session:', err)
      router.push('/dashboard')
    }
  }, [user, session, dayNumber, supabase, router])

  if (userLoading || pageState === 'loading') return <LoadingScreen />
  if (pageState === 'error' || !session) return <ErrorScreen onBack={() => router.push('/dashboard')} />

  if (sessionComplete) {
    return (
      <CompleteScreen
        session={session}
        timer={timer}
        dayNumber={dayNumber}
        onDone={handleDone}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center flex-1 px-2">
            <p className="font-display text-sm font-black uppercase tracking-tight text-foreground leading-none">
              {session.sessionTitle}
            </p>
            <span className="text-xs font-bold text-brand mt-0.5 inline-block">
              {session.estimatedMinutes}min · {session.dayPattern}
            </span>
          </div>
          <div className="stat-num text-sm font-bold text-muted-foreground w-14 text-right">
            {formatTime(timer)}
          </div>
        </div>

        {session.coachNote && (
          <div className="mx-4 mb-3 max-w-md mx-auto">
            <div className="bg-brand/5 border-l-2 border-brand rounded-r-lg px-3 py-2">
              <p className="text-xs text-muted-foreground italic leading-relaxed">{session.coachNote}</p>
            </div>
          </div>
        )}
      </header>

      {/* Blocks */}
      <div className="px-4 pt-4 space-y-4 max-w-md mx-auto">
        {session.blocks.map((block, i) => {
          if (block.blockId === 'A1') return <A1BlockView key={i} block={block} />
          if (block.blockId === 'A2') return <A2BlockView key={i} block={block} />
          if (block.blockId === 'F') return <FinisherBlockView key={i} block={block} />
          if (block.blockId === 'CIRCUIT') return <CircuitBlockView key={i} block={block} />
          if (block.blockId === 'RECOVERY') return <RecoveryBlockView key={i} block={block} />
          return null
        })}

        {/* Complete session button */}
        <button
          onClick={() => {
            setSessionComplete(true)
            if (timerRef.current) clearInterval(timerRef.current)
          }}
          className="w-full py-4 rounded-2xl bg-brand text-white font-display font-black text-sm uppercase tracking-widest active:scale-95 brand-glow mt-4"
        >
          Session Complete
        </button>
      </div>
    </div>
  )
}
