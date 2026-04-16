'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'
import ForgeLoader from '../../../../components/ForgeLoader'
import {
  ArrowLeft, Timer, Play, Pause, RotateCcw, CheckCircle2,
  ChevronDown, ChevronUp, Flame, Dumbbell, Zap, Wind,
  Trophy, Clock, BarChart2, AlertTriangle, Activity,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ZeusAccessoryExercise {
  name: string
  sets: number
  repsMin: number
  repsMax: number
  note?: string
}

interface ZeusBlock {
  blockType: 'strength_a' | 'strength_b' | 'olympic' | 'gymnastics' | 'conditioning' | 'accessory'
  name: string
  format: 'sets_reps' | 'build_to_max' | 'skill_time' | 'intervals' | 'steady_state' | 'accessory_circuit'
  sets?: number
  repsMin?: number
  repsMax?: number
  targetRir?: number
  variation?: string
  climbScheme?: string
  timeCapMinutes?: number
  durationMinutes?: number
  skillFocus?: string
  scaledOption?: string
  progressionNote?: string
  intervalScheme?: string
  machine?: string
  effortCue?: string
  accessoryExercises?: ZeusAccessoryExercise[]
  coachCue?: string
  notes?: string
}

interface ZeusMetconMovement {
  name: string
  reps?: number
  calories?: number
  distance?: string
  weightRx?: string
  scaledOption?: string
}

interface ZeusMetcon {
  name?: string
  format: string
  timeDomain: string
  timeCapMinutes?: number
  description: string
  movements: ZeusMetconMovement[]
  rounds?: number
  coachNote?: string
}

interface ZeusDay {
  weekNumber: number
  mesoNumber: number
  weekInMeso: number
  dayNumber: number
  dayName: string
  sessionIntent: string
  blocks: ZeusBlock[]
  metcon: ZeusMetcon | null
  coachNote: string
}

interface StrengthSetLog {
  setIndex: number
  weight: string
  reps: string
  rir: number | null
  done: boolean
}

interface MetconResult {
  rx: boolean
  timeMinutes: string
  timeSeconds: string
  rounds: string
  partialReps: string
  timeCapHit: boolean
  notes: string
  done: boolean
}

// ── LocalStorage helpers ───────────────────────────────────────────────────────

const ZEUS_LOCK_KEY = 'zeus-locked-week'

const getUserLockedWeek = (): number => {
  try {
    const raw = localStorage.getItem(ZEUS_LOCK_KEY)
    if (raw) {
      const lock = JSON.parse(raw)
      const weekNumber = lock.weekNumber ?? 1
      const doneDays: number[] = lock.doneDays ?? []
      if (doneDays.length < 4) return weekNumber
      // All days done — advance to next week
      const nextWeek = Math.min(12, weekNumber + 1)
      localStorage.setItem(ZEUS_LOCK_KEY, JSON.stringify({ weekNumber: nextWeek, doneDays: [], daysCount: 4 }))
      return nextWeek
    }
  } catch { /* fall through */ }
  localStorage.setItem(ZEUS_LOCK_KEY, JSON.stringify({ weekNumber: 1, doneDays: [], daysCount: 4 }))
  return 1
}

const markZeusDayDone = (day: number) => {
  try {
    const raw = localStorage.getItem(ZEUS_LOCK_KEY)
    const lock = raw ? JSON.parse(raw) : { weekNumber: 1, doneDays: [], daysCount: 4 }
    const doneDays: number[] = [...new Set([...(lock.doneDays ?? []), day])]
    localStorage.setItem(ZEUS_LOCK_KEY, JSON.stringify({ ...lock, doneDays }))
  } catch { /* ignore */ }
}

// ── Timer component ────────────────────────────────────────────────────────────

function WorkoutTimer({ autoStart = false }: { autoStart?: boolean }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(autoStart)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-4 py-2">
      <Clock size={14} className="text-muted-foreground" />
      <span className="font-mono text-xl tabular-nums text-foreground">{fmt(seconds)}</span>
      <button onClick={() => setRunning(r => !r)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button onClick={() => { setSeconds(0); setRunning(false) }} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
        <RotateCcw size={14} />
      </button>
    </div>
  )
}

// ── Countdown timer for time-cap MetCons ──────────────────────────────────────

function CountdownTimer({ minutes, onComplete }: { minutes: number; onComplete?: () => void }) {
  const totalSecs = minutes * 60
  const [remaining, setRemaining] = useState(totalSecs)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    if (remaining <= 0) { setRunning(false); onComplete?.(); return }
    const id = setInterval(() => setRemaining(r => r - 1), 1000)
    return () => clearInterval(id)
  }, [running, remaining, onComplete])

  const pct = remaining / totalSecs
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const urgent = remaining < 60

  return (
    <div className={`flex flex-col items-center gap-3 p-4 rounded-xl border ${urgent ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-background'}`}>
      <span className={`font-mono text-4xl tabular-nums font-bold ${urgent ? 'text-red-400' : 'text-foreground'}`}>
        {fmt(remaining)}
      </span>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${urgent ? 'bg-red-500' : 'bg-brand'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setRunning(r => !r)}
          className="px-4 py-1.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider"
        >
          {running ? 'Pause' : remaining === totalSecs ? 'Start' : 'Resume'}
        </button>
        <button
          onClick={() => { setRemaining(totalSecs); setRunning(false) }}
          className="px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Strength block (strength_a / strength_b) ───────────────────────────────────

function StrengthBlock({ block, label, onLog }: {
  block: ZeusBlock
  label: string
  onLog: (sets: StrengthSetLog[]) => void
}) {
  const totalSets = block.sets ?? 3
  const [sets, setSets] = useState<StrengthSetLog[]>(
    Array.from({ length: totalSets }, (_, i) => ({
      setIndex: i,
      weight: '',
      reps: String(block.repsMin ?? ''),
      rir: block.targetRir ?? null,
      done: false,
    }))
  )
  const [expanded, setExpanded] = useState(true)

  const update = (idx: number, field: keyof StrengthSetLog, value: unknown) => {
    setSets(prev => {
      const next = prev.map((s, i) => i === idx ? { ...s, [field]: value } : s)
      onLog(next)
      return next
    })
  }

  const doneCount = sets.filter(s => s.done).length
  const repRange = block.repsMin === block.repsMax
    ? `${block.repsMin}`
    : `${block.repsMin}–${block.repsMax}`

  return (
    <div className="ds-card overflow-hidden">
      {/* Block type label */}
      <div className="px-4 pt-3 pb-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{label}</span>
      </div>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 pt-2"
      >
        <div className="flex items-center gap-3">
          <Dumbbell size={15} className="text-blue-400 shrink-0" />
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm text-foreground">{block.name}</p>
              {block.variation && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  {block.variation}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalSets}×{repRange} reps
              {block.targetRir != null ? ` · RIR ${block.targetRir}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doneCount === totalSets && <CheckCircle2 size={15} className="text-blue-400" />}
          <span className="text-xs text-muted-foreground">{doneCount}/{totalSets}</span>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {block.coachCue && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic border-t border-border pt-2 mx-4">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          <div className="grid grid-cols-4 gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">
            <span>Set</span><span>Weight (lbs)</span><span>Reps</span><span>RIR</span>
          </div>
          {sets.map((s, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg border transition-colors ${s.done ? 'border-blue-500/30 bg-blue-500/5' : 'border-border bg-background'}`}
            >
              <span className="text-xs font-mono text-muted-foreground pl-1">{idx + 1}</span>
              <input
                type="number"
                value={s.weight}
                onChange={e => update(idx, 'weight', e.target.value)}
                placeholder="lbs"
                className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 text-center"
              />
              <input
                type="number"
                value={s.reps}
                onChange={e => update(idx, 'reps', e.target.value)}
                placeholder={repRange}
                className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/40 text-center"
              />
              <button
                onClick={() => update(idx, 'done', !s.done)}
                className={`text-xs font-medium rounded px-2 py-1 transition-colors ${s.done ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {s.done ? 'Done' : 'Log'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Olympic block ──────────────────────────────────────────────────────────────

function OlympicBlock({ block, onLog }: {
  block: ZeusBlock
  onLog: (peakWeight: number, notes: string) => void
}) {
  const [peakWeight, setPeakWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)

  const handleLog = () => {
    if (!peakWeight) return
    onLog(parseFloat(peakWeight), notes)
    setLogged(true)
  }

  return (
    <div className="ds-card p-4 space-y-4">
      <div className="pb-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Olympic</span>
      </div>
      <div className="flex items-center gap-3">
        <Zap size={15} className="text-yellow-400 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            Build to heavy · {block.climbScheme ?? '5-4-3-2-1'}
            {block.timeCapMinutes ? ` · ${block.timeCapMinutes} min cap` : ''}
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-blue-400 ml-auto" />}
      </div>

      {block.coachCue && (
        <p className="text-xs text-yellow-400/80 italic border-l-2 border-yellow-500/30 pl-3">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
            Peak Weight Hit (lbs)
          </label>
          <input
            type="number"
            value={peakWeight}
            onChange={e => setPeakWeight(e.target.value)}
            placeholder="e.g. 185"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How it felt, misses, PRs..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={handleLog}
          disabled={!peakWeight}
          className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-foreground/90 transition-colors"
        >
          {logged ? 'Logged ✓' : 'Log Peak Weight'}
        </button>
      </div>
    </div>
  )
}

// ── Gymnastics block ───────────────────────────────────────────────────────────

function GymnasticsBlock({ block, onLog }: {
  block: ZeusBlock
  onLog: (notes: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)

  return (
    <div className="ds-card p-4 space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Gymnastics</span>
      </div>
      <div className="flex items-center gap-3">
        <Wind size={15} className="text-sky-400 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            {block.durationMinutes ?? 15} min skill work
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-blue-400 ml-auto" />}
      </div>

      {block.skillFocus && (
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-sky-400 mb-1">Focus</p>
          <p className="text-xs text-foreground/80">{block.skillFocus}</p>
        </div>
      )}

      {block.scaledOption && (
        <p className="text-xs text-muted-foreground/70 border-l-2 border-border pl-3">
          Scale: {block.scaledOption}
        </p>
      )}

      {block.progressionNote && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
          {block.progressionNote}
        </p>
      )}

      {block.coachCue && (
        <p className="text-xs text-sky-400/80 italic border-l-2 border-sky-500/30 pl-3">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      <WorkoutTimer />

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
          Observations / Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What you worked on, wins, what needs more reps..."
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>
      <button
        onClick={() => { onLog(notes); setLogged(true) }}
        className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-foreground/90 transition-colors"
      >
        {logged ? 'Logged ✓' : 'Log Gymnastics'}
      </button>
    </div>
  )
}

// ── Conditioning block ─────────────────────────────────────────────────────────

function ConditioningBlock({ block, onLog }: {
  block: ZeusBlock
  onLog: (result: string, notes: string) => void
}) {
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)

  const machineIcon = () => {
    const m = (block.machine ?? '').toLowerCase()
    if (m.includes('bike') || m.includes('assault') || m.includes('echo')) return <Activity size={15} className="text-green-400 shrink-0" />
    if (m.includes('row')) return <Activity size={15} className="text-green-400 shrink-0" />
    if (m.includes('ski')) return <Activity size={15} className="text-green-400 shrink-0" />
    return <Timer size={15} className="text-green-400 shrink-0" />
  }

  return (
    <div className="ds-card p-4 space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Conditioning</span>
      </div>
      <div className="flex items-center gap-3">
        {machineIcon()}
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            {block.machine && `${block.machine} · `}
            {block.intervalScheme ?? block.format}
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-blue-400 ml-auto" />}
      </div>

      {block.intervalScheme && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-green-400 mb-1">Interval Scheme</p>
          <p className="text-xs text-foreground/80">{block.intervalScheme}</p>
        </div>
      )}

      {block.effortCue && (
        <p className="text-xs text-green-400/80 italic border-l-2 border-green-500/30 pl-3">&ldquo;{block.effortCue}&rdquo;</p>
      )}

      {block.coachCue && block.coachCue !== block.effortCue && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      <WorkoutTimer autoStart={false} />

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
            Result (calories / time)
          </label>
          <input
            type="text"
            value={result}
            onChange={e => setResult(e.target.value)}
            placeholder="e.g. 85 cals or 12:34"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Pace, effort, splits..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={() => { onLog(result, notes); setLogged(true) }}
          className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-foreground/90 transition-colors"
        >
          {logged ? 'Logged ✓' : 'Log Conditioning'}
        </button>
      </div>
    </div>
  )
}

// ── Accessory block ────────────────────────────────────────────────────────────

function AccessoryBlock({ block, onLog }: {
  block: ZeusBlock
  onLog: (notes: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)
  const exercises = block.accessoryExercises ?? []

  return (
    <div className="ds-card p-4 space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Accessories</span>
      </div>
      <div className="flex items-center gap-3">
        <Dumbbell size={15} className="text-muted-foreground shrink-0" />
        <p className="font-medium text-sm text-foreground">{block.name}</p>
        {logged && <CheckCircle2 size={15} className="text-blue-400 ml-auto" />}
      </div>

      {exercises.length > 0 && (
        <div className="space-y-2">
          {exercises.map((ex, i) => {
            const repRange = ex.repsMin === ex.repsMax
              ? `${ex.repsMin}`
              : `${ex.repsMin}–${ex.repsMax}`
            return (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                <span className="text-[10px] text-muted-foreground font-mono mt-0.5 w-4 shrink-0">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-muted-foreground"> · {ex.sets}×{repRange}</span>
                  </p>
                  {ex.note && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{ex.note}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {block.coachCue && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
          Session Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How it went, any adjustments..."
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>
      <button
        onClick={() => { onLog(notes); setLogged(true) }}
        className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-foreground/90 transition-colors"
      >
        {logged ? 'Logged ✓' : 'Log Accessories'}
      </button>
    </div>
  )
}

// ── MetCon block ───────────────────────────────────────────────────────────────

function MetConBlock({ metcon, onLog }: {
  metcon: ZeusMetcon
  onLog: (result: MetconResult) => void
}) {
  const [rx, setRx] = useState(true)
  const [timeMin, setTimeMin] = useState('')
  const [timeSec, setTimeSec] = useState('')
  const [rounds, setRounds] = useState('')
  const [partialReps, setPartialReps] = useState('')
  const [timeCapHit, setTimeCapHit] = useState(false)
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)
  const [showTimer, setShowTimer] = useState(false)

  const isForTime = metcon.format === 'for_time' || metcon.format === 'for_time_with_cap'
  const isAmrap = metcon.format === 'amrap'
  const isEmom = metcon.format === 'emom'
  const hasTimeCap = metcon.timeCapMinutes != null

  const handleLog = () => {
    const result: MetconResult = {
      rx, timeMinutes: timeMin, timeSeconds: timeSec,
      rounds, partialReps, timeCapHit, notes, done: true,
    }
    onLog(result)
    setLogged(true)
  }

  const timeDomainLabel = metcon.timeDomain.replace('_', ' ')

  const timeDomainColor = (() => {
    switch (metcon.timeDomain) {
      case 'short': return 'text-red-400 border-red-500/20 bg-red-500/5'
      case 'medium': return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
      case 'long': return 'text-orange-400 border-orange-500/20 bg-orange-500/5'
      default: return 'text-brand border-brand/20 bg-brand/5'
    }
  })()

  return (
    <div className="ds-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {metcon.name ?? 'MetCon'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {metcon.format.replace(/_/g, ' ')}
                {metcon.timeCapMinutes ? ` · ${metcon.timeCapMinutes} min` : ''}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${timeDomainColor}`}>
            {timeDomainLabel}
          </span>
        </div>
      </div>

      {/* Whiteboard prescription */}
      <div className="p-4 bg-background/50 border-b border-border">
        <pre className="text-sm text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed">
          {metcon.description}
        </pre>
      </div>

      {/* Movements detail with scale */}
      {metcon.movements.length > 0 && (
        <div className="p-4 border-b border-border space-y-2">
          {metcon.movements.map((mv, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">
                  {mv.reps && `${mv.reps} `}
                  {mv.calories && `${mv.calories} cal `}
                  {mv.distance && `${mv.distance} `}
                  {mv.name}
                </p>
                {mv.scaledOption && !rx && (
                  <p className="text-[10px] text-sky-400 mt-0.5">Scale: {mv.scaledOption}</p>
                )}
              </div>
              {mv.weightRx && (
                <span className="text-[10px] text-muted-foreground shrink-0">{mv.weightRx}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {metcon.coachNote && (
        <div className="px-4 py-3 bg-brand/5 border-b border-brand/10">
          <p className="text-xs text-brand/80 italic">{metcon.coachNote}</p>
        </div>
      )}

      {/* Timer section */}
      <div className="p-4 border-b border-border space-y-3">
        <button
          onClick={() => setShowTimer(t => !t)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Timer size={13} />
          {showTimer ? 'Hide' : 'Show'} Timer
        </button>
        {showTimer && (
          hasTimeCap && metcon.timeCapMinutes
            ? <CountdownTimer minutes={metcon.timeCapMinutes} onComplete={() => setTimeCapHit(true)} />
            : <WorkoutTimer autoStart={false} />
        )}
      </div>

      {/* Result logging */}
      <div className="p-4 space-y-4">
        {/* RX / Scaled toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setRx(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium uppercase tracking-wider border transition-colors ${rx ? 'bg-brand text-foreground border-brand' : 'bg-background border-border text-muted-foreground'}`}
          >
            RX
          </button>
          <button
            onClick={() => setRx(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium uppercase tracking-wider border transition-colors ${!rx ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-background border-border text-muted-foreground'}`}
          >
            Scaled
          </button>
        </div>

        {/* For Time result */}
        {isForTime && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Time to Complete
            </label>
            {timeCapHit && (
              <div className="flex items-center gap-2 text-orange-400 text-xs mb-2">
                <AlertTriangle size={12} />
                Time cap hit — log rounds if applicable
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={timeMin}
                onChange={e => setTimeMin(e.target.value)}
                placeholder="min"
                className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 text-center"
              />
              <span className="text-muted-foreground">:</span>
              <input
                type="number"
                value={timeSec}
                onChange={e => setTimeSec(e.target.value)}
                placeholder="sec"
                className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 text-center"
              />
              {hasTimeCap && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                  <input
                    type="checkbox"
                    checked={timeCapHit}
                    onChange={e => setTimeCapHit(e.target.checked)}
                    className="accent-brand"
                  />
                  Cap hit
                </label>
              )}
            </div>
          </div>
        )}

        {/* AMRAP / EMOM result */}
        {(isAmrap || isEmom) && (
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              {isEmom ? 'Rounds + Partial Reps' : 'Score (Rounds + Reps)'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rounds}
                onChange={e => setRounds(e.target.value)}
                placeholder="rounds"
                className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 text-center"
              />
              <span className="text-muted-foreground text-sm">+</span>
              <input
                type="number"
                value={partialReps}
                onChange={e => setPartialReps(e.target.value)}
                placeholder="reps"
                className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 text-center"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How it felt, where you broke, what to adjust..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
          />
        </div>

        <button
          onClick={handleLog}
          className={`w-full py-3 rounded-lg text-sm font-medium uppercase tracking-wider transition-all ${
            logged
              ? 'bg-brand/20 text-brand border border-brand/30'
              : 'bg-brand text-foreground hover:bg-brand/90'
          }`}
        >
          {logged ? '✓ MetCon Logged' : 'Log MetCon Result'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ZeusWorkoutPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [supabase] = useState(() => createClient())
  const dayNumber = parseInt(params.day as string, 10) || 1

  const [day, setDay] = useState<ZeusDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [programDone, setProgramDone] = useState(false)

  const generatedWorkoutIdRef = useRef<string | null>(null)
  const zeusWeekNumberRef = useRef<number>(1)

  // ── Load or generate the day ────────────────────────────────────────────────

  const loadDay = useCallback(async () => {
    if (!user) return

    const zeusWeekNumber = getUserLockedWeek()
    zeusWeekNumberRef.current = zeusWeekNumber

    const cacheKey = `zeus-wod-w${zeusWeekNumber}-d${dayNumber}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setDay(parsed.day)
        generatedWorkoutIdRef.current = parsed.generatedWorkoutId ?? null
        setLoading(false)
        return
      } catch { /* fall through to DB check */ }
    }

    // Check generated_workouts table — shared across all users
    const { data: existing } = await supabase
      .from('generated_workouts')
      .select('id, workout_data')
      .eq('program_slug', 'zeus')
      .eq('week_number', zeusWeekNumber)
      .eq('day_number', dayNumber)
      .maybeSingle()

    if (existing) {
      const workoutData = existing.workout_data as { day: ZeusDay }
      setDay(workoutData.day)
      generatedWorkoutIdRef.current = existing.id
      localStorage.setItem(cacheKey, JSON.stringify({ day: workoutData.day, generatedWorkoutId: existing.id }))
      setLoading(false)
      return
    }

    // Generate fresh — first user to hit this week+day generates for everyone
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/zeus-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber: zeusWeekNumber,
          dayNumber,
          recentLogs: [],
          recentMetcons: [],
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { day: generated } = await res.json() as { day: ZeusDay }
      setDay(generated)

      // Cache locally immediately
      localStorage.setItem(cacheKey, JSON.stringify({ day: generated, generatedWorkoutId: null }))

      // Persist to generated_workouts — unique constraint on (program_slug, week_number, day_number)
      const { data: saved, error: insertError } = await supabase
        .from('generated_workouts')
        .insert({
          user_id: user.id,
          program_slug: 'zeus',
          week_number: zeusWeekNumber,
          day_number: dayNumber,
          workout_data: { day: generated },
        })
        .select('id')
        .single()

      if (saved) {
        generatedWorkoutIdRef.current = saved.id
        localStorage.setItem(cacheKey, JSON.stringify({ day: generated, generatedWorkoutId: saved.id }))
      } else if ((insertError as { code?: string } | null)?.code === '23505') {
        // Another user beat us — fetch canonical version
        const { data: canonical } = await supabase
          .from('generated_workouts')
          .select('id, workout_data')
          .eq('program_slug', 'zeus')
          .eq('week_number', zeusWeekNumber)
          .eq('day_number', dayNumber)
          .single()

        if (canonical) {
          const canonicalData = canonical.workout_data as { day: ZeusDay }
          setDay(canonicalData.day)
          generatedWorkoutIdRef.current = canonical.id
          localStorage.setItem(cacheKey, JSON.stringify({ day: canonicalData.day, generatedWorkoutId: canonical.id }))
        }
      }
    } catch (e) {
      setError('Could not generate workout. Check your connection and try again.')
      console.error(e)
    } finally {
      setGenerating(false)
      setLoading(false)
    }
  }, [user, dayNumber, supabase])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Log handlers ────────────────────────────────────────────────────────────

  const logStrengthSets = async (block: ZeusBlock, sets: StrengthSetLog[]) => {
    if (!user) return
    const doneSets = sets.filter(s => s.done)
    if (!doneSets.length) return
    const rows = doneSets.map(s => ({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'strength_set' as const,
      block_name: block.name,
      set_number: s.setIndex + 1,
      weight_lbs: parseFloat(s.weight) || null,
      reps: parseInt(s.reps) || null,
      rir_actual: s.rir,
      completed: true,
    }))
    await supabase.from('ares_session_logs').insert(rows)
  }

  const logOlympic = async (block: ZeusBlock, peakWeight: number, notes: string) => {
    if (!user) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'build_to_max',
      block_name: block.name,
      peak_weight_lbs: peakWeight,
      climb_scheme: block.climbScheme,
      notes,
    })
  }

  const logGymnastics = async (block: ZeusBlock, notes: string) => {
    if (!user) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'skill_work',
      block_name: block.name,
      skill_duration_minutes: block.durationMinutes,
      notes,
    })
  }

  const logConditioning = async (block: ZeusBlock, result: string, notes: string) => {
    if (!user) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'monostructural',
      block_name: block.name,
      notes: result ? `${result}${notes ? ' · ' + notes : ''}` : notes || null,
    })
  }

  const logAccessory = async (block: ZeusBlock, notes: string) => {
    if (!user) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'skill_work',
      block_name: block.name,
      notes: notes || null,
    })
  }

  const logMetcon = async (metcon: ZeusMetcon, result: MetconResult) => {
    if (!user) return
    const timeSeconds = result.timeMinutes || result.timeSeconds
      ? (parseInt(result.timeMinutes || '0') * 60) + parseInt(result.timeSeconds || '0')
      : null
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'metcon',
      block_name: metcon.name ?? 'MetCon',
      metcon_format: metcon.format,
      metcon_time_seconds: timeSeconds,
      metcon_rounds: result.rounds ? parseInt(result.rounds) : null,
      metcon_partial_reps: result.partialReps ? parseInt(result.partialReps) : null,
      metcon_rx: result.rx,
      time_cap_hit: result.timeCapHit,
      notes: result.notes || null,
    })
    completeSession()
  }

  const completeSession = () => {
    markZeusDayDone(dayNumber)
    // Check if week 12 day 4 — program complete
    const raw = localStorage.getItem(ZEUS_LOCK_KEY)
    if (raw) {
      try {
        const lock = JSON.parse(raw)
        if (lock.weekNumber >= 12 && lock.doneDays?.includes(dayNumber) && dayNumber === 4) {
          setProgramDone(true)
        }
      } catch { /* ignore */ }
    }
    setSessionComplete(true)
  }

  const handleCompleteWithoutMetcon = () => {
    completeSession()
  }

  const handleSkipDay = () => {
    markZeusDayDone(dayNumber)
    if (dayNumber < 4) {
      router.push(`/workout/zeus/${dayNumber + 1}`)
    } else {
      router.push('/dashboard')
    }
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <ForgeLoader
          size={64}
          label={generating ? 'Forging Zeus Session' : 'Loading'}
        />
        {generating && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Building your Zeus workout for week {zeusWeekNumberRef.current}, day {dayNumber}...
          </p>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-foreground font-medium">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); loadDay() }}
          className="px-6 py-2.5 bg-brand text-foreground rounded-lg text-sm font-medium"
        >
          Try Again
        </button>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">
          Go Back
        </button>
      </div>
    )
  }

  if (!day) return null

  if (sessionComplete) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Zap className="w-9 h-9 text-blue-400" />
        </div>
        <div>
          <p className="font-display text-3xl tracking-[0.12em] uppercase text-foreground mb-2">
            {programDone ? 'Program Complete' : 'Session Done'}
          </p>
          <p className="text-sm text-muted-foreground">
            {programDone
              ? 'You completed all 12 weeks of Zeus. Legendary.'
              : `Day ${dayNumber} logged. Zeus is satisfied.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {!programDone && dayNumber < 4 && (
            <button
              onClick={() => router.push(`/workout/zeus/${dayNumber + 1}`)}
              className="w-full py-3 bg-blue-500 text-white rounded-lg text-sm font-medium uppercase tracking-wider hover:bg-blue-600 transition-colors"
            >
              Next Day →
            </button>
          )}
          {programDone && (
            <button
              onClick={() => router.push('/build')}
              className="w-full py-3 bg-blue-500 text-white rounded-lg text-sm font-medium uppercase tracking-wider hover:bg-blue-600 transition-colors"
            >
              Choose New Program
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-2.5 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  const hasMetcon = day.metcon !== null

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400 border border-blue-500/30 bg-blue-500/10 rounded px-1.5 py-0.5">
              MESO {day.mesoNumber} — WEEK {day.weekInMeso}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Day {day.dayNumber}
            </span>
          </div>
          <h1 className="font-display text-xl tracking-[0.1em] uppercase truncate mt-0.5">{day.dayName}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSkipDay}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors font-medium px-2 py-1"
            title="Skip this day"
          >
            Skip
          </button>
          {!hasMetcon && (
            <button
              onClick={handleCompleteWithoutMetcon}
              className="p-2 border border-blue-500/30 rounded-md text-blue-400 hover:bg-blue-500/10 transition-colors"
              title="Mark session complete"
            >
              <Trophy size={15} />
            </button>
          )}
          <BarChart2 size={16} className="text-blue-400" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Session intent */}
        <p className="text-xs text-muted-foreground italic border-l-2 border-blue-500/30 pl-3">
          {day.sessionIntent}
        </p>

        {/* Coach note */}
        {day.coachNote && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Coach Note</p>
            <p className="text-xs text-foreground/80">{day.coachNote}</p>
          </div>
        )}

        {/* Blocks */}
        {day.blocks.map((block, i) => {
          const blockNum = i + 1

          if (block.blockType === 'strength_a' || block.blockType === 'strength_b') {
            const label = block.blockType === 'strength_a' ? 'Strength A' : 'Strength B'
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{blockNum}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <StrengthBlock
                  block={block}
                  label={label}
                  onLog={sets => logStrengthSets(block, sets)}
                />
              </div>
            )
          }

          if (block.blockType === 'olympic') {
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{blockNum}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <OlympicBlock
                  block={block}
                  onLog={(w, n) => logOlympic(block, w, n)}
                />
              </div>
            )
          }

          if (block.blockType === 'gymnastics') {
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{blockNum}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <GymnasticsBlock
                  block={block}
                  onLog={n => logGymnastics(block, n)}
                />
              </div>
            )
          }

          if (block.blockType === 'conditioning') {
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{blockNum}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <ConditioningBlock
                  block={block}
                  onLog={(r, n) => logConditioning(block, r, n)}
                />
              </div>
            )
          }

          if (block.blockType === 'accessory') {
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{blockNum}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <AccessoryBlock
                  block={block}
                  onLog={n => logAccessory(block, n)}
                />
              </div>
            )
          }

          return null
        })}

        {/* MetCon — only on days 1 and 3 */}
        {day.metcon && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono text-muted-foreground/60">{day.blocks.length + 1}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <MetConBlock
              metcon={day.metcon}
              onLog={result => logMetcon(day.metcon!, result)}
            />
          </div>
        )}

        {/* Complete button for days without a metcon (days 2 and 4) */}
        {!day.metcon && (
          <button
            onClick={handleCompleteWithoutMetcon}
            className="w-full py-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-medium uppercase tracking-wider hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <Trophy size={16} />
            Complete Session
          </button>
        )}
      </main>
    </div>
  )
}
