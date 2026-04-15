'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DailyObjectivesCard() {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]

      // Try localStorage first for instant load
      const cached = localStorage.getItem('dad-strength-mind-state')
      if (cached) {
        const data = JSON.parse(cached)
        if (data.date === new Date().toLocaleDateString()) {
          setObjectives(data.objectives || ['', '', ''])
          setCompleted(data.completedObjectives || [false, false, false])
          setLocked(data.lockedIn || false)
          setLoading(false)
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('daily_checkins')
        .select('mind_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()

      if (data?.mind_state) {
        const ms = data.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean }
        setObjectives(ms.objectives || ['', '', ''])
        setCompleted(ms.completedObjectives || [false, false, false])
        setLocked(ms.lockedIn || false)
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggle = async (i: number) => {
    if (!locked) return
    const newCompleted = [...completed]
    newCompleted[i] = !newCompleted[i]
    setCompleted(newCompleted)

    // Persist
    const today = new Date().toISOString().split('T')[0]
    const cached = localStorage.getItem('dad-strength-mind-state')
    const data = cached ? JSON.parse(cached) : {}
    const updated = { ...data, completedObjectives: newCompleted, date: new Date().toLocaleDateString() }
    localStorage.setItem('dad-strength-mind-state', JSON.stringify(updated))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('daily_checkins').upsert(
      { user_id: user.id, date: today, mind_state: updated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
  }

  const doneCount = completed.filter(Boolean).length
  const filledObjectives = objectives.filter(o => o.trim())
  const hasObjectives = locked && filledObjectives.length > 0

  if (loading) {
    return <div className="ds-card h-32 animate-pulse" />
  }

  return (
    <div className="ds-card p-5 relative overflow-hidden">
      {/* Editorial depth marks */}
      <span
        className="absolute -top-4 right-2 font-display leading-none pointer-events-none select-none"
        style={{ fontSize: '7rem', color: 'rgba(200,130,10,0.045)', letterSpacing: '0.05em' }}
        aria-hidden="true"
      >03</span>
      <svg className="absolute -bottom-4 -right-4 w-24 h-24 pointer-events-none select-none" viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ opacity: 0.04, color: 'hsl(38 90% 50%)' }}>
        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="5" />
        <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="5" />
        <circle cx="50" cy="50" r="12" stroke="currentColor" strokeWidth="5" />
        <line x1="50" y1="6" x2="50" y2="22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="78" x2="50" y2="94" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <line x1="6" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <line x1="78" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Target size={14} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm font-display tracking-[0.06em]">Daily Objectives</h3>
        </div>
        {hasObjectives && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            {doneCount}/{filledObjectives.length} done
          </span>
        )}
      </div>

      {!hasObjectives ? (
        <a href="/mind" className="block text-center py-4 text-sm text-muted-foreground hover:text-foreground transition-colors relative z-10">
          <p className="text-xs">No objectives set yet.</p>
          <p className="text-brand text-xs font-medium mt-1">Set today&apos;s objectives →</p>
        </a>
      ) : (
        <div className="space-y-2 relative z-10">
          {filledObjectives.map((obj, i) => (
            <motion.button
              key={i}
              onClick={() => toggle(i)}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 text-left group"
            >
              {completed[i]
                ? <CheckCircle2 size={16} className="text-brand shrink-0" />
                : <Circle size={16} className="text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
              }
              <span className={`text-sm leading-snug transition-all ${completed[i] ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                {obj}
              </span>
            </motion.button>
          ))}

          {doneCount === filledObjectives.length && filledObjectives.length > 0 && (
            <p className="text-[10px] text-brand uppercase tracking-widest font-black pt-1 text-center">
              Locked in. ⚡
            </p>
          )}
        </div>
      )}
    </div>
  )
}
