'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'
import { patchCheckin, usePaintGate } from '../lib/checkins'
import { carryOver, lastNightDay, type CarryOver } from '../lib/evening'

// THE RECORD IS THE ROW (FOR-231 v2).
// daily_checkins.mind_state holds the day's objectives. Nothing is kept in
// localStorage, so the card never has a second copy to reconcile against the
// row. A save is a write to the row: it lands, or it fails and says so.
//
// AND THIS CARD IS THE ONLY WRITER OF OBJECTIVES (Andrew's ruling, 2026-10-11).
// The morning protocol's Goals step used to write them too, so the card
// re-read the row whenever the protocol saved. That re-read painted a tick
// back off the screen when it raced one, and left a failed draft's Retry able
// to replace objectives saved from the other writer (Codex v3 r1). With one
// writer the row is read ONCE, when the card mounts, and nothing re-reads it.
export default function DailyObjectivesCard() {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  /**
   * THE DAY OF THE LIST ON THE SCREEN, and the row a tick goes to.
   *
   * Not `localDay()` recomputed at tick time. A list loaded before midnight
   * and ticked after it was ticked into the NEXT day's row, which had no
   * `lockedIn`, so a reload showed a blank editor where the tick had been
   * (Codex v3 r1). Set by the read from the day it read, and by a saved draft
   * from the day it saved under. The same rule as the protocol's `entryDay`.
   */
  const [listDay, setListDay] = useState<string | null>(null)
  /**
   * THE ROW COULD NOT BE READ, which is not "no objectives today". A failed
   * read used to show the empty editor, and objectives saved from there
   * replaced the list the row was holding (Codex v3 r2). A failed read says it
   * failed and offers to read again; the editor stays out of reach until a read
   * has answered.
   */
  const [readFailed, setReadFailed] = useState(false)
  // Bumped by that Retry, and by nothing else: it is the only re-read.
  const [readNonce, setReadNonce] = useState(0)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  // What last night's evening review hands this morning (FOR-332): a one
  // thing that slipped is offered again as objective 1. READ ONLY — nothing here
  // writes until the athlete locks the list in, so a carried objective is an
  // offer, never a decision.
  const [carry, setCarry] = useState<CarryOver | null>(null)
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
    if (saving) return
    // AN EMPTY DRAFT HAS NOTHING TO SAVE, and so nothing that failed to: a
    // draft that failed and was then cleared left its banner up with a Retry
    // that returned here, silently, every time (Codex v3 r5).
    if (!draft.some(o => o.trim())) { setUnsaved((u) => u.filter((t) => t !== 'draft')); return }
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
      if (await patchCheckin('mind_state', today, [
        { path: ['date'], value: today },
        { path: ['objectives'], value: dense },
        { path: ['completedObjectives'], value: dense.map(() => false) },
        { path: ['lockedIn'], value: true },
      ]) !== 'landed') {
        // Nothing local remembers this, so the screen has to. Retry re-runs
        // this function, which reads `draft` at that moment — so an edit made
        // after the failure is what gets written.
        setUnsaved((u) => (u.includes('draft') ? u : [...u, 'draft']))
        return
      }
      setObjectives(dense)
      setCompleted(dense.map(() => false))
      setLocked(true)
      setListDay(today)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      const today = localDay()
      const claim = gate.claim()
      try {
        // The row, and nothing before it. There is no cache to paint from.
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!user) { if (authError && gate.mayPaint(claim)) setReadFailed(true); return }

        // maybeSingle, not single: single() reports "no row" AS an error, and
        // then a day with no objectives could not be told from a failed read.
        const { data, error } = await supabase
          .from('daily_checkins')
          .select('mind_state')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
        if (error) { if (gate.mayPaint(claim)) setReadFailed(true); return }

        // Only the newest read paints. With one read per mount this matters
        // in development, where StrictMode runs the effect twice and the
        // first read is discarded.
        if (data?.mind_state && gate.mayPaint(claim)) {
          const ms = data.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean }
          const n = normalise(ms.objectives, ms.completedObjectives)
          setObjectives(n.objectives)
          setCompleted(n.completed)
          setLocked(ms.lockedIn || false)
          setListDay(today)
        }

        // Last night, after today's row has painted, and never able to fail
        // the card: a missing or unreadable review carries nothing over.
        const night = lastNightDay()
        if (night) {
          const { data: prev } = await supabase
            .from('daily_checkins')
            .select('mind_state')
            .eq('user_id', user.id)
            .eq('date', night)
            .maybeSingle()
          const c = carryOver(prev?.mind_state ?? null, night)
          if (c && gate.mayPaint(claim)) {
            setCarry(c)
            if (c.oneThing) setDraft((d) => (d[0].trim() ? d : [c.oneThing as string, d[1], d[2]]))
          }
        }
      } catch { if (gate.mayPaint(claim)) setReadFailed(true) }
      finally {
        // THE SKELETON COMES DOWN ONLY FOR THE NEWEST READ (FOR-231 v3). A
        // read discarded by a newer one used to take it down and show the
        // EMPTY editor while the newer read was still out, and a save made
        // there replaced the list that read was about to paint (Codex r4).
        //
        // It cannot stay up forever: while the skeleton is showing nothing
        // else is rendered, so nothing can write, so whatever claimed after
        // this read is itself a read, and that read reaches this `finally`
        // too, error or not.
        if (gate.mayPaint(claim)) setLoading(false)
      }
    }
    load()
    // Once, on mount, and again only when the athlete presses Retry on a read
    // that FAILED. Nothing else writes objectives, so there is nothing else to
    // re-read them for.
  }, [readNonce])

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
    if (!locked || saving || !listDay) return
    const next = [...completed]
    next[i] = !next[i]
    setUnsaved((u) => u.filter((t) => t !== 'tick'))
    setSaving(true)
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
    const landed = await patchCheckin('mind_state', listDay, [
      { path: ['objectives'], value: objectives },
      { path: ['completedObjectives'], value: next },
    ]) === 'landed'
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

  // The read failed. The editor below would say there are no objectives, and
  // that is not known.
  if (readFailed) {
    return (
      <div id="daily-objectives" className="rounded-kit border border-status-danger-line bg-status-danger-bg p-3 flex items-center justify-between gap-3 scroll-mt-24">
        <p className="text-status-danger-ink text-xs">Could not load today&apos;s objectives. Nothing has been changed.</p>
        <button
          type="button"
          onClick={() => { setReadFailed(false); setLoading(true); setReadNonce((n) => n + 1) }}
          className="btn-ghost text-xs shrink-0"
        >
          Retry
        </button>
      </div>
    )
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

  // The apology and anything held back show on the On Awakening card; here
  // only the carried objective, while the editor is open.
  const fromLastNight = carry?.oneThing && !hasObjectives ? (
    <p className="mb-3 relative z-10 text-xs text-muted-foreground">
      Carried from last night: your one thing slipped, so it&apos;s in objective 1. Change it if today needs something else.
    </p>
  ) : null

  return (
    <div id="daily-objectives" className="tile p-5 relative overflow-hidden scroll-mt-24">
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

      {fromLastNight}

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
              // READ-ONLY WHILE THE SAVE IS IN FLIGHT (FOR-231 v3, Codex r3).
              // The save sends the draft as it stood when it started, and a
              // landed save locks the list and takes these inputs away. An
              // edit typed in between was neither sent nor kept. What can be
              // typed is what gets written - the protocol's gratitude rule.
              readOnly={saving}
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
