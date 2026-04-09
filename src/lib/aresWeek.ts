/**
 * Shared Ares week number utilities.
 * Keep in sync with the route handler (src/app/api/ai/ares-generate/route.ts).
 *
 * weekNumber format: year * 100 + ISO week  (e.g. 202614 = week 14 of 2026)
 * This is an integer so it fits the week_number INT column in Supabase.
 */

export function getAresWeekNumber(date = new Date()): number {
  const d = new Date(date)
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const isoWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return d.getUTCFullYear() * 100 + isoWeek
}

/** Get the Monday date (YYYY-MM-DD) for a given aresWeekNumber */
export function getMondayOfAresWeek(weekNum: number): Date {
  const year = Math.floor(weekNum / 100)
  const week = weekNum % 100
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  return monday
}

/** "Week of Apr 7" */
export function formatAresWeek(weekNum: number): string {
  const monday = getMondayOfAresWeek(weekNum)
  return 'Week of ' + monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Format seconds as "M:SS" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
