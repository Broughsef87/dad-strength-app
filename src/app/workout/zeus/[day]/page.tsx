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

// ── Log history types ──────────────────────────────────────────────────────────

interface RecentStrengthLog {
  exercise: string
  weekNumber: number
  sets: Array<{ weight: number; reps: number; rir?: number }>
}

interface RecentMetconLog {
  name: string
  format: string
  result: string
  weekNumber: number
}

// ── One-time cleanup of pre-v2 localStorage keys ──────────────────────────────
// Devices that were around for the old localStorage-based progression have
// stale 'zeus-locked-week' keys and 'zeus-wod-w*-d*' (v1) cached workouts
// that diverged from the server. We sweep them on first load so no manual
// DevTools work is required (especially on mobile).
//
// Idempotent — sets a sentinel key so this only runs once per device.
// Sentinel bumped to v3 so devices that already swept under v2 sweep again.
const ZEUS_CACHE_SWEEP_KEY = 'zeus-cache-swept-v3'

function sweepLegacyZeusCache(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(ZEUS_CACHE_SWEEP_KEY) === '1') return
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      // Legacy keys to nuke: 'zeus-locked-week', the old v2 sweep sentinel,
      // and any workout cache older than the current v3 key.
      if (key === 'zeus-locked-week' || key === 'zeus-cache-swept-v2') {
        toRemove.push(key)
        continue
      }
      // All zeus-wod-* localStorage caches are obsolete — we DB-first now.
      if (key.startsWith('zeus-wod-')) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) localStorage.removeItem(key)
    localStorage.setItem(ZEUS_CACHE_SWEEP_KEY, '1')
  } catch { /* localStorage unavailable — nothing to sweep */ }
}

// ── Server-side progression state ──────────────────────────────────────────────
// Previously tracked in localStorage per-device, which caused phone and desktop
// to diverge (different weeks, different done-days, different generated workouts).
// Now the `user_programs` row for Zeus is the single source of truth.

interface ZeusProgress {
  weekNumber: number
  doneDays: number[]
}

async function fetchZeusProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<ZeusProgress> {
  const { data } = await supabase
    .from('user_programs')
    .select('current_week, done_days')
    .eq('user_id', userId)
    .eq('program_slug', 'zeus')
    .eq('status', 'active')
    .maybeSingle()

  if (!data) {
    // No active Zeus program yet — default to week 1, no days done.
    return { weekNumber: 1, doneDays: [] }
  }
  return {
    weekNumber: data.current_week ?? 1,
    doneDays: (data.done_days ?? []) as number[],
  }
}

async function markZeusDayDoneRemote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  dayNumber: number,
): Promise<ZeusProgress> {
  // Read current state
  const current = await fetchZeusProgress(supabase, userId)
  const doneDays = [...new Set([...current.doneDays, dayNumber])].sort()

  // If all 4 days done, advance to next week and reset done_days.
  const shouldAdvance = doneDays.length >= 4
  const nextWeek = shouldAdvance ? current.weekNumber + 1 : current.weekNumber
  const nextDone = shouldAdvance ? [] : doneDays

  await supabase
    .from('user_programs')
    .update({ current_week: nextWeek, done_days: nextDone })
    .eq('user_id', userId)
    .eq('program_slug', 'zeus')
    .eq('status', 'active')

  return { weekNumber: nextWeek, doneDays: nextDone }
}

// ── Recent log fetcher ─────────────────────────────────────────────────────────
// Queries ares_session_logs scoped to Zeus workouts only (via generated_workouts join)
// so Ares logs never bleed into Zeus progression context.

