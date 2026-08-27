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

  // Rows written before objectives were stored dense can still be sparse, and
  // the render path pairs objective i with completed i. Compact them TOGETHER
  // so each flag keeps the objective it belongs to; compacting the strings
  // alone is what silently shifts a completion onto the wrong line.
  const normalise = (
    objs: string[] | undefined,
    done: boolean[] | undefined,
  ): { objectives: string[]; completed: boolean[] } => {
    const pairs: Array<[string, boolean]> = (objs ?? [])
      .map((o, i): [string, boolean] => [String(o ?? ''), Boolean((done ?? [])[i])])
      .filter(([o]) => o.trim().length > 0)
    return { objectives: pairs.map(p => p[0]), completed: pairs.map(p => p[1]) }
  }
  // Writes the same shape MorningProtocol's Goals step writes, to the same
  // localStorage key and the same daily_checkins column, so the two are
  // interchangeable and whichever the user reaches first works.
  const saveDraft = async () => {
    if (saving || !draft.some(o => o.trim())) return
    setSaving(true)
    const today = localDay()
    // Store DENSE. The render path filters blanks and hands toggle() the
    // filtered index, which then writes completedObjectives at that index — so
    // a sparse save ('', 'B', 'C') puts B's completion flag on slot 0 while B
    // lives at slot 1. Compacting here keeps stored order and rendered order
    // identical, which is the only thing making those indices interchangeable.
    const dense = draft.map(o => o.trim()).filter(Boolean)
    const state = {
      date: today,
      objectives: dense,
      completedObjectives: dense.map(() => false),
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
      setObjectives(dense)
      setCompleted(dense.map(() => false))
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
          const n = normalise(data.objectives, data.completedObjectives)
          setObjectives(n.objectives)
          setCompleted(n.completed)
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
        const n = normalise(ms.objectives, ms.completedObjectives)
        setObjectives(n.objectives)
        setCompleted(n.completed)
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
          <div className="p-1.5">
            <Target size={14} className="text-foreground" />
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
            <div key={i} className="ledger-row">
              <span className="ledger-no">{String(i + 1).padStart(2, '0')}</span>
              <input
                type="text"
                value={v}
                onChange={e => {
                  const next = [...draft]
                  next[i] = e.target.value
                  setDraft(next)
                }}
                placeholder="—"
                className="flex-1 min-w-0 bg-transparent border-none outline-none ink-written placeholder:text-[hsl(var(--border))] focus:bg-[hsl(var(--brand)/0.06)] focus:ring-1 focus:ring-[hsl(var(--foreground))] rounded-[2px]"
              />
            </div>
          ))}
          <button
            onClick={saveDraft}
            disabled={saving || !draft.some(o => o.trim())}
            className="w-full pill bg-foreground text-[hsl(var(--brand-ink))] text-xs font-bold uppercase tracking-[0.1em] py-2.5 disabled:opacity-40 transition-opacity"
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
              className="w-full ledger-row text-left group"
            >
              <span className="ledger-no">{String(i + 1).padStart(2, '0')}</span>
              <span className="form-box">
                {completed[i] && <span className="form-tick">✓</span>}
              </span>
              <span className={`flex-1 ink-written leading-snug transition-all ${completed[i] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {obj}
              </span>
            </motion.button>
          ))}

          {doneCount === filledObjectives.length && filledObjectives.length > 0 && (
            <p className="eyebrow-mono pt-1 text-center">
              Locked in. ⚡
            </p>
          )}
        </div>
      )}
    </div>
  )
}
