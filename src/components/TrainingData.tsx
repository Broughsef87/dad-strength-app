'use client'

// ── Training data ─────────────────────────────────────────────────────────────
// The one question the app never answered: is this working? Everything here is
// derived from sets already logged — no new input, ever.
//
// Deliberately NOT shown, because something else on this page already owns it:
//   · all-time PRs per rep bracket → RecordsBoard, directly above
//   · sessions this week / streak  → BodyVitals
//   · week + meso position         → the mission schedule
//   · weekly tonnage               → the battle log (and it reads another table,
//                                    so restating it here would disagree)
//
// A projection is a FLOOR, not a forecast. Best e1RM inside a recency window
// says "you are good for at least this" — it can never say you got weaker,
// because not lifting heavy lately is not evidence of decline. That matters
// concretely: power cleans run at 87-91% of the FULL clean max by design, so a
// naive delta would print a permanent -9% regression on a lift that is fine.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { LineChart } from 'lucide-react'
import {
  liftTrends, projections, adherence,
  DEFAULT_VELOCITY_SLOTS, DEFAULT_VELOCITY_LIFT_NAMES,
  type SetRow, type LiftTrend, type Projection, type AdherenceResult,
} from '../lib/analytics/training'
import { getProgram } from '../lib/programs'
import { Sparkline, ColumnChart } from './charts/primitives'

const DAY_LABEL = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function TrainingData() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [loaded, setLoaded] = useState(false)
  const [trends, setTrends] = useState<LiftTrend[]>([])
  const [projs, setProjs] = useState<Projection[]>([])
  const [adh, setAdh] = useState<AdherenceResult | null>(null)

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }

    const [{ data: rows }, { data: maxRows }, { data: prog }] = await Promise.all([
      supabase.from('ares_session_logs')
        .select('block_name, slot, weight_lbs, reps, completed, completed_at, week_number, day_number, log_type')
        .eq('user_id', user.id)
        .order('week_number', { ascending: true })
        .limit(5000),
      supabase.from('user_maxes').select('lift_key, value_lbs').eq('user_id', user.id),
      supabase.from('user_programs').select('program_slug, current_week, preferences')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    ])

    const prefs = (prog?.preferences ?? {}) as { deload_weeks?: unknown }
    const deloadWeeks = Array.isArray(prefs.deload_weeks)
      ? prefs.deload_weeks.filter((n): n is number => typeof n === 'number')
      : []

    const maxes: Record<string, number> = {}
    for (const m of maxRows ?? []) maxes[m.lift_key] = Number(m.value_lbs)

    const setRows = (rows ?? []) as SetRow[]
    const t = liftTrends(setRows, {
      deloadWeeks,
      velocitySlots: [...DEFAULT_VELOCITY_SLOTS],
      velocityNames: [...DEFAULT_VELOCITY_LIFT_NAMES],
    })

    // Heaviest first — the lifts he cares most about lead.
    const list = Object.values(t).sort((a, b) => b.current - a.current)
    setTrends(list)
    setProjs(Object.values(projections(t, maxes, { latestWeek: prog?.current_week ?? undefined })))
    // Adherence is a RATE, so the denominator has to be the program the
    // athlete is actually on. It was hardcoded to 4, which was wrong for every
    // program in the registry (5, 6, 6, and Power Dad's 7 — 6 as of FOR-195)
    // and quietly inflated the rate for all of them. The row is already loaded
    // here; it just was not being asked for the slug.
    const active = getProgram((prog?.program_slug as string | null) ?? '')
    setAdh(adherence(setRows, { daysPerWeek: active?.daysPerWeek ?? 4 }))
    setLoaded(true)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  return <TrainingDataView loaded={loaded} trends={trends} projs={projs} adh={adh} />
}

/** Pure render — no data access, so the proof harness can drive it with
 *  synthetic rows and the card gets SEEN before it ships. */
