'use client'

import { useEffect, useState } from 'react'

/**
 * The current time, refreshed every minute and whenever the tab comes back.
 * Cards that open and close on the clock (the evening review at 5pm, on
 * awakening at 4am) must not freeze the hour they were mounted in: a dashboard
 * left open overnight would keep yesterday's card and write to yesterday's row
 * (FOR-332, Codex r1).
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return now
}

/**
 * Fired by the daily objectives card after a list lands in the row. Readers of
 * "your one thing" re-read on it, so locking in an objective at 6pm reaches an
 * evening review that was already on screen. A signal, never a payload: the
 * reader goes back to the row.
 */
export const OBJECTIVES_SAVED = 'dad-strength:objectives-saved'

export function useObjectivesSaved(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const on = () => setN((x) => x + 1)
    window.addEventListener(OBJECTIVES_SAVED, on)
    return () => window.removeEventListener(OBJECTIVES_SAVED, on)
  }, [])
  return n
}
