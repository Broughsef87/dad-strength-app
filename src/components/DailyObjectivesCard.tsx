'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { ACCOUNT_CHANGED, runAs } from '../lib/checkinQueue'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'

// ── THE RECORD IS THE ROW (FOR-231) ──────────────────────────────────────────
// daily_checkins.mind_state, in the calendar day's row, is the record of the
// day's objectives — the same rule MorningProtocol states for spirit_state, one
// authority for the whole row. localStorage['dad-strength-mind-state'] is a
// paint layer: rendered at once, replaced by whatever the row says, and never
// the basis of a save.
const MIND_KEY = 'dad-strength-mind-state'

export default function DailyObjectivesCard(
  { refreshKey = 0 }: { refreshKey?: number } = {},
) {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  // 'unsaved': a change made here has not reached the row. 'unreached': the row
  // could not be read, so the card shows only what this device last saw.
  const [sync, setSync] = useState<'synced' | 'unsaved' | 'unreached'>('synced')
  const supabase = createClient()
  // Every read and write of the row goes through the ONE check-in queue it
  // shares with MorningProtocol (src/lib/checkinQueue.ts, Codex r2), bound to
  // the account that made the change.
  // Bumped by every change made here; a row read that started before one is
  // older than it, and is not applied over it.
  const localEdits = useRef(0)
  // Which load is the newest. Only it may paint what it read: two refreshes in
  // flight, and the older answering last would put back obsolete objectives.
  const loadSeq = useRef(0)

  // The row is the day the change was MADE — carried on the state, captured
  // when the change was accepted. Read inside the queue it could be evaluated
  // after midnight, and file yesterday's objectives into today's row (Codex r1).
  const writeRecord = async (state: { date: string } & Record<string, unknown>): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSync('unsaved'); return false }
    const res = await runAs(supabase, user.id, async () => supabase.from('daily_checkins').upsert(
      { user_id: user.id, date: state.date, mind_state: state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    )).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : String(e) } }))
    setSync(res.error ? 'unsaved' : 'synced')
    return !res.error
  }

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
    localEdits.current++
    try {
      try { localStorage.setItem(MIND_KEY, JSON.stringify(state)) } catch { /* paint only */ }
      setObjectives(dense)
      setCompleted(dense.map(() => false))
      setLocked(true)
      await writeRecord(state)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const mine = ++loadSeq.current
    const load = async () => {
      const today = localDay()
      // PAINT from this device's copy, for the first frame…
      try {
        const cached = localStorage.getItem(MIND_KEY)
        if (cached) {
          const data = JSON.parse(cached)
          if (data.date === today) {
            const n = normalise(data.objectives, data.completedObjectives)
            setObjectives(n.objectives)
            setCompleted(n.completed)
            setLocked(data.lockedIn || false)
            setLoading(false)
          }
        }
      } catch { /* no paint — the row will answer */ }

      // …then the RECORD, ALWAYS. This returned early whenever the paint had
      // today, so an objective ticked on another device never showed here and
      // the paint was the authority (FOR-231). What the row says replaces the
      // paint — including that there is nothing today.
      const editsAtOpen = localEdits.current
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      // The read goes through the SAME queue as the writes (Codex r1). A read
      // asked for while a write is pending then runs after it lands and reads
      // it back, instead of reverting it on screen; and reads run one at a
      // time, in order.
      const read = await runAs(supabase, user.id, async () => supabase
        .from('daily_checkins')
        .select('mind_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle())
      if (cancelled || mine !== loadSeq.current) return
      if (read === ACCOUNT_CHANGED || read.error) { setSync('unreached'); setLoading(false); return }
      const data = 'data' in read ? read.data : null
      // A change made here while the read was in flight is newer than it.
      if (localEdits.current !== editsAtOpen) { setLoading(false); return }
      const ms = data?.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean } | null | undefined
      const n = normalise(ms?.objectives, ms?.completedObjectives)
      setObjectives(n.objectives)
      setCompleted(n.completed)
      setLocked(ms?.lockedIn || false)
      try {
        if (ms) localStorage.setItem(MIND_KEY, JSON.stringify({ ...ms, date: today }))
        else localStorage.removeItem(MIND_KEY)
      } catch { /* paint only */ }
      setSync('synced')
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // refreshKey is bumped when MorningProtocol's record changes on the same
    // page — its Goals step writes mind_state, and the signal fires once the
    // row has it, so this re-read reads the new objectives.
  }, [refreshKey])

  const toggle = async (i: number) => {
    if (!locked) return
    // The objective set this tick was made against, the day it was made on,
    // and the state the athlete chose for this one objective.
    const basis = objectives
    const day = localDay()
    const done = !completed[i]
    setCompleted((c) => c.map((v, j) => (j === i ? done : v)))
    localEdits.current++
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSync('unsaved'); return }

    // A tick is a read-modify-write of the RECORD, inside the one queue — never
    // of the paint, which wrote a row with no objectives at all whenever it was
    // empty or another day's, and never of this card's copy alone. Every write
    // asked for before this one has landed by the time it reads, so if the
    // Goals step has replaced the objectives meanwhile, this tick was made
    // against a set that no longer exists: it is dropped, and the card shows
    // the record (Codex r2). Otherwise only THIS objective's flag changes;
    // every other flag stays what the row says.
    type Mind = { date: string; objectives: string[]; completedObjectives: boolean[]; lockedIn: boolean }
    type Tick = { kind: 'failed' } | { kind: 'stale'; now: { objectives: string[]; completed: boolean[] }; lockedIn: boolean } | { kind: 'saved'; updated: Mind }
    const res = await runAs(supabase, user.id, async (): Promise<Tick> => {
      const { data, error } = await supabase.from('daily_checkins').select('mind_state').eq('user_id', user.id).eq('date', day).maybeSingle()
      if (error) return { kind: 'failed' }
      const ms = data?.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean } | null | undefined
      const now = normalise(ms?.objectives, ms?.completedObjectives)
      if (JSON.stringify(now.objectives) !== JSON.stringify(basis)) return { kind: 'stale', now, lockedIn: !!ms?.lockedIn }
      const updated: Mind = { date: day, objectives: now.objectives, completedObjectives: now.completed.map((v, j) => (j === i ? done : v)), lockedIn: !!ms?.lockedIn }
      const w = await supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: day, mind_state: updated, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      )
      return w.error ? { kind: 'failed' } : { kind: 'saved', updated }
    }).catch((): Tick => ({ kind: 'failed' }))
    // No tag: the account that made the tick is no longer signed in (ACCOUNT_CHANGED).
    if (!('kind' in res) || res.kind === 'failed') { setSync('unsaved'); return }
    if (res.kind === 'stale') {
      setObjectives(res.now.objectives)
      setCompleted(res.now.completed)
      setLocked(res.lockedIn)
      setSync('synced')
      return
    }
    setCompleted(res.updated.completedObjectives)
    try { localStorage.setItem(MIND_KEY, JSON.stringify(res.updated)) } catch { /* paint only */ }
    setSync('synced')
  }

  const syncNote = sync === 'unsaved'
    ? 'not saved yet — this device has your changes, your record doesn\u2019t. they save with your next change'
    : sync === 'unreached' ? 'couldn\u2019t reach your record — showing what this device last saw' : null

  const doneCount = completed.filter(Boolean).length
  const filledObjectives = objectives.filter(o => o.trim())
  const hasObjectives = locked && filledObjectives.length > 0

  if (loading) {
    return <div className="tile h-32" />
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

      {syncNote && <p className="text-[11px] text-muted-foreground mb-2 relative z-10" role="status">{syncNote}</p>}

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
    </div>
  )
}
