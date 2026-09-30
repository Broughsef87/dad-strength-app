'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'

// THE RECORD IS THE ROW (FOR-231 v2).
// daily_checkins.mind_state holds the day's objectives. Nothing is kept in
// localStorage, so the card never has a second copy to reconcile against the
// row. A save is a write to the row: it lands, or it fails and says so.
export default function DailyObjectivesCard(
  { refreshKey = 0 }: { refreshKey?: number } = {},
) {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  // A write that did not land. Retry re-sends what is on the screen now.
  const [unsaved, setUnsaved] = useState<null | (() => void)>(null)
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
  /** Write the row. It lands, or the screen says it did not. */
  const write = async (state: Record<string, unknown>, day: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const res = await supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: day, mind_state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      )
      return !res.error
    } catch { return false }
  }

  // Writes the same shape MorningProtocol's Goals step writes, to the same
  // daily_checkins column, so the two are interchangeable and whichever the
  // user reaches first works.
  const saveDraft = async () => {
    if (saving || !draft.some(o => o.trim())) return
    setSaving(true)
    setUnsaved(null)
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
      if (!await write(state, today)) {
        // Nothing local remembers this, so the screen has to. Retry writes the
        // same objectives against the row as it is then.
        setUnsaved(() => () => { void saveDraft() })
        return
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
      // The row, and nothing before it. There is no cache to paint from.
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
    const before = completed
    const newCompleted = [...completed]
    newCompleted[i] = !newCompleted[i]
    setCompleted(newCompleted)
    setUnsaved(null)

    // The state written is built from what is on the screen, never read back
    // out of a cache: the objectives shown ARE the objectives the row holds,
    // because the row is the only thing this card has ever rendered from.
    const today = localDay()
    const updated = {
      date: today,
      objectives,
      completedObjectives: newCompleted,
      lockedIn: locked,
    }
    if (!await write(updated, today)) {
      // The tick did not reach the record, so it does not stand on screen
      // either. Back to what the row holds, and say so.
      setCompleted(before)
      setUnsaved(() => () => { void toggle(i) })
    }
  }

  const doneCount = completed.filter(Boolean).length
  const filledObjectives = objectives.filter(o => o.trim())
  const hasObjectives = locked && filledObjectives.length > 0

  if (loading) {
    return <div className="tile h-32" />
  }

  const unsavedBanner = unsaved ? (
    <div className="mt-3 rounded-kit border border-status-danger-line bg-status-danger-bg p-3 flex items-center justify-between gap-3">
      <p className="text-status-danger-ink text-xs">Not saved - the record did not take it. It is lost unless you retry.</p>
      <button type="button" onClick={() => unsaved()} className="btn-ghost text-xs shrink-0">Retry</button>
    </div>
  ) : null

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
            className="w-full pill-volt text-xs font-bold py-2.5 disabled:saturate-[.15] transition-opacity"
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

      {unsavedBanner}
    </div>
  )
}
