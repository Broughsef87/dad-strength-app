'use client'

// ── Week pulse ────────────────────────────────────────────────────────────────
// The compact read, for the dashboard and the top of the training week. Two
// numbers and a shape — glanceable in about two seconds.
//
// WHY TONNAGE NEVER APPEARS ALONE. A periodised block trades volume for
// intensity on purpose: 5x5 at 70% in meso 1 becomes 4x3 at 85%+ in meso 3, so
// tonnage FALLS across a macro that is working perfectly. On its own that reads
// as "you are slacking". Paired with average intensity it reads as what it is —
// the block doing its job. The one-line verdict underneath states which of the
// two is happening so the pair can't be misread.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import {
  weeklyLoad, DEFAULT_VELOCITY_SLOTS, DEFAULT_VELOCITY_LIFT_NAMES,
  type SetRow, type WeekLoad,
} from '../lib/analytics/training'
import { Sparkline } from './charts/primitives'

const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

/** Deterministic reading of the volume/intensity pair — no AI, no vibes. */
function verdict(cur: WeekLoad, prev: WeekLoad | undefined): string {
  if (cur.isDeload) return 'deload week — light by design'
  if (!prev) return 'first week logged — this becomes your baseline'
  const dT = prev.tonnage > 0 ? ((cur.tonnage - prev.tonnage) / prev.tonnage) * 100 : 0
  const dI = cur.avgIntensityPct != null && prev.avgIntensityPct != null
    ? cur.avgIntensityPct - prev.avgIntensityPct : null
  if (prev.isDeload) return 'back on after a deload'
  if (dI != null && dT < -5 && dI > 1) return 'volume down, intensity up — the block is doing its job'
  if (dI != null && dT > 5 && dI < -1) return 'building volume at lighter loads'
  if (dT < -20) return 'a lighter week than last'
  if (dT > 20) return 'a heavier week than last'
  return 'holding steady on last week'
}

export default function WeekPulse({ compact = false }: { compact?: boolean }) {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [loaded, setLoaded] = useState(false)
  const [weeks, setWeeks] = useState<WeekLoad[]>([])

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }
    const [{ data: rows }, { data: maxRows }, { data: prog }] = await Promise.all([
      supabase.from('ares_session_logs')
        .select('block_name, slot, weight_lbs, reps, completed, week_number, log_type')
        .eq('user_id', user.id).eq('log_type', 'strength_set').eq('completed', true)
        .limit(5000),
      supabase.from('user_maxes').select('lift_key, value_lbs').eq('user_id', user.id),
      supabase.from('user_programs').select('preferences')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    ])
    const prefs = (prog?.preferences ?? {}) as { deload_weeks?: unknown }
    const deloadWeeks = Array.isArray(prefs.deload_weeks)
      ? prefs.deload_weeks.filter((n): n is number => typeof n === 'number') : []
    const maxes: Record<string, number> = {}
    for (const m of maxRows ?? []) maxes[m.lift_key] = Number(m.value_lbs)

    setWeeks(weeklyLoad((rows ?? []) as SetRow[], maxes, {
      deloadWeeks,
      velocitySlots: [...DEFAULT_VELOCITY_SLOTS],
      velocityNames: [...DEFAULT_VELOCITY_LIFT_NAMES],
    }))
    setLoaded(true)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  return <WeekPulseView loaded={loaded} weeks={weeks} compact={compact} />
}

/** Pure render, so the proof harness can drive it outside the auth wall. */
export function WeekPulseView({
  loaded, weeks, compact = false,
}: { loaded: boolean; weeks: WeekLoad[]; compact?: boolean }) {
  if (!loaded) return <div className={`tile ${compact ? 'p-4' : 'p-5'}`}><div className="skeleton h-20" /></div>
  if (!weeks.length) return null

  const cur = weeks[weeks.length - 1]
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : undefined
  const dT = prev && prev.tonnage > 0 ? ((cur.tonnage - prev.tonnage) / prev.tonnage) * 100 : null
  const dI = cur.avgIntensityPct != null && prev?.avgIntensityPct != null
    ? cur.avgIntensityPct - prev.avgIntensityPct : null
  const recent = weeks.slice(-8)

  return (
    <div className={`tile ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow-mono">week {cur.week} · load</p>
        {cur.isDeload && <span className="pill-quiet px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em]">deload</span>}
      </div>

      <div className="flex items-start gap-5">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="font-sans font-bold text-3xl leading-none tracking-tight">{kilo(cur.tonnage)}</span>
            <span className="text-[11px] text-muted-foreground">lb moved</span>
          </div>
          <p className="eyebrow-mono mt-1">
            {cur.sets} {cur.sets === 1 ? 'set' : 'sets'}{dT != null ? ` · ${dT >= 0 ? '+' : ''}${dT.toFixed(0)}% vs last` : ''}
          </p>
        </div>

        {cur.avgIntensityPct != null && (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-sans font-bold text-3xl leading-none tracking-tight">
                {Math.round(cur.avgIntensityPct)}
              </span>
              <span className="text-[11px] text-muted-foreground">% of max</span>
            </div>
            <p className="eyebrow-mono mt-1">
              avg intensity{dI != null ? ` · ${dI >= 0 ? '+' : ''}${dI.toFixed(0)} pts` : ''}
            </p>
          </div>
        )}
      </div>

      {recent.length > 1 && (
        <div className="mt-3">
          <Sparkline
            height={32}
            ariaLabel={`Weekly tonnage over the last ${recent.length} weeks, currently ${Math.round(cur.tonnage)} pounds`}
            points={recent.map(w => ({ y: w.tonnage, label: `wk ${w.week}${w.isDeload ? ' · deload' : ''}` }))}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2 uppercase tracking-[0.08em]">{verdict(cur, prev)}</p>
    </div>
  )
}
