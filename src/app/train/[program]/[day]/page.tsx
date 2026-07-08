'use client'

// ── Generic training day page ─────────────────────────────────────────────────
// Works for any program in src/lib/programs. The day plan is DETERMINISTIC —
// built client-side from config + the user's maxes. No AI call, no timeout,
// no schema validation. The plan is persisted to generated_workouts once so
// session logs (ares_session_logs) have a stable id to hang off, and the
// battle-tested upsert-logging / session_complete-sentinel flow carries over
// from the Zeus engine unchanged.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock, Dumbbell, Flame,
  AlertTriangle, Trophy, Zap, Wind, Pause, Play, RotateCcw,
} from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'
import ForgeLoader from '../../../../components/ForgeLoader'
import {
  DayPlan, LiftPrescription, MetconPrescription, OutsideSession,
  PlyoPrescription, getProgram,
} from '../../../../lib/programs'
import { computeAdjustments, RPE_HINTS } from '../../../../lib/programs/autoreg'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionLogRow {
  block_name: string
  log_type: string
  set_number: number | null
  weight_lbs: number | null
  reps: number | null
  rpe: number | null
  slot: string | null
  completed: boolean | null
  completed_at: string | null
  notes: string | null
  metcon_time_seconds: number | null
  metcon_rounds: number | null
}

interface SetEntry {
  setIndex: number
  weight: string
  reps: string
  done: boolean
  rpe: number | null
}

const UPSERT_CONFLICT = 'user_id,generated_workout_id,block_name,set_number'

// ── Progression (server-derived, same pattern as Zeus) ────────────────────────

async function fetchCurrentWeek(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, slug: string,
): Promise<number> {
  const { data: prog } = await supabase
    .from('user_programs')
    .select('current_week')
    .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active')
    .maybeSingle()
  return prog?.current_week ?? 1
}

async function fetchDoneDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, slug: string, weekNumber: number,
): Promise<number[]> {
  const { data: workouts } = await supabase
    .from('generated_workouts')
    .select('id')
    .eq('user_id', userId).eq('program_slug', slug).eq('week_number', weekNumber)
  const ids: string[] = (workouts ?? []).map((w: { id: string }) => w.id)
  if (!ids.length) return []

  const { data: rows } = await supabase
    .from('ares_session_logs')
    .select('day_number')
    .eq('user_id', userId).in('generated_workout_id', ids)
    .eq('log_type', 'session_complete')
  return [...new Set((rows ?? []).map((r: { day_number: number }) => r.day_number))].sort() as number[]
}

// Only advances user_programs.current_week when the CURRENT week is fully
// logged — completing a previewed future/past week never moves the pointer.
async function advanceWeekIfDone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, slug: string, daysPerWeek: number,
): Promise<void> {
  const weekNumber = await fetchCurrentWeek(supabase, userId, slug)
  const doneDays = await fetchDoneDays(supabase, userId, slug, weekNumber)
  if (doneDays.length < daysPerWeek) return
  await supabase
    .from('user_programs')
    .update({ current_week: weekNumber + 1 })
    .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active')
}

async function fetchMaxes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('user_maxes')
    .select('lift_key, value_lbs')
    .eq('user_id', userId)
  const out: Record<string, number> = {}
  for (const r of data ?? []) out[r.lift_key] = Number(r.value_lbs)
  return out
}

async function fetchSessionLogs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, generatedWorkoutId: string,
): Promise<SessionLogRow[]> {
  const { data } = await supabase
    .from('ares_session_logs')
    .select('block_name, log_type, set_number, weight_lbs, reps, rpe, slot, completed, completed_at, notes, metcon_time_seconds, metcon_rounds')
    .eq('generated_workout_id', generatedWorkoutId)
  return (data ?? []) as SessionLogRow[]
}

// ── Timer (shared) ─────────────────────────────────────────────────────────────

function WorkoutTimer() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
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

// ── Lift card — per-set logging with prescribed load ─────────────────────────

