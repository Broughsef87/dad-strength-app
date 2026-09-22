'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Sun, BookOpen, Flame, Heart, Star, Moon, CloudDrizzle, Skull, Zap, Coffee, Wind, Target, ArrowRight } from 'lucide-react'
import AmbientAudioPlayer from './AmbientAudioPlayer'
import RecommendedReading from './RecommendedReading'
import { createClient } from '../utils/supabase/client'
import { localDay, localDayWithCutoff } from '../utils/day'
import { isUpgradeRequired } from '../lib/upgradeRequired'
import UpgradeModal from './UpgradeModal'
import { ACCOUNT_CHANGED, runAs } from '../lib/checkinQueue'

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

  // Where this device stands against the record. 'unsaved': a change made here
  // has not reached the row (it retries on the next change, or on Retry).
  // 'unreached': the row could not be read, so what is on screen is only what
  // this device last saw.
  const [sync, setSync] = useState<'synced' | 'unsaved' | 'unreached'>('synced')
  // Every write of the row goes through the ONE check-in queue shared with the
  // objectives card (src/lib/checkinQueue.ts, Codex r2): gratitude saves on
  // every keystroke, and an earlier keystroke landing last would leave the
  // record holding it. Each write is bound to the account that made it — the
  // queue outlives this component, and a write queued before a sign-out must
  // not run under whoever signs in next.
  const ownerRef = useRef<string | null>(null)
  // Bumped by every change made here. The row read on open is applied only if
  // nothing has been changed since — a change made after the read started is
  // newer than what the read will return, and is already on its way to the row.
  const localEdits = useRef(0)
  // The latest protocol state made here, and the protocol day it belongs to —
  // for Retry, which must retry THAT day's record, not today's (Codex r2).
  const latest = useRef<{ p: Protocol; c: boolean[]; g: string[]; day: string } | null>(null)

  const saveMindState = async () => {
    const supabase = createClient()
    const today = localDay()
    // Dense, for the same reason DailyObjectivesCard stores dense: its render
    // path filters blanks and toggles by the FILTERED index, so a sparse array
    // misaligns completion flags against objectives. Both writers must agree.
    const dense = mindObjectives.map(o => o.trim()).filter(Boolean)
    const state = {
      date: localDay(),
      objectives: dense,
      completedObjectives: dense.map(() => false),
      lockedIn: true,
    }
    // Paint only: the objectives card renders it instantly on its next open.
    try { localStorage.setItem('dad-strength-mind-state', JSON.stringify(state)) } catch { /* paint only */ }
    // The record. "Saved" means the row has it — nothing earlier.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMindError('sign in to save your objectives'); return }
    const res = await runAs(supabase, user.id, async () => supabase.from('daily_checkins').upsert(
      { user_id: user.id, date: today, mind_state: state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : String(e) } }))
    if (res.error) { setMindError('not saved — check your connection and try again'); return }
    setMindError('')
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
          setProtocol(data.protocol)
          setCompleted(data.completed || new Array(data.protocol.steps.length).fill(false))
          setGratitude(data.gratitude || ['', '', ''])
          setConfigured(true)
        }
      }
    } catch { /* no paint — the row will answer */ }

    // …then the RECORD answers, and what it says replaces the paint entirely:
    // more done, less done, a different protocol, or none at all. Nothing is
    // compared. The one exception is a change made here while the read was in
    // flight — that change is newer than the read, and already on its way to
    // the row, so the read is not allowed to put the screen back behind it.
    const editsAtOpen = localEdits.current
    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        ownerRef.current = user.id
        // The row keyed on the protocol's OWN day — where every protocol write
        // has landed since the row-key fix (FOR-228, ruling 2).
        const read = await runAs(supabase, user.id, async () => supabase
          .from('daily_checkins')
          .select('spirit_state')
          .eq('user_id', user.id)
          .eq('date', todayKey())
          .maybeSingle())
        if (read === ACCOUNT_CHANGED || read.error) throw new Error('unreached')
        const row = 'data' in read ? read.data : null
        if (localEdits.current !== editsAtOpen) return
        const m = (row?.spirit_state as { morning?: { date?: string; protocol?: Protocol; completed?: boolean[]; gratitude?: string[] } } | null)?.morning
        if (m?.protocol && m.date === todayKey()) {
          const c = m.completed ?? new Array(m.protocol.steps.length).fill(false)
          const g = m.gratitude ?? ['', '', '']
          setProtocol(m.protocol)
          setCompleted(c)
          setGratitude(g)
          setConfigured(true)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), protocol: m.protocol, completed: c, gratitude: g })) } catch { /* paint only */ }
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
        setSync('synced')
      } catch {
        setSync('unreached')
      }
    })()
  }, [])

  const saveCache = (p: Protocol, c: boolean[], g: string[], day: string = todayKey()) => {
    localEdits.current++
    // `day`: the protocol day the change was MADE on, captured now — or, for a
    // Retry, the day of the change being retried. Evaluated inside the queued
    // write it could fall after 4am and file this protocol into the next day's
    // row (Codex r1, r2).
    latest.current = { p, c, g, day }
    // The account that made the change, captured now. Before the open-time
    // read has told us who is signed in there is no owner to bind to, and the
    // change is a render until the next change or Retry — never a write under
    // an account nobody checked.
    const owner = ownerRef.current
    // Paint, for the next open's first frame.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: day, protocol: p, completed: c, gratitude: g })) } catch { /* paint only */ }
    // The record. Upsert names only its own column, so mind_state is untouched.
    void (async () => {
      if (!owner) { setSync('unsaved'); return }
      const supabase = createClient()
      const res = await runAs(supabase, owner, async () => {
        // The row is keyed on the protocol's OWN day — the same 4am-cutoff
        // key the entry carries — not the calendar day. Keyed on the calendar
        // day, a protocol finished at 1am landed in the next day's row, and
        // generating that day's protocol after 4am overwrote it: a completed
        // protocol gone (FOR-228, ruling 2).
        return supabase.from('daily_checkins').upsert(
          {
            user_id: owner,
            date: day,
            spirit_state: { morning: { date: day, protocol: p, completed: c, gratitude: g } },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' },
        )
      }).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : String(e) } }))
      if (res.error) { setSync('unsaved'); return }
      setSync('synced')
      // The row has it now. Only now are the readers told (FOR-231): the
      // daily number, the checklist and the objectives card re-read the row
      // on this, and a signal sent before the write landed sent them to read
      // the old one.
      onSaved?.()
    })()
  }
  const retrySave = () => { const l = latest.current; if (l) saveCache(l.p, l.c, l.g, l.day) }

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
        <button
          onClick={() => { localEdits.current++; setConfigured(false); setProtocol(null); setCompleted([]); setGratitude(['', '', '']) }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          title="Rebuild"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {sync !== 'synced' && (
        <p className="text-[11px] text-muted-foreground" role="status">
          {sync === 'unsaved'
            ? <>not saved yet — this device has your changes, your record doesn&apos;t. <button onClick={retrySave} className="underline">retry</button></>
            : 'couldn\u2019t reach your record — showing what this device last saw'}
        </p>
      )}

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
