'use client'

// ── Schedule ───────────────────────────────────────────────────────────────────
// Program overview: the current week as tappable day rows plus the full
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
import WeekPulse from '../../../components/WeekPulse'
import type { DayPlan } from '../../../lib/programs/types'
import MaxesCard from '../../../components/MaxesCard'
import { RUN_EPOCH } from '../../../lib/programs/run'
import { blockCount } from '../../../lib/programs/schedule'

const DAY_LABELS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

interface DoneMap { [week: number]: Set<number> }

export default function SchedulePage() {
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

  // The maxes editor had no permanent home: the session runner shows it only
  // during test week or when one is MISSING, so on a four-max program you fill
  // them in once and can never change them again. Power Dad hid this by asking
  // for seven, one of which is usually blank.
  const saveMaxes = async (vals: Record<string, number>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const rows = Object.entries(vals).map(([lift_key, value_lbs]) => ({
      user_id: user.id, lift_key, value_lbs, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('user_maxes').upsert(rows, { onConflict: 'user_id,lift_key' })
    if (!error) setMaxes(m => ({ ...m, ...vals }))
  }
  const [deloadWeeks, setDeloadWeeks] = useState<number[]>([])
  const [dismissedChecks, setDismissedChecks] = useState<number[]>([])
  const prefsRef = useRef<Record<string, unknown>>({})

  const load = useCallback(async () => {
    if (!user || !program) return
    try {
      const [{ data: prog }, { data: maxRows }] = await Promise.all([
        supabase.from('user_programs').select('current_week, preferences, started_at')
          .eq('user_id', user.id).eq('program_slug', slug).eq('status', 'active').maybeSingle(),
        supabase.from('user_maxes').select('lift_key, value_lbs').eq('user_id', user.id),
      ])
      // Only THIS run counts toward progress. Rows from an earlier attempt at
      // the same program stay in the table as history, but a fresh start has to
      // look fresh — see src/lib/programs/run.ts.
      const runStart = (prog?.started_at as string | undefined) ?? RUN_EPOCH
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
        .gte('created_at', runStart)
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
        <AlertTriangle className="w-10 h-10 text-status-danger-ink" />
        <p className="text-foreground font-medium">unknown program &ldquo;{slug}&rdquo;</p>
        <button onClick={() => router.push('/build')} className="pill-volt px-6 py-2.5 text-sm">choose program</button>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><ForgeLoader size={64} label="loading schedule" /></div>
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
    wim === program.macroWeeks ? 'test'
      : wim === program.macroWeeks - 1 || (wk != null && deloadWeeks.includes(wk)) ? 'deload'
      : `m${Math.ceil(wim / 4)}·w${((wim - 1) % 4) + 1}`

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
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="back home"
          className="pill-quiet p-2 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold lowercase truncate">{program.name}</h1>
        </div>
        <div className="text-right shrink-0">
          <p className="stat-num text-4xl">{currentWeek}</p>
          <p className="eyebrow-mono mt-1">active week</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {/* ── Selected week — day rows ── */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="data-mono truncate">week {selectedWeek} · {weekTag(weekInMacro, selectedWeek)}</p>
              {selectedWeek === currentWeek && <span className="chip-live shrink-0">active</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isDeload && <span className="pill-quiet px-2.5 py-1 text-[11px]">deload</span>}
              {isTest && <span className="pill-volt px-2.5 py-1 text-[11px]">test week</span>}
              {!isTest && !isNaturalDeload && (
                <button
                  onClick={() => void toggleDeload()}
                  title="fatigued? render this week with the deload treatment."
                  className="pill-quiet px-2.5 py-1 text-[11px] hover:text-foreground transition-colors"
                >
                  {isForcedDeload ? 'unflag deload' : 'flag deload'}
                </button>
              )}
            </div>
          </div>

          {fatigueCheckDue && (
            <div className="tile p-4">
              <p className="eyebrow-mono mb-2">fatigue check</p>
              <p className="text-sm font-semibold mb-1">
                top week of the meso — three loading weeks banked.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                feeling strong? ride into the heavy work. beat up? flag the deload
                and come back for these numbers fresh.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggleDeload()}
                  className="pill-volt flex-1 py-2.5 text-xs"
                >
                  flag deload
                </button>
                <button
                  onClick={() => void dismissFatigueCheck()}
                  className="pill-quiet flex-1 py-2.5 text-xs hover:text-foreground transition-colors"
                >
                  ride on
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
                className="tile w-full text-left p-3.5 flex items-center gap-3 group"
              >
                <span className="data-mono w-9 shrink-0">{DAY_LABELS[i]}</span>
                <Icon size={14} className={done ? 'text-brand' : 'text-muted-foreground'} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold lowercase truncate ${done ? 'text-muted-foreground line-through decoration-brand' : 'text-foreground'}`}>
                    {plan.dayName}
                  </p>
                  <p className="data-mono truncate">{blockCount(plan)} block{blockCount(plan) === 1 ? '' : 's'} · {plan.dayType.toLowerCase()}</p>
                </div>
                {done
                  ? <span className="chip-live shrink-0">done</span>
                  : <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />}
              </button>
            )
          })}
        </section>

        {/* ── Macro grid ── */}
        <section className="space-y-2.5">
          <p className="data-mono">macro · {program.macroWeeks} weeks</p>
          <div className="tile-lg p-4">
            <div className="space-y-1.5">
              {macroWeeks.map(wk => {
                const wim = ((wk - 1) % program.macroWeeks) + 1
                const done = doneMap[wk] ?? new Set<number>()
                const isSel = wk === selectedWeek
                const isCur = wk === currentWeek
                const mesoBoundary = wim === 1 || wim === 5 || wim === 9 || wim === program.macroWeeks - 1
                return (
                  <div key={wk}>
                    {mesoBoundary && (
                      <p className="eyebrow-mono mt-3 mb-1">
                        {wim === 1 ? 'meso 1 · volume + variation'
                          : wim === 5 ? 'meso 2 · intensification'
                          : wim === 9 ? 'meso 3 · realization'
                          : 'reset · deload + test week'}
                      </p>
                    )}
                    <button
                      onClick={() => setSelectedWeek(wk)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${isSel ? 'row-recessed' : 'hover:bg-muted/40'}`}
                    >
                      <span className={`data-mono w-8 text-left shrink-0 ${isCur ? 'text-brand font-semibold' : ''}`}>
                        w{wk}
                      </span>
                      <div className="flex flex-1 items-center gap-1.5">
                        {Array.from({ length: program.daysPerWeek }).map((_, i) => (
                          <span key={i} className={`h-2.5 w-2.5 rounded-[5px] ${done.has(i + 1) ? 'bg-brand' : 'bg-muted'}`} />
                        ))}
                      </div>
                      <span className="data-mono w-14 text-right shrink-0">{weekTag(wim, wk)}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            every week&apos;s loads are computed from your current maxes — tap any week to preview or train it.
            update them above any time; next macro&apos;s numbers follow. re-test in week-{program.macroWeeks} tests.
          </p>
        </section>

        {/* The permanent home for training maxes. The session runner shows this
            card only during test week or when one is missing, which means a
            four-max program locks you out the moment you finish filling them in.
            Here it is always available, in the program whose maxes it edits. */}
        <section className="space-y-2.5">
          <MaxesCard
            maxDefs={program.requiredMaxes}
            current={maxes}
            onSave={saveMaxes}
            title="Your Maxes"
            subtitle="Every load below is computed from these. Change them any time."
          />
        </section>
      </main>
    </div>
  )
}
