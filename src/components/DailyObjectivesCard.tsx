'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'
import { patchCheckin, usePaintGate } from '../lib/checkins'

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
  // Which writes did not land — tags, never a closure and never a payload.
  // A captured closure holds the draft it was made with, which is a queued
  // intention; the re-spec forbids one and Codex found it writing stale
  // objectives over newer edits (FOR-231 v2, Blaine's ruling 2026-10-01).
  //
  // ONE SLOT PER WRITER (Blaine's ruling, 2026-10-05). This was a single tag,
  // so a successful tick cleared a FAILED draft and took its Retry with it,
  // leaving objectives on screen that the row does not have. Each writer sets
  // and clears only its own.
  const [unsaved, setUnsaved] = useState<readonly ('draft' | 'tick')[]>([])
  const supabase = createClient()
  // Only the newest operation paints. A refresh that started before a tick
  // must not paint the row as it was before it (FOR-231 v2, r3).
  const gate = usePaintGate()

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
  // daily_checkins column, so the two are interchangeable and whichever the
  // user reaches first works.
  const saveDraft = async () => {
    if (saving || !draft.some(o => o.trim())) return
    setSaving(true)
    setUnsaved((u) => u.filter((t) => t !== 'draft'))
    const today = localDay()
    // Store DENSE. The render path filters blanks and hands toggle() the
    // filtered index, which then writes completedObjectives at that index — so
    // a sparse save ('', 'B', 'C') puts B's completion flag on slot 0 while B
    // lives at slot 1. Compacting here keeps stored order and rendered order
    // identical, which is the only thing making those indices interchangeable.
    const dense = draft.map(o => o.trim()).filter(Boolean)
    try {
      // ITS OWN FOUR KEYS, IN ONE CALL. `objectives` and `completedObjectives`
      // are paired by index, so they have to land in the same statement; `date`
      // and `lockedIn` ride along because this is the write that sets the list.
      // Anything else under mind_state is not named here and survives it —
      // which is what the old whole-column write could not promise.
      gate.claim()
      if (!await patchCheckin('mind_state', today, [
        { path: ['date'], value: today },
        { path: ['objectives'], value: dense },
        { path: ['completedObjectives'], value: dense.map(() => false) },
        { path: ['lockedIn'], value: true },
      ])) {
        // Nothing local remembers this, so the screen has to. Retry re-runs
        // this function, which reads `draft` at that moment — so an edit made
        // after the failure is what gets written.
        setUnsaved((u) => (u.includes('draft') ? u : [...u, 'draft']))
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
      const claim = gate.claim()
      // The row, and nothing before it. There is no cache to paint from.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('daily_checkins')
        .select('mind_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()

      // A refresh that started before a write must not paint the row as it was
      // (FOR-231 v2, r3). It is DISCARDED, never queued: the write it lost to
      // already put the newer value on the screen. The skeleton comes down
      // either way, or a discarded first load would leave the card blank.
      if (data?.mind_state && gate.mayPaint(claim)) {
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

  /**
   * THE ROW FIRST. A tick that did not reach the record was never on the
   * screen (Blaine's ruling, 2026-10-01).
   *
   * There is no optimistic paint, so there is nothing to roll back, no
   * snapshot of what the screen held before, and no ordering question between
   * a write that failed and a newer one that did not — `saving` keeps a second
   * tick from starting while the first is in flight, rather than deciding
   * which of two in-flight writes should win.
   */
  const toggle = async (i: number) => {
    if (!locked || saving) return
    const next = [...completed]
    next[i] = !next[i]
    setUnsaved((u) => u.filter((t) => t !== 'tick'))
    setSaving(true)
    const today = localDay()
    // THE PAIR, because the pair is ONE FACT. objectives and
    // completedObjectives are paired by index: the render path filters blanks
    // and hands toggle() the filtered index, and normalise() pairs objective i
    // with flag i. A tick that wrote the flags ALONE could land them on a
    // different list — the Goals step above writes both together, so between
    // this tick being read and landing the list can have changed under it, and
    // the result is a tick on the wrong objective. FOR-243 is the standing
    // evidence for which direction is dangerous: unticked costs one tap, and
    // wrongly ticked is a lie. So both halves go, and the row is self
    // consistent whichever write lands last.
    //
    // `lockedIn` and `date` are the Goals step's and are NOT in this call.
    gate.claim()
    const landed = await patchCheckin('mind_state', today, [
      { path: ['objectives'], value: objectives },
      { path: ['completedObjectives'], value: next },
    ])
    setSaving(false)
    if (!landed) { setUnsaved((u) => (u.includes('tick') ? u : [...u, 'tick'])); return }
    setCompleted(next)
  }

  const doneCount = completed.filter(Boolean).length
  const filledObjectives = objectives.filter(o => o.trim())
  const hasObjectives = locked && filledObjectives.length > 0

  if (loading) {
    return <div className="tile h-32" />
  }

  // A failed draft can be retried: the objectives are still in the inputs, so
  // Retry reads them as they are then. A failed TICK has nothing to retry —
  // the screen never moved, so the objective is still untick­ed and tapping it
  // again is the retry.
  // One row per outstanding failure, in a fixed order, each with its own
  // Retry — a failed draft and a failed tick are different losses.
  const unsavedBanner = unsaved.length > 0 ? (
    <div className="mt-3 space-y-2">
      {(['draft', 'tick'] as const).filter((t) => unsaved.includes(t)).map((tag) => (
        <div key={tag} className="rounded-kit border border-status-danger-line bg-status-danger-bg p-3 flex items-center justify-between gap-3">
          <p className="text-status-danger-ink text-xs">
            {tag === 'draft'
              ? 'Not saved — the record did not take it. It is lost unless you retry.'
              : 'That tick did not save — tap it again.'}
          </p>
          {tag === 'draft' && (
            <button type="button" onClick={() => { void saveDraft() }} className="btn-ghost text-xs shrink-0">Retry</button>
          )}
        </div>
      ))}
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
              disabled={saving}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 text-left group disabled:saturate-[.15]"
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
