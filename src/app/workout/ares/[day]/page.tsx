'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'
import {
  ArrowLeft, Timer, Play, Pause, RotateCcw, CheckCircle2,
  ChevronDown, ChevronUp, Flame, Dumbbell, Zap, Wind,
  Trophy, Clock, BarChart2, AlertTriangle,
} from 'lucide-react'
// Inline to avoid circular dep on ProgramSelector
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface AresBlock {
  blockType: 'strength' | 'olympic_build' | 'gymnastics_skill' | 'monostructural' | 'accessory'
  name: string
  format: 'sets_reps' | 'build_to_max' | 'skill_time' | 'monostructural_distance' | 'monostructural_time'
  sets?: number
  repsMin?: number
  repsMax?: number
  targetRir?: number
  climbScheme?: string
  timeCapMinutes?: number
  durationMinutes?: number
  skillFocus?: string
  distance?: string
  coachCue?: string
  notes?: string
}

interface AresMetconMovement {
  name: string
  reps?: number
  calories?: number
  distance?: string
  weightRx?: string
  scaledOption?: string
}

interface AresMetcon {
  name?: string
  format: 'for_time' | 'amrap' | 'emom' | 'chipper' | 'for_time_with_cap'
  timeDomain: 'short' | 'medium' | 'long' | 'very_long'
  timeCapMinutes?: number
  description: string
  movements: AresMetconMovement[]
  rounds?: number
  coachNote?: string
}

interface AresDay {
  dayNumber: number
  dayName: string
  archetype: string
  blocks: AresBlock[]
  metcon: AresMetcon | null
  sessionIntent: string
}

interface AresProgram {
  weekNumber: number
  weekTheme: string
  coachNote: string
  days: AresDay[]
  deloadRecommended: boolean
  deloadReason?: string
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
  // For Time
  timeMinutes: string
  timeSeconds: string
  // AMRAP
  rounds: string
  partialReps: string
  timeCapHit: boolean
  // General
  notes: string
  done: boolean
}

// ── Archetype icon + label ─────────────────────────────────────────────────────

function archetypeIcon(archetype: string) {
  switch (archetype) {
    case 'olympic_build': return <Zap size={14} className="text-yellow-400" />
    case 'gymnastics_skill': return <Wind size={14} className="text-sky-400" />
    case 'monostructural_strength': return <Timer size={14} className="text-green-400" />
    case 'long_metcon': return <Flame size={14} className="text-orange-400" />
    case 'benchmark': return <Trophy size={14} className="text-brand" />
    default: return <Dumbbell size={14} className="text-muted-foreground" />
  }
}