async function fetchZeusRecentLogs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  currentWeek: number,
): Promise<{ recentLogs: RecentStrengthLog[]; recentMetcons: RecentMetconLog[] }> {
  if (currentWeek <= 1) return { recentLogs: [], recentMetcons: [] }

  const fromWeek = Math.max(1, currentWeek - 4)
  const toWeek = currentWeek - 1

  // Step 1 — get Zeus generated_workout IDs for the relevant weeks
  const { data: zeusWorkouts } = await supabase
    .from('generated_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('program_slug', 'zeus')
    .gte('week_number', fromWeek)
    .lte('week_number', toWeek)

  const zeusIds: string[] = (zeusWorkouts ?? []).map((w: { id: string }) => w.id).filter(Boolean)
  if (zeusIds.length === 0) return { recentLogs: [], recentMetcons: [] }

  // Step 2 — fetch strength sets scoped to those IDs
  const { data: strengthRows } = await supabase
    .from('ares_session_logs')
    .select('block_name, week_number, weight_lbs, reps, rir_actual, set_number')
    .eq('user_id', userId)
    .eq('log_type', 'strength_set')
    .in('generated_workout_id', zeusIds)
    .order('week_number', { ascending: false })
    .order('set_number', { ascending: true })

  // Group by exercise + week
  const grouped: Record<string, RecentStrengthLog> = {}
  for (const row of strengthRows ?? []) {
    if (!row.weight_lbs || !row.reps) continue
    const key = `${row.block_name}::w${row.week_number}`
    if (!grouped[key]) {
      grouped[key] = { exercise: row.block_name, weekNumber: row.week_number, sets: [] }
    }
    grouped[key].sets.push({
      weight: row.weight_lbs,
      reps: row.reps,
      rir: row.rir_actual ?? undefined,
    })
  }
  const recentLogs = Object.values(grouped).slice(0, 12)

  // Step 3 — fetch metcon results scoped to those IDs
  const { data: metconRows } = await supabase
    .from('ares_session_logs')
    .select('block_name, week_number, metcon_format, metcon_time_seconds, metcon_rounds, metcon_partial_reps, notes')
    .eq('user_id', userId)
    .eq('log_type', 'metcon')
    .in('generated_workout_id', zeusIds)
    .order('week_number', { ascending: false })

  const recentMetcons: RecentMetconLog[] = (metconRows ?? []).map((r: {
    block_name: string
    week_number: number
    metcon_format: string | null
    metcon_time_seconds: number | null
    metcon_rounds: number | null
    metcon_partial_reps: number | null
    notes: string | null
  }) => ({
    name: r.block_name,
    format: r.metcon_format ?? 'unknown',
    result: r.metcon_time_seconds != null
      ? `${Math.floor(r.metcon_time_seconds / 60)}:${String(r.metcon_time_seconds % 60).padStart(2, '0')}`
      : r.metcon_rounds != null
      ? `${r.metcon_rounds}${r.metcon_partial_reps ? '+' + r.metcon_partial_reps + ' reps' : ''} rounds`
      : r.notes ?? 'completed',
    weekNumber: r.week_number,
  })).slice(0, 8)

  return { recentLogs, recentMetcons }
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

function StrengthBlock({ block, label, onLog, initialLogs }: {
  block: ZeusBlock
  label: string
  onLog: (sets: StrengthSetLog[]) => void
  initialLogs?: SessionLogRow[]
}) {
  const totalSets = block.sets ?? 3
  const [sets, setSets] = useState<StrengthSetLog[]>(() =>
    // Hydrate from previously-entered rows so refresh doesn't wipe progress.
    Array.from({ length: totalSets }, (_, i) => {
      const row = initialLogs?.find(r => r.set_number === i + 1)
      return {
        setIndex: i,
        weight: row?.weight_lbs != null ? String(row.weight_lbs) : '',
        reps: row?.reps != null ? String(row.reps) : String(block.repsMin ?? ''),
        rir: row?.rir_actual ?? block.targetRir ?? null,
        done: row?.completed === true,
      }
    })
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
  const repRange = block.repsMin == null && block.repsMax == null
    ? '—'
    : block.repsMin === block.repsMax
    ? `${block.repsMin}`
    : `${block.repsMin ?? block.repsMax}–${block.repsMax ?? block.repsMin}`

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

function OlympicBlock({ block, onLog, initialLog }: {
  block: ZeusBlock
  onLog: (peakWeight: number, notes: string) => void
  initialLog?: SessionLogRow
}) {
  const [peakWeight, setPeakWeight] = useState(
    initialLog?.peak_weight_lbs != null ? String(initialLog.peak_weight_lbs) : '',
  )
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)

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

function GymnasticsBlock({ block, onLog, initialLog }: {
  block: ZeusBlock
  onLog: (notes: string) => void
  initialLog?: SessionLogRow
}) {
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)

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

function ConditioningBlock({ block, onLog, initialLog }: {
  block: ZeusBlock
  onLog: (result: string, notes: string) => void
  initialLog?: SessionLogRow
}) {
  // Legacy stored "result · notes" concatenated into the notes column.
  // Split once when hydrating so the fields show cleanly.
  const [hydratedResult, hydratedNotes] = (() => {
    const raw = initialLog?.notes ?? ''
    const idx = raw.indexOf(' · ')
    if (idx > 0) return [raw.slice(0, idx), raw.slice(idx + 3)]
    return [raw, '']
  })()
  const [result, setResult] = useState(hydratedResult)
  const [notes, setNotes] = useState(hydratedNotes)
  const [logged, setLogged] = useState(initialLog?.completed === true)

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
            {block.machine || (block.format === 'steady_state' ? 'Distance piece' : 'Interval work')}
          </p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-blue-400 ml-auto" />}
      </div>

      {block.intervalScheme && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-green-400 mb-1">
            {block.format === 'steady_state' ? 'Pace / Distance' : 'Interval Scheme'}
          </p>
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

function AccessoryBlock({ block, onLog, initialLog }: {
  block: ZeusBlock
  onLog: (notes: string) => void
  initialLog?: SessionLogRow
}) {
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)
  const exercises = block.accessoryExercises ?? []

  return (
    <div className="ds-card p-4 space-y-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Accessory Work</span>
      </div>
      <div className="flex items-center gap-3">
        <Dumbbell size={15} className="text-muted-foreground shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">{block.name}</p>
          <p className="text-[10px] text-muted-foreground">Straight sets · 60-90s rest</p>
        </div>
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

function MetConBlock({ metcon, onLog, initialLog }: {
  metcon: ZeusMetcon
  onLog: (result: MetconResult) => void
  initialLog?: SessionLogRow
}) {
  // Hydrate metcon inputs from previously-logged row if present.
  const hydratedTimeSec = initialLog?.metcon_time_seconds ?? null
  const [rx, setRx] = useState(initialLog?.metcon_rx ?? true)
  const [timeMin, setTimeMin] = useState(
    hydratedTimeSec != null ? String(Math.floor(hydratedTimeSec / 60)) : '',
  )
  const [timeSec, setTimeSec] = useState(
    hydratedTimeSec != null ? String(hydratedTimeSec % 60).padStart(2, '0') : '',
  )
  const [rounds, setRounds] = useState(
    initialLog?.metcon_rounds != null ? String(initialLog.metcon_rounds) : '',
  )
  const [partialReps, setPartialReps] = useState(
    initialLog?.metcon_partial_reps != null ? String(initialLog.metcon_partial_reps) : '',
  )
  const [timeCapHit, setTimeCapHit] = useState(initialLog?.time_cap_hit ?? false)
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)
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

// ── Session log fetcher ───────────────────────────────────────────────────────
// Pulls all ares_session_logs rows for a given generated_workout_id so blocks
// can hydrate their inputs from what the athlete previously entered. This is
// what makes the logger survive tab refresh + cross-device continuation.

interface SessionLogRow {
  block_name: string
  log_type: string
  set_number: number | null
  weight_lbs: number | null
  reps: number | null
  rir_actual: number | null
  peak_weight_lbs: number | null
  climb_scheme: string | null
  skill_duration_minutes: number | null
  distance_meters: number | null
  duration_seconds: number | null
  metcon_format: string | null
  metcon_time_seconds: number | null
  metcon_rounds: number | null
  metcon_partial_reps: number | null
  metcon_rx: boolean | null
  time_cap_hit: boolean | null
  notes: string | null
  completed: boolean | null
  completed_at: string | null
}

async function fetchSessionLogs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  generatedWorkoutId: string | null,
): Promise<SessionLogRow[]> {
  if (!generatedWorkoutId) return []
  const { data } = await supabase
    .from('ares_session_logs')
    .select('block_name, log_type, set_number, weight_lbs, reps, rir_actual, peak_weight_lbs, climb_scheme, skill_duration_minutes, distance_meters, duration_seconds, metcon_format, metcon_time_seconds, metcon_rounds, metcon_partial_reps, metcon_rx, time_cap_hit, notes, completed, completed_at')
    .eq('generated_workout_id', generatedWorkoutId)
  return (data ?? []) as SessionLogRow[]
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
  // Zeus cycles indefinitely through 4-week mesos — no "program done" state.
  // Preserved only as a const so downstream refs don't break; always false.
  const programDone = false
  const [sessionLogs, setSessionLogs] = useState<SessionLogRow[]>([])

  const generatedWorkoutIdRef = useRef<string | null>(null)
  const zeusWeekNumberRef = useRef<number>(1)
  // In-flight guard for generation. React StrictMode double-invokes effects
  // in development and causes two simultaneous /api/ai/zeus-generate calls
  // (which were racing each other and producing divergent workouts). This
  // ref gates the network request so only one can be in flight at a time.
  const generationInFlightRef = useRef<boolean>(false)

  // ── Load or generate the day ────────────────────────────────────────────────

  const loadDay = useCallback(async () => {
    if (!user) return

    // Nuke pre-v2 legacy localStorage keys on first load — no-op after.
    sweepLegacyZeusCache()

    // Fetch current week from the server. Single source of truth across devices.
    const progress = await fetchZeusProgress(supabase, user.id)
    const zeusWeekNumber = progress.weekNumber
    zeusWeekNumberRef.current = zeusWeekNumber
    if (progress.doneDays.includes(dayNumber)) {
      setSessionComplete(true)
    }

    // ── DB-first load. No localStorage cache of workouts.
    //
    // Flow:
    //   1. Look up generated_workouts for (user, zeus, week, day).
    //      Hit? Use it, fetch logs, done.
    //   2. Miss? Generate, insert, fetch logs, done.
    //
    // The previous 3-layer cache (localStorage + DB + AI retry + dedupe
    // detector + in-flight lock) was the source of every persistence bug.
    // This replaces it with straight line code.

    const loadExisting = async (): Promise<boolean> => {
      const { data: existingRows, error: selectError } = await supabase
        .from('generated_workouts')
        .select('id, workout_data')
        .eq('user_id', user.id)
        .eq('program_slug', 'zeus')
        .eq('week_number', zeusWeekNumber)
        .eq('day_number', dayNumber)
        .order('id', { ascending: true })
        .limit(1)
      if (selectError) {
        console.error('[zeus] generated_workouts select failed:', selectError)
        return false
      }
      const existing = existingRows?.[0]
      if (!existing) return false
      const workoutData = existing.workout_data as { day: ZeusDay }
      setDay(workoutData.day)
      generatedWorkoutIdRef.current = existing.id
      const logs = await fetchSessionLogs(supabase, existing.id)
      setSessionLogs(logs)
      return true
    }

    if (await loadExisting()) {
      setLoading(false)
      return
    }

    // No existing row — generate and persist.
    if (generationInFlightRef.current) return
    generationInFlightRef.current = true
    setGenerating(true)
    try {
      const { recentLogs, recentMetcons } = await fetchZeusRecentLogs(supabase, user.id, zeusWeekNumber)

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

      const res = await fetch('/api/ai/zeus-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekNumber: zeusWeekNumber,
          dayNumber,
          recentLogs,
          recentMetcons,
          olympicLifts1RMs,
        }),
      })
      if (!res.ok) {
        let detail = ''
        try {
          const body = await res.json()
          detail = body?.detail?.message ?? body?.error ?? `HTTP ${res.status}`
        } catch {
          detail = `HTTP ${res.status}`
        }
        throw new Error(`Generation failed — ${detail}`)
      }
      const { day: generated } = await res.json() as { day: ZeusDay }

      // Insert the new workout. If a row already exists (another tab/device
      // raced us) Postgres 23505's, and we fall back to reading theirs.
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
        setDay(generated)
        generatedWorkoutIdRef.current = saved.id
        console.log('[zeus] inserted generated_workouts row', saved.id)
      } else if ((insertError as { code?: string } | null)?.code === '23505') {
        const foundExisting = await loadExisting()
        if (!foundExisting) {
          throw new Error('Generated workout conflicts but no canonical row found — possible RLS issue')
        }
      } else {
        // Real insert error — surface it loudly, don't silently render a
        // generated workout that isn't persisted.
        console.error('[zeus] generated_workouts insert failed:', insertError)
        throw new Error(`Workout generated but persist failed: ${insertError?.message ?? 'unknown'}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      console.error(e)
    } finally {
      setGenerating(false)
      setLoading(false)
      generationInFlightRef.current = false
    }
  }, [user, dayNumber, supabase])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Log handlers ────────────────────────────────────────────────────────────

  // Unique key for every upsert: (user_id, generated_workout_id, block_name, set_number)
  // The unique index on ares_session_logs uses NULLS NOT DISTINCT, so blocks
  // without numbered sets (olympic, skill, mono, metcon) can safely pass
  // set_number: null and still collapse to one row per block.
  const UPSERT_CONFLICT = 'user_id,generated_workout_id,block_name,set_number'

  // Diagnostic wrapper. Logs every log attempt with enough detail to tell
  // whether the write fired, succeeded, failed, or was skipped due to
  // missing user/workoutId. Once the logger is confirmed stable these
  // console.log lines should be pared back to errors-only.
  type SbErrorResult = { error?: { code?: string; message?: string; details?: string } | null }
  const reportLogResult = (tag: string, res: SbErrorResult | null | undefined) => {
    if (res?.error) {
      console.error(`[zeus-log] ${tag} upsert FAILED:`, {
        code: res.error.code,
        message: res.error.message,
        details: res.error.details,
      })
    } else {
      console.log(`[zeus-log] ${tag} upsert ok`)
    }
  }

  const reportSkip = (tag: string) => {
    console.warn(`[zeus-log] ${tag} SKIPPED —`, {
      hasUser: Boolean(user),
      hasGeneratedWorkoutId: Boolean(generatedWorkoutIdRef.current),
      generatedWorkoutId: generatedWorkoutIdRef.current,
    })
  }

  const logStrengthSets = async (block: ZeusBlock, sets: StrengthSetLog[]) => {
    if (!user || !generatedWorkoutIdRef.current) { reportSkip(`strength_sets[${block.name}]`); return }
    const nowIso = new Date().toISOString()
    const rows = sets.map(s => ({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'strength_set' as const,
      block_name: block.name,
      set_number: s.setIndex + 1,
      weight_lbs: s.weight === '' ? null : parseFloat(s.weight) || null,
      reps: s.reps === '' ? null : parseInt(s.reps) || null,
      rir_actual: s.rir,
      completed: s.done,
      completed_at: s.done ? nowIso : null,
    }))
    const res = await supabase.from('ares_session_logs').upsert(rows, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`strength_sets[${block.name}]`, res)
  }

  const logOlympic = async (block: ZeusBlock, peakWeight: number, notes: string) => {
    if (!user || !generatedWorkoutIdRef.current) return
    const res = await supabase.from('ares_session_logs').upsert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'build_to_max',
      block_name: block.name,
      set_number: null,
      peak_weight_lbs: peakWeight,
      climb_scheme: block.climbScheme,
      notes,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`olympic[${block.name}]`, res)
  }

  const logGymnastics = async (block: ZeusBlock, notes: string) => {
    if (!user || !generatedWorkoutIdRef.current) return
    const res = await supabase.from('ares_session_logs').upsert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'skill_work',
      block_name: block.name,
      set_number: null,
      skill_duration_minutes: block.durationMinutes,
      notes,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`gymnastics[${block.name}]`, res)
  }

  const logConditioning = async (block: ZeusBlock, result: string, notes: string) => {
    if (!user || !generatedWorkoutIdRef.current) return
    const res = await supabase.from('ares_session_logs').upsert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'monostructural',
      block_name: block.name,
      set_number: null,
      notes: result ? `${result}${notes ? ' · ' + notes : ''}` : notes || null,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`conditioning[${block.name}]`, res)
  }

  const logAccessory = async (block: ZeusBlock, notes: string) => {
    if (!user || !generatedWorkoutIdRef.current) return
    const res = await supabase.from('ares_session_logs').upsert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'skill_work',
      block_name: block.name,
      set_number: null,
      notes: notes || null,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`accessory[${block.name}]`, res)
  }

  const logMetcon = async (metcon: ZeusMetcon, result: MetconResult) => {
    if (!user || !generatedWorkoutIdRef.current) return
    const timeSeconds = result.timeMinutes || result.timeSeconds
      ? (parseInt(result.timeMinutes || '0') * 60) + parseInt(result.timeSeconds || '0')
      : null
    const res = await supabase.from('ares_session_logs').upsert({
      user_id: user.id,
      generated_workout_id: generatedWorkoutIdRef.current,
      week_number: zeusWeekNumberRef.current,
      day_number: dayNumber,
      log_type: 'metcon',
      block_name: metcon.name ?? 'MetCon',
      set_number: null,
      metcon_format: metcon.format,
      metcon_time_seconds: timeSeconds,
      metcon_rounds: result.rounds ? parseInt(result.rounds) : null,
      metcon_partial_reps: result.partialReps ? parseInt(result.partialReps) : null,
      metcon_rx: result.rx,
      time_cap_hit: result.timeCapHit,
      notes: result.notes || null,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    reportLogResult(`metcon[${metcon.name ?? 'MetCon'}]`, res)
    void completeSession()
  }

  const completeSession = async () => {
    if (!user) return
    await markZeusDayDoneRemote(supabase, user.id, dayNumber)

    // Write a streak-counter shim row into workout_logs so the dashboard's
    // streak and history views pick up Zeus sessions. Dashboard counts
    // distinct days with completed=true from workout_logs. Zeus never
    // wrote there before, so Zeus sessions were invisible to the streak.
    // Keyed with set_number=0 + identifying exercise_name so the upsert
    // is idempotent via workout_logs_generated_unique_set.
    if (generatedWorkoutIdRef.current) {
      await supabase.from('workout_logs').upsert({
        user_id: user.id,
        generated_workout_id: generatedWorkoutIdRef.current,
        exercise_name: `Zeus · Week ${zeusWeekNumberRef.current} · Day ${dayNumber}`,
        set_number: 0,
        weight_lbs: 0,
        reps: 0,
        completed: true,
        notes: JSON.stringify({
          program: 'zeus',
          week: zeusWeekNumberRef.current,
          day: dayNumber,
        }),
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,generated_workout_id,exercise_name,set_number' })
    }

    // Program cycles indefinitely in 4-week mesos — never "complete".
    setSessionComplete(true)
  }

  const handleCompleteWithoutMetcon = () => {
    void completeSession()
  }

  const handleSkipDay = async () => {
    if (!user) return
    await markZeusDayDoneRemote(supabase, user.id, dayNumber)
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

          // Lookup any prior logs for this block_name so the block can hydrate.
          const blockLogs = sessionLogs.filter(l => l.block_name === block.name)
          const singleLog = blockLogs[0] // non-strength blocks have 0 or 1 row

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
                  initialLogs={blockLogs}
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
                  initialLog={singleLog}
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
                  initialLog={singleLog}
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
                  initialLog={singleLog}
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
                  initialLog={singleLog}
                />
              </div>
            )
          }

          return null
        })}

        {/* MetCon — populated on days 1 and 4 */}
        {day.metcon && (() => {
          const metconLog = sessionLogs.find(l => l.log_type === 'metcon')
          return (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-muted-foreground/60">{day.blocks.length + 1}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <MetConBlock
                metcon={day.metcon}
                onLog={result => logMetcon(day.metcon!, result)}
                initialLog={metconLog}
              />
            </div>
          )
        })()}

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
