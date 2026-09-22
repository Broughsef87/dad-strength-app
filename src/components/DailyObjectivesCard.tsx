'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { runAs } from '../lib/checkinQueue'
import { adoptRead, book, changedBy, flushObjectives, intend, onObjectives, paintedMind, savingObjectives, wasDropped, type Change } from '../lib/objectivesOutbox'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { localDay } from '../utils/day'

// ── THE RECORD IS THE ROW (FOR-231) ──────────────────────────────────────────
// daily_checkins.mind_state, in the calendar day's row, is the record of the
// day's objectives — the same rule MorningProtocol states for spirit_state, one
// authority for the whole row. localStorage is a paint layer: rendered at once,
// replaced by whatever the row says, and never the basis of a save. A change
// made here is an intent against the record, kept until the row has it, in the
// outbox this card shares with the protocol's Goals step — one writer of the
// day's objectives, not two (src/lib/objectivesOutbox.ts, Codex r3, r7).

export default function DailyObjectivesCard(
  { refreshKey = 0 }: { refreshKey?: number } = {},
) {
  const [objectives, setObjectives] = useState<string[]>(['', '', ''])
  const [completed, setCompleted] = useState<boolean[]>([false, false, false])
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string[]>(['', '', ''])
  // A change of this device's the record overtook: the objectives it was made
  // against are gone, so it was not saved and never will be (Codex r8).
  const [overtaken, setOvertaken] = useState(false)
  // 'saving': a change made here is on its way to the row. 'unsaved': one did
  // not get there. 'unreached': the row could not be read, so the card shows
  // only what this device last saw.
  const [sync, setSync] = useState<'synced' | 'saving' | 'unsaved' | 'unreached'>('synced')
  const supabase = createClient()
  // The account this card was opened for. Every read and write of the row goes
  // through the ONE check-in queue it shares with MorningProtocol
  // (src/lib/checkinQueue.ts, Codex r2), bound to the account that made it.
  const ownerRef = useRef<string | null>(null)
  // A read that failed says so only when there is nothing more urgent: a
  // change of this device's that the row does not have outranks it, because
  // that is the one with the Retry and the warning on it (Codex r5). And
  // nothing is "saved" while a save is still on its way (Codex r4).
  const settleSync = (failed: boolean, unreached = false) =>
    setSync(savingObjectives() ? 'saving' : failed || book().pending().length ? 'unsaved' : unreached ? 'unreached' : 'synced')

  const show = () => {
    const s = book().shown()
    setObjectives(s.objectives)
    setCompleted(s.completed)
    setLocked(s.lockedIn)
  }

  // Saving from the moment the change is made — not from when its turn in the
  // queue comes, behind whatever else is writing (Codex r4). `mine` is the
  // change just made, if any: it is the one whose answer this screen owes.
  const save = (owner: Promise<string | null>, mine?: Change) => {
    setSync('saving')
    void flushObjectives(owner).then((res) => {
      show()
      settleSync(!res.ok)
      if (mine && wasDropped(mine)) setOvertaken(true)
    })
  }
  const retry = () => save(changedBy(ownerRef.current))

  // Writes the same shape MorningProtocol's Goals step writes, through the same
  // outbox, so the two are interchangeable and whichever the user reaches first
  // works.
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
    book().turn(localDay())
    const owner = changedBy(ownerRef.current)
    const mine: Change = { kind: 'set', day: book().day(), basis: book().shown().objectives, objectives: dense, owner }
    setOvertaken(false)
    intend(mine)
    show()
    save(owner, mine)
  }

  // What this card shows is what the outbox holds — the Goals step changes the
  // same objectives on the same screen, and a tick applied to a copy taken when
  // this card last rendered would land on a different objective (Codex r8).
  // Contents AND status: a change made on the Goals step is this card's to
  // show — and if its save failed, this is where the Retry is (Codex r9).
  const syncRef = useRef(sync)
  syncRef.current = sync
  useEffect(() => onObjectives(() => { show(); settleSync(false, syncRef.current === 'unreached') }), [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const today = localDay()
      // PAINT from this device's copy, for the first frame…
      const painted = paintedMind(today)
      if (painted) {
        book().paint(today, painted)
        show()
        setLoading(false)
      }

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
        return { error: r.error, ms: r.data?.mind_state ?? null, seq: book().nextRead() }
      })
      if (cancelled) return
      if (!('seq' in read) || read.error) { settleSync(false, true); setLoading(false); return }
      // The row replaces the paint; changes made here that it does not have yet
      // stay on top of it.
      adoptRead(today, read.ms, read.seq, true)
      show()
      settleSync(false)
      setLoading(false)
      // A change kept from an earlier visit to this tab — the card was unmounted
      // before it reached the row, or the Goals step's save failed — is saved
      // now (Codex r5, r7).
      if (book().pending().length) save(changedBy(ownerRef.current))
    }
    load()
    return () => { cancelled = true }
    // refreshKey is bumped when MorningProtocol's record changes on the same
    // page — its Goals step changes the day's objectives, and the signal fires
    // once the row has them, so this re-read reads them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // A tick is an intent: this objective, done or not, against the objective set
  // on screen. Worked out from what the card SHOWS — record plus every pending
  // change — so a tick made while another is saving builds on it, not on an
  // older answer (Codex r3).
  const toggle = (i: number) => {
    const now = book().shown()
    if (!now.lockedIn) return
    const owner = changedBy(ownerRef.current)
    const mine: Change = { kind: 'tick', day: book().day(), basis: now.objectives, index: i, done: !now.completed[i], owner }
    setOvertaken(false)
    intend(mine)
    show()
    save(owner, mine)
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
      {overtaken && (
        <p className="text-[11px] text-muted-foreground mb-2 relative z-10" role="status">
          {'today\u2019s objectives were set somewhere else first — these are the ones your record has'}
        </p>
      )}
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