function archetypeLabel(archetype: string) {
  const labels: Record<string, string> = {
    strength_metcon: 'Strength + MetCon',
    olympic_build: 'Olympic Build',
    gymnastics_skill: 'Gymnastics Skill',
    monostructural_strength: 'Cardio + Strength',
    long_metcon: 'Long Effort',
    benchmark: 'Benchmark',
  }
  return labels[archetype] ?? archetype
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

// ── Strength block logger ──────────────────────────────────────────────────────

function StrengthBlock({ block, onLog }: {
  block: AresBlock
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
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <Dumbbell size={15} className="text-brand shrink-0" />
          <div className="text-left">
            <p className="font-medium text-sm text-foreground">{block.name}</p>
            <p className="text-xs text-muted-foreground">
              {totalSets}×{repRange} reps{block.targetRir != null ? ` · RIR ${block.targetRir}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {doneCount === totalSets && <CheckCircle2 size={15} className="text-brand" />}
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
            <div key={idx} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg border transition-colors ${s.done ? 'border-brand/30 bg-brand/5' : 'border-border bg-background'}`}>
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
                className={`text-xs font-medium rounded px-2 py-1 transition-colors ${s.done ? 'bg-brand/20 text-brand' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
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

// ── Build-to-max block ─────────────────────────────────────────────────────────

function BuildToMaxBlock({ block, onLog }: {
  block: AresBlock
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
      <div className="flex items-center gap-3">
        <Zap size={15} className="text-yellow-400 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            Build to heavy · {block.climbScheme ?? '5-4-3-2-1'}
            {block.timeCapMinutes ? ` · ${block.timeCapMinutes} min cap` : ''}
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-brand ml-auto" />}
      </div>

      {block.skillFocus && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{block.skillFocus}</p>
      )}
      {block.coachCue && (
        <p className="text-xs text-brand/80 italic border-l-2 border-brand/30 pl-3">&ldquo;{block.coachCue}&rdquo;</p>
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
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
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
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
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

// ── Skill work block ───────────────────────────────────────────────────────────

function SkillWorkBlock({ block, onLog }: {
  block: AresBlock
  onLog: (notes: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)

  return (
    <div className="ds-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Wind size={15} className="text-sky-400 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            {block.durationMinutes ?? 15} min skill work
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-brand ml-auto" />}
      </div>

      {block.skillFocus && (
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-sky-400 mb-1">Focus</p>
          <p className="text-xs text-foreground/80">{block.skillFocus}</p>
        </div>
      )}

      <WorkoutTimer />

      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">
          Session Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What you worked on, wins, what needs more reps..."
          rows={2}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 resize-none"
        />
      </div>
      <button
        onClick={() => { onLog(notes); setLogged(true) }}
        className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-foreground/90 transition-colors"
      >
        {logged ? 'Logged ✓' : 'Log Skill Work'}
      </button>
    </div>
  )
}

// ── Monostructural block ───────────────────────────────────────────────────────

function MonostructuralBlock({ block, onLog }: {
  block: AresBlock
  onLog: (data: { distanceMeters?: number; durationSeconds?: number; notes: string }) => void
}) {
  const [duration, setDuration] = useState('')  // minutes
  const [distance, setDistance] = useState('')  // meters/km
  const [notes, setNotes] = useState('')
  const [logged, setLogged] = useState(false)

  const handleLog = () => {
    onLog({
      distanceMeters: distance ? parseFloat(distance) * (distance.includes('.') ? 1000 : 1) : undefined,
      durationSeconds: duration ? parseFloat(duration) * 60 : undefined,
      notes,
    })
    setLogged(true)
  }

  return (
    <div className="ds-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Timer size={15} className="text-green-400 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            {block.distance ?? block.durationMinutes ? `${block.durationMinutes} min` : 'Monostructural'}
            {block.distance ? ` · ${block.distance}` : ''}
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-brand ml-auto" />}
      </div>

      {block.coachCue && (
        <p className="text-xs text-green-400/80 italic border-l-2 border-green-500/30 pl-3">&ldquo;{block.coachCue}&rdquo;</p>
      )}

      <WorkoutTimer autoStart={false} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">Time (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="e.g. 26.5"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">Distance</label>
          <input
            type="text"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            placeholder="5000m or 5k"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Pace, effort, how it felt..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50"
        />
      </div>
      <button
        onClick={handleLog}
        className="w-full py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-foreground/90 transition-colors"
      >
        {logged ? 'Logged ✓' : 'Log Cardio'}
      </button>
    </div>
  )
}

// ── MetCon block ───────────────────────────────────────────────────────────────

function MetConBlock({ metcon, onLog }: {
  metcon: AresMetcon
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

  const timeDomainColor = {
    short: 'text-red-400 border-red-500/20 bg-red-500/5',
    medium: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
    long: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    very_long: 'text-brand border-brand/20 bg-brand/5',
  }[metcon.timeDomain]

  return (
    <div className="ds-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {metcon.name ? `${metcon.name}` : 'MetCon'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {metcon.format.replace('_', ' ')}
                {metcon.timeCapMinutes ? ` · ${metcon.timeCapMinutes} min` : ''}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${timeDomainColor}`}>
            {metcon.timeDomain.replace('_', ' ')}
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

        {/* AMRAP result */}
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

export default function AresWorkoutPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [supabase] = useState(() => createClient())
  const dayNumber = parseInt(params.day as string, 10) || 1

  const [program, setProgram] = useState<ActiveProgramData | null>(null)
  const [day, setDay] = useState<AresDay | null>(null)
  const [weekTheme, setWeekTheme] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

  // Saved log IDs so we can persist to Supabase
  const generatedWorkoutIdRef = useRef<string | null>(null)
  const aresWeekNumberRef = useRef<number>(0)

  // ── Week locking helpers ────────────────────────────────────────────────────
  // Ares weeks are purely sequential program weeks (1, 2, 3…) — completely
  // independent of the calendar. Finish all days of week N → advance to week N+1.
  // The calendar never forces a rotation mid-stride.

  const ARES_LOCK_KEY = 'ares-locked-week'

  const getUserLockedWeek = (daysCount: number): number => {
    try {
      const raw = localStorage.getItem(ARES_LOCK_KEY)
      if (raw) {
        const lock = JSON.parse(raw)
        // Migrate users who have an old calendar-based week number (YYYYWW format > 10000)
        const weekNumber: number = lock.weekNumber > 10000 ? 1 : (lock.weekNumber ?? 1)
        const doneDays: number[] = lock.doneDays ?? []
        if (doneDays.length < daysCount) {
          // Still mid-week — stay on this program week
          if (lock.weekNumber > 10000) {
            // Write the migrated value back
            localStorage.setItem(ARES_LOCK_KEY, JSON.stringify({ weekNumber, doneDays, daysCount }))
          }
          return weekNumber
        }
        // All days done — advance to the next consecutive program week
        const nextWeek = weekNumber + 1
        localStorage.setItem(ARES_LOCK_KEY, JSON.stringify({ weekNumber: nextWeek, doneDays: [], daysCount }))
        return nextWeek
      }
    } catch { /* fall through */ }
    // First time — start at program week 1
    localStorage.setItem(ARES_LOCK_KEY, JSON.stringify({ weekNumber: 1, doneDays: [], daysCount }))
    return 1
  }

  const markAresDayDone = (day: number) => {
    try {
      const raw = localStorage.getItem(ARES_LOCK_KEY)
      const lock = raw ? JSON.parse(raw) : { weekNumber: 1, doneDays: [], daysCount: 4 }
      const doneDays: number[] = [...new Set([...(lock.doneDays ?? []), day])]
      localStorage.setItem(ARES_LOCK_KEY, JSON.stringify({ ...lock, doneDays }))
    } catch { /* ignore */ }
  }

  // ── Load or generate the day ────────────────────────────────────────────────

  const loadDay = useCallback(async () => {
    const raw = localStorage.getItem('dad-strength-active-program')
    if (!raw) { router.push('/build'); return }
    const prog = JSON.parse(raw) as ActiveProgramData
    setProgram(prog)

    if (!user) return

    // Use the user's locked week — won't rotate until all days are done/skipped
    const aresWeekNumber = getUserLockedWeek(prog.daysCount)
    aresWeekNumberRef.current = aresWeekNumber
    const cacheKey = `ares-wod-w${aresWeekNumber}-d${dayNumber}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setDay(parsed.day)
        if (parsed.weekTheme) setWeekTheme(parsed.weekTheme)
        generatedWorkoutIdRef.current = parsed.generatedWorkoutId ?? null
        setLoading(false)
        return
      } catch { /* fall through to DB check */ }
    }

    // Check generated_workouts table — no user_id filter, shared across all users
    const { data: existing } = await supabase
      .from('generated_workouts')
      .select('id, workout_data')
      .eq('program_slug', 'ares')
      .eq('week_number', aresWeekNumber)
      .eq('day_number', dayNumber)
      .maybeSingle()

    if (existing) {
      const workoutData = existing.workout_data as { day: AresDay; weekTheme?: string }
      setDay(workoutData.day)
      if (workoutData.weekTheme) setWeekTheme(workoutData.weekTheme)
      generatedWorkoutIdRef.current = existing.id
      localStorage.setItem(cacheKey, JSON.stringify({ day: workoutData.day, weekTheme: workoutData.weekTheme, generatedWorkoutId: existing.id }))
      setLoading(false)
      return
    }

    // Generate fresh — first user to hit this day+date generates it for everyone
    setGenerating(true)
    try {
      // ── Build generation context ────────────────────────────────────────────
      // 1. Last week's day archetypes — so AI doesn't repeat the same structure
      const lastWeekNumber = aresWeekNumber - 1
      const { data: lastWeekDays } = await supabase
        .from('generated_workouts')
        .select('workout_data')
        .eq('program_slug', 'ares')
        .eq('week_number', lastWeekNumber)
        .order('day_number', { ascending: true })
      const previousWeekArchetypes = (lastWeekDays ?? [])
        .map((r: { workout_data: unknown }) => (r.workout_data as { day?: { archetype?: string } })?.day?.archetype)
        .filter(Boolean) as string[]

      // 2. Recent metcon results — so AI doesn't repeat same movement combos
      const { data: recentLogs } = await supabase
        .from('ares_session_logs')
        .select('log_type, metcon_name, metcon_format, metcon_result, week_number, rx')
        .eq('user_id', user.id)
        .eq('log_type', 'metcon')
        .order('created_at', { ascending: false })
        .limit(8)
      const recentMetconResults = (recentLogs ?? []).map((l: { metcon_name?: string | null; metcon_format?: string | null; metcon_result?: string | null; week_number?: number | null; rx?: boolean | null }) => ({
        workoutName: l.metcon_name ?? 'Custom',
        format: l.metcon_format ?? '',
        result: l.metcon_result ?? '',
        weekNumber: l.week_number ?? 0,
        rx: l.rx ?? false,
      }))

      // 3. Recent strength logs — so AI can progressively overload
      const { data: strengthLogs } = await supabase
        .from('ares_session_logs')
        .select('block_name, set_number, weight_lbs, reps, rir_actual, week_number')
        .eq('user_id', user.id)
        .eq('log_type', 'strength_set')
        .order('created_at', { ascending: false })
        .limit(40)
      // Group by exercise name for the AI
      const strengthByExercise: Record<string, { weight: number; reps: number; rir: number | null; weekNumber: number }[]> = {}
      for (const l of (strengthLogs ?? [])) {
        const name = l.block_name ?? 'Unknown'
        if (!strengthByExercise[name]) strengthByExercise[name] = []
        strengthByExercise[name].push({ weight: l.weight_lbs ?? 0, reps: l.reps ?? 0, rir: l.rir_actual ?? null, weekNumber: l.week_number ?? 0 })
      }
      const recentStrengthLogs = Object.entries(strengthByExercise).map(([exercise, sets]) => ({
        exercise,
        sets: sets.slice(0, 6),
        weekNumber: sets[0]?.weekNumber ?? 0,
      }))

      // Olympic 1RMs from onboarding (Snatch, C&J) — seeds Olympic session loading
      let olympicLifts1RMs: Record<string, number> | undefined
      try {
        const raw = localStorage.getItem('dad-strength-one-rep-maxes')
        if (raw) {
          const all = JSON.parse(raw) as Record<string, number>
          const oly: Record<string, number> = {}
          if (typeof all.snatch === 'number' && all.snatch > 0) oly.snatch = all.snatch
          if (typeof all.cleanJerk === 'number' && all.cleanJerk > 0) oly.cleanJerk = all.cleanJerk
          if (Object.keys(oly).length) olympicLifts1RMs = oly
        }
      } catch { /* ignore */ }

      const res = await fetch('/api/ai/ares-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysPerWeek: prog.daysCount,
          userProfile: {
            trainingAge: prog.trainingAge,
            primaryGoal: prog.primaryGoal,
          },
          previousWeekArchetypes,
          olympicLifts1RMs,
          recentMetconResults,
          recentStrengthLogs,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { program: generated } = await res.json() as { program: AresProgram }
      const targetDay = generated.days.find(d => d.dayNumber === dayNumber) ?? generated.days[0]
      setDay(targetDay)
      setWeekTheme(generated.weekTheme ?? '')

      // Cache locally immediately — don't wait for DB.
      // Even if the DB insert races and loses, this user keeps a stable workout.
      localStorage.setItem(cacheKey, JSON.stringify({ day: targetDay, weekTheme: generated.weekTheme, generatedWorkoutId: null }))

      // Persist to generated_workouts — shared, date-keyed.
      // The unique constraint on (program_slug, week_number, day_number) means
      // only the FIRST insert wins. Concurrent generators get a 23505 conflict.
      const { data: saved, error: insertError } = await supabase
        .from('generated_workouts')
        .insert({
          user_id: user.id,
          program_slug: 'ares',
          week_number: aresWeekNumber,
          day_number: dayNumber,
          workout_data: { program: generated, day: targetDay, weekTheme: generated.weekTheme },
        })
        .select('id')
        .single()

      if (saved) {
        // We won the race — our workout is now canonical for this week/day.
        generatedWorkoutIdRef.current = saved.id
        localStorage.setItem(cacheKey, JSON.stringify({ day: targetDay, weekTheme: generated.weekTheme, generatedWorkoutId: saved.id }))
      } else if ((insertError as { code?: string } | null)?.code === '23505') {
        // Another user beat us to it — fetch their canonical version and
        // overwrite our locally-generated (potentially different) workout.
        const { data: canonical } = await supabase
          .from('generated_workouts')
          .select('id, workout_data')
          .eq('program_slug', 'ares')
          .eq('week_number', aresWeekNumber)
          .eq('day_number', dayNumber)
          .single()

        if (canonical) {
          const canonicalData = canonical.workout_data as { day: AresDay; weekTheme?: string }
          setDay(canonicalData.day)
          setWeekTheme(canonicalData.weekTheme ?? '')
          generatedWorkoutIdRef.current = canonical.id
          localStorage.setItem(cacheKey, JSON.stringify({
            day: canonicalData.day,
            weekTheme: canonicalData.weekTheme,
            generatedWorkoutId: canonical.id,
          }))
        }
      }
    } catch (e) {
      setError('Could not generate workout. Check your connection and try again.')
      console.error(e)
    } finally {
      setGenerating(false)
      setLoading(false)
    }
  }, [user, dayNumber, supabase, router])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Log handlers ────────────────────────────────────────────────────────────

  const logStrengthSets = async (block: AresBlock, sets: StrengthSetLog[]) => {
    if (!user || !program) return
    const doneSets = sets.filter(s => s.done)
    if (!doneSets.length) return
    const rows = doneSets.map(s => ({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: aresWeekNumberRef.current,
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

  const logBuildToMax = async (block: AresBlock, peakWeight: number, notes: string) => {
    if (!user || !program) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: aresWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'build_to_max',
      block_name: block.name,
      peak_weight_lbs: peakWeight,
      climb_scheme: block.climbScheme,
      notes,
    })
  }

  const logSkillWork = async (block: AresBlock, notes: string) => {
    if (!user || !program) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: aresWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'skill_work',
      block_name: block.name,
      skill_duration_minutes: block.durationMinutes,
      notes,
    })
  }

  const logMonostructural = async (block: AresBlock, data: { distanceMeters?: number; durationSeconds?: number; notes: string }) => {
    if (!user || !program) return
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: aresWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'monostructural',
      block_name: block.name,
      distance_meters: data.distanceMeters,
      duration_seconds: data.durationSeconds,
      notes: data.notes,
    })
  }

  const logMetcon = async (metcon: AresMetcon, result: MetconResult) => {
    if (!user || !program) return
    const timeSeconds = result.timeMinutes || result.timeSeconds
      ? (parseInt(result.timeMinutes || '0') * 60) + parseInt(result.timeSeconds || '0')
      : null
    await supabase.from('ares_session_logs').insert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: aresWeekNumberRef.current,
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
    setSessionComplete(true)
    markAresDayDone(dayNumber)
  }

  const handleSkipDay = () => {
    markAresDayDone(dayNumber)
    if (dayNumber < (program?.daysCount ?? 4)) {
      router.push(`/workout/ares/${dayNumber + 1}`)
    } else {
      router.push('/dashboard')
    }
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-brand/20 flex items-center justify-center">
            <Flame className="w-7 h-7 text-brand animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl tracking-[0.15em] uppercase text-foreground mb-2">
            {generating ? 'Generating' : 'Loading'}
          </p>
          <p className="text-sm text-muted-foreground">
            {generating ? 'Building your Ares workout...' : 'One moment...'}
          </p>
        </div>
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
        <div className="w-20 h-20 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Flame className="w-9 h-9 text-brand" />
        </div>
        <div>
          <p className="font-display text-3xl tracking-[0.12em] uppercase text-foreground mb-2">Session Done</p>
          <p className="text-sm text-muted-foreground">Day {dayNumber} logged. Ares is proud.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {dayNumber < (program?.daysCount ?? 4) && (
            <button
              onClick={() => router.push(`/workout/ares/${dayNumber + 1}`)}
              className="w-full py-3 bg-brand text-foreground rounded-lg text-sm font-medium uppercase tracking-wider"
            >
              Next Day →
            </button>
          )}
          <button
            onClick={() => router.push('/workout/ares/leaderboard')}
            className="w-full py-3 border border-brand/30 text-brand rounded-lg text-sm font-medium hover:bg-brand/10 transition-colors"
          >
            🏆 View Leaderboard
          </button>
          <button
            onClick={() => router.push('/workout/ares/history')}
            className="w-full py-3 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
          >
            My History
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {weekTheme || `Ares · Day ${dayNumber}`}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {archetypeIcon(day.archetype)}
              {archetypeLabel(day.archetype)}
            </span>
          </div>
          <h1 className="font-display text-xl tracking-[0.1em] uppercase truncate">{day.dayName}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSkipDay}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors font-medium px-2 py-1"
            title="Skip this day"
          >
            Skip
          </button>
          <button
            onClick={() => router.push('/workout/ares/leaderboard')}
            className="p-2 border border-border rounded-md text-muted-foreground hover:text-brand transition-colors"
            title="Leaderboard"
          >
            <Trophy size={15} />
          </button>
          <BarChart2 size={16} className="text-brand" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Session intent */}
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
          {day.sessionIntent}
        </p>

        {/* Blocks */}
        {day.blocks.map((block, i) => {
          if (block.format === 'sets_reps') {
            return (
              <StrengthBlock
                key={i}
                block={block}
                onLog={sets => logStrengthSets(block, sets)}
              />
            )
          }
          if (block.format === 'build_to_max') {
            return (
              <BuildToMaxBlock
                key={i}
                block={block}
                onLog={(w, n) => logBuildToMax(block, w, n)}
              />
            )
          }
          if (block.format === 'skill_time') {
            return (
              <SkillWorkBlock
                key={i}
                block={block}
                onLog={n => logSkillWork(block, n)}
              />
            )
          }
          if (block.format === 'monostructural_distance' || block.format === 'monostructural_time') {
            return (
              <MonostructuralBlock
                key={i}
                block={block}
                onLog={d => logMonostructural(block, d)}
              />
            )
          }
          return null
        })}

        {/* MetCon */}
        {day.metcon && (
          <MetConBlock
            metcon={day.metcon}
            onLog={result => logMetcon(day.metcon!, result)}
          />
        )}
      </main>
    </div>
  )
}
