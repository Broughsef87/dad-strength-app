'use client'

import { useState } from 'react'

// THE MISS-TREND QUESTION (FOR-337). Misses on the snatch and clean & jerk are
// how Andrew knows he needs a deload, so a run of them asks the question. It
// never acts on its own: "yes" marks next week as a deload exactly the way the
// toggle on the program page does (preferences.deload_weeks), and "not yet"
// puts the question away for that week (preferences.deload_dismissed).
export default function DeloadAsk({ supabase, userId, slug, week, onAnswered }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  userId: string
  slug: string
  /** The week the deload would be: next week. */
  week: number
  onAnswered: (key: 'deload_weeks' | 'deload_dismissed', weeks: number[]) => void
}) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const answer = async (key: 'deload_weeks' | 'deload_dismissed') => {
    if (saving) return
    setSaving(true)
    setFailed(false)
    // Read the preferences fresh and add one week to one list, so nothing else
    // on the row (jump ramp restarts, the other list) is written from a stale copy.
    const { data, error } = await supabase
      .from('user_programs').select('preferences')
      .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active')
      .maybeSingle()
    if (error || !data) { setSaving(false); setFailed(true); return }
    const prefs = (data.preferences ?? {}) as Record<string, unknown>
    const cur = Array.isArray(prefs[key]) ? (prefs[key] as unknown[]).filter((n): n is number => typeof n === 'number') : []
    const next = cur.includes(week) ? cur : [...cur, week].sort((a, b) => a - b)
    const { error: e2 } = await supabase
      .from('user_programs').update({ preferences: { ...prefs, [key]: next } })
      .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active')
    setSaving(false)
    if (e2) { setFailed(true); return }
    onAnswered(key, next)
  }

  return (
    <div className="border border-status-danger-fill/40 bg-status-danger-fill/5 rounded-lg px-4 py-3 space-y-2.5">
      <p className="text-sm text-foreground">Misses are trending up. Take next week as a deload?</p>
      <p className="text-xs text-muted-foreground">
        Week {week} would run lighter. You can undo it on the program page.
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={() => answer('deload_weeks')}
          className="pill-volt text-xs px-4 py-1.5 disabled:saturate-[.15]">
          yes, deload
        </button>
        <button type="button" disabled={saving} onClick={() => answer('deload_dismissed')}
          className="pill-quiet text-xs px-4 py-1.5">
          not yet
        </button>
      </div>
      {failed && <p className="text-status-danger-ink text-xs">Not saved. Tap again to retry.</p>}
    </div>
  )
}
