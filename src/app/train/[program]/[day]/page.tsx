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
  ArrowLeft, CheckCircle2, Check, ChevronDown, ChevronUp, Clock, Dumbbell, Flame,
  AlertTriangle, Trophy, Zap, Wind, Pause, Play, RotateCcw, Link2, Repeat, Search, History,
} from 'lucide-react'
import { createClient } from '../../../../utils/supabase/client'
import { useUser } from '../../../../contexts/UserContext'
import ForgeLoader from '../../../../components/ForgeLoader'
import {
  DayPlan, LiftPrescription, MetconPrescription, OutsideSession,
  PlyoPrescription, getProgram,
} from '../../../../lib/programs'
import { computeAdjustments, RPE_HINTS } from '../../../../lib/programs/autoreg'
import { EXERCISE_LIBRARY, CATEGORY_LABELS, ExerciseCategory } from '../../../../lib/programs/exerciseLibrary'

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

// ── Exercise substitutions ─────────────────────────────────────────────────────
// Persistent per (program, slot, original name) — a swap survives across weeks
// because the plan is rebuilt deterministically and re-subbed on every load.

type SubsMap = Record<string, string> // `${slot}::${originalName}` → subName

function applySubs(plan: DayPlan, subs: SubsMap): DayPlan {
  if (Object.keys(subs).length === 0) return plan
  return {
    ...plan,
    items: plan.items.map(i => {
      if (i.kind !== 'lift' && i.kind !== 'plyo') return i
      const sub = subs[`${i.slot}::${i.name}`]
      return sub && sub !== i.name ? { ...i, name: sub, subbedFrom: i.name } : i
    }),
  }
}

// Last (absolute) week of the mesocycle that `week` falls in. Mesos are the
// 4-week blocks 1-4 / 5-8 / 9-12; the test week (13) is its own.
function mesoLastWeek(week: number, macroWeeks: number): number {
  const wim = ((week - 1) % macroWeeks) + 1
  const cycleStart = week - (wim - 1)
  const lastWim = Math.min(Math.ceil(wim / 4) * 4, macroWeeks)
  return cycleStart + lastWim - 1
}

// Whether a stored swap is in scope for the week being viewed.
//   • created_week null → legacy swap, always applies (pre-scope behavior)
//   • repeat_meso       → created_week through that meso's last week
//   • otherwise         → only the exact session week it was made
function subInScope(createdWeek: number | null, repeatMeso: boolean, currentWeek: number, macroWeeks: number): boolean {
  if (createdWeek == null) return true
  if (currentWeek < createdWeek) return false
  return repeatMeso ? currentWeek <= mesoLastWeek(createdWeek, macroWeeks) : currentWeek === createdWeek
}

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

// Per-lift history: the top logged set for each slot in the EARLIER weeks of the
// current mesocycle. Lets you see "what did I hit last week on this movement"
// right on the card. Scoped through generated_workouts so week numbers can't
// collide with a program the user ran previously.
export interface SlotHistoryEntry { week: number; weight: number; reps: number }
type LiftHistory = Record<string, SlotHistoryEntry[]>

