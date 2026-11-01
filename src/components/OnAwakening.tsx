'use client'

import { useEffect, useState } from 'react'
import { Sunrise, CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { patchCheckin, usePaintGate } from '../lib/checkins'
import { useClock, useObjectivesSaved } from '../lib/useClock'
import { localDay } from '../utils/day'
import {
  AWAKENING_ANCHOR, AWAKENING_LINE, inMorningWindow, morningDay, readAwakening, carryOver, lastNightDay, firstObjective,
  type CarryOver,
} from '../lib/evening'

// ON AWAKENING (FOR-332). The first thing in the morning: the day ahead, one
// line to set the day's thinking, and what last night's review handed over.
// Deterministic — no AI. 4am to noon only.
export default function OnAwakening({ trainingLine }: { trainingLine: string }) {
  const now = useClock()
  const objectivesSaved = useObjectivesSaved()
  const open = inMorningWindow(now)
  const day = morningDay(now)

  const [loading, setLoading] = useState(true)
  const [oneThing, setOneThing] = useState<string | null>(null)
  const [carry, setCarry] = useState<CarryOver | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const gate = usePaintGate()

  useEffect(() => {
    if (!open) return
    const claim = gate.claim()
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const night = lastNightDay(now)
        // Today's objectives are keyed on the calendar day (the objectives
        // card's own key); the acknowledgement on the routine's 4am day. In
        // the noon window both are the same date.
        const dates = [...new Set([localDay(now), day, ...(night ? [night] : [])])]
        const { data } = await supabase
          .from('daily_checkins')
          .select('date, mind_state, spirit_state')
          .eq('user_id', user.id)
          .in('date', dates)
        if (!gate.mayPaint(claim)) return
        const row = (d: string) => (data ?? []).find((r: { date: string }) => r.date === d) as
          { mind_state?: unknown; spirit_state?: { awakening?: unknown } | null } | undefined
        setOneThing(firstObjective(row(localDay(now))?.mind_state ?? null))
        setDone(readAwakening(row(day)?.spirit_state?.awakening, day) !== null)
        if (night) setCarry(carryOver(row(night)?.mind_state ?? null, night))
      } catch { /* a failed read shows the card unticked, which a tap fixes */ }
      finally { if (gate.mayPaint(claim)) setLoading(false) }
    }
    load()
  }, [open, day, objectivesSaved])

  if (!open || loading) return null

  const acknowledge = async () => {
    if (saving || done) return
    setSaving(true)
    setSaveFailed(false)
    gate.claim()
    const landed = await patchCheckin('spirit_state', day, [
      { path: ['awakening'], value: { day, at: new Date().toISOString() } },
    ]) === 'landed'
    setSaving(false)
    if (!landed) { setSaveFailed(true); return }
    setDone(true)
  }

  return (
    <div id="on-awakening" className="tile p-5 scroll-mt-24">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-brand/10 rounded-lg">
          <Sunrise size={14} className="text-brand" />
        </div>
        <h3 className="font-medium text-sm font-display tracking-[0.06em]">on awakening</h3>
      </div>

      <p className="eyebrow-mono text-muted-foreground mb-1.5">the 24 hours ahead</p>
      <ul className="space-y-1 mb-4 text-sm text-foreground">
        <li>{oneThing ? `One thing: ${oneThing}` : <a href="#daily-objectives" className="underline">Set your one thing below.</a>}</li>
        <li>{trainingLine}</li>
      </ul>

      {carry && (
        <div className="mb-4 rounded-lg bg-muted px-3 py-2 space-y-1">
          <p className="eyebrow-mono text-muted-foreground">from last night</p>
          {carry.apology && (
            <p className="text-xs text-foreground">Make it right{carry.apology.to ? ` with ${carry.apology.to}` : ''} today.</p>
          )}
          {carry.holding && (
            <p className="text-xs text-foreground">Talk over what you&apos;re carrying with someone you trust.</p>
          )}
          {carry.oneThing && (
            <p className="text-xs text-foreground">Yesterday&apos;s one thing slipped: {carry.oneThing}</p>
          )}
        </div>
      )}

      <p className="text-sm text-foreground mb-2">{AWAKENING_ANCHOR}</p>
      <button
        type="button"
        onClick={acknowledge}
        disabled={saving || done}
        aria-pressed={done}
        className="w-full flex items-start gap-3 text-left"
      >
        {done
          ? <CheckCircle2 size={16} className="text-brand shrink-0 mt-0.5" />
          : <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />}
        <span className={`text-sm leading-snug ${done ? 'text-muted-foreground' : 'text-foreground'}`}>{AWAKENING_LINE}</span>
      </button>
      {saveFailed && <p className="text-status-danger-ink text-xs mt-2">Not saved. Tap again to retry.</p>}
    </div>
  )
}
