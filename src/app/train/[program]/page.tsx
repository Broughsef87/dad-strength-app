'use client'

// ── Mission Schedule ───────────────────────────────────────────────────────────
// Program overview: the current week as tappable day panels plus the full
// macro grid. Because prescriptions are deterministic, EVERY week of the
// macro is preview-able and trainable — tap any day of any week to open it
// (the day page takes a ?week= override). Completed days are lit from
// session_complete sentinel rows.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Dumbbell, Wind, FlaskConical, ChevronRight } from 'lucide-react'
import { createClient } from '../../../utils/supabase/client'
import { useUser } from '../../../contexts/UserContext'
import ForgeLoader from '../../../components/ForgeLoader'
import { getProgram } from '../../../lib/programs'
import type { DayPlan } from '../../../lib/programs/types'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

// A back-off slot isn't its own block — it's the same bar, same station, right
// after the top set. Counting it separately made a 6-block day read as 7 and
// contradicted the program's own session budget.
const blockCount = (plan: DayPlan) => plan.items.filter(i => !i.slot.endsWith('_back')).length

interface DoneMap { [week: number]: Set<number> }

export default function MissionSchedulePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [supabase] = useState(() => createClient())

  const slug = String(params.program ?? '')
  const program = getProgram(slug)

  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [doneMap, setDoneMap] = useState<DoneMap>({})
  const [maxes, setMaxes] = useState<Record<string, number>>({})
  const [deloadWeeks, setDeloadWeeks] = useState<number[]>([])
  const [dismissedChecks, setDismissedChecks] = useState<number[]>([])
  const prefsRef = useRef<Record<string, unknown>>({})

  const load = useCallback(async () => {
    if (!user || !program) return
    try {
      const [{ data: prog }, { data: maxRows }] = await Promise.all([
        supabase.from('user_programs').select('current_week, preferences')
          .eq('user_id', user.id).eq('program_slug', slug).eq('status', 'active').maybeSingle(),
        supabase.from('user_maxes').select('lift_key, value_lbs').eq('user_id', user.id),
      ])
      const wk = prog?.current_week ?? 1
      setCurrentWeek(wk)
      setSelectedWeek(wk)
      prefsRef.current = (prog?.preferences ?? {}) as Record<string, unknown>
      const dw = (prefsRef.current as { deload_weeks?: unknown }).deload_weeks
      setDeloadWeeks(Array.isArray(dw) ? dw.filter((n): n is number => typeof n === 'number') : [])
      const dc = (prefsRef.current as { deload_checks_dismissed?: unknown }).deload_checks_dismissed
      setDismissedChecks(Array.isArray(dc) ? dc.filter((n): n is number => typeof n === 'number') : [])
      const m: Record<string, number> = {}
      for (const r of maxRows ?? []) m[r.lift_key] = Number(r.value_lbs)
      setMaxes(m)

      // All completion sentinels for this program, mapped (week → done days).
      const { data: workouts } = await supabase
        .from('generated_workouts')
        .select('id, week_number, day_number')
        .eq('user_id', user.id).eq('program_slug', slug)
      const byId: Record<string, { week: number; day: number }> = {}
      for (const w of workouts ?? []) byId[w.id] = { week: w.week_number, day: w.day_number }
      const ids = Object.keys(byId)
      const map: DoneMap = {}
      if (ids.length) {
        const { data: sentinels } = await supabase
          .from('ares_session_logs')
          .select('generated_workout_id')
          .eq('user_id', user.id).eq('log_type', 'session_complete')
          .in('generated_workout_id', ids)
        for (const s of sentinels ?? []) {
          const loc = byId[s.generated_workout_id as string]
          if (!loc) continue
          if (!map[loc.week]) map[loc.week] = new Set()
          map[loc.week].add(loc.day)
        }
      }
      setDoneMap(map)
    } finally {
      setLoading(false)
    }
  }, [user, program, slug, supabase])

  useEffect(() => { load() }, [load])

  if (!program) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-foreground font-medium">Unknown program &ldquo;{slug}&rdquo;</p>
        <button onClick={() => router.push('/build')} className="px-6 py-2.5 bg-brand text-brand-ink rounded-lg text-sm font-medium">Choose Program</button>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><ForgeLoader size={64} label="Loading Schedule" /></div>
  }

  // Macro position for the selected week (mirror of config math).
  const weekInMacro = ((selectedWeek - 1) % program.macroWeeks) + 1
  const isTest = weekInMacro === program.macroWeeks
  const isNaturalDeload = weekInMacro === program.macroWeeks - 1
  const isForcedDeload = deloadWeeks.includes(selectedWeek)
  const isDeload = isNaturalDeload || isForcedDeload

  const macroStart = selectedWeek - (weekInMacro - 1)
  const macroWeeks = Array.from({ length: program.macroWeeks }, (_, i) => macroStart + i)

  // Fatigue checkpoint: entering the 4th (top) week of a meso, ask the athlete
  // whether to ride into the heavy work or take the deload instead. W12/W13
  // are excluded — the macro already deloads and tests there. Keyed to the
  // absolute week so each macro's checkpoints ask fresh.
  const fatigueCheckDue =
    selectedWeek === currentWeek &&
    weekInMacro % 4 === 0 && !isTest && !isNaturalDeload &&
    !isForcedDeload && !dismissedChecks.includes(selectedWeek)

  const weekPlans = Array.from({ length: program.daysPerWeek }, (_, i) =>
    program.buildDay(selectedWeek, i + 1, maxes, undefined, { forceDeload: isForcedDeload }),
  )
  const doneDays = doneMap[selectedWeek] ?? new Set<number>()

  const weekTag = (wim: number, wk?: number) =>
    wim === program.macroWeeks ? 'TRIALS'
      : wim === program.macroWeeks - 1 || (wk != null && deloadWeeks.includes(wk)) ? 'HOLD PT'
      : `M${Math.ceil(wim / 4)}·W${((wim - 1) % 4) + 1}`

  // Fatigue-flagged deload: toggle for the selected week, persisted on
  // user_programs.preferences so the day pages render it too.
  const toggleDeload = async () => {
    if (!user) return
    const next = isForcedDeload
      ? deloadWeeks.filter(w => w !== selectedWeek)
      : [...deloadWeeks, selectedWeek]
    setDeloadWeeks(next)
    prefsRef.current = { ...prefsRef.current, deload_weeks: next }
    await supabase.from('user_programs')
      .update({ preferences: prefsRef.current })
      .eq('user_id', user.id).eq('program_slug', slug).eq('status', 'active')
  }

  const dismissFatigueCheck = async () => {
    if (!user) return
    const next = [...dismissedChecks, selectedWeek]
    setDismissedChecks(next)
    prefsRef.current = { ...prefsRef.current, deload_checks_dismissed: next }
    await supabase.from('user_programs')
      .update({ preferences: prefsRef.current })
      .eq('user_id', user.id).eq('program_slug', slug).eq('status', 'active')
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="carbon sticky top-0 z-10 border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="panel-cut-sm p-2 border border-border/70 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="telemetry">OPS // MISSION.SCHEDULE</p>
          <h1 className="font-display text-xl tracking-[0.08em] uppercase truncate mt-0.5 text-white">{program.name}</h1>
        </div>
        <div className="text-right shrink-0">
          <p className="readout-num text-3xl text-brand" style={{ textShadow: '0 0 14px hsl(var(--brand) / 0.4)' }}>
            {String(currentWeek).padStart(2, '0')}
          </p>
          <p className="telemetry-dim">ACTIVE WK</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* ── Selected week — day panels ── */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="telemetry">
              WK {String(selectedWeek).padStart(2, '0')} // {weekTag(weekInMacro, selectedWeek)}
              {selectedWeek === currentWeek ? ' · ACTIVE' : ''}
            </p>
            <div className="flex items-center gap-2">
              {isDeload && <span className="telemetry border border-destructive/60 text-destructive px-1.5 py-0.5">HOLD POINT</span>}
              {isTest && <span className="telemetry border border-destructive/60 px-1.5 py-0.5 red-alert">TRIALS</span>}
              {!isTest && !isNaturalDeload && (
                <button
                  onClick={() => void toggleDeload()}
                  title="Fatigued? Issue a hold point — the week renders with the deload treatment."
                  className={`telemetry border px-1.5 py-0.5 transition-colors ${
                    isForcedDeload
                      ? 'border-destructive text-destructive bg-destructive/10 hover:bg-destructive/20'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-brand/40'
                  }`}
                >
                  {isForcedDeload ? 'LIFT HOLD POINT' : 'ISSUE HOLD POINT'}
                </button>
              )}
            </div>
          </div>
          <div className="readout-rule" />

          {fatigueCheckDue && (
            <div className="panel-cut-sm relative border border-brand/40 bg-brand/5 p-4 pt-6">
              <span className="panel-id">SYS-FTG // FATIGUE CHECK</span>
              <p className="text-sm font-medium text-foreground mb-1">
                Top week of the meso — three loading weeks banked.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Feeling strong? Ride into the heavy work. Beat up? Issue a hold
                point and come back for these numbers fresh.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggleDeload()}
                  className="panel-cut-sm flex-1 py-2.5 border border-destructive/60 text-destructive text-xs font-semibold uppercase tracking-widest hover:bg-destructive/10 transition-colors"
                >
                  Issue Hold Point
                </button>
                <button
                  onClick={() => void dismissFatigueCheck()}
                  className="panel-cut-sm flex-1 py-2.5 border border-border text-muted-foreground text-xs font-semibold uppercase tracking-widest hover:text-foreground hover:border-brand/40 transition-colors"
                >
                  Ride On
                </button>
              </div>
            </div>
          )}

          {weekPlans.map((plan, i) => {
            const d = i + 1
            const done = doneDays.has(d)
            const isGym = program.gymDayNumbers.includes(d)
            const Icon = plan.dayType === 'test' ? FlaskConical : isGym ? Dumbbell : Wind
            return (
              <button
                key={d}
                onClick={() => router.push(`/train/${slug}/${d}${selectedWeek !== currentWeek ? `?week=${selectedWeek}` : ''}`)}
                className={`panel-cut-sm w-full text-left bg-card border p-3.5 flex items-center gap-3 transition-colors group ${done ? 'border-cleared/40 yellow-out' : 'border-border hover:border-brand/40'}`}
              >
                <span className="readout-num text-lg text-muted-foreground w-9 shrink-0">{DAY_LABELS[i]}</span>
                <Icon size={14} className={done ? 'text-cleared' : 'text-muted-foreground'} />
                <div className="flex-1 min-w-0">
                  <p className={`font-display text-sm uppercase tracking-wide truncate ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {plan.dayName}
                  </p>
                  <p className="telemetry-dim truncate">{blockCount(plan)} BLOCK{blockCount(plan) === 1 ? '' : 'S'} · {plan.dayType.toUpperCase()}</p>
                </div>
                {done
                  ? <span className="telemetry text-cleared shrink-0">AS BUILT</span>
                  : <ChevronRight size={14} className="text-muted-foreground group-hover:text-brand transition-colors shrink-0" />}
              </button>
            )
          })}
        </section>

        {/* ── Macro grid ── */}
        <section className="space-y-2.5">
          <p className="telemetry">MACRO // {program.macroWeeks} WEEKS</p>
          <div className="readout-rule" />
          <div className="panel-cut hud-frame relative bg-card border border-border p-4 pt-7">
            <span className="panel-id">CAMPAIGN MAP</span>
            <div className="space-y-1.5">
              {macroWeeks.map(wk => {
                const wim = ((wk - 1) % program.macroWeeks) + 1
                const done = doneMap[wk] ?? new Set<number>()
                const isSel = wk === selectedWeek
                const isCur = wk === currentWeek
                // Drafting reads: crosshatch = hold point, single hatch = not cut yet
                const isHold = wim === program.macroWeeks - 1 || deloadWeeks.includes(wk)
                const isFuture = wk > currentWeek
                const mesoBoundary = wim === 1 || wim === 5 || wim === 9 || wim === program.macroWeeks - 1
                return (
                  <div key={wk}>
                    {mesoBoundary && (
                      <p className="telemetry-dim mt-3 mb-1">
                        {wim === 1 ? 'MESO 1 // VOLUME + VARIATION'
                          : wim === 5 ? 'MESO 2 // INTENSIFICATION'
                          : wim === 9 ? 'MESO 3 // REALIZATION'
                          : 'HOLD POINT // DELOAD + TRIALS'}
                      </p>
                    )}
                    <button
                      onClick={() => setSelectedWeek(wk)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 transition-colors ${
                        isSel ? 'bg-brand/10 border border-brand/40'
                          : isHold ? 'crosshatch border border-transparent hover:bg-muted/40'
                          : isFuture ? 'hatch border border-transparent hover:bg-muted/40'
                          : 'border border-transparent hover:bg-muted/40'
                      }`}
                    >
                      <span className={`readout-num text-xs w-8 text-left shrink-0 ${isCur ? 'text-brand' : 'text-muted-foreground'}`}>
                        W{String(wk).padStart(2, '0')}
                      </span>
                      <div className="led-bar flex-1">
                        {Array.from({ length: program.daysPerWeek }).map((_, i) => (
                          <span key={i} className={`led-cell ${done.has(i + 1) ? 'lit' : ''}`} />
                        ))}
                      </div>
                      <span className="telemetry-dim w-14 text-right shrink-0">{weekTag(wim, wk)}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every week&apos;s loads are computed from your current maxes — tap any week to preview or train it.
            Next macro&apos;s numbers appear after you log new maxes in the week-{program.macroWeeks} trials.
          </p>
        </section>
      </main>
    </div>
  )
}
