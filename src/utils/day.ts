// The user's LOCAL calendar day as YYYY-MM-DD.
//
// Daily features (objectives, morning protocol, growth) key both their
// localStorage cache and their daily_checkins row on "today". Those two must
// agree, or state bleeds across the day boundary and never appears to reset.
// The old code mixed `toISOString().split('T')[0]` (UTC day) for the DB with
// `toLocaleDateString()` (local day) for the cache — so for anyone west of
// UTC, an evening entry was written under tomorrow's UTC date and loaded back
// the next morning as "today". This helper is the single source of truth:
// always the viewer's local calendar day, in a Postgres-`date`-friendly format.
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Local day with the boundary shifted `cutoffHour` hours past midnight.
// A cutoff of 4 means the "day" runs 4:00am → 3:59am: a 1am session still
// counts as the night before. Used for the morning routine so a late-night
// or pre-dawn check-in doesn't wipe the completed routine.
export function localDayWithCutoff(cutoffHour: number, d: Date = new Date()): string {
  return localDay(new Date(d.getTime() - cutoffHour * 3_600_000))
}

// The local calendar day BEFORE `d`, by calendar arithmetic.
//
// Not `d - 24 hours`. On the day after the clocks go forward a local day is 23
// hours long, so at 00:30 that Monday, 24 hours earlier is 23:30 on SATURDAY
// and Sunday is skipped altogether. A reader asking for "today and yesterday"
// then never asks for Sunday's row, shows nothing, and the next save writes
// over it (FOR-231 v3, Codex r2). setDate() moves the calendar field and lets
// the engine find that day, whatever its length.
export function localDayBefore(d: Date = new Date()): string {
  const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  return localDay(prev)
}
