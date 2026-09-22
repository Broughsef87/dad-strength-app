'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { accountAtChange, runAs } from '../lib/checkinQueue'
import { fromRow, objectivesBook, toRow, type Intent, type MindRow } from '../lib/objectivesRecord'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'

// ── THE RECORD IS THE ROW (FOR-231) ──────────────────────────────────────────
// daily_checkins.mind_state, in the calendar day's row, is the record of the
// day's objectives — the same rule MorningProtocol states for spirit_state, one
// authority for the whole row. localStorage['dad-strength-mind-state'] is a
// paint layer: rendered at once, replaced by whatever the row says, and never
// the basis of a save. A change made here is an intent against the record,
// kept until the row has it (src/lib/objectivesRecord.ts, Codex r3).
const MIND_KEY = 'dad-strength-mind-state'

// A change, and the account it was made by — fixed at the change.
type Change = Intent & { owner: Promise<string | null> }

export default function DailyObjectivesCard(
  { refreshKey = 0 }: { refreshKey?: number } = {},
) {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  // 'saving': a change made here is on its way to the row. 'unsaved': one did
  // not get there. 'unreached': the row could not be read, so the card shows
  // only what this device last saw.
  const [sync, setSync] = useState<'synced' | 'saving' | 'unsaved' | 'unreached'>('synced')
  const supabase = createClient()
  // The record as this card last read it, in queue order, and every change made
  // here that the row does not have yet. What the card shows is always the one
  // with the other on top.
  const [book] = useState(() => objectivesBook<Change>(localDay()))
  // The account this card was opened for. Every read and write of the row goes
  // through the ONE check-in queue it shares with MorningProtocol
  // (src/lib/checkinQueue.ts, Codex r2), bound to the account that made it.
  const ownerRef = useRef<string | null>(null)
  // Saves queued and not yet answered. Each carries every pending change, so
  // while one is still to run the card is saving — not saved, not failed.
  const inFlight = useRef(0)
  const settleSync = (failed: boolean) =>
    setSync(inFlight.current ? 'saving' : failed || book.pending().length ? 'unsaved' : 'synced')

  const show = () => {
    const s = book.shown()
    setObjectives(s.objectives)
    setCompleted(s.completed)
    setLocked(s.lockedIn)
  }
  const paintCache = (day: string, ms: unknown) => {
    try {
      if (ms) localStorage.setItem(MIND_KEY, JSON.stringify(toRow(day, fromRow(ms))))
      else localStorage.removeItem(MIND_KEY)
    } catch { /* paint only */ }
  }

  // Every change the row does not have yet — the one just made AND any that
  // failed before it — written as one read-modify-write of the record per day,
  // inside the one queue. So a failed change is saved by the next one, or by
  // Retry, and the card never says it is saved while any change is not
  // (Codex r3). Each change goes to the day it was made on, carried on it.
  const flush = (owner: Promise<string | null>) => {
    // Saving from the moment the change is made — not from when its turn in
    // the queue comes, behind whatever else is writing (Codex r4).
    inFlight.current++
    setSync('saving')
    void (async () => {
      type Landed = { day: string; ms: MindRow | null; seq: number }
      const res = await runAs(supabase, owner, async (me) => {
        // A change made under another account is not this one's to save. One
        // made while no account was known is saved by the account that saves
        // it — and only onto a record holding the objectives it was made on.
        for (const c of book.pending()) { const who = await c.owner; if (who && who !== me) book.settle([c]) }
        const landed: Landed[] = []
        for (const day of book.days()) {
          const { data, error } = await supabase.from('daily_checkins').select('mind_state').eq('user_id', me).eq('date', day).maybeSingle()
          if (error) return { ok: false, landed }
          const seq = book.nextRead()
          const { write, settles } = book.plan(day, data?.mind_state ?? null)
          let ms = (data?.mind_state ?? null) as MindRow | null
          if (write) {
            const row = toRow(day, write)
            const w = await supabase.from('daily_checkins').upsert(
              { user_id: me, date: day, mind_state: row, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,date' },
            )
            if (w.error) return { ok: false, landed }
            ms = row
          }
          book.settle(settles)
          landed.push({ day, ms, seq })
        }
        return { ok: true, landed }
      }).catch(() => ({ ok: false, landed: [] as Landed[] }))
      inFlight.current--
      // No `ok`: the account that made the change is not the one signed in.
      if (!('ok' in res)) { settleSync(true); return }
      for (const l of res.landed) if (book.adopt(l.day, l.ms, l.seq)) paintCache(l.day, l.ms)
      show()
      settleSync(!res.ok)
    })()
  }
  const retry = () => flush(accountAtChange(supabase, ownerRef))

  // Writes the same shape MorningProtocol's Goals step writes, to the same
  // daily_checkins column, so the two are interchangeable and whichever the
  // user reaches first works.
  const saveDraft = () => {
    if (!draft.some(o => o.trim())) return
    // Store DENSE. The render path filters blanks and hands toggle() the
    // filtered index, which then writes completedObjectives at that index — so
    // a sparse save ('', 'B', 'C') puts B's completion flag on slot 0 while B
    // lives at slot 1. Compacting here keeps stored order and rendered order
    // identical, which is the only thing making those indices interchangeable.
    const dense = draft.map(o => o.trim()).filter(Boolean)
    // Objectives are locked in for the day they are typed on. A card left open
    // across midnight still shows yesterday: it turns to today first, and the
    // lock-in is made against today's record (Codex r4).
    book.turn(localDay())
    const owner = accountAtChange(supabase, ownerRef)
    book.intend({ kind: 'set', day: book.day(), basis: book.shown().objectives, objectives: dense, owner })
    show()
    flush(owner)
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const today = localDay()
      // PAINT from this device's copy, for the first frame…
      try {
        const cached = localStorage.getItem(MIND_KEY)
        if (cached) {
          const data = JSON.parse(cached)
          if (data.date === today) {
            book.paint(today, data)
            show()
            setLoading(false)
          }
        }
      } catch { /* no paint — the row will answer */ }

      // …then the RECORD, ALWAYS. This returned early whenever the paint had
      // today, so an objective ticked on another device never showed here and
      // the paint was the authority (FOR-231). What the row says replaces the
      // paint — including that there is nothing today.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      ownerRef.current = user.id
      // The read goes through the SAME queue as the writes (Codex r1), and takes
      // its place in queue order there: a read landing after a later one is
      // older than it, and does not become the record.
      const read = await runAs(supabase, user.id, async (me) => {
        const r = await supabase.from('daily_checkins').select('mind_state').eq('user_id', me).eq('date', today).maybeSingle()
        return { error: r.error, ms: r.data?.mind_state ?? null, seq: book.nextRead() }
      })
      if (cancelled) return
      if (!('seq' in read) || read.error) { setSync('unreached'); setLoading(false); return }
      // The row replaces the paint; changes made here that it does not have yet
      // stay on top of it.
      if (book.adopt(today, read.ms, read.seq, true)) paintCache(today, read.ms)
      show()
      settleSync(false)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // refreshKey is bumped when MorningProtocol's record changes on the same
    // page — its Goals step writes mind_state, and the signal fires once the
    // row has it, so this re-read reads the new objectives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // A change on its way to the row, or one that did not get there, is lost if
  // the tab closes now — so closing it asks first (Codex r4). Moving elsewhere
  // in the app is safe: the queue outlives this component.
  useEffect(() => {
    if (sync !== 'saving' && sync !== 'unsaved') return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sync])

  // A tick is an intent: this objective, done or not, against the objective set
  // on screen. Worked out from what the card SHOWS — record plus every pending
  // change — so a tick made while another is saving builds on it, not on an
  // older answer (Codex r3).
  const toggle = (i: number) => {
    const now = book.shown()
    if (!now.lockedIn) return
    const owner = accountAtChange(supabase, ownerRef)
    book.intend({ kind: 'tick', day: book.day(), basis: now.objectives, index: i, done: !now.completed[i], owner })
    show()
    flush(owner)
  }

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
            {sync === 'saving' && 'saving · '}{doneCount} of {filledObjectives.length} done
          </span>
        )}
      </div>

      {/* 'saving' shows in the header, beside the count: a line appearing here
          would move the objectives under the next tap. */}
      {(sync === 'unsaved' || sync === 'unreached') && (
        <p className="text-[11px] text-muted-foreground mb-2 relative z-10" role="status">
          {sync === 'unsaved'
            ? <>not saved yet — this device has your changes, your record doesn&apos;t. <button onClick={retry} className="underline">retry</button></>
            : 'couldn\u2019t reach your record — showing what this device last saw'}
        </p>
      )}

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
            disabled={!draft.some(o => o.trim())}
            className="w-full pill-volt text-xs font-bold py-2.5 disabled:saturate-[.15] transition-opacity"
          >
            lock them in
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
