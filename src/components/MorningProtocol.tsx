'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Sun, BookOpen, Flame, Heart, Star, Moon, CloudDrizzle, Skull, Zap, Coffee, Wind, Target, ArrowRight } from 'lucide-react'
import AmbientAudioPlayer from './AmbientAudioPlayer'
import RecommendedReading from './RecommendedReading'
import { createClient } from '../utils/supabase/client'
import { localDay, localDayWithCutoff } from '../utils/day'
import { isUpgradeRequired } from '../lib/upgradeRequired'
import UpgradeModal from './UpgradeModal'
import { ACCOUNT_CHANGED, accountAtChange, runAs } from '../lib/checkinQueue'
import { accountIs, book, changedBy, currentRun, flushObjectives, intend, wasDropped, type Change } from '../lib/objectivesOutbox'
import { setUnloadGuard } from '../lib/unloadGuard'
import { sameJson } from '../lib/canonical'

const TIME_OPTIONS = [5, 10, 20, 30]

const SLEEP_QUALITY = [
  { id: 'great',  label: 'Slept great',      Icon: Star },
  { id: 'ok',     label: 'Decent night',     Icon: Moon },
  { id: 'rough',  label: 'Rough night',      Icon: CloudDrizzle },
  { id: 'brutal', label: 'Up all night',     Icon: Skull },
]

const ENERGY_LEVELS = [
  { id: 'high',   label: 'Ready to go',      Icon: Zap },
  { id: 'medium', label: 'Getting there',    Icon: Coffee },
  { id: 'low',    label: 'Running on fumes', Icon: Wind },
]

const PILLAR_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'Prayer':          Flame,
  'Meditation':      Sun,
  'Reading':         BookOpen,
  'Gratitude':       Heart,
  'Goals':           Target,
  'Goals & Journal': Target, // legacy — protocols cached before journaling was removed
}

const PILLAR_COLORS: Record<string, string> = {
  'Prayer':          'text-brand bg-brand/10 border-brand/20',
  'Meditation':      'text-foreground bg-muted border-border',
  'Reading':         'text-foreground bg-muted border-border',
  'Gratitude':       'text-category-core bg-category-core/10 border-category-core/20',
  'Goals':           'text-muted-foreground bg-muted border-border',
  'Goals & Journal': 'text-muted-foreground bg-muted border-border', // legacy
}

type Step = {
  pillar: string
  minutes: number
  title: string
  guidance: string
  prompt: string
}

type Protocol = {
  theme: string
  greeting: string
  steps: Step[]
  closingWord: string
}

// A change made here: the protocol state, the protocol day it belongs to, the
// account that made it — fixed AT the change — and where it falls in the order
// they were made.
type Latest = {
  p: Protocol
  c: boolean[]
  g: string[]
  day: string
  by: Promise<string | null>
  n: number
  /** What the RECORD held for that day when this change was made — as this
   * screen knew it: the row it read, the row it last wrote, or the paint it
   * opened on. The change belongs on top of that and nothing else, which is
   * the same rule the objectives keep (basis). It is what makes a rebuild of
   * an existing protocol recoverable — the row still holds the protocol it
   * replaced — and what stops a protocol replaced elsewhere being put back
   * (Codex r18, r19). */
  was: Protocol | null
  /** Which run of this tab it was made in — the outbox's own count, so the
   * protocol and the objectives mean the same thing by it. A change nobody
   * could name an account for belongs to the run it was made in and to no
   * other: after a sign-out, it is not the next account's to save, whatever
   * their row happens to hold (Codex r20, P1). */
  run: number
}

// Kept per TAB, not per mount (Codex r5). Moving to another tab in the app
// unmounts this component, and a change that has not reached the row must not
// go with it: the next open reads the row and saves it if the record vouches
// for it. Touched only by a click or an effect — never while rendering, so a
// server render cannot make one visitor's change another's.
//
// Which means it outlives a SIGN-OUT too: everything kept here carries the
// account that made it, and nothing made by one account is ever saved under
// another (Codex r6, P1). `writing` is here for the same reason — a write
// started before this mount is still a write this screen is waiting for.
const kept: {
  latest: Latest | null
  unsent: Map<string, Latest>
} = { latest: null, unsent: new Map() }
let stamp = 0
let writing = 0
// The newest change queued for a day. Gratitude saves on every keystroke, and
// each write carries the WHOLE protocol — so a queued write the day has moved
// past writes nothing, instead of spending its turn in the shared queue on a
// row state two keystrokes old and holding up everything behind it (Codex r18).
const queuedFor = new Map<string, number>()
// Snapshots queued and not yet answered. A change made while one of them is in
// flight is made on top of it, so when it lands that is what the change is
// measured against — and it is not kept yet, so looking only at what is kept
// misses exactly the change that is still on its way (Codex r20, r21).
const sending = new Set<Latest>()
// Opens, counted per TAB. What an open reads and recovers is this tab's, not
// one component's: a screen left while it was reading would otherwise go on
// settling and writing behind the screen that replaced it, which then showed
// one protocol while another was being saved (Codex r25). A newer open, and
// leaving the screen, both end the one before.
let opens = 0
/** The row holds `p` for `day` now: everything made after `after` was made on top of it. */
const movedOn = (day: string, p: Protocol, after: number) => {
  const held = kept.unsent.get(day)
  for (const s of held ? [...sending, held] : [...sending]) if (s.day === day && s.n > after) s.was = p
}
/**
 * Where this device stands against the record, as everything kept says — and
 * the closing-the-tab warning with it: what is kept lives in the tab, not in
 * this component, so the warning must not go when the component does (Codex r7).
 */
