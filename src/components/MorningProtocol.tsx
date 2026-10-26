'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Sun, BookOpen, Flame, Heart, Star, Moon, CloudDrizzle, Skull, Zap, Coffee, Wind, Target, ArrowRight } from 'lucide-react'
import AmbientAudioPlayer from './AmbientAudioPlayer'
import RecommendedReading from './RecommendedReading'
import { createClient } from '../utils/supabase/client'
import { localDay, localDayBefore, localDayWithCutoff } from '../utils/day'
import { isUpgradeRequired } from '../lib/upgradeRequired'
import { patchCheckin, readTodaysObjectives, usePaintGate, type CheckinPatch } from '../lib/checkins'

// A tag names the path its writer owns.
type SpiritTag = 'protocol' | 'tick' | 'gratitude'

// What each failed write is called on screen. Record<> rather than a lookup
// with a fallback, so tsc refuses a tag with no label instead of the screen
// rendering `undefined`. 'tick' is here too now that every tag is shown.
const UNSAVED_LABEL: Record<SpiritTag, string> = {
  protocol: 'Not saved',
  gratitude: 'Gratitude not saved',
  tick: 'That step did not save',
}
// The order they are shown in, so two failures do not swap places between
// renders. Deriving it from the state array would order them by when they
// failed, which moves a Retry button under the user's finger.
const UNSAVED_ORDER: readonly SpiritTag[] = ['protocol', 'gratitude', 'tick']
import UpgradeModal from './UpgradeModal'

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

// THE RECORD IS THE ROW (FOR-231 v2).
// daily_checkins is the morning protocol. Nothing about a check-in is kept in
// localStorage: no cache, no mirror, no optimistic layer, so there is never a
// second copy to decide between. A save is a write to the row: it lands, or it
// fails and says so, and Retry writes what is on the screen now.
//
// The morning routine's "day" runs 4am → 3:59am, so a late-night or pre-dawn
// check-in doesn't wipe a routine completed that morning.
const todayKey = () => localDayWithCutoff(4)