function LiftCard({ item, index, initialLogs, onLog }: {
  item: LiftPrescription
  index: number
  initialLogs: SessionLogRow[]
  onLog: (sets: SetEntry[]) => void
}) {
  const [sets, setSets] = useState<SetEntry[]>(() =>
    Array.from({ length: item.sets }, (_, i) => {
      const row = initialLogs.find(r => r.set_number === i + 1)
      return {
        setIndex: i,
        weight: row?.weight_lbs != null ? String(row.weight_lbs) : (item.targetWeightLbs != null ? String(item.targetWeightLbs) : ''),
        reps: row?.reps != null ? String(row.reps) : String(item.reps),
        done: row?.completed === true,
        rpe: row?.rpe ?? null,
      }
    }),
  )
  const [expanded, setExpanded] = useState(true)

  const update = (idx: number, field: keyof SetEntry, value: unknown) => {
    setSets(prev => {
      const next = prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
      onLog(next)
      return next
    })
  }
  const doneCount = sets.filter(s => s.done).length
  const allDone = doneCount === item.sets
  const panelId = `PNL-${String(index + 1).padStart(2, '0')} // ${item.slot.replace(/_/g, '.').toUpperCase()}`

  return (
    <div className={`panel-cut hud-frame relative bg-card border transition-colors overflow-hidden ${allDone ? 'border-brand/50' : 'border-border'}`}>
      <span className="panel-id">{panelId}</span>

      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-4 pt-6 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight uppercase tracking-wide text-foreground truncate">{item.name}</p>
            {/* Prescription readout — target weight is the hero */}
            {item.targetWeightLbs != null ? (
              <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                <span className="readout-num text-4xl text-brand" style={{ textShadow: '0 0 18px hsl(var(--brand) / 0.35)' }}>
                  {item.targetWeightLbs}
                </span>
                <span className="telemetry-dim">
                  LB @ {item.percent}% · {item.sets}×{item.reps}{item.targetRpe != null ? ` · TGT RPE ${item.targetRpe}` : ''}
                </span>
                {item.appliedAdjustmentPct != null && (
                  <span className="telemetry border border-brand/50 px-1.5 py-0.5 text-brand">
                    AUTO {item.appliedAdjustmentPct > 0 ? '+' : ''}{item.appliedAdjustmentPct}%
                  </span>
                )}
              </div>
            ) : (
              <p className="telemetry-dim mt-1.5">
                {item.sets}×{item.reps}{item.percent != null ? ` @ ${item.percent}%` : item.rpe != null ? ` @ RPE ${item.rpe}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0 pb-0.5">
            {/* Ammo counter — spent rounds = completed sets */}
            <div className="flex gap-1">
              {sets.map((s, i) => (
                <span key={i} className={`ammo-cell ${s.done ? 'spent' : ''}`} />
              ))}
            </div>
            {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
          </div>
        </div>
      </button>

      {item.note && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">{item.note}</p>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-border/60 pt-3">
          <div className="grid grid-cols-4 gap-2 telemetry-dim px-1">
            <span>SET</span><span>LOAD.LB</span><span>REPS</span><span></span>
          </div>
          {sets.map((s, idx) => (
            <div key={idx} className={`panel-cut-sm border transition-colors ${s.done ? 'border-brand/40 bg-brand/5' : 'border-border/60 bg-background'}`}>
              <div className="grid grid-cols-4 gap-2 items-center p-2">
                <span className="readout-num text-xs text-muted-foreground pl-1">{String(idx + 1).padStart(2, '0')}</span>
                <input type="number" value={s.weight} onChange={e => update(idx, 'weight', e.target.value)} placeholder="lbs"
                  className="readout-num w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground/40 text-center" />
                <input type="number" value={s.reps} onChange={e => update(idx, 'reps', e.target.value)} placeholder={String(item.reps)}
                  className="readout-num w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground/40 text-center" />
                <button onClick={() => update(idx, 'done', !s.done)}
                  className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 transition-colors ${s.done ? 'bg-brand text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {s.done ? (s.rpe != null ? `RPE ${s.rpe}` : 'Hit') : 'Log'}
                </button>
              </div>
              {/* RPE strip — appears once the set is logged */}
              {s.done && (
                <div className="px-2 pb-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, r) => r + 1).map(r => (
                      <button
                        key={r}
                        onClick={() => update(idx, 'rpe', s.rpe === r ? null : r)}
                        className={`readout-num flex-1 py-1 text-[11px] border transition-colors ${
                          s.rpe === r
                            ? 'bg-brand text-white border-brand'
                            : item.targetRpe === r
                              ? 'border-brand/50 text-brand'
                              : 'border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                        title={RPE_HINTS[r]}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="telemetry-dim mt-1">
                    {s.rpe != null
                      ? `RPE ${s.rpe} — ${RPE_HINTS[s.rpe]}`
                      : `HOW HARD? ${item.targetRpe != null ? `TARGET ${item.targetRpe}` : 'TAP TO RATE'}`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Plyo card — one-tap done ───────────────────────────────────────────────────

function PlyoCard({ item, initialLog, onLog }: {
  item: PlyoPrescription
  initialLog?: SessionLogRow
  onLog: (notes: string) => void
}) {
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)
  return (
    <div className={`panel-cut relative bg-card border p-4 pt-7 space-y-3 ${logged ? 'border-brand/50' : 'border-border'}`}>
      <span className="panel-id">ORD // {item.slot.replace(/_/g, '.').toUpperCase()}</span>
      <div className="flex items-center gap-3">
        <Zap size={15} className="text-brand shrink-0" />
        <div className="flex-1">
          <p className="font-display text-base uppercase tracking-wide text-foreground">{item.name}</p>
          <p className="telemetry-dim mt-0.5">{item.sets}×{item.reps}{item.note ? ` · ${item.note}` : ''}</p>
        </div>
        {logged && <CheckCircle2 size={15} className="text-brand" />}
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (height, distance, how it felt)..."
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
      <button onClick={() => { onLog(notes); setLogged(true) }}
        className="panel-cut-sm w-full py-2.5 bg-foreground text-background text-xs font-semibold uppercase tracking-widest hover:bg-foreground/90 transition-colors">
        {logged ? 'Logged ✓' : 'Log'}
      </button>
    </div>
  )
}

// ── Metcon card ────────────────────────────────────────────────────────────────

function MetconCard({ item, initialLog, onLog }: {
  item: MetconPrescription
  initialLog?: SessionLogRow
  onLog: (result: { timeMin: string; timeSec: string; rounds: string; notes: string }) => void
}) {
  const t = initialLog?.metcon_time_seconds ?? null
  const [timeMin, setTimeMin] = useState(t != null ? String(Math.floor(t / 60)) : '')
  const [timeSec, setTimeSec] = useState(t != null ? String(t % 60).padStart(2, '0') : '')
  const [rounds, setRounds] = useState(initialLog?.metcon_rounds != null ? String(initialLog.metcon_rounds) : '')
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)
  return (
    <div className="panel-cut relative bg-card border border-brand/40 overflow-hidden">
      <div className="hazard" />
      <div className="p-4 pt-3 border-b border-border flex items-center gap-2">
        <Flame size={15} className="text-brand shrink-0" />
        <div className="flex-1">
          <p className="telemetry">COMBAT.SIM // {item.format.replace(/_/g, '.').toUpperCase()}</p>
          <p className="font-display text-lg uppercase tracking-wide text-foreground mt-0.5">{item.name}</p>
        </div>
        <span className="readout-num text-2xl text-brand">{item.timeCapMinutes}&apos;</span>
      </div>
      <div className="p-4 bg-background/50 border-b border-border">
        <pre className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'var(--font-telemetry)' }}>{item.description}</pre>
      </div>
      <div className="p-4 space-y-3">
        <WorkoutTimer />
        <div className="flex items-center gap-2">
          <input type="number" value={timeMin} onChange={e => setTimeMin(e.target.value)} placeholder="min"
            className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm text-center text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
          <span className="text-muted-foreground">:</span>
          <input type="number" value={timeSec} onChange={e => setTimeSec(e.target.value)} placeholder="sec"
            className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm text-center text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
          <input type="number" value={rounds} onChange={e => setRounds(e.target.value)} placeholder="rounds"
            className="w-24 bg-background border border-border rounded-lg px-3 py-2 text-sm text-center text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
        </div>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
        <button onClick={() => { onLog({ timeMin, timeSec, rounds, notes }); setLogged(true) }}
          className={`w-full py-3 rounded-lg text-sm font-medium uppercase tracking-wider transition-all ${logged ? 'bg-brand/20 text-brand border border-brand/30' : 'bg-brand text-foreground hover:bg-brand/90'}`}>
          {logged ? '✓ MetCon Logged' : 'Log MetCon Result'}
        </button>
      </div>
    </div>
  )
}

// ── Outside session card — checklist + done ───────────────────────────────────

function OutsideCard({ item, initialLog, onLog }: {
  item: OutsideSession
  initialLog?: SessionLogRow
  onLog: (notes: string) => void
}) {
  const [notes, setNotes] = useState(initialLog?.notes ?? '')
  const [logged, setLogged] = useState(initialLog?.completed === true)
  return (
    <div className={`panel-cut hud-frame relative bg-card border p-4 pt-7 space-y-4 ${logged ? 'border-brand/50' : 'border-border'}`}>
      <span className="panel-id">BRIEFING // {item.slot.replace(/_/g, '.').toUpperCase()}</span>
      <div className="flex items-center gap-3">
        <Wind size={15} className="text-steel shrink-0" />
        <p className="font-display text-lg uppercase tracking-wide text-foreground">{item.title}</p>
        {logged && <CheckCircle2 size={15} className="text-brand ml-auto" />}
      </div>
      <ul className="space-y-2">
        {item.parts.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/85">
            <span className="readout-num text-brand/80 mt-px shrink-0">{String(i + 1).padStart(2, '0')}</span>{p}
          </li>
        ))}
      </ul>
      {item.note && <p className="text-xs text-muted-foreground italic border-l-2 border-brand/30 pl-3">{item.note}</p>}
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Debrief (times, distances, feel)..."
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50 resize-none" />
      <button onClick={() => { onLog(notes); setLogged(true) }}
        className="panel-cut-sm w-full py-2.5 bg-foreground text-background text-xs font-semibold uppercase tracking-widest hover:bg-foreground/90 transition-colors">
        {logged ? 'Logged ✓' : 'Mission Complete'}
      </button>
    </div>
  )
}

// ── Maxes update card (test week) ──────────────────────────────────────────────

function MaxesCard({ maxDefs, current, onSave }: {
  maxDefs: Array<{ key: string; label: string }>
  current: Record<string, number>
  onSave: (vals: Record<string, number>) => Promise<void>
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(maxDefs.map(d => [d.key, current[d.key] ? String(current[d.key]) : ''])),
  )
  const [saved, setSaved] = useState(false)
  return (
    <div className="ds-card p-4 space-y-3 border border-brand/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand">Update Your Maxes</p>
      <p className="text-xs text-muted-foreground">New numbers drive next macro&apos;s percentages.</p>
      {maxDefs.map(d => (
        <div key={d.key} className="flex items-center gap-3">
          <span className="text-xs text-foreground w-32">{d.label}</span>
          <input type="number" value={vals[d.key]} onChange={e => { setVals(v => ({ ...v, [d.key]: e.target.value })); setSaved(false) }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand/50" />
          <span className="text-xs text-muted-foreground">lbs</span>
        </div>
      ))}
      <button
        onClick={async () => {
          const out: Record<string, number> = {}
          for (const [k, v] of Object.entries(vals)) {
            const n = parseFloat(v)
            if (Number.isFinite(n) && n > 0) out[k] = n
          }
          await onSave(out)
          setSaved(true)
        }}
        className="w-full py-2.5 bg-brand text-foreground rounded-lg text-xs font-medium uppercase tracking-wider hover:bg-brand/90 transition-colors">
        {saved ? 'Saved ✓' : 'Save Maxes'}
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TrainingDayPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [supabase] = useState(() => createClient())

  const slug = String(params.program ?? '')
  const dayNumber = parseInt(String(params.day), 10) || 1
  const program = getProgram(slug)

  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [maxes, setMaxes] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [sessionLogs, setSessionLogs] = useState<SessionLogRow[]>([])
  const [logWriteError, setLogWriteError] = useState<string | null>(null)

  const workoutIdRef = useRef<string | null>(null)
  const weekRef = useRef<number>(1)
  const logErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDay = useCallback(async () => {
    if (!user || !program) return
    try {
      // ?week=N override lets the schedule open any week of the macro —
      // prescriptions are deterministic so every week is trainable.
      let weekOverride: number | null = null
      try {
        const q = new URLSearchParams(window.location.search).get('week')
        const n = q ? parseInt(q, 10) : NaN
        if (Number.isFinite(n) && n >= 1) weekOverride = n
      } catch { /* SSR-safe no-op */ }

      const [currentWeek, userMaxes] = await Promise.all([
        fetchCurrentWeek(supabase, user.id, slug),
        fetchMaxes(supabase, user.id),
      ])
      const weekNumber = weekOverride ?? currentWeek
      weekRef.current = weekNumber
      setMaxes(userMaxes)
      const doneDays = await fetchDoneDays(supabase, user.id, slug, weekNumber)
      if (doneDays.includes(dayNumber)) setSessionComplete(true)

      // Autoregulation: bounded % deltas from last week's per-set RPE.
      const adjustments = await computeAdjustments(supabase, user.id, program, weekNumber, dayNumber)

      // Deterministic build — instant, no AI.
      const built = program.buildDay(weekNumber, dayNumber, userMaxes, adjustments)
      setPlan(built)

      // Find-or-create the generated_workouts row for log linkage.
      const { data: rows } = await supabase
        .from('generated_workouts')
        .select('id')
        .eq('user_id', user.id).eq('program_slug', slug)
        .eq('week_number', weekNumber).eq('day_number', dayNumber)
        .order('id', { ascending: true }).limit(1)

      let workoutId: string | null = rows?.[0]?.id ?? null
      if (!workoutId) {
        const { data: saved, error: insertError } = await supabase
          .from('generated_workouts')
          .insert({
            user_id: user.id,
            program_slug: slug,
            week_number: weekNumber,
            day_number: dayNumber,
            workout_data: { plan: built },
            exercises: [],
          })
          .select('id').single()
        if (saved) workoutId = saved.id
        else if ((insertError as { code?: string } | null)?.code === '23505') {
          const { data: again } = await supabase
            .from('generated_workouts').select('id')
            .eq('user_id', user.id).eq('program_slug', slug)
            .eq('week_number', weekNumber).eq('day_number', dayNumber)
            .order('id', { ascending: true }).limit(1)
          workoutId = again?.[0]?.id ?? null
        } else if (insertError) {
          throw new Error(`Could not persist workout: ${insertError.message}`)
        }
      }
      workoutIdRef.current = workoutId
      if (workoutId) setSessionLogs(await fetchSessionLogs(supabase, workoutId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user, program, slug, dayNumber, supabase])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Log writers (Zeus engine pattern) ────────────────────────────────────────

  type SbRes = { error?: { code?: string; message?: string } | null }
  const report = (tag: string, res: SbRes | null | undefined) => {
    if (res?.error) {
      console.error(`[train-log] ${tag} FAILED:`, res.error)
      setLogWriteError(`Save failed on ${tag}: ${res.error.message ?? res.error.code ?? 'unknown'}`)
    } else {
      if (logErrTimer.current) clearTimeout(logErrTimer.current)
      logErrTimer.current = setTimeout(() => setLogWriteError(null), 6000)
    }
  }

  const baseRow = () => ({
    user_id: user!.id,
    generated_workout_id: workoutIdRef.current,
    week_number: weekRef.current,
    day_number: dayNumber,
  })

  const logLiftSets = async (item: LiftPrescription, sets: SetEntry[]) => {
    if (!user || !workoutIdRef.current) return
    const now = new Date().toISOString()
    const rows = sets.map(s => ({
      ...baseRow(),
      log_type: 'strength_set' as const,
      block_name: item.name,
      slot: item.slot,
      set_number: s.setIndex + 1,
      weight_lbs: s.weight === '' ? null : parseFloat(s.weight) || null,
      reps: s.reps === '' ? null : parseInt(s.reps) || null,
      rpe: s.rpe,
      completed: s.done,
      completed_at: s.done ? now : null,
    }))
    report(item.name, await supabase.from('ares_session_logs').upsert(rows, { onConflict: UPSERT_CONFLICT }))
  }

  const logSimple = async (blockName: string, logType: string, notes: string, extra?: Record<string, unknown>) => {
    if (!user || !workoutIdRef.current) return
    report(blockName, await supabase.from('ares_session_logs').upsert({
      ...baseRow(),
      log_type: logType,
      block_name: blockName,
      set_number: null,
      notes: notes || null,
      completed: true,
      completed_at: new Date().toISOString(),
      ...extra,
    }, { onConflict: UPSERT_CONFLICT }))
  }

  const completeSession = async () => {
    if (!user || !workoutIdRef.current || !program) return
    await supabase.from('ares_session_logs').upsert({
      ...baseRow(),
      log_type: 'session_complete',
      block_name: '__session_complete__',
      set_number: null,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: UPSERT_CONFLICT })
    await advanceWeekIfDone(supabase, user.id, slug, program.daysPerWeek)
    // Streak shim so dashboard streak sees this session.
    await supabase.from('workout_logs').upsert({
      user_id: user.id,
      generated_workout_id: workoutIdRef.current,
      exercise_name: `${program.name} · Week ${weekRef.current} · Day ${dayNumber}`,
      set_number: 0, weight_lbs: 0, reps: 0, completed: true,
      notes: JSON.stringify({ program: slug, week: weekRef.current, day: dayNumber }),
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,generated_workout_id,exercise_name,set_number' })
    setSessionComplete(true)
  }

  const saveMaxes = async (vals: Record<string, number>) => {
    if (!user) return
    const rows = Object.entries(vals).map(([lift_key, value_lbs]) => ({
      user_id: user.id, lift_key, value_lbs, updated_at: new Date().toISOString(),
    }))
    const res = await supabase.from('user_maxes').upsert(rows, { onConflict: 'user_id,lift_key' })
    report('maxes', res)
    if (!res?.error) setMaxes(m => ({ ...m, ...vals }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!program) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-foreground font-medium">Unknown program &ldquo;{slug}&rdquo;</p>
        <button onClick={() => router.push('/build')} className="px-6 py-2.5 bg-brand text-foreground rounded-lg text-sm font-medium">Choose Program</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ForgeLoader size={64} label="Loading" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-foreground font-medium">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); loadDay() }} className="px-6 py-2.5 bg-brand text-foreground rounded-lg text-sm font-medium">Try Again</button>
      </div>
    )
  }

  if (!plan) return null

  if (sessionComplete) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-6 text-center">
        <div className="stamp px-8 py-4">
          <p className="font-display text-4xl tracking-[0.2em] uppercase">Cleared</p>
        </div>
        <div>
          <p className="telemetry mb-2">WK {weekRef.current} · DAY {dayNumber} // MISSION LOG SAVED</p>
          <p className="text-sm text-muted-foreground">{program.name}</p>
        </div>
        {/* Week LED bar */}
        <div className="w-full max-w-xs">
          <div className="led-bar">
            {Array.from({ length: program.daysPerWeek }).map((_, i) => (
              <span key={i} className={`led-cell ${i < dayNumber ? 'lit' : ''}`} />
            ))}
          </div>
          <p className="telemetry-dim mt-2">WEEK PROGRESS</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {dayNumber < program.daysPerWeek && (
            <button onClick={() => { setSessionComplete(false); setLoading(true); router.push(`/train/${slug}/${dayNumber + 1}`) }}
              className="panel-cut-sm mecha-glow w-full py-3.5 bg-brand text-white text-sm font-semibold uppercase tracking-[0.12em] hover:bg-brand/90 transition-colors">
              Next Mission →
            </button>
          )}
          <button onClick={() => router.push('/dashboard')}
            className="panel-cut-sm w-full py-2.5 border border-border text-muted-foreground text-sm font-medium uppercase tracking-wider hover:text-foreground transition-colors">
            Return to Bridge
          </button>
        </div>
      </div>
    )
  }

  const isTestWeek = plan.dayType === 'test'
  const missingMaxes = program.requiredMaxes.filter(d => !maxes[d.key])
  // Session progress for the header LED bar: logged blocks / total items.
  const loggedBlocks = new Set(sessionLogs.filter(l => l.completed && l.log_type !== 'session_complete').map(l => l.block_name)).size

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className={`carbon sticky top-0 z-10 border-b px-4 py-3 ${isTestWeek ? 'border-brand/60 red-alert' : 'border-border'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/train/${slug}`)} title="Back to week" className="p-2 border border-border/70 text-muted-foreground hover:text-foreground transition-colors panel-cut-sm">
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="telemetry">WK {String(weekRef.current).padStart(2, '0')} // DAY {dayNumber}</span>
              {isTestWeek && <span className="telemetry border border-brand/60 px-1.5 py-0.5">TRIAL PROTOCOL</span>}
            </div>
            <h1 className="font-display text-xl tracking-[0.08em] uppercase truncate mt-0.5 text-white">{plan.dayName}</h1>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="status-dot" />
              <span className="telemetry-dim">{program.name.split(' ')[0].toUpperCase()}</span>
            </div>
            <div className="led-bar w-20">
              {Array.from({ length: Math.max(plan.items.length, 1) }).map((_, i) => (
                <span key={i} className={`led-cell ${i < loggedBlocks ? 'lit' : ''}`} />
              ))}
            </div>
          </div>
        </div>
        {isTestWeek && <div className="hazard mt-2 -mx-4" />}
      </header>

      {logWriteError && (
        <div className="sticky top-[60px] z-10 bg-red-500/10 border-b border-red-500/40 px-4 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 flex-1">{logWriteError}</p>
          <button onClick={() => setLogWriteError(null)} className="text-[10px] uppercase tracking-wider text-red-300/80 hover:text-red-200 px-2">Dismiss</button>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <p className="text-xs text-muted-foreground italic border-l-2 border-blue-500/30 pl-3">{plan.sessionIntent}</p>

        {missingMaxes.length > 0 && plan.dayType === 'gym' && (
          <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg px-4 py-3">
            <p className="text-xs text-yellow-400">
              Missing maxes: {missingMaxes.map(d => d.label).join(', ')} — prescribed weights can&apos;t be computed. Set them in the program settings (or below on a test day).
            </p>
          </div>
        )}

        {plan.items.map((item, i) => {
          const logsFor = (name: string) => sessionLogs.filter(l => l.block_name === name)
          const firstLog = (name: string) => sessionLogs.find(l => l.block_name === name)
          return (
            <div key={`${item.slot}-${i}`} className="panel-mount" style={{ animationDelay: `${i * 45}ms` }}>
              <div className="readout-rule mb-2" />
              {item.kind === 'lift' && (
                <LiftCard item={item} index={i} initialLogs={logsFor(item.name)} onLog={sets => logLiftSets(item, sets)} />
              )}
              {item.kind === 'plyo' && (
                <PlyoCard item={item} initialLog={firstLog(item.name)} onLog={n => logSimple(item.name, 'skill_work', n)} />
              )}
              {item.kind === 'metcon' && (
                <MetconCard item={item} initialLog={firstLog(item.name)} onLog={r => {
                  const secs = r.timeMin || r.timeSec ? (parseInt(r.timeMin || '0') * 60) + parseInt(r.timeSec || '0') : null
                  logSimple(item.name, 'metcon', r.notes, {
                    metcon_format: item.format,
                    metcon_time_seconds: secs,
                    metcon_rounds: r.rounds ? parseInt(r.rounds) : null,
                  })
                }} />
              )}
              {item.kind === 'outside' && (
                <OutsideCard item={item} initialLog={firstLog(item.title)} onLog={n => logSimple(item.title, 'monostructural', n)} />
              )}
            </div>
          )
        })}

        {isTestWeek && (
          <MaxesCard maxDefs={program.requiredMaxes} current={maxes} onSave={saveMaxes} />
        )}

        <button onClick={() => void completeSession()}
          className="panel-cut carbon mecha-glow w-full py-4 border border-brand/60 text-brand text-sm font-semibold uppercase tracking-[0.16em] hover:border-brand transition-colors flex items-center justify-center gap-2.5">
          <Trophy size={16} />
          Mission Complete
        </button>
      </main>
    </div>
  )
}
