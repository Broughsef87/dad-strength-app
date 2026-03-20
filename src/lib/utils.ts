// Shared utility functions for Dad Strength

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns the Monday of the current week at midnight local time */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns the Sunday of the week at 23:59:59 local time */
export function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Returns the ISO date string (YYYY-MM-DD) in local time — avoids UTC offset issues */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns today's ISO date string in local time */
export function todayLocalISO(): string {
  return toLocalDateString(new Date())
}

/**
 * Calculate a consecutive-day streak from an array of ISO date strings (YYYY-MM-DD).
 * Handles the case where the user hasn't logged yet today (yesterday counts as day 1).
 */
export function calcStreak(localDateStrings: string[]): number {
  if (!localDateStrings.length) return 0

  const unique = Array.from(new Set(localDateStrings)).sort().reverse()
  const today = toLocalDateString(new Date())

  // Allow streak to start from yesterday if nothing logged today yet
  const startOffset = unique[0] === today ? 0 : 1

  let streak = 0
  for (let i = 0; i < unique.length; i++) {
    const expected = new Date()
    expected.setDate(expected.getDate() - (i + startOffset))
    if (unique[i] === toLocalDateString(expected)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── Volume ──────────────────────────────────────────────────────────────────

/** Safe volume calculation for a single set */
export function setVolume(weightLbs: number | string, reps: number | string): number {
  return (parseFloat(String(weightLbs)) || 0) * (parseInt(String(reps)) || 0)
}