export default function MorningProtocol(
  { objectives = [], onSaved }:
  {
    objectives?: string[]
    /**
     * A write of the PROTOCOL landed in the row. Siblings that read
     * either re-read the row here. One signal, because there is only one thing
     * it can mean now: the record changed.
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
  // Reading the record. Nothing is rendered from anywhere else, so until the
  // row answers there is nothing honest to show.
  const [reading, setReading] = useState(true)
  /**
   * THE ROW COULD NOT BE READ. Not the same as "there is nothing in the row",
   * and it must never look the same: a failed read used to fall through to the
   * setup form, which says nothing is built, and a protocol built from there
   * REPLACED the one the row was holding all along (Codex v3 r2). So a failed
   * read shows that it failed, with a Retry that reads again, and no way to
   * build until a read has actually answered.
   */
  const [readFailed, setReadFailed] = useState(false)
  // Bumped by that Retry, and by nothing else: it is the only re-read.
  const [readNonce, setReadNonce] = useState(0)
  // A write that did not land — a tag. Retry re-reads what is on the screen at
  // that moment; nothing here captures a payload.
  /**
   * ONE FAILURE SLOT PER WRITER (Blaine's ruling, 2026-10-05; Codex r3 P1).
   *
   * This was a single tag, and every writer cleared the whole thing. So a
   * successful step tick cleared a FAILED protocol save and took its Retry off
   * the screen with it — leaving a protocol the athlete can see and the row
   * does not have, with nothing saying so, and a reload losing the paid
   * result. A successful tick cleared a failed gratitude save the same way.
   *
   * Each writer now sets and clears only its own tag, which is the same rule
   * as one HALT line per hold: a holder releases what it placed and nothing
   * else. A failure stays on screen until the writer that owns it succeeds.
   *
   * `gratitude` is its own tag for the same reason: a gratitude failure has to
   * be retried as a gratitude write, or the Retry button becomes the
   * whole-entry writer this ticket exists to remove.
   *
   * An array of string literals, so the type still cannot hold a function —
   * a captured closure is a queued intention the re-spec forbids, and tsc is
   * the only guard a regex cannot be.
   */
  const [unsaved, setUnsaved] = useState<readonly SpiritTag[]>([])
  /**
   * A write of spirit_state is in flight. ONE AT A TIME, for every writer here
   * (FOR-231 v3): while it is set, the step buttons, every Retry, Rebuild and
   * Build refuse, and the gratitude inputs are read-only. It refuses - it never
   * queues and never replays - so there are never two writes of this row in
   * flight and nothing has to decide which of two should win.
   *
   * That is what closes both accepted v2 races: an old tick, or an old protocol
   * Retry, cannot land after a Rebuild's new protocol, because Rebuild cannot
   * be pressed until it has landed. And it is what makes a gratitude write
   * unable to land under a protocol write that is about to replace it.
   *
   * State, for the render; a ref, for the handlers, because two taps inside
   * one frame both read the same stale state value.
   */
  const [writing, setWritingState] = useState(false)
  const writingRef = useRef(false)
  const setWriting = (w: boolean) => { writingRef.current = w; setWritingState(w) }
  // Only the newest operation paints. The mount read and a write race on first
  // load: generation can finish before the read does, and the read would then
  // paint the old row over the protocol just generated (FOR-231 v2, r3).
  const gate = usePaintGate()
  /**
   * THE DAY OF THE PROTOCOL ON THE SCREEN, and the row every write goes to.
   *
   * Not `todayKey()` recomputed at write time. A protocol loaded at 3:50 and
   * ticked at 4:10 used to be ticked into the NEXT day's row, because the key
   * moved under the screen at the 4am cutoff (Codex r4). The protocol on the
   * screen belongs to one day, and that is the row its ticks belong in. Set by
   * the loader from the entry it painted, and by generation from the entry it
   * built; cleared by Rebuild. It is the identity of what is painted, not a
   * belief about the row.
   *
   * WHETHER THE ROW HOLDS THE ENTRY IS NOT KNOWN HERE AT ALL. v2's
   * `entryInRow` tried to know it and went stale across the cutoff, and where
   * it held it turned an orphan write into a silent one. The database holds
   * it now: `checkin_patch` refuses a {morning,...} patch onto a row with no
   * entry for its own day (CK001,
   * supabase/migrations/20261009_checkin_patch_requires_entry.sql), and the
   * screen reports that as the protocol not being saved.
   */
  const [entryDay, setEntryDay] = useState<string | null>(null)
  // Completed protocols collapse to a "systems green" stamp; review re-expands.
  const [reviewOpen, setReviewOpen] = useState(false)
  // Gratitude entries: 3 text inputs
  const [gratitude, setGratitude] = useState(['', '', ''])

  /**
   * THE GOALS STEP DOES NOT WRITE OBJECTIVES (Andrew's ruling, 2026-10-11).
   *
   * It used to: three inputs here wrote `mind_state`, and so did the daily
   * objectives card below. Two writers of one list meant the card had to
   * re-read the row every time this component saved, and that re-read is what
   * painted a tick back off the screen and let a stale Retry replace newer
   * objectives (Codex v3 r1). The card is the ONLY writer now. This step
   * points at it.
   */

  /**
   * THE PROTOCOL ON SCREEN IS NOT IN THE ROW, as far as this tab knows: its own
   * save failed, or the database refused a sub-path for want of an entry. That
   * is the 'protocol' failure already on the screen, nothing more — it is this
   * tab's knowledge of its own write, not a read of the row.
   *
   * While it stands, steps and gratitude take no writes (Codex v3 r1): after a
   * Rebuild whose save failed, the row still holds the PREVIOUS protocol, which
   * is a valid entry for the day, so the database accepts a tick made on the
   * new one and files it under the old. Nothing is lost by refusing: the
   * protocol's Retry writes the whole entry off the screen, gratitude included.
   */
  const protocolUnsaved = unsaved.includes('protocol')

  useEffect(() => {
    // The row decides what is on this screen. The 4am-cutoff day can span two
    // calendar rows, so read today and yesterday and take the entry stamped
    // with today's protocol day.
    let cancelled = false
    void (async () => {
      try {
        const claim = gate.claim()
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { if (authError) setReadFailed(true); return }
        const { data: rows, error } = await supabase
          .from('daily_checkins')
          .select('date, spirit_state')
          .eq('user_id', user.id)
          .in('date', [localDay(), localDayBefore()])
        if (cancelled) return
        // supabase-js RETURNS a failed query rather than throwing it, so
        // `rows` is null for "the request failed" exactly as it is for nothing
        // else. Asked for explicitly, or a failure reads as an empty day.
        if (error) { setReadFailed(true); return }
        // A read that started before a write paints nothing. Generation paints
        // first and then saves, so on a slow first load this read can land
        // AFTER it, and it would otherwise put the old row back over the
        // protocol the athlete just paid for. It is discarded, never queued:
        // whatever claimed after it already describes the screen (r3).
        if (cancelled || !gate.mayPaint(claim)) return
        // The record row first: the one keyed on the day its entry carries.
        // A pre-fix row (keyed on the calendar day, holding the cutoff day's
        // entry) is painted only if there is no record row, and a write
        // addressed from it goes to the entry's own day, where the database
        // refuses it until Retry writes the entry there.
        const day = todayKey()
        const ordered = [...(rows ?? [])].sort((a, b) => Number(b.date === day) - Number(a.date === day))
        for (const r of ordered) {
          const m = (r.spirit_state as { morning?: { date?: string; protocol?: Protocol; completed?: boolean[]; gratitude?: string[] } } | null)?.morning
          if (!m?.protocol || m.date !== day) continue
          setProtocol(m.protocol)
          setCompleted(m.completed ?? new Array(m.protocol.steps.length).fill(false))
          setGratitude(m.gratitude ?? ['', '', ''])
          setConfigured(true)
          setEntryDay(m.date)
          break
        }
      } catch { if (!cancelled) setReadFailed(true) }
      finally { if (!cancelled) setReading(false) }
    })()
    return () => { cancelled = true }
  }, [readNonce])

  /**
   * The whole morning entry, as generation and Rebuild write it. `{morning}` is
   * a path, so it replaces what lives under it and nothing beside it - and a
   * new protocol SHOULD reset its own completion and gratitude, which is the
   * one case where replacing a subtree is the intent rather than a defect.
   */
  const morningEntry = (day: string, p: Protocol, c: boolean[], g: string[]) =>
    ({ date: day, protocol: p, completed: c, gratitude: g })

  /**
   * Write some fields of this day's spirit_state. They land or they do not, and
   * the screen says which. No queue, no retry-on-reconnect, no unload guard: a
   * save made with no network is lost, and `unsaved` is how the user is told,
   * so they can press Retry, which writes whatever is on the screen then.
   *
   * EACH CALLER NAMES THE PATHS IT OWNS, and the merge happens in the database
   * (supabase/migrations/20261003_checkin_set_path.sql). While all four writers
   * here sent the whole entry, a gratitude blur carried the completion flags it
   * had read before a tick, and the tick came back off the row while the screen
   * still showed it ticked. Nothing about that was a cache or a queue; it was
   * four whole-entry writers on one jsonb column.
   *
   * The row is keyed on the protocol's OWN day, the same 4am-cutoff key the
   * entry carries, never the calendar day. Keyed on the calendar day, a
   * protocol finished at 1am landed in the next day's row, and generating that
   * day's protocol after 4am overwrote it (FOR-228, ruling 2). And it is the
   * day of the protocol ON THE SCREEN, passed in, never recomputed here: see
   * `entryDay`.
   *
   * A REFUSAL FOR NO ENTRY IS THE PROTOCOL'S FAILURE, not this writer's. The
   * tick or the gratitude did not fail; there was no entry for it to land on,
   * and patching it again cannot make one. The protocol's Retry writes the
   * whole entry off the screen, gratitude included, which is the only write
   * that can. So this writer's tag is left clear and the protocol's is raised.
   */
  const patchSpirit = async (
    day: string,
    patches: CheckinPatch[],
    as: SpiritTag = 'protocol',
  ): Promise<boolean> => {
    if (writingRef.current) return false
    // ITS OWN TAG, AND NOTHING ELSE'S. Clearing them all is how a successful
    // tick used to take a failed protocol save off the screen.
    setUnsaved((u) => u.filter((t) => t !== as))
    setWriting(true)
    gate.claim()
    const result = await patchCheckin('spirit_state', day, patches)
    setWriting(false)
    if (result !== 'landed') {
      const tag: SpiritTag = result === 'no-entry' ? 'protocol' : as
      setUnsaved((u) => (u.includes(tag) ? u : [...u, tag]))
      return false
    }
    // A PROTOCOL WRITE AND A TICK BOTH CARRY THE GRATITUDE ON SCREEN, so when
    // either lands, a gratitude failure still showing is no longer true: the
    // row has that text. Left up, it told the athlete something saved was
    // "lost unless you retry" (Codex v3 r4). A gratitude write retires only
    // its own. Nothing else is ever retired by a write that did not carry it.
    if (as !== 'gratitude') setUnsaved((u) => u.filter((t) => t !== 'gratitude'))
    // The row holds it, so siblings that read the row can read it now. A
    // same-tab write notifies nobody on its own; this is the notification.
    onSaved?.()
    return true
  }

  const generate = async () => {
    if (writingRef.current) return
    setLoading(true)
    setError('')
    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      // Today's objectives, read from the card's row at build time. No caller
      // passed them, so the model always heard "No objectives set" and the
      // Goals step could never name one. Read, never copied: the card stays
      // the only writer. A failed read builds without them rather than not at all.
      const todaysObjectives = objectives.length ? objectives : await readTodaysObjectives()
      const res = await fetch('/api/ai/morning-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          sleepQuality: SLEEP_QUALITY.find(s => s.id === sleep)?.label,
          energy: ENERGY_LEVELS.find(e => e.id === energy)?.label,
          objectives: todaysObjectives,
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
      const day = todayKey()
      // Generation paints BEFORE its save lands, unlike every other write here:
      // write-first would throw away a paid AI result on a network blip. What
      // makes that order safe: `writing` is set for the whole save, so no tick,
      // no gratitude and no Retry can start until it lands or fails; and if it
      // fails, any later sub-path write is refused by the database (no entry)
      // and reported as the protocol not being saved, never written as an
      // orphan and never dropped silently.
      setProtocol(fresh)
      setCompleted(freshCompleted)
      setGratitude(freshGratitude)
      setExpanded(0)
      setConfigured(true)
      setEntryDay(day)
      await patchSpirit(day, [{ path: ['morning'], value: morningEntry(day, fresh, freshCompleted, freshGratitude) }])
    } catch {
      setError('Failed to generate. Try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * THE ROW FIRST. A step that did not reach the record was never ticked on the
   * screen, so there is no paint to roll back and no snapshot to roll back to
   * (Blaine's ruling, 2026-10-01).
   */
  const toggleStep = async (i: number) => {
    if (!protocol || !entryDay || writingRef.current || protocolUnsaved) return
    const next = [...completed]
    next[i] = !next[i]
    // THE FLAGS, AND THE GRATITUDE AS IT IS ON THE SCREEN, in one statement.
    //
    // The gratitude rides along because a blur is not a promise. Tapping a
    // button does not take focus off a text field on a phone, and marking the
    // Gratitude step done unmounts its inputs, which fires no blur at all: the
    // text typed just before the tap was never sent by anything (Codex v3 r4).
    // So every write sends what the athlete can have changed since the last
    // one, read off the screen now.
    //
    // This is not the write that used to undo a tick. That one overlapped a
    // tick and carried flags read before it. Writes here are one at a time, so
    // the gratitude on this screen is never older than the row's.
    if (!await patchSpirit(entryDay, [
      { path: ['morning', 'completed'], value: next },
      { path: ['morning', 'gratitude'], value: gratitude },
    ], 'tick')) return
    setCompleted(next)
    if (next[i] && i < protocol.steps.length - 1) {
      setExpanded(i + 1)
    }
  }

  /**
   * Typing is local. A text field's value is the athlete's input until it is
   * submitted, which is not a second copy of the record to reconcile — but
   * writing it on every keystroke put many writes of one row in flight at
   * once, and choosing between them is the ordering question this ticket
   * exists to delete. So it is written ONCE, when the field is left.
   */
  const updateGratitude = (i: number, val: string) => {
    const next = [...gratitude]
    next[i] = val
    setGratitude(next)
  }
  // ONE FIELD. Gratitude owns {morning,gratitude}. This is the write that used
  // to undo a tick: it carried `completed` as it stood when the field was
  // focused, which is before the tick made while typing.
  //
  // IT ALWAYS WRITES (FOR-231 v3). v2's r4 guard returned here, silently,
  // whenever the client believed the entry was not in the row, and gratitude
  // typed during the protocol save was lost with nothing on screen. Now the
  // database decides: no entry, and the write is refused and the screen says
  // the protocol is not saved, with a Retry that carries this gratitude.
  //
  // The cases it does not write are a write already in flight, and a protocol
  // that is itself not saved. In both there is nothing to lose: the inputs
  // are read-only for exactly those spans, and the protocol's Retry carries
  // whatever gratitude is on the screen.
  const commitGratitude = () => {
    if (!protocol || !entryDay || writingRef.current || protocolUnsaved) return
    void patchSpirit(entryDay, [{ path: ['morning', 'gratitude'], value: gratitude }], 'gratitude')
  }

  const doneCount = completed.filter(Boolean).length
  const totalSteps = protocol?.steps.length || 0
  const allDone = doneCount === totalSteps && totalSteps > 0

  /**
   * A write that did not land, said once and rendered in EVERY view.
   *
   * One tag per owned path, so the Retry below can re-send exactly what failed.
   *
   * It used to live inside the setup branch only, and generation sets
   * `configured` before saving — so every failure after the first save showed
   * no warning and no Retry at all, and an unsaved completion read "morning
   * done" until a reload took it away (Codex r1, P1). Defined here, above the
   * early returns, it cannot be stranded in one branch again.
   *
   * Retry carries nothing: it re-reads what is on the screen at that moment.
   */
  // RETRY WRITES THE SAME PATH THAT FAILED, read off the screen at the moment
  // it is pressed. One Retry that rewrote the whole entry would hand every
  // failure the clobbering this ticket exists to prevent.
  const retryOf = (tag: SpiritTag) => () => {
    if (!protocol || !entryDay || writingRef.current) return
    if (tag === 'gratitude') {
      // A SUB-PATH, so it waits for the protocol like every other one (Codex
      // v3 r5): with the protocol itself not saved, this would either be
      // refused for want of an entry or land on the PREVIOUS protocol's. The
      // protocol's Retry carries this gratitude and retires this failure.
      if (protocolUnsaved) return
      void patchSpirit(entryDay, [{ path: ['morning', 'gratitude'], value: gratitude }], 'gratitude')
      return
    }
    void patchSpirit(entryDay, [{ path: ['morning'], value: morningEntry(entryDay, protocol, completed, gratitude) }])
  }

  // EVERY OUTSTANDING FAILURE, each with its own Retry. One row per tag,
  // because one row could not carry two: a protocol that did not save and a
  // gratitude that did not save are different losses with different retries,
  // and showing one of them hid the other.
  const unsavedBanner = unsaved.length > 0 ? (
    <div className="space-y-2">
      {UNSAVED_ORDER.filter((t) => unsaved.includes(t)).map((tag) => (
        <div key={tag} className="rounded-kit border border-status-danger-line bg-status-danger-bg p-3 flex items-center justify-between gap-3">
          <p className="text-status-danger-ink text-xs">
            {tag === 'tick'
              ? `${UNSAVED_LABEL[tag]} — tap it again.`
              : `${UNSAVED_LABEL[tag]} — the record did not take it. It is lost unless you retry.`}
          </p>
          {/* A failed tick has nothing to retry: the screen never moved, so the
              step is still as the row has it and tapping it again IS the retry. */}
          {tag !== 'tick' && (
            <button type="button" onClick={retryOf(tag)} disabled={writing || (tag === 'gratitude' && protocolUnsaved)} className="btn-ghost text-xs shrink-0 disabled:saturate-[.15]">
              Retry
            </button>
          )}
        </div>
      ))}
    </div>
  ) : null

  // Reading the record. Not a paint of a remembered protocol: there is none.
  if (reading) {
    return <div className="tile h-48" aria-busy="true" />
  }

  // The read failed. Nothing below this may render: the setup form would say
  // there is no protocol, and that is not known.
  if (readFailed) {
    return (
      <div className="rounded-kit border border-status-danger-line bg-status-danger-bg p-3 flex items-center justify-between gap-3">
        <p className="text-status-danger-ink text-xs">Could not load your morning protocol. Nothing has been changed.</p>
        <button
          type="button"
          onClick={() => { setReadFailed(false); setReading(true); setReadNonce((n) => n + 1) }}
          className="btn-ghost text-xs shrink-0"
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Config screen ──────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="space-y-5">
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

        {unsavedBanner && <div className="mt-3">{unsavedBanner}</div>}
        {error && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-status-danger-ink text-xs">{error}</p>
            <button onClick={() => generate()} className="text-brand hover:underline text-xs">Try Again</button>
          </div>
        )}

        <button
          onClick={() => generate()}
          disabled={loading || writing}
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
        <button
          onClick={() => {
            if (writingRef.current) return
            setConfigured(false); setEntryDay(null); setProtocol(null); setCompleted([]); setGratitude(['', '', ''])
            // The protocol is discarded, so its failures go with it: a banner
            // left up here offered a Retry with nothing to retry (Codex v3 r1).
            setUnsaved([])
          }}
          disabled={writing}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors disabled:saturate-[.15]"
          title="Rebuild"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {unsavedBanner}

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
                  onClick={(e) => { e.stopPropagation(); void toggleStep(i) }}
                  disabled={writing || protocolUnsaved}
                  className="flex-shrink-0 transition-all disabled:saturate-[.15]"
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
                            onBlur={commitGratitude}
                            readOnly={writing || protocolUnsaved}
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
                    /* Goals — handed to the daily objectives card, the only
                       writer of objectives. Nothing is typed or saved here. */
                    <div className="space-y-2">
                      <p className="text-[10px] lowercase text-muted-foreground font-medium">Today&apos;s objectives</p>
                      <p className="text-sm text-muted-foreground font-light leading-relaxed">
                        Set your three in Daily Objectives, just below this protocol. Then come back and mark this step done.
                      </p>
                      <a href="#daily-objectives" className="btn-ghost text-xs inline-flex items-center gap-1.5">
                        <Target size={12} /> Go to Daily Objectives <ArrowRight size={12} />
                      </a>
                    </div>

                  ) : (
                    <div className={`rounded-lg px-4 py-3 border ${colors}`}>
                      <p className="text-[10px] lowercase font-medium mb-1 opacity-70">Focus Prompt</p>
                      <p className="text-sm font-light italic">{step.prompt}</p>
                    </div>
                  )}

                  <button
                    onClick={() => { void toggleStep(i) }}
                    disabled={writing || protocolUnsaved}
                    className="w-full bg-muted hover:bg-foreground hover:text-background text-foreground font-medium py-2.5 rounded-lg text-xs lowercase transition-all disabled:saturate-[.15]"
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
