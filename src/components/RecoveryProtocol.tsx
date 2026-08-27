'use client'

// ── Recovery Protocol (Chassis) ────────────────────────────────────────────────
// Weekly target: 4 recovery sessions in ANY combination — 3 cold plunges and a
// stretch counts the same as one of each. Tap a modality to log a session
// (tap − to take one back). Hits 4 → RECOVERY GREEN. Resets Monday, DB-synced.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Snowflake, StretchHorizontal, Cylinder, Flame, Wind, Droplets, PersonStanding, Minus, Plus } from 'lucide-react'

interface RecoverySession {
  key: string
  name: string
  detail: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

const SESSIONS: RecoverySession[] = [
  { key: 'cold',    name: 'Cold Plunge',       detail: '2-5 min. Contrast shower counts.', Icon: Snowflake },
  { key: 'stretch', name: 'Full-Body Stretch', detail: '15-20 min. Hips, hams, T-spine.', Icon: StretchHorizontal },
  { key: 'foam',    name: 'Foam Roll',         detail: '10-15 min. Quads, glutes, back.', Icon: Cylinder },
  { key: 'sauna',   name: 'Sauna',             detail: '15-20 min post-session.', Icon: Flame },
  { key: 'breath',  name: 'Breathwork',        detail: '10 min box breathing, down-regulate.', Icon: Wind },
  { key: 'epsom',   name: 'Epsom Bath',        detail: '20 min soak, night before a hard day.', Icon: Droplets },
  { key: 'hips',    name: 'Hip Mobility',      detail: 'Couch stretch + 90/90, 12-15 min.', Icon: PersonStanding },
]

const WEEKLY_TARGET = 4
const GREEN = '#10B981'

function mondayKey(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function RecoveryProtocol() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [weekKey] = useState(() => mondayKey())
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }
    const { data } = await supabase
      .from('user_recovery_checks')
      .select('session_key, count')
      .eq('user_id', user.id)
      .eq('week_key', weekKey)
    const next: Record<string, number> = {}
    for (const r of (data ?? []) as Array<{ session_key: string; count: number | null }>) {
      next[r.session_key] = r.count ?? 1
    }
    setCounts(next)
    setLoaded(true)
  }, [user, supabase, weekKey])

  useEffect(() => { load() }, [load])

  const setCount = async (key: string, n: number) => {
    if (!user) return
    const next = { ...counts }
    if (n <= 0) delete next[key]
    else next[key] = n
    setCounts(next)
    if (n <= 0) {
      await supabase.from('user_recovery_checks').delete()
        .eq('user_id', user.id).eq('week_key', weekKey).eq('session_key', key)
    } else {
      await supabase.from('user_recovery_checks').upsert(
        { user_id: user.id, week_key: weekKey, session_key: key, count: n },
        { onConflict: 'user_id,week_key,session_key' },
      )
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const complete = total >= WEEKLY_TARGET

  return (
    <div className="tile relative rounded-xl p-6 pt-8">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Snowflake size={16} className={complete ? 'text-foreground' : 'text-brand'} />
          <h3 className="font-display font-semibold text-sm lowercase">Recovery Protocol</h3>
        </div>
        <span className="eyebrow-mono">{total}/{WEEKLY_TARGET} THIS WK</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        {WEEKLY_TARGET} sessions a week, any combination — stack what works for you. Resets Monday.
      </p>

      {complete ? (
        /* ── weekly target hit — volt marks what's earned ── */
        <div className="mb-4 flex flex-col items-center gap-2 py-3">
          <span className="chip-live text-sm px-4 py-2">recovery done</span>
          <p className="eyebrow-mono">
            {total} of {WEEKLY_TARGET} logged · absorbing the work
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <div className="led-bar">
            {Array.from({ length: WEEKLY_TARGET }).map((_, i) => (
              <span key={i} className={`led-cell ${i < total ? 'lit' : ''}`} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {SESSIONS.map(s => {
          const n = counts[s.key] ?? 0
          const active = n > 0
          return (
            <div
              key={s.key}
              className={`flex items-center gap-3 border px-3.5 py-2.5 transition-colors ${
 active ? 'border-border/40 bg-muted/5' : 'border-border/60 bg-background/40'
 }`}
            >
              <button
                onClick={() => void setCount(s.key, n + 1)}
                disabled={!loaded}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                title="Log a session"
              >
                <s.Icon size={15} className={active ? 'text-foreground' : 'text-muted-foreground'} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{s.name}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{s.detail}</span>
                </span>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                {active && (
                  <>
                    <span className="stat-num text-sm" style={{ color: GREEN }}>×{n}</span>
                    <button onClick={() => void setCount(s.key, n - 1)} title="Remove one"
                      className="p-1.5 border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
                      <Minus size={11} />
                    </button>
                  </>
                )}
                <button onClick={() => void setCount(s.key, n + 1)} disabled={!loaded} title="Log a session"
                  className={`p-1.5 border transition-colors ${
 active ? 'border-border/50 text-foreground hover:bg-muted/10' : 'border-border/60 text-muted-foreground hover:text-brand hover:border-brand/50'
 }`}>
                  <Plus size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
