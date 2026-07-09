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