const statusNow = (): 'synced' | 'saving' | 'unsaved' => {
  const s = writing ? 'saving' : kept.unsent.size ? 'unsaved' : 'synced'
  setUnloadGuard('protocol', s !== 'synced')
  return s
}
/**
 * `u` has reached its day's row, or has been decided against: it and anything
 * older for THAT DAY stop being kept. Only for that day — a change made on
 * another day is another row, and no write of this one can carry it (Codex r12).
 */
const settled = (u: Latest) => {
  const held = kept.unsent.get(u.day)
  if (held && held.n <= u.n) kept.unsent.delete(u.day)
}
/** A change its day's row does not have. Kept until it does, or until it is decided against. */
const keep = (u: Latest) => {
  const held = kept.unsent.get(u.day)
  if (!held || held.n <= u.n) kept.unsent.set(u.day, u)
}

// ── THE RECORD IS THE ROW (FOR-231) ──────────────────────────────────────────
// daily_checkins is the record of the morning protocol (spirit_state.morning,
// in the row keyed on the protocol's own 4am-cutoff day) and of the day's
// objectives (mind_state, in the calendar day's row). localStorage is a PAINT
// layer and nothing more: written so the next open renders instantly, read only
// until the row answers, replaced by whatever the row says — including "nothing
// today" — and never read by anything that decides, counts or saves. A change
// made here is a render until the row has it, and the screen says so.
const STORAGE_KEY = 'dad-strength-morning-protocol'
// The morning routine's "day" runs 4am → 3:59am, so a late-night or pre-dawn
// check-in doesn't wipe a routine completed that morning.
const todayKey = () => localDayWithCutoff(4)