async function fetchLiftHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, slug: string, weekNumber: number, macroWeeks: number,
): Promise<LiftHistory> {
  const weekInMacro = ((weekNumber - 1) % macroWeeks) + 1
  // Meso start within the macro: weeks 1-4 → 1, 5-8 → 5, 9-12 → 9 (test week 13
  // has no history worth showing). 4-week mesos.
  const mesoStartInMacro = weekInMacro > 12 ? 9 : Math.floor((weekInMacro - 1) / 4) * 4 + 1
  const mesoStart = weekNumber - (weekInMacro - mesoStartInMacro)
  if (weekNumber <= mesoStart) return {} // first week of the meso — nothing prior

  const { data: workouts } = await supabase
    .from('generated_workouts')
    .select('id, week_number')
    .eq('user_id', userId).eq('program_slug', slug)
    .gte('week_number', mesoStart).lt('week_number', weekNumber)
  const weekById: Record<string, number> = {}
  for (const w of workouts ?? []) weekById[w.id] = w.week_number
  const ids = Object.keys(weekById)
  if (!ids.length) return {}

  const { data: logs } = await supabase
    .from('ares_session_logs')
    .select('generated_workout_id, slot, weight_lbs, reps')
    .eq('user_id', userId).eq('log_type', 'strength_set').eq('completed', true)
    .in('generated_workout_id', ids)

  // Best (heaviest) logged set per (slot, week).
  const best: Record<string, SlotHistoryEntry> = {} // key: slot|week
  for (const l of logs ?? []) {
    if (!l.slot || l.weight_lbs == null) continue
    const week = weekById[l.generated_workout_id as string]
    if (!week) continue
    const key = `${l.slot}|${week}`
    const w = Number(l.weight_lbs)
    if (!best[key] || w > best[key].weight) best[key] = { week, weight: w, reps: Number(l.reps ?? 0) }
  }
  const out: LiftHistory = {}
  // Group by slot, most recent week first.
  for (const key of Object.keys(best)) {
    const slot = key.slice(0, key.lastIndexOf('|'))
    ;(out[slot] ??= []).push(best[key])
  }
  for (const slot of Object.keys(out)) out[slot].sort((a, b) => b.week - a.week)
  return out
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

// ── Rest timer — 2:00 countdown, restarts each time a set is logged ──────────

function restBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[0, 0.18].forEach(offset => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, now + offset)
      g.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14)
      o.connect(g); g.connect(ctx.destination)
      o.start(now + offset); o.stop(now + offset + 0.16)
    })
    setTimeout(() => ctx.close(), 700)
  } catch { /* audio blocked — the visual countdown still works */ }
}

const REST_SECONDS = 120

function RestTimer({ trigger }: { trigger: number }) {
  const [remaining, setRemaining] = useState(0)
  const [active, setActive] = useState(false)
  const endRef = useRef(0)
  const beeped = useRef(false)

  // Each set-log bumps `trigger` → (re)start the countdown.
  useEffect(() => {
    if (trigger === 0) return
    endRef.current = Date.now() + REST_SECONDS * 1000
    beeped.current = false
    setRemaining(REST_SECONDS)
    setActive(true)
  }, [trigger])

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !beeped.current) {
        beeped.current = true
        restBeep()
        try { navigator.vibrate?.([120, 60, 120]) } catch { /* unsupported */ }
        setTimeout(() => setActive(false), 2600)
      }
    }, 250)
    return () => clearInterval(t)
  }, [active, trigger])

  if (!active) return null
  const done = remaining <= 0
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const pct = Math.max(0, Math.min(100, (remaining / REST_SECONDS) * 100))

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm panel-mount">
      <div className={`panel-cut-sm carbon border px-4 py-3 shadow-2xl ${done ? 'border-brand red-alert' : 'border-brand/50 mecha-glow'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Clock size={14} className={done ? 'text-brand' : 'text-brand'} />
            <span className="telemetry text-brand">{done ? 'REST DONE' : 'REST'}</span>
          </div>
          <span className="readout-num text-2xl tabular-nums text-white">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { endRef.current += 30_000; setRemaining(r => r + 30); beeped.current = false }}
              className="panel-cut-sm border border-border/70 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors">+0:30</button>
            <button onClick={() => setActive(false)}
              className="panel-cut-sm border border-brand/50 text-[10px] font-semibold uppercase tracking-widest text-brand hover:bg-brand/10 px-2 py-1.5 transition-colors">Skip</button>
          </div>
        </div>
        <div className="mt-2 h-1 bg-border/40 overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${pct}%`, transition: 'width 250ms linear' }} />
        </div>
      </div>
    </div>
  )
}

// ── Lift card — per-set logging with prescribed load ─────────────────────────

