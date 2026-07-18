'use client'

// ── Recovery Protocol (Chassis) ────────────────────────────────────────────────
// 3-4 recommended recovery sessions per week. Three staples (cold, stretch,
// foam roll) plus one rotating modality so it doesn't go stale. Checkbox-grade
// logging — one tap per session, resets weekly (Monday), synced to the DB.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Snowflake, StretchHorizontal, Cylinder, Flame, Wind, Droplets, PersonStanding, Check } from 'lucide-react'

interface RecoverySession {
  key: string
  name: string
  detail: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}

const STAPLES: RecoverySession[] = [
  { key: 'cold',    name: 'Cold Plunge',      detail: '2-5 min. Contrast shower counts.', Icon: Snowflake },
  { key: 'stretch', name: 'Full-Body Stretch', detail: '15-20 min. Hips, hams, T-spine.', Icon: StretchHorizontal },
  { key: 'foam',    name: 'Foam Roll',         detail: '10-15 min. Quads, glutes, back.', Icon: Cylinder },
]

// One extra modality per week, rotating so the toolbox stays broad.
const ROTATION: RecoverySession[] = [
  { key: 'sauna',  name: 'Sauna',        detail: '15-20 min post-session.', Icon: Flame },
  { key: 'breath', name: 'Breathwork',   detail: '10 min box breathing, down-regulate.', Icon: Wind },
  { key: 'epsom',  name: 'Epsom Bath',   detail: '20 min soak, night before a hard day.', Icon: Droplets },
  { key: 'hips',   name: 'Hip Mobility', detail: 'Couch stretch + 90/90, 12-15 min.', Icon: PersonStanding },
]

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

// Deterministic rotation: week-of-year picks the fourth session.
function weekSessions(weekKey: string): RecoverySession[] {
  const weekNum = Math.floor(Date.parse(weekKey) / (7 * 86_400_000))
  return [...STAPLES, ROTATION[((weekNum % ROTATION.length) + ROTATION.length) % ROTATION.length]]
}

export default function RecoveryProtocol() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()
  const [weekKey] = useState(() => mondayKey())
  const [done, setDone] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  const sessions = weekSessions(weekKey)

  const load = useCallback(async () => {
    if (!user) { setLoaded(true); return }
    const { data } = await supabase
      .from('user_recovery_checks')
      .select('session_key')
      .eq('user_id', user.id)
      .eq('week_key', weekKey)
    setDone(new Set(((data ?? []) as Array<{ session_key: string }>).map(r => r.session_key)))
    setLoaded(true)
  }, [user, supabase, weekKey])

  useEffect(() => { load() }, [load])

  const toggle = async (key: string) => {
    if (!user) return
    const next = new Set(done)
    if (next.has(key)) {
      next.delete(key)
      setDone(next)
      await supabase.from('user_recovery_checks').delete()
        .eq('user_id', user.id).eq('week_key', weekKey).eq('session_key', key)
    } else {
      next.add(key)
      setDone(next)
      await supabase.from('user_recovery_checks').upsert(
        { user_id: user.id, week_key: weekKey, session_key: key },
        { onConflict: 'user_id,week_key,session_key' },
      )
    }
  }

  const doneCount = sessions.filter(s => done.has(s.key)).length

  return (
    <div className="glass-card relative rounded-xl p-6 pt-8">
      <span className="panel-id">CHS-RCV // RECOVERY.OPS</span>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Snowflake size={16} className="text-brand" />
          <h3 className="font-display font-semibold text-sm uppercase tracking-wide">Recovery Protocol</h3>
        </div>
        <span className="telemetry-dim">{doneCount}/{sessions.length} THIS WK</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        3-4 sessions a week keeps the engine absorbing the training. Tap when done — resets Monday.
      </p>

      {/* LED progress */}
      <div className="led-bar mb-4">
        {sessions.map((s, i) => (
          <span key={i} className={`led-cell ${i < doneCount ? 'lit' : ''}`} />
        ))}
      </div>

      <div className="space-y-2">
        {sessions.map(s => {
          const isDone = done.has(s.key)
          return (
            <button
              key={s.key}
              onClick={() => void toggle(s.key)}
              disabled={!loaded}
              className={`w-full flex items-center gap-3 panel-cut-sm border px-3.5 py-3 text-left transition-colors ${
                isDone ? 'border-brand/40 bg-brand/5' : 'border-border/60 bg-background/40 hover:border-brand/30'
              }`}
            >
              <span className={`w-5 h-5 shrink-0 border flex items-center justify-center transition-colors ${
                isDone ? 'bg-brand border-brand' : 'border-border'
              }`}>
                {isDone && <Check size={12} className="text-white" strokeWidth={3} />}
              </span>
              <s.Icon size={15} className={isDone ? 'text-brand' : 'text-muted-foreground'} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{s.name}</span>
                <span className="block text-[11px] text-muted-foreground truncate">{s.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
