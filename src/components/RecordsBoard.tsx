'use client'

// ── Records board (Chassis) ────────────────────────────────────────────────────
// All-time bests derived from what's already logged — zero input. For every
// exercise: best single / triple / five (best weight moved for at least that
// many reps in one set). A dot marks records set in the last 7 days.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'

interface RecordRow {
  name: string
  best1: number | null
  best3: number | null
  best5: number | null
  freshest: string | null // most recent date any of the bests was set
}

const SHOW_COLLAPSED = 6

export default function RecordsBoard() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [records, setRecords] = useState<RecordRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }
    const { data } = await supabase
      .from('ares_session_logs')
      .select('block_name, weight_lbs, reps, completed_at')
      .eq('user_id', user.id)
      .eq('log_type', 'strength_set')
      .eq('completed', true)
      .not('weight_lbs', 'is', null)
      .gt('weight_lbs', 0)
      .order('completed_at', { ascending: false })
      .limit(5000)

    type Row = { block_name: string; weight_lbs: number; reps: number | null; completed_at: string | null }
    const byName: Record<string, { best: Record<number, { w: number; at: string | null }> }> = {}
    for (const r of (data ?? []) as Row[]) {
      const reps = r.reps ?? 1
      const w = Number(r.weight_lbs)
      if (!w || reps < 1) continue
      const e = (byName[r.block_name] ??= { best: {} })
      // A set of N reps counts toward every bucket ≤ N.
      for (const bucket of [1, 3, 5]) {
        if (reps >= bucket && (!e.best[bucket] || w > e.best[bucket].w)) {
          e.best[bucket] = { w, at: r.completed_at }
        }
      }
    }

    const out: RecordRow[] = Object.entries(byName).map(([name, e]) => {
      const dates = [1, 3, 5].map(b => e.best[b]?.at).filter(Boolean) as string[]
      return {
        name,
        best1: e.best[1]?.w ?? null,
        best3: e.best[3]?.w ?? null,
        best5: e.best[5]?.w ?? null,
        freshest: dates.sort().pop() ?? null,
      }
    })
    out.sort((a, b) => (b.best1 ?? 0) - (a.best1 ?? 0))
    setRecords(out)
    setLoaded(true)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const fresh = (d: string | null) =>
    d != null && Date.now() - Date.parse(d) < 7 * 86_400_000

  const visible = showAll ? records : records.slice(0, SHOW_COLLAPSED)

  return (
    <div className="glass-card relative rounded-xl p-6 pt-8">
      <span className="panel-id">CHS-REC // RECORDS</span>
      <div className="flex items-center gap-2 mb-1.5">
        <Trophy size={16} className="text-brand" />
        <h3 className="font-display font-semibold text-sm uppercase tracking-wide">Records</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Pulled straight from your logged sets — heaviest weight for 1, 3, and 5+ reps.
      </p>

      {!loaded ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-9 bg-muted/60 rounded-lg animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <p className="text-xs text-muted-foreground italic border-l-2 border-brand/30 pl-3">
          Log working sets and your records build themselves.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_repeat(3,3.2rem)] gap-x-2 telemetry-dim px-1 mb-1.5">
            <span>LIFT</span><span className="text-right">×1</span><span className="text-right">×3</span><span className="text-right">×5</span>
          </div>
          <div className="space-y-1.5">
            {visible.map(r => (
              <div key={r.name}
                className={`grid grid-cols-[1fr_repeat(3,3.2rem)] gap-x-2 items-center panel-cut-sm border px-3 py-2 ${
                  fresh(r.freshest) ? 'border-brand/40 bg-brand/5' : 'border-border/60 bg-background/40'
                }`}>
                <span className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                  {fresh(r.freshest) && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" title="Set this week" />}
                  {r.name}
                </span>
                {[r.best1, r.best3, r.best5].map((v, i) => (
                  <span key={i} className={`readout-num text-sm text-right ${v != null ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {v ?? '—'}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {records.length > SHOW_COLLAPSED && (
            <button onClick={() => setShowAll(s => !s)}
              className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
              {showAll ? <><ChevronUp size={12} /> Top {SHOW_COLLAPSED} only</> : <><ChevronDown size={12} /> All {records.length} lifts</>}
            </button>
          )}
        </>
      )}
    </div>
  )
}
