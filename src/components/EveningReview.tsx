'use client'

import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { patchCheckin, usePaintGate } from '../lib/checkins'
import { useClock, useObjectivesSaved } from '../lib/useClock'
import {
  SHORTFALLS, ONE_THING, LINE_MAX, emptyAnswers, eveningDay, inEveningWindow, isComplete, toEntry,
  readEntry, toAnswers, firstObjective, type EveningAnswers, type EveningEntry,
} from '../lib/evening'

// THE EVENING REVIEW (FOR-332). A form, not a coach: no AI reads or writes it.
// Shows from 5pm to the 4am boundary. The record is the row
// (mind_state.evening); nothing is cached, so a save lands or says it did not.
export default function EveningReview() {
  const now = useClock()
  const objectivesSaved = useObjectivesSaved()
  const day = eveningDay(now)
  const open = inEveningWindow(now)

  const [loading, setLoading] = useState(true)
  const [readFailed, setReadFailed] = useState(false)
  const [oneThing, setOneThing] = useState<string | null>(null)
  const [saved, setSaved] = useState<EveningEntry | null>(null)
  const [editing, setEditing] = useState(false)
  const [a, setA] = useState<EveningAnswers & { day?: string }>(() => ({ ...emptyAnswers(), day }))
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const gate = usePaintGate()

  useEffect(() => {
    if (!open) return
    const claim = gate.claim()
    const load = async () => {
      setReadFailed(false)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data, error } = await supabase
          .from('daily_checkins')
          .select('mind_state')
          .eq('user_id', user.id)
          .eq('date', day)
          .maybeSingle()
        if (!gate.mayPaint(claim)) return
        if (error) { setReadFailed(true); return }
        const mind = data?.mind_state ?? null
        setOneThing(firstObjective(mind))
        const e = readEntry((mind as { evening?: unknown } | null)?.evening, day)
        // A new day starts clean; a re-read after objectives were locked in
        // leaves an open form's answers alone.
        if (e) { setSaved(e); setA(toAnswers(e)); setEditing(false) }
        else { setSaved(null); setA((cur) => (cur.day === day ? cur : { ...emptyAnswers(), day })) }
      } catch { if (gate.mayPaint(claim)) setReadFailed(true) }
      finally { if (gate.mayPaint(claim)) setLoading(false) }
    }
    load()
    // Once per mount: nothing else writes the evening entry.
  }, [open, day, objectivesSaved])

  if (!open || loading) return null

  if (readFailed) {
    return (
      <div className="rounded-kit border border-status-danger-line bg-status-danger-bg p-3">
        <p className="text-status-danger-ink text-xs">Could not load tonight&apos;s review. Nothing has been changed.</p>
      </div>
    )
  }

  const save = async () => {
    if (saving || !isComplete(a, oneThing !== null)) return
    setSaving(true)
    setSaveFailed(false)
    const entry = toEntry(a, day, oneThing)
    gate.claim()
    const landed = await patchCheckin('mind_state', day, [{ path: ['evening'], value: entry }]) === 'landed'
    setSaving(false)
    if (!landed) { setSaveFailed(true); return }
    setSaved(entry)
    setEditing(false)
  }

  const header = (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 bg-brand/10 rounded-lg">
        <Moon size={14} className="text-brand" />
      </div>
      <h3 className="font-medium text-sm font-display tracking-[0.06em]">evening review</h3>
    </div>
  )

  if (saved && !editing) {
    return (
      <div id="evening-review" className="tile p-5 scroll-mt-24">
        {header}
        <p className="text-sm text-foreground">Day reviewed. Hand it over and get some sleep.</p>
        {saved.apology && (
          <p className="text-xs text-muted-foreground mt-2">
            Make it right tomorrow{saved.apologyTo ? `: ${saved.apologyTo}` : ''}.
          </p>
        )}
        {saved.holding && (
          <p className="text-xs text-muted-foreground mt-1">Talk it over with someone you trust.</p>
        )}
        <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground underline mt-3">
          edit
        </button>
      </div>
    )
  }

  const toggle = (on: boolean) =>
    `pill text-xs px-3 py-1.5 transition-colors ${on ? 'pill-volt' : 'pill-quiet'}`
  const yesNo = (value: boolean | null, set: (v: boolean) => void) => (
    <div className="flex gap-2">
      <button type="button" aria-pressed={value === true} disabled={saving} onClick={() => set(true)} className={toggle(value === true)}>yes</button>
      <button type="button" aria-pressed={value === false} disabled={saving} onClick={() => set(false)} className={toggle(value === false)}>no</button>
    </div>
  )
  const line = (value: string, set: (v: string) => void, placeholder: string) => (
    <input
      type="text"
      value={value}
      maxLength={LINE_MAX}
      readOnly={saving}
      onChange={(e) => set(e.target.value)}
      placeholder={placeholder}
      className="w-full mt-2 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted-foreground"
    />
  )
  const q = 'text-sm text-foreground mb-2'

  return (
    <div id="evening-review" className="tile p-5 scroll-mt-24">
      {header}
      <p className="text-xs text-muted-foreground mb-4">Look back over the day. Honest, not harsh.</p>

      <div className="space-y-5">
        <div>
          <p className={q}>Today, was I…</p>
          <div className="flex flex-wrap gap-2">
            {SHORTFALLS.map((s) => {
              const on = a.shortfalls.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  disabled={saving}
                  onClick={() => setA({ ...a, shortfalls: on ? a.shortfalls.filter((x) => x !== s) : [...a.shortfalls, s] })}
                  className={toggle(on)}
                >
                  {s}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Tap any that fit. None is fine.</p>
        </div>

        <div>
          <p className={q}>Do I owe anyone an apology?</p>
          {yesNo(a.apology, (v) => setA({ ...a, apology: v }))}
          {a.apology && line(a.apologyTo, (v) => setA({ ...a, apologyTo: v }), 'Who? (optional)')}
        </div>

        <div>
          <p className={q}>Am I holding onto something I should talk over with someone?</p>
          {yesNo(a.holding, (v) => setA({ ...a, holding: v }))}
        </div>

        <div>
          <p className={q}>Did I give more than I got?</p>
          {yesNo(a.gaveMore, (v) => setA({ ...a, gaveMore: v }))}
        </div>

        <div>
          <p className={q}>What could I have done better?</p>
          {line(a.better, (v) => setA({ ...a, better: v }), 'One line (optional)')}
        </div>

        {oneThing !== null && (
          <div>
            <p className={q}>Did I hit my one thing?</p>
            <p className="text-xs text-muted-foreground mb-2">{oneThing}</p>
            <div className="flex gap-2">
              {ONE_THING.map((o) => (
                <button key={o} type="button" aria-pressed={a.oneThing === o} disabled={saving} onClick={() => setA({ ...a, oneThing: o })} className={toggle(a.oneThing === o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || !isComplete(a, oneThing !== null)}
          className="w-full pill-volt text-xs font-bold py-2.5 disabled:saturate-[.15] transition-opacity"
        >
          {saving ? 'saving…' : 'done for the day'}
        </button>
        {saveFailed && (
          <p className="text-status-danger-ink text-xs text-center">Not saved. Tap again to retry.</p>
        )}
      </div>
    </div>
  )
}