export function TrainingDataView({
  loaded, trends, projs, adh,
}: {
  loaded: boolean
  trends: LiftTrend[]
  projs: Projection[]
  adh: AdherenceResult | null
}) {
  const tracked = trends.filter(t => !t.sparse && t.deltaPct != null)
  // Median, not mean: one lift having a huge week shouldn't speak for the rest.
  const deltas = tracked.map(t => t.deltaPct as number).sort((a, b) => a - b)
  const headline = deltas.length
    ? deltas.length % 2 ? deltas[(deltas.length - 1) / 2]
      : (deltas[deltas.length / 2 - 1] + deltas[deltas.length / 2]) / 2
    : null
  const firstWeek = tracked.length ? Math.min(...tracked.map(t => t.firstWeek)) : null
  const lastWeek = tracked.length ? Math.max(...tracked.map(t => t.lastWeek)) : null

  return (
    <div className="tile p-6">
      <div className="flex items-center gap-2 mb-1">
        <LineChart size={15} className="text-muted-foreground" />
        <h3 className="font-display text-base lowercase">training data</h3>
      </div>
      <p className="eyebrow-mono mb-5">built from every set you have logged</p>

      {!loaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-16" />)}
        </div>
      ) : !trends.length ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nothing to plot yet. Log a few working sets and this fills itself in —
          trends, projected maxes, and which day tends to slip.
        </p>
      ) : (
        <div className="space-y-7">

          {/* ── Hero: the one number the card exists to answer ── */}
          {headline != null && (
            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-sans font-bold text-5xl leading-none tracking-tight"
                  style={{ color: headline >= 0 ? 'hsl(var(--brand-text))' : 'hsl(var(--foreground))' }}
                >
                  {headline >= 0 ? '+' : ''}{headline.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground lowercase">typical lift</span>
              </div>
              <p className="eyebrow-mono mt-1.5">
                median change across {tracked.length} tracked {tracked.length === 1 ? 'lift' : 'lifts'}
                {firstWeek != null && lastWeek != null ? ` · wk ${firstWeek}–${lastWeek}` : ''}
              </p>
            </div>
          )}

          {/* ── Per lift: own scale, own sparkline ── */}
          <section>
            <p className="eyebrow-mono mb-2.5">estimated 1rm · by lift</p>
            <div className="grid grid-cols-2 gap-2.5">
              {trends.slice(0, 8).map(t => (
                <div key={t.name} className="row-recessed p-3">
                  <p className="text-[11px] lowercase text-muted-foreground truncate" title={t.name}>
                    {t.name.toLowerCase()}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-sans font-bold text-xl leading-none tracking-tight">
                      {Math.round(t.current)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">lb</span>
                    {/* Ink, not volt: at 10px the volt-as-text token measured
                        4.33:1 on the recessed row — under the 4.5 AA floor. The
                        sign carries direction; volt lives on the marks. */}
                    {t.deltaPct != null && (
                      <span className="text-[10px] font-semibold ml-auto text-foreground">
                        {t.deltaPct >= 0 ? '+' : ''}{t.deltaPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    {t.points.length > 1 ? (
                      <Sparkline
                        height={34}
                        ariaLabel={`${t.name} estimated 1RM trend, ${t.points.length} sessions, currently ${Math.round(t.current)} pounds`}
                        points={t.points.map(p => ({ y: p.e1rm, label: `wk ${p.week}` }))}
                      />
                    ) : (
                      <p className="eyebrow-mono" style={{ lineHeight: '34px' }}>one session — no trend yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Projected maxes — a floor, never a forecast ── */}
          <section>
            <p className="eyebrow-mono mb-1">what your training says you are good for</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">
              A floor, not a prediction — the most your logged sets can prove. Below your
              entered max just means you have not gone heavy lately, not that you got weaker.
            </p>
            <div>
              {projs.map(p => {
                const ready = p.projected != null && p.entered != null && p.projected > p.entered
                return (
                  <div key={p.key} className="data-row items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm lowercase">{p.label.toLowerCase()}</p>
                      <p className="eyebrow-mono truncate" title={p.basis}>{p.basis}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {p.projected == null ? (
                        <span className="data-mono">—</span>
                      ) : (
                        <>
                          <span
                            className="stat-num text-base"
                            style={{ color: ready ? 'hsl(var(--brand-text))' : 'hsl(var(--foreground))' }}
                          >
                            {Math.round(p.projected)}
                          </span>
                          <span className="text-[10px] text-muted-foreground"> lb</span>
                          <p className="eyebrow-mono">
                            {ready
                              ? `above your ${Math.round(p.entered as number)} — ready to test`
                              : p.entered != null ? `max on file ${Math.round(p.entered)}` : 'no max on file'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Which day slips — the cut nothing else in the app makes ── */}
          {adh && adh.source !== 'none' && adh.byWeekday.some(d => d.sessions > 0) && (
            <section>
              <p className="eyebrow-mono mb-2.5">
                sessions by weekday · {adh.totalSessions} total over {adh.weeksTracked} {adh.weeksTracked === 1 ? 'week' : 'weeks'}
              </p>
              <ColumnChart
                ariaLabel="Sessions completed by day of week"
                data={adh.byWeekday.map(d => ({
                  label: DAY_LABEL[d.day - 1] ?? String(d.day),
                  value: d.sessions,
                  sub: `${DAY_LABEL[d.day - 1] ?? d.day}: ${d.sessions} ${d.sessions === 1 ? 'session' : 'sessions'}`,
                }))}
              />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