function LiftCard({ item, index, initialLogs, onLog, onSwap, history, onSetComplete }: {
  item: LiftPrescription
  index: number
  initialLogs: SessionLogRow[]
  onLog: (sets: SetEntry[]) => void
  onSwap?: () => void
  history?: SlotHistoryEntry[]
  onSetComplete?: () => void
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
      const next = prev.map((s, i) => {
        if (i === idx) return { ...s, [field]: value }
        // Editing weight or reps cascades forward to the sets you haven't logged
        // yet — set your working load once and the rest follow. Earlier sets and
        // already-logged sets are never touched.
        if ((field === 'weight' || field === 'reps') && i > idx && !s.done) {
          return { ...s, [field]: value }
        }
        return s
      })
      onLog(next)
      return next
    })
    // Marking a set done kicks off the rest timer.
    if (field === 'done' && value === true) onSetComplete?.()
  }
  const doneCount = sets.filter(s => s.done).length
  const allDone = doneCount === item.sets
  const panelId = `PNL-${String(index + 1).padStart(2, '0')} // ${item.slot.replace(/_/g, '.').toUpperCase()}`

  return (
    <div className={`panel-cut hud-frame relative bg-card border transition-colors overflow-hidden ${allDone ? 'border-brand/50' : 'border-border'}`}>
      <span className="panel-id">{panelId}</span>
      {onSwap && (
        <button onClick={onSwap} title="Substitute exercise"
          className="absolute top-0.5 right-0.5 z-10 p-2 text-muted-foreground/70 hover:text-brand transition-colors">
          <Repeat size={12} />
        </button>
      )}

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
            {/* Prior weeks of this meso — what you actually lifted here before */}
            {history && history.length > 0 && (
              <p className="telemetry-dim mt-1.5 flex items-center gap-1.5 flex-wrap">
                <History size={9} className="text-muted-foreground/70 shrink-0" />
                {history.slice(0, 3).map(h => (
                  <span key={h.week}>
                    W{String(h.week).padStart(2, '0')} <span className="text-foreground/70">{h.weight}×{h.reps}</span>
                  </span>
                ))}
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

      {item.subbedFrom && (
        <p className="px-4 pb-1 telemetry-dim">SUB // WAS {item.subbedFrom.toUpperCase()}</p>
      )}
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

// ── Plyo card — per-set logging (max-intent work deserves a real log) ──────────

interface PlyoSetEntry {
  setIndex: number
  reps: string
  done: boolean
}

function PlyoCard({ item, index, initialLogs, onLog, onSwap, onSetComplete }: {
  item: PlyoPrescription
  index: number
  initialLogs: SessionLogRow[]
  onLog: (sets: PlyoSetEntry[], notes: string) => void
  onSwap?: () => void
  onSetComplete?: () => void
}) {
  const [sets, setSets] = useState<PlyoSetEntry[]>(() =>
    Array.from({ length: item.sets }, (_, i) => {
      const row = initialLogs.find(r => r.set_number === i + 1)
      return {
        setIndex: i,
        reps: row?.reps != null ? String(row.reps) : String(item.reps),
        done: row?.completed === true,
      }
    }),
  )
  const [notes, setNotes] = useState(initialLogs.find(r => r.notes)?.notes ?? '')

  const update = (idx: number, field: 'reps' | 'done', value: unknown) => {
    setSets(prev => {
      const next = prev.map((s, i) => {
        if (i === idx) return { ...s, [field]: value }
        if (field === 'reps' && i > idx && !s.done) return { ...s, reps: value as string }
        return s
      })
      onLog(next, notes)
      return next
    })
    if (field === 'done' && value === true) onSetComplete?.()
  }
  const allDone = sets.filter(s => s.done).length === item.sets

  return (
    <div className={`panel-cut relative bg-card border transition-colors overflow-hidden ${allDone ? 'border-brand/50' : 'border-border'}`}>
      <span className="panel-id">ORD-{String(index + 1).padStart(2, '0')} // {item.slot.replace(/_/g, '.').toUpperCase()}</span>
      {onSwap && (
        <button onClick={onSwap} title="Substitute exercise"
          className="absolute top-0.5 right-0.5 z-10 p-2 text-muted-foreground/70 hover:text-brand transition-colors">
          <Repeat size={12} />
        </button>
      )}
      <div className="px-4 pt-6 pb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <Zap size={15} className="text-brand shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight uppercase tracking-wide text-foreground truncate">{item.name}</p>
            <p className="telemetry-dim mt-0.5">{item.sets}×{item.reps} · MAX INTENT</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 pb-0.5">
          {sets.map((s, i) => (
            <span key={i} className={`ammo-cell ${s.done ? 'spent' : ''}`} />
          ))}
        </div>
      </div>
      {item.subbedFrom && (
        <p className="px-4 pb-1 telemetry-dim">SUB // WAS {item.subbedFrom.toUpperCase()}</p>
      )}
      {item.note && (
        <p className="px-4 pb-2 text-xs text-muted-foreground italic">{item.note}</p>
      )}
      <div className="px-4 pb-4 space-y-1.5 border-t border-border/60 pt-3">
        <div className="grid grid-cols-3 gap-2 telemetry-dim px-1">
          <span>SET</span><span>REPS</span><span></span>
        </div>
        {sets.map((s, idx) => (
          <div key={idx} className={`panel-cut-sm border transition-colors ${s.done ? 'border-brand/40 bg-brand/5' : 'border-border/60 bg-background'}`}>
            <div className="grid grid-cols-3 gap-2 items-center p-2">
              <span className="readout-num text-xs text-muted-foreground pl-1">{String(idx + 1).padStart(2, '0')}</span>
              <input type="number" value={s.reps} onChange={e => update(idx, 'reps', e.target.value)} placeholder={String(item.reps)}
                className="readout-num w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted-foreground/40 text-center" />
              <button onClick={() => update(idx, 'done', !s.done)}
                className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1.5 transition-colors ${s.done ? 'bg-brand text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {s.done ? 'Hit' : 'Log'}
              </button>
            </div>
          </div>
        ))}
        <input type="text" value={notes} onChange={e => { setNotes(e.target.value); onLog(sets, e.target.value) }}
          placeholder="Notes (height, load, how it felt)..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/50" />
      </div>
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

// ── Swap modal — searchable exercise library ───────────────────────────────────

function SwapModal({ target, onPick, onRevert, onClose }: {
  target: { slot: string; originalName: string; currentName: string }
  onPick: (name: string, repeatMeso: boolean) => void
  onRevert: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ExerciseCategory | null>(null)
  const [repeat, setRepeat] = useState(true)
  const query = q.trim().toLowerCase()
  const results = EXERCISE_LIBRARY.filter(e =>
    e.name !== target.currentName &&
    (cat == null || e.cat === cat) &&
    (query === '' || e.name.toLowerCase().includes(query)),
  ).slice(0, 40)
  const exactMatch = EXERCISE_LIBRARY.some(e => e.name.toLowerCase() === query)
  const isSubbed = target.currentName !== target.originalName

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative panel-cut bg-card border border-border w-full sm:max-w-md max-h-[82vh] flex flex-col p-4 pt-8 sm:m-6">
        <span className="panel-id">ARMORY // SWAP.{target.slot.replace(/_/g, '.').toUpperCase()}</span>

        <div className="mb-3">
          <p className="telemetry mb-1">SUBSTITUTE EXERCISE</p>
          <p className="font-display text-base uppercase tracking-wide text-foreground">{target.currentName}</p>
          {isSubbed && <p className="telemetry-dim mt-0.5">ORIGINAL // {target.originalName.toUpperCase()}</p>}
        </div>

        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 mb-2">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search the library..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
          {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map(c => (
            <button key={c} onClick={() => setCat(cat === c ? null : c)}
              className={`shrink-0 text-[9px] font-mono uppercase tracking-widest px-2 py-1 border rounded-sm transition-colors ${
                cat === c ? 'border-brand text-brand bg-brand/10' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-[240px]">
          {results.map(e => (
            <button key={e.name} onClick={() => onPick(e.name, repeat)}
              className="w-full text-left panel-cut-sm border border-border/60 bg-background hover:border-brand/50 px-3 py-2 transition-colors flex items-center justify-between gap-2">
              <span className="text-sm text-foreground">{e.name}</span>
              <span className="telemetry-dim shrink-0">{CATEGORY_LABELS[e.cat]}</span>
            </button>
          ))}
          {query !== '' && !exactMatch && (
            <button onClick={() => onPick(q.trim(), repeat)}
              className="w-full text-left panel-cut-sm border border-dashed border-border px-3 py-2 hover:border-brand/50 transition-colors">
              <span className="text-sm text-muted-foreground">Use custom: </span>
              <span className="text-sm text-foreground">{q.trim()}</span>
            </button>
          )}
          {results.length === 0 && query === '' && (
            <p className="telemetry-dim text-center py-6">TYPE TO SEARCH OR PICK A CATEGORY</p>
          )}
        </div>

        {/* Scope — repeat the swap for the rest of this mesocycle, or just today */}
        <button onClick={() => setRepeat(r => !r)}
          className="mt-3 flex items-center gap-2.5 text-left group">
          <span className={`w-4 h-4 shrink-0 border flex items-center justify-center transition-colors ${repeat ? 'bg-brand border-brand' : 'border-border group-hover:border-brand/50'}`}>
            {repeat && <Check size={11} className="text-white" strokeWidth={3} />}
          </span>
          <span className="text-xs text-foreground/90">
            Repeat for the rest of this mesocycle
            <span className="block telemetry-dim mt-0.5">{repeat ? 'APPLIES TO EVERY WEEK THROUGH THIS MESO' : 'THIS SESSION ONLY'}</span>
          </span>
        </button>

        <div className="pt-3 space-y-2">
          {isSubbed && (
            <button onClick={onRevert}
              className="w-full py-2.5 border border-brand/50 text-brand text-xs font-semibold uppercase tracking-widest hover:bg-brand/10 transition-colors panel-cut-sm">
              Revert to {target.originalName}
            </button>
          )}
          <button onClick={onClose}
            className="w-full py-2.5 bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-widest hover:text-foreground transition-colors panel-cut-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Maxes update card (test week) ──────────────────────────────────────────────

function MaxesCard({ maxDefs, current, onSave }: {
  maxDefs: Array<{ key: string; label: string; unit?: string }>
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
          <span className="text-xs text-muted-foreground">{d.unit ?? 'lbs'}</span>
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
  const [liftHistory, setLiftHistory] = useState<LiftHistory>({})
  const [logWriteError, setLogWriteError] = useState<string | null>(null)
  const [restTrigger, setRestTrigger] = useState(0)

  const workoutIdRef = useRef<string | null>(null)
  const weekRef = useRef<number>(1)
  const logErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subsRef = useRef<SubsMap>({})
  const [swapTarget, setSwapTarget] = useState<{ slot: string; originalName: string; currentName: string } | null>(null)

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

      const [currentWeek, userMaxes, subRes] = await Promise.all([
        fetchCurrentWeek(supabase, user.id, slug),
        fetchMaxes(supabase, user.id),
        supabase.from('user_exercise_subs')
          .select('slot, original_name, sub_name, created_week, repeat_meso')
          .eq('user_id', user.id).eq('program_slug', slug),
      ])
      const weekNumber = weekOverride ?? currentWeek
      weekRef.current = weekNumber
      setMaxes(userMaxes)
      const subs: SubsMap = {}
      for (const r of (subRes.data ?? []) as Array<{ slot: string; original_name: string; sub_name: string; created_week: number | null; repeat_meso: boolean | null }>) {
        if (!subInScope(r.created_week, r.repeat_meso ?? true, weekNumber, program.macroWeeks)) continue
        subs[`${r.slot}::${r.original_name}`] = r.sub_name
      }
      subsRef.current = subs
      const doneDays = await fetchDoneDays(supabase, user.id, slug, weekNumber)
      if (doneDays.includes(dayNumber)) setSessionComplete(true)

      // Autoregulation: bounded % deltas from last week's per-set RPE.
      const adjustments = await computeAdjustments(supabase, user.id, program, weekNumber, dayNumber)

      // Deterministic build — instant, no AI — then user substitutions on top.
      const built = applySubs(program.buildDay(weekNumber, dayNumber, userMaxes, adjustments), subs)
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
      setLiftHistory(await fetchLiftHistory(supabase, user.id, slug, weekNumber, program.macroWeeks))
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

  const logPlyoSets = async (item: PlyoPrescription, sets: PlyoSetEntry[], notes: string) => {
    if (!user || !workoutIdRef.current) return
    const now = new Date().toISOString()
    const rows = sets.map(s => ({
      ...baseRow(),
      log_type: 'skill_work' as const,
      block_name: item.name,
      slot: item.slot,
      set_number: s.setIndex + 1,
      reps: s.reps === '' ? null : parseInt(s.reps) || null,
      completed: s.done,
      completed_at: s.done ? now : null,
      notes: s.setIndex === 0 ? notes || null : null, // card-level notes ride on set 1
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

  // Swap an exercise (subName) or revert to the original (null). Persists to
  // user_exercise_subs and patches the in-memory plan without a reload.
  const applySwap = async (subName: string | null, repeatMeso = true) => {
    if (!user || !swapTarget) return
    const { slot, originalName } = swapTarget
    if (subName == null || subName === originalName) {
      const res = await supabase.from('user_exercise_subs').delete()
        .eq('user_id', user.id).eq('program_slug', slug)
        .eq('slot', slot).eq('original_name', originalName)
      report('swap', res)
      delete subsRef.current[`${slot}::${originalName}`]
    } else {
      const res = await supabase.from('user_exercise_subs').upsert({
        user_id: user.id, program_slug: slug, slot,
        original_name: originalName, sub_name: subName,
        created_week: weekRef.current, repeat_meso: repeatMeso,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,program_slug,slot,original_name' })
      report('swap', res)
      subsRef.current[`${slot}::${originalName}`] = subName
    }
    setPlan(p => p && ({
      ...p,
      items: p.items.map(i => {
        if ((i.kind !== 'lift' && i.kind !== 'plyo') || i.slot !== slot) return i
        if ((i.subbedFrom ?? i.name) !== originalName) return i
        return subName == null || subName === originalName
          ? { ...i, name: originalName, subbedFrom: undefined }
          : { ...i, name: subName, subbedFrom: originalName }
      }),
    }))
    setSwapTarget(null)
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

        {(() => {
          const logsFor = (name: string) => sessionLogs.filter(l => l.block_name === name)
          const firstLog = (name: string) => sessionLogs.find(l => l.block_name === name)
          type Item = DayPlan['items'][number]
          const swapFor = (item: LiftPrescription | PlyoPrescription) => () =>
            setSwapTarget({ slot: item.slot, originalName: item.subbedFrom ?? item.name, currentName: item.name })
          const renderCard = (item: Item, i: number) => (
            <>
              {item.kind === 'lift' && (
                <LiftCard item={item} index={i} initialLogs={logsFor(item.name)} onLog={sets => logLiftSets(item, sets)} onSwap={swapFor(item)} history={liftHistory[item.slot]} onSetComplete={() => setRestTrigger(t => t + 1)} />
              )}
              {item.kind === 'plyo' && (
                <PlyoCard item={item} index={i} initialLogs={logsFor(item.name)} onLog={(sets, n) => logPlyoSets(item, sets, n)} onSwap={swapFor(item)} onSetComplete={() => setRestTrigger(t => t + 1)} />
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
            </>
          )
          // Consecutive items sharing a superset id render as one linked unit.
          const groups: Array<{ superset?: string; entries: Array<{ item: Item; i: number }> }> = []
          plan.items.forEach((item, i) => {
            const ss = item.kind === 'lift' || item.kind === 'plyo' ? item.superset : undefined
            const last = groups[groups.length - 1]
            if (ss && last?.superset === ss) last.entries.push({ item, i })
            else groups.push({ superset: ss, entries: [{ item, i }] })
          })
          return groups.map(g =>
            g.entries.length > 1 ? (
              <div key={`ss-${g.superset}-${g.entries[0].i}`} className="panel-mount" style={{ animationDelay: `${g.entries[0].i * 45}ms` }}>
                <div className="readout-rule mb-2" />
                <div className="relative pl-3">
                  {/* Link rail — one circuit, alternate between these cards */}
                  <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-brand/60" aria-hidden="true" />
                  <span className="absolute left-0 top-1 w-2 h-[2px] bg-brand/60" aria-hidden="true" />
                  <span className="absolute left-0 bottom-1 w-2 h-[2px] bg-brand/60" aria-hidden="true" />
                  <div className="telemetry text-brand mb-2 flex items-center gap-1.5">
                    <Link2 size={11} /> LINKED // SUPERSET · ALTERNATE SETS
                  </div>
                  <div className="space-y-2">
                    {g.entries.map(({ item, i }) => (
                      <div key={`${item.slot}-${'name' in item ? item.name : ''}-${i}`}>{renderCard(item, i)}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div key={`${g.entries[0].item.slot}-${'name' in g.entries[0].item ? g.entries[0].item.name : ''}-${g.entries[0].i}`} className="panel-mount" style={{ animationDelay: `${g.entries[0].i * 45}ms` }}>
                <div className="readout-rule mb-2" />
                {renderCard(g.entries[0].item, g.entries[0].i)}
              </div>
            ),
          )
        })()}

        {isTestWeek && (
          <MaxesCard maxDefs={program.requiredMaxes} current={maxes} onSave={saveMaxes} />
        )}

        <button onClick={() => void completeSession()}
          className="panel-cut carbon mecha-glow w-full py-4 border border-brand/60 text-brand text-sm font-semibold uppercase tracking-[0.16em] hover:border-brand transition-colors flex items-center justify-center gap-2.5">
          <Trophy size={16} />
          Mission Complete
        </button>
      </main>

      {swapTarget && (
        <SwapModal
          target={swapTarget}
          onPick={(name, repeatMeso) => void applySwap(name, repeatMeso)}
          onRevert={() => void applySwap(null)}
          onClose={() => setSwapTarget(null)}
        />
      )}

      <RestTimer trigger={restTrigger} />
    </div>
  )
}
