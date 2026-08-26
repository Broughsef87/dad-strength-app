'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'

export default function DailyObjectivesCard(
  { refreshKey = 0 }: { refreshKey?: number } = {},
) {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Writes the same shape MorningProtocol's Goals step writes, to the same
  // localStorage key and the same daily_checkins column, so the two are
  // interchangeable and whichever the user reaches first works.
  const saveDraft = async () => {
    if (saving || !draft.some(o => o.trim())) return
    setSaving(true)
    const today = localDay()
    const state = {
      date: today,
      objectives: draft,
      completedObjectives: [false, false, false],
      lockedIn: true,
    }
    try {
      localStorage.setItem('dad-strength-mind-state', JSON.stringify(state))
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('daily_checkins').upsert(
          { user_id: user.id, date: today, mind_state: state, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' },
        )
      }
      setObjectives(draft)
      setCompleted([false, false, false])
      setLocked(true)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      const today = localDay()

      // Try localStorage first for instant load
      const cached = localStorage.getItem('dad-strength-mind-state')
      if (cached) {
        const data = JSON.parse(cached)
        if (data.date === localDay()) {
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
    // refreshKey is bumped when MorningProtocol saves objectives from the
    // same page. Its Goals step writes mind_state, and a same-tab
    // localStorage write notifies no sibling — without this the card keeps
    // saying "no objectives set" next to the ones just entered.
  }, [refreshKey])

  const toggle = async (i: number) => {
    if (!locked) return
    const newCompleted = [...completed]
    newCompleted[i] = !newCompleted[i]
    setCompleted(newCompleted)

    // Persist
    const today = localDay()
    const cached = localStorage.getItem('dad-strength-mind-state')
    const data = cached ? JSON.parse(cached) : {}
    const updated = { ...data, completedObjectives: newCompleted, date: localDay() }
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
    return <div className="tile h-32 animate-pulse" />
  }

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Target size={14} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm font-display tracking-[0.06em]">daily objectives</h3>
        </div>
        {hasObjectives && (
          <span className="eyebrow-mono text-muted-foreground">
            {doneCount} of {filledObjectives.length} done
          </span>
        )}
      </div>

      {!hasObjectives ? (
        /* Set them here rather than sending the user somewhere. The old CTA
           pointed at /mind, then at the protocol's Goals step — but that step
           only exists once an AI protocol has been generated, so anyone with no
           protocol yet, or out of free AI quota, or who already passed that
           step, hit a dead end on a feature that needs no AI at all. */
        <div className="space-y-2 relative z-10">
          <p className="text-xs text-muted-foreground">Three things that would make today a win.</p>
          {draft.map((v, i) => (
            <input
              key={i}
              type="text"
              value={v}
              onChange={e => {
                const next = [...draft]
                next[i] = e.target.value
                setDraft(next)
              }}
              placeholder={`Objective ${i + 1}`}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground/50"
            />
          ))}
          <button
            onClick={saveDraft}
            disabled={saving || !draft.some(o => o.trim())}
            className="w-full pill-volt text-xs font-bold py-2.5 disabled:opacity-40 transition-opacity"
          >
            {saving ? 'saving…' : 'lock them in'}
          </button>
        </div>
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
            <p className="text-[10px] text-brand lowercase font-black pt-1 text-center">
              Locked in. ⚡
            </p>
          )}
        </div>
      )}
    </div>
  )
}