export default function MorningProtocol(
  { objectives = [], onSaved }:
  {
    objectives?: string[]
    /**
     * The RECORD changed — the row now holds a protocol or objectives change
     * made here. Fired once the write has landed, never when it starts, so a
     * reader that re-reads the row on it reads the change (FOR-231).
     */
    onSaved?: () => void
  } = {},
) {
  const [minutes, setMinutes] = useState(20)
  const [sleep, setSleep] = useState('ok')
  const [energy, setEnergy] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [completed, setCompleted] = useState<boolean[]>([])
  const [expanded, setExpanded] = useState<number | null>(0)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState(false)
  // Completed protocols collapse to a "systems green" stamp; review re-expands.
  const [reviewOpen, setReviewOpen] = useState(false)
  // Gratitude entries: 3 text inputs
  const [gratitude, setGratitude] = useState(['', '', ''])

  // Goals — synced to Mind tab storage
  const [mindObjectives, setMindObjectives] = useState(['', '', ''])
  const [mindSaved, setMindSaved] = useState(false)
  const [mindError, setMindError] = useState('')

  // Where this device stands against the record. 'saving': a change made here
  // is on its way to the row. 'unsaved': one has not reached it (it retries on
  // the next change, or on Retry).
  // 'unreached': the row could not be read, so what is on screen is only what
  // this device last saw.
  const [sync, setSync] = useState<'synced' | 'saving' | 'unsaved' | 'unreached'>('synced')
  // Every write of the row goes through the ONE check-in queue shared with the
  // objectives card (src/lib/checkinQueue.ts, Codex r2): gratitude saves on
  // every keystroke, and an earlier keystroke landing last would leave the
  // record holding it. Each write is bound to the account that made it — the
  // queue outlives this component, and a write queued before a sign-out must
  // not run under whoever signs in next.
  //
  // ownerRef is that account, and it is set only once the open-time read has
  // ANSWERED: it names an account and says that account's row was read. Until
  // then what is on screen is a paint nobody has checked — it may be another
  // account's — and a write of it would file it under whoever is signed in. A
  // change made before then is kept as `unsent`; the read, when it answers,
  // saves it if the record vouches for it (Codex r3).
  const ownerRef = useRef<string | null>(null)
  // Bumped by every change made here. The row read on open is applied only if
  // nothing has been changed since — a change made after the read started is
  // newer than what the read will return.
  const localEdits = useRef(0)
  // kept.latest: the latest protocol state made here, and the protocol day it
  // belongs to — for Retry, which must retry THAT day's record, not today's
  // (Codex r2). kept.unsent: a change the row does not have, one per day.
  //
  // What this screen believes today's row holds: read on open, written by a
  // save that landed, or painted from what this device last saw. Every change
  // made here is made ON TOP of it, and carries it (Codex r19).
  const recordP = useRef<{ day: string; p: Protocol | null } | null>(null)
  // The account a change is made by, fixed AT the change: the account this
  // screen was confirmed for, or — before that — whoever is signed in now.
  // Never written to ownerRef: that says an account's ROW answered, which is
  // what makes it safe to write what is on screen.
  // The one implementation of "who is making this change" (checkinQueue); the
  // object it is handed is a copy, so a change-time lookup never becomes the
  // confirmed account.
  const madeBy = (): Promise<string | null> => accountAtChange(createClient(), { current: ownerRef.current })
  // The open-time read is running. A change made meanwhile is saving — the
  // read saves it when it answers — not unsaved.
  const opening = useRef(false)

  const showStatus = () => setSync(statusNow())

  const saveMindState = async () => {
    // Dense, for the same reason the objectives card stores dense: the render
    // path filters blanks and toggles by the FILTERED index, so a sparse array
    // misaligns completion flags against objectives.
    const dense = mindObjectives.map(o => o.trim()).filter(Boolean)
    // The day's objectives have ONE outbox, shared with the objectives card
    // (Codex r7). Written here directly, a save that failed was remembered by
    // nothing: the objectives lived in the paint until the card replaced it
    // with the row, and there was nothing to retry. As a change in the outbox
    // it is kept until the row has it, whatever this screen does next.
    book().turn(localDay())
    const owner = changedBy(ownerRef.current)
    const mine: Change = { kind: 'set', day: book().day(), basis: book().shown().objectives, objectives: dense, owner }
    intend(mine)
    setMindError('')
    // The record. "Saved" means the row has it — nothing earlier.
    const res = await flushObjectives(owner)
    // Overtaken: the objectives these replaced are gone — set here on another
    // device, or on the card — so these were not saved and never will be.
    // "Saved" is the one answer that cannot be true (Codex r8).
    if (wasDropped(mine)) { setMindError('today\u2019s objectives were set somewhere else first — they\u2019re on the card below; set these again if you still want them'); return }
    if (!res.ok) { setMindError('not saved yet — it saves with your next change, or on the objectives card'); return }
    setMindSaved(true)
    // Objectives are written HERE, not in save() — a separate path, so it
    // needs the signal separately. DailyObjectivesCard renders directly below
    // this component and reads mind_state; without this it keeps showing "no
    // objectives set" beside the Saved confirmation until a reload.
    onSaved?.()
  }

  useEffect(() => {
    // PAINT from this device's copy, so the protocol is on screen at once…
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.date === todayKey() && data.protocol) {
          // The paint IS what the row said, when this device last saw it.
          recordP.current = { day: todayKey(), p: data.protocol }
          setProtocol(data.protocol)
          setCompleted(data.completed || new Array(data.protocol.steps.length).fill(false))
          setGratitude(data.gratitude || ['', '', ''])
          setConfigured(true)
        }
      }
    } catch { /* no paint — the row will answer */ }

    // …then the RECORD answers.
    void open()
    // Leaving the screen ends it: what it has not decided yet is left kept,
    // for the next open to decide (Codex r25).
    return () => { opens++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One row of spirit_state, read through the queue. A read that cannot be
  // made is not an empty record — it is no answer at all, and throws.
  const readSpirit = async (supabase: ReturnType<typeof createClient>, me: string, day: string) => {
    const read = await runAs(supabase, me, async (who) => supabase
      .from('daily_checkins')
      .select('spirit_state')
      .eq('user_id', who)
      .eq('date', day)
      .maybeSingle())
    if (read === ACCOUNT_CHANGED || read.error) throw new Error('unreached')
    return 'data' in read ? read.data : null
  }
  const morningIn = (row: { spirit_state?: unknown } | null) =>
    (row?.spirit_state as { morning?: { date?: string; protocol?: Protocol; completed?: boolean[]; gratitude?: string[] } } | null)?.morning
  // The protocol that row holds FOR that day — an entry stamped with another
  // day is not that day's, whatever row it sits in.
  const protocolOn = (row: { spirit_state?: unknown } | null, day: string) => {
    const n = morningIn(row)
    return n?.protocol && n.date === day ? n.protocol : null
  }

  // The open-time read: who is signed in, and what their row holds. What it
  // says replaces the paint entirely — more done, less done, a different
  // protocol, or none at all. Nothing is compared. Run on open, and again by
  // Retry while it has never answered — so a failed open is recovered, not a
  // screen that refuses every change until a reload (Codex r3).
  const open = async () => {
    const editsAtOpen = localEdits.current
    // This open, until another starts or this screen goes.
    const mine = ++opens
    const live = () => mine === opens
    opening.current = true
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (kept.unsent.size) setSync('unsaved'); return }
      // The row keyed on the protocol's OWN day — where every protocol write
      // has landed since the row-key fix (FOR-228, ruling 2).
      const row = await readSpirit(supabase, user.id, todayKey())
      const m = morningIn(row)
      if (!live()) return
      const held = protocolOn(row, todayKey())
      // What the row holds is what every change made from here is made against
      // — set before any recovery, because recovery can return without ever
      // reaching the apply below, and a change made meanwhile would carry the
      // paint as its basis and be thrown away on the next open (Codex r22).
      recordP.current = { day: todayKey(), p: held }
      const applyRecord = () => {
        if (held) {
          const c = m?.completed ?? new Array(held.steps.length).fill(false)
          const g = m?.gratitude ?? ['', '', '']
          setProtocol(held)
          setCompleted(c)
          setGratitude(g)
          setConfigured(true)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), protocol: held, completed: c, gratitude: g })) } catch { /* paint only */ }
        } else {
          // The record holds no protocol for today. Whatever this device had
          // painted — another account's, or one that never reached the row —
          // is not a protocol, and goes.
          setProtocol(null)
          setCompleted([])
          setGratitude(['', '', ''])
          setConfigured(false)
          try { localStorage.removeItem(STORAGE_KEY) } catch { /* paint only */ }
        }
      }
      // Today's record goes on the screen NOW, before anything is awaited:
      // writes are enabled from here, and a tick made while an older day's row
      // is being read must be made on the record, not on a cache the row has
      // already replaced (Codex r24). Unless something changed here since the
      // read started — that is newer than the read, and it keeps the screen.
      if (localEdits.current === editsAtOpen) applyRecord()
      // Only now are writes this screen's to make: what is on it is the
      // record, or a change newer than the read (Codex r24).
      ownerRef.current = user.id
      accountIs(user.id)
      // A change made before the account was confirmed is saved only if the
      // record vouches for it: the row holds the protocol it was made on, or
      // that protocol was generated here. Otherwise it was made on a paint that
      // is not this account's record, and the record replaces it. Compared as
      // JSON values, not strings: jsonb reorders keys, so the row's copy of a
      // protocol generated here never matches the paint's by string.
      // The kept change belongs to the day it was MADE on: after 4am that is
      // no longer today's row, and today's row cannot vouch for it (Codex r5).
      // Until it is decided it stays kept, so a read that fails here retries.
      let ownEdits = 0
      let rejected = false
      let recovered: Latest | null = null
      let keepScreen = false
      // Recovering the kept days reads their rows, and one of those reads can
      // fail on its own. That is that day's answer, not today's: it stays kept
      // and today's record — already read, right here — still goes on the
      // screen (Codex r17).
      for (const u of [...kept.unsent.values()]) {
        if (!live()) return
        // One day's row failing to answer is THAT day's answer: it stays
        // kept, and the days after it are still recovered (Codex r17, r31).
        try {
          // Whose change it is decides first. Kept state outlives a sign-out,
          // and a change account A made is never saved under account B — it
          // would put A's protocol, and A's gratitude, in B's record (Codex r6,
          // P1). One nobody could name an account for belongs to the run of
          // this tab it was made in: after a sign-out it is not the next
          // account's, and an empty row of theirs is no kind of ownership
          // (Codex r20, P1).
          const by = await u.by
          let vouched = false
          if (by !== null ? by !== user.id : u.run !== currentRun()) {
            if (kept.latest && kept.latest.n <= u.n) kept.latest = null
          } else {
            // The row still holds what the change was made against: then the
            // change belongs on top of it, whether it ticks that protocol,
            // rebuilds it, or is the first one of the day. If the row holds
            // something else, the record moved on — here or on another device
            // — and the change is not this one's to land (Codex r18, r19).
            const its = u.day === todayKey() ? held : protocolOn(await readSpirit(supabase, user.id, u.day), u.day)
            // …or the row already holds this change's OWN protocol: its write
            // reached the row and the answer was lost on the way back, and the
            // ticks and gratitude made after it are still this screen's to save
            // (Codex r29).
            vouched = sameJson(its, u.was) || sameJson(its, u.p)
          }
          // The awaits above take time — the account, sometimes another day's
          // row — and this open may have been ended while they ran. Nothing of
          // this tab's is its to settle or send any more (Codex r26).
          if (!live()) return
          settled(u)
          // Not vouched: the change is gone, and what it put on the screen goes
          // with it. It must not keep the record off the screen as if it were
          // still a change waiting to be saved (Codex r23).
          if (!vouched && u.day === todayKey()) rejected = true
          // Deciding that took an await, or two. The account was confirmed before
          // them, so a change made to THE SAME DAY meanwhile has been written on
          // its own — and this older snapshot must not land on top of it, nor the
          // record be applied over it (Codex r10, r12).
          if (kept.latest !== null && kept.latest.day === u.day && kept.latest.n > u.n) {
            if (u.day === todayKey()) keepScreen = true
            continue
          }
          if (vouched) {
            // The vouch IS the account: this account's row holds the protocol the
            // change was made on, or this screen generated it for this account.
            // A change made while nobody could say who was signed in would
            // otherwise be refused by the queue for ever (Codex r17).
            ownEdits++
            saveCache(u.p, u.c, u.g, u.day, { ...u, by: Promise.resolve(user.id) })
            // A change for TODAY is what the screen shows, and the row does not
            // have it yet — the record must not be applied over it. A change
            // for an earlier day is not what the screen shows: today's record
            // still applies, or the screen would sit on the config step with a
            // protocol already in the row (Codex r6).
            if (u.day === todayKey()) recovered = u
          }
        } catch { /* that day's row did not answer; it stays kept */ }
      }
      if (!live()) return
      // The screen changed while the read was in flight — a change made here,
      // or a Rebuild — and that is newer than the read, which does not put it
      // back. Our own recovery writes are not that: they are this read's doing.
      // Counting only whether anything was KEPT missed an edit made to today
      // while an older day's row was being read (Codex r22). It holds for what
      // was RECOVERED too: recovering today's change and then reading an older
      // day's row leaves time for another tick, and painting the recovered
      // snapshot over it would put that tick back on the next save (Codex r32).
      const newerOnScreen = keepScreen || (!rejected && localEdits.current !== editsAtOpen + ownEdits)
      if (recovered && !newerOnScreen) {
        // On screen, not left to the paint: localStorage may be unavailable,
        // or its last write may have failed, and then nothing would show what
        // was just recovered (Codex r7).
        setProtocol(recovered.p)
        setCompleted(recovered.c)
        setGratitude(recovered.g)
        setConfigured(true)
        return
      }
      if (recovered || newerOnScreen) { showStatus(); return }
      applyRecord()
      showStatus()
    } catch {
      setSync(kept.unsent.size ? 'unsaved' : 'unreached')
    } finally {
      opening.current = false
    }
  }

  // `again`: a snapshot being sent a second time — a Retry, or the open-time
  // read recovering one it vouched for. It keeps everything that was fixed when
  // it was MADE: the account that made it, whether this screen generated its
  // protocol, and what it was made against. Re-stamping those from what is
  // true now put one account's protocol and gratitude under another, and took
  // an older day's protocol its only way home (Codex r16, r19).
  const saveCache = (p: Protocol, c: boolean[], g: string[], day: string = todayKey(), again?: Latest) => {
    localEdits.current++
    // The change this one is made on top of, if this day's row does not have
    // it yet — kept, or still on its way there. Its basis can itself be null
    // — the row held nothing — and that is not the same as there being no
    // change to stack on (Codex r24). A rebuild still saving when the screen
    // was left is in `sending` and nowhere else, and taking the paint instead
    // of its basis threw it away on the next open (Codex r27).
    const onTop = [...sending, ...(kept.unsent.get(day) ? [kept.unsent.get(day) as Latest] : [])]
      .filter((u) => u.day === day)
      .reduce<Latest | null>((newest, u) => (newest === null || u.n > newest.n ? u : newest), null)
    // `day`: the protocol day the change was MADE on, captured now — or, for a
    // Retry, the day of the change being retried. Evaluated inside the queued
    // write it could fall after 4am and file this protocol into the next day's
    // row (Codex r1, r2).
    kept.latest = {
      p, c, g, day, n: ++stamp,
      by: again ? again.by : madeBy(),
      run: again ? again.run : currentRun(),
      // On top of a change this day's row does not have yet: then the row
      // still holds what THAT was made against, and this one is made against
      // the same thing. Taking the paint here threw away a rebuild whose save
      // failed, the moment anything was typed after a remount (Codex r23).
      // …and what the record holds is only ever what it holds for THAT DAY:
      // across 4am the screen's last read describes yesterday's row, and
      // yesterday's protocol is no basis for a change made today (Codex r31).
      was: again ? again.was : (onTop ? onTop.was : (recordP.current?.day === day ? recordP.current.p : null)),
    }
    // The account that made the change, captured now. Before the open-time
    // read has answered there is no owner to bind to, and the change is kept
    // as unsent — never a write under an account nobody checked. The read
    // saves it when it answers; Retry runs the read again if it failed.
    const owner = ownerRef.current
    // Paint, for the next open's first frame.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: day, protocol: p, completed: c, gratitude: g })) } catch { /* paint only */ }
    const mine = kept.latest
    if (!owner) {
      keep(mine)
      const s = statusNow()
      setSync(opening.current ? 'saving' : s)
      return
    }
    // Saving from the moment the change is made, not from its turn in the
    // queue (Codex r4).
    queuedFor.set(day, mine.n)
    sending.add(mine)
    // Whether this change is today's, decided NOW like its day: read after the
    // write it could fall the other side of 4am (Codex r1).
    const isToday = day === todayKey()
    writing++
    showStatus()
    // The record. Upsert names only its own column, so mind_state is untouched.
    void (async () => {
      const supabase = createClient()
      // Written under the account that MADE it, never under whoever is signed
      // in when it is sent: having been checked under one account is no
      // authorization under the next (Codex r16, P1). runAs hands the job the
      // account it verified, and that is what the row is filed under.
      const res = await runAs(supabase, mine.by, async (me): Promise<{ error: { message: string } | null; stale?: true }> => {
        // The row is keyed on the protocol's OWN day — the same 4am-cutoff
        // key the entry carries — not the calendar day. Keyed on the calendar
        // day, a protocol finished at 1am landed in the next day's row, and
        // generating that day's protocol after 4am overwrote it: a completed
        // protocol gone (FOR-228, ruling 2).
        const w = await supabase.from('daily_checkins').upsert(
          {
            user_id: me,
            date: day,
            spirit_state: { morning: { date: day, protocol: p, completed: c, gratitude: g } },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' },
        )
        return { error: w.error }
      }, () => (queuedFor.get(day) ?? 0) > mine.n).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : String(e) } }))
      // Every write carries the whole protocol, so the LAST one answered says
      // whether the row holds the latest change; until then it is saving.
      writing--
      sending.delete(mine)
      // Nothing was written and nothing is wrong: the newer change for this day
      // is still to come, and it will settle this one with itself (Codex r18).
      if ('stale' in res && res.stale) { showStatus(); return }
      // A write that failed leaves the change kept, for the next open or Retry
      // to save — it is not in the row, and nothing else remembers it (Codex
      // r5). A write that landed settles ITS OWN change and every older one,
      // never a newer change made meanwhile — on this mount or the next
      // (Codex r6).
      if (res.error) { keep(mine); showStatus(); return }
      settled(mine)
      // Anything still kept for this day was made on top of what this write
      // has just put in the row — a gratitude line typed while the protocol it
      // belongs to was still saving. That is what it is made against now, and
      // comparing it with what the row held BEFORE would throw it away on the
      // next open (Codex r20).
      movedOn(day, p, mine.n)
      // The row holds it now, so that is what the next change is made against.
      if (isToday) recordP.current = { day, p }
      showStatus()
      // The row has it now. Only now are the readers told (FOR-231): the
      // daily number, the checklist and the objectives card re-read the row
      // on this, and a signal sent before the write landed sent them to read
      // the old one.
      onSaved?.()
    })()
  }
  // Retry IS the open-time read. It reads each kept day's row and saves the
  // change only if that row still holds what the change was made against —
  // every change the row does not have, each to its own day (Codex r13), and
  // none of them over a protocol another device has put there since (Codex
  // r15, r26). Writing a snapshot straight out because some earlier screen had
  // read the row is not the same thing: the row moves.
  const retrySave = () => { void open() }

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      const res = await fetch('/api/ai/morning-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          sleepQuality: SLEEP_QUALITY.find(s => s.id === sleep)?.label,
          energy: ENERGY_LEVELS.find(e => e.id === energy)?.label,
          objectives,
          dayOfWeek,
        }),
      })
      const data = await res.json()
      // Paywall check must precede the generic error throw — a free user who
      // has used their daily protocol isn't "broken", they've hit a tier cap.
      if (isUpgradeRequired(res, data)) {
        setShowUpgrade(true)
        return
      }
      if (data.error) throw new Error(data.error)
      const fresh = data.protocol as Protocol
      const freshCompleted = new Array(fresh.steps.length).fill(false)
      const freshGratitude = ['', '', '']
      setProtocol(fresh)
      setCompleted(freshCompleted)
      setGratitude(freshGratitude)
      setExpanded(0)
      setConfigured(true)
      saveCache(fresh, freshCompleted, freshGratitude)
    } catch {
      setError('Failed to generate. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleStep = (i: number) => {
    const next = [...completed]
    next[i] = !next[i]
    setCompleted(next)
    if (protocol) saveCache(protocol, next, gratitude)
    if (next[i] && i < (protocol?.steps.length || 0) - 1) {
      setExpanded(i + 1)
    }
  }

  const updateGratitude = (i: number, val: string) => {
    const next = [...gratitude]
    next[i] = val
    setGratitude(next)
    if (protocol) saveCache(protocol, completed, next)
  }

  const doneCount = completed.filter(Boolean).length
  const totalSteps = protocol?.steps.length || 0
  const allDone = doneCount === totalSteps && totalSteps > 0

  // Where this device stands, on whichever screen is up. A change kept from an
  // earlier day leaves the config screen showing — today's row has no protocol
  // — and with the notice only on the active one, its Retry was unreachable
  // without generating another protocol (Codex r14). 'saving' shows in the
  // header instead: a line appearing here on every keystroke would move the
  // gratitude field being typed in.
  const syncNotice = (sync === 'unsaved' || sync === 'unreached') && (
    <p className="text-[11px] text-muted-foreground" role="status">
      {sync === 'unsaved'
        ? <>not saved yet — this device has your changes, your record doesn&apos;t. <button onClick={retrySave} className="underline">retry</button></>
        : <>{'couldn\u2019t reach your record — showing what this device last saw. '}<button onClick={retrySave} className="underline">retry</button></>}
    </p>
  )

  // ── Config screen ──────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="space-y-5">
        {syncNotice}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun size={14} className="text-brand" />
            <span className="text-[10px] lowercase text-brand font-medium">Morning Protocol</span>
          </div>
          <p className="text-xs text-muted-foreground font-light">Build your morning. Own your day.</p>
        </div>

        {/* Time */}
        <div>
          <label className="text-[10px] text-muted-foreground lowercase font-medium block mb-2.5">How much time?</label>
          <div className="flex gap-2">
            {TIME_OPTIONS.map(t => (
              <button key={t} onClick={() => setMinutes(t)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
 minutes === t
 ? 'bg-foreground text-background'
 : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
 }`}
              >{t}m</button>
            ))}
          </div>
        </div>

        {/* Sleep quality */}
        <div>
          <label className="text-[10px] text-muted-foreground lowercase font-medium block mb-2.5">How&apos;d you sleep?</label>
          <div className="space-y-2">
            {SLEEP_QUALITY.map(s => (
              <button key={s.id} onClick={() => setSleep(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all border ${
 sleep === s.id
 ? 'bg-brand/5 border-brand/30 text-foreground'
 : 'bg-muted border-transparent text-muted-foreground hover:border-border'
 }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
 sleep === s.id ? 'bg-brand/15 border border-brand/40' : 'bg-background/40 border border-border'
 }`}>
                  <s.Icon size={14} className={sleep === s.id ? 'text-brand' : 'text-muted-foreground'} />
                </span>
                <span className="text-sm font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="text-[10px] text-muted-foreground lowercase font-medium block mb-2.5">Your energy right now?</label>
          <div className="space-y-2">
            {ENERGY_LEVELS.map(e => (
              <button key={e.id} onClick={() => setEnergy(e.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all border ${
 energy === e.id
 ? 'bg-brand/5 border-brand/30 text-foreground'
 : 'bg-muted border-transparent text-muted-foreground hover:border-border'
 }`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
 energy === e.id ? 'bg-brand/15 border border-brand/40' : 'bg-background/40 border border-border'
 }`}>
                  <e.Icon size={14} className={energy === e.id ? 'text-brand' : 'text-muted-foreground'} />
                </span>
                <span className="text-sm font-semibold">{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-status-danger-ink text-xs">{error}</p>
            <button onClick={() => generate()} className="text-brand hover:underline text-xs">Try Again</button>
          </div>
        )}

        <button
          onClick={() => generate()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-foreground disabled:bg-surface-2 disabled:text-muted-foreground text-background font-medium py-4 rounded-lg text-sm lowercase transition-all"
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Building...</>
            : <><Sun size={16} /> Build My Morning</>
          }
        </button>

        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          trigger="Unlimited AI Morning Protocol"
        />
      </div>
    )
  }

  // ── Active protocol ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Sun size={13} className="text-brand" />
            <span className="text-[10px] lowercase text-brand font-medium">Morning Protocol</span>
          </div>
          <h3 className="font-light text-lg tracking-tight leading-tight">{protocol?.theme}</h3>
        </div>
        <div className="flex items-center gap-2">
        {sync === 'saving' && <span className="eyebrow-mono text-muted-foreground" role="status">saving</span>}
        <button
          onClick={() => { localEdits.current++; setConfigured(false); setProtocol(null); setCompleted([]); setGratitude(['', '', '']) }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          title="Rebuild"
        >
          <RefreshCw size={13} />
        </button>
        </div>
      </div>

      {syncNotice}

      {allDone && !reviewOpen ? (
        /* ── Collapsed — every check done. Volt marks what's earned. ── */
        <div className="py-5 flex flex-col items-center gap-4">
          <span className="chip-live text-base px-5 py-2.5">morning done</span>
          <div className="text-center space-y-1.5">
            <p className="eyebrow-mono">every check in · the day is yours</p>
            {protocol?.closingWord && (
              <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs mx-auto">{protocol.closingWord}</p>
            )}
          </div>
          <button
            onClick={() => setReviewOpen(true)}
            className="eyebrow-mono hover:text-foreground transition-colors flex items-center gap-1"
          >
            REVIEW PROTOCOL <ChevronDown size={11} />
          </button>
        </div>
      ) : (
      <>
      {/* Greeting */}
      <p className="text-sm text-muted-foreground font-light leading-relaxed">{protocol?.greeting}</p>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground lowercase font-medium">Progress</span>
          <span className="text-[10px] text-brand font-medium">{doneCount}/{totalSteps}</span>
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: totalSteps ? `${(doneCount / totalSteps) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {protocol?.steps.map((step, i) => {
          const Icon = PILLAR_ICONS[step.pillar] || Sun
          const colors = PILLAR_COLORS[step.pillar] || PILLAR_COLORS['Prayer']
          const isExpanded = expanded === i
          const isDone = completed[i]
          const isGratitude = step.pillar === 'Gratitude'

          return (
            <div
              key={i}
              className={`rounded-xl border overflow-hidden transition-all ${isDone ? 'border-border opacity-60' : 'border-border'}`}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : i)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/50 transition-colors"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStep(i) }}
                  className="flex-shrink-0 transition-all"
                >
                  {isDone
                    ? <CheckCircle2 size={18} className="text-brand" />
                    : <Circle size={18} className="text-border hover:text-muted-foreground" />
                  }
                </button>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${colors}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground lowercase mt-0.5">
                    {step.pillar} · {step.minutes}m
                  </p>
                </div>
                {isExpanded
                  ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" />
                  : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                }
              </button>

              {isExpanded && !isDone && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{step.guidance}</p>

                  {step.pillar === 'Meditation' && <AmbientAudioPlayer />}
                  {step.pillar === 'Reading' && <RecommendedReading />}

                  {/* Gratitude — 3 text inputs */}
                  {isGratitude ? (
                    <div className="space-y-2">
                      <p className="text-[10px] lowercase text-muted-foreground font-medium">3 things you&apos;re grateful for</p>
                      {[0, 1, 2].map(j => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-medium w-4">{j + 1}.</span>
                          <input
                            type="text"
                            value={gratitude[j]}
                            onChange={e => updateGratitude(j, e.target.value)}
                            placeholder={
                              j === 0 ? 'My family...' :
                              j === 1 ? 'My health...' :
                              'This moment...'
                            }
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-status-good-fill/50 transition-colors"
                          />
                        </div>
                      ))}
                    </div>

                  ) : step.pillar === 'Goals' || step.pillar === 'Goals & Journal' ? (
                    /* Goals — inline objectives that sync to the Mind tab */
                    <div className="space-y-4">
                      {/* Daily Objectives */}
                      <div className="space-y-2">
                        <p className="text-[10px] lowercase text-muted-foreground font-medium">Today&apos;s objectives</p>
                        {[0, 1, 2].map(j => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">0{j + 1}</span>
                            <input
                              type="text"
                              value={mindObjectives[j]}
                              onChange={e => {
                                const next = [...mindObjectives]
                                next[j] = e.target.value
                                setMindObjectives(next)
                                setMindSaved(false)
                              }}
                              placeholder={
                                j === 0 ? 'Primary objective for today...' :
                                j === 1 ? 'Secondary focus...' :
                                'One more thing...'
                              }
                              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border transition-colors"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Save button */}
                      {!mindSaved ? (
                        <button
                          onClick={saveMindState}
                          disabled={!mindObjectives.some(o => o.trim())}
                          className="w-full flex items-center justify-center gap-2 bg-muted border border-border hover:bg-muted text-muted-foreground font-medium py-2.5 rounded-lg text-xs lowercase transition-all disabled:bg-surface-2 disabled:border-transparent disabled:cursor-not-allowed disabled:cursor-not-allowed"
                        >
                          <Target size={12} /> Save to Mind Tab
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <CheckCircle2 size={13} />
                          Saved
                        </div>
                      )}
                      {mindError && <p className="text-[11px] text-muted-foreground" role="status">{mindError}</p>}
                    </div>

                  ) : (
                    <div className={`rounded-lg px-4 py-3 border ${colors}`}>
                      <p className="text-[10px] lowercase font-medium mb-1 opacity-70">Focus Prompt</p>
                      <p className="text-sm font-light italic">{step.prompt}</p>
                    </div>
                  )}

                  <button
                    onClick={() => toggleStep(i)}
                    className="w-full bg-muted hover:bg-foreground hover:text-background text-foreground font-medium py-2.5 rounded-lg text-xs lowercase transition-all"
                  >
                    Mark Complete ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allDone && (
        <button
          onClick={() => setReviewOpen(false)}
          className="w-full py-2.5 border border-status-good-fill/50 text-status-good-ink text-xs font-semibold lowercase hover:bg-status-good-fill/10 transition-colors"
        >
          Collapse — Systems Green
        </button>
      )}
      </>
      )}

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        trigger="Unlimited AI Morning Protocol"
      />
    </div>
  )
}
