// ── Fuel: the athlete's own items (FOR-240) ──────────────────────────────────
// Recurring staples and one-offs: lines on the list the solver has never heard
// of. They never enter solver output — buildShoppingList does not see them —
// and they carry no quantity, no diversion and no rule. Staples are MERGED
// when a version is created (store.ts, createVersion), so a regeneration
// carries them and cannot delete one; a tick on any custom line persists
// through the same row-authoritative write as every other line.
// Pure: rows in, no I/O, no clock.
import type { ListItem } from './types'

export type CustomKind = 'staple' | 'one-off'

/** A fuel_staples row: on every list built from now on, until stopped. */
export interface StapleRow {
  id: string
  item: string
  store_section: string
}

/**
 * The key namespace the solver can never mint. A solver key is
 * `section:item:unit`, with `:trip2` for the second trip, so it ALWAYS holds a
 * colon — whatever the library, whatever the section is called. A custom key
 * is this prefix and the row's id with everything but letters and digits
 * removed, so it NEVER holds one. The two sets cannot meet: a custom `rice`
 * never collides with the solver's `rice`. The database mints the same shape
 * (`'custom~' || replace(uuid::text, '-', '')`), and fuel-custom-keys.mjs
 * holds the invariant over generated libraries.
 */
export const CUSTOM_PREFIX = 'custom~'
export const customKey = (id: string): string => CUSTOM_PREFIX + id.replace(/[^a-zA-Z0-9]/g, '')
export const isCustomKey = (key: string): boolean => key.startsWith(CUSTOM_PREFIX) && !key.includes(':')
export const isCustom = (line: Pick<ListItem, 'key'>): boolean => isCustomKey(line.key)

/**
 * The staple a staple line was merged from: its key is the staple's uuid with
 * the dashes taken out, so the uuid comes straight back. Null for any key that
 * is not a custom key of that shape — a solver key never leads to a staple.
 * This is what lets one tap on the line stop the staple (FOR-240, Andrew).
 */
export function stapleIdFromKey(key: string): string | null {
  const m = /^custom~([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/.exec(key)
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}` : null
}

/** One custom line, shaped like every other line on the list so the checklist and the tick path treat it the same. */
export function customLine(id: string, item: string, section: string, kind: CustomKind): ListItem {
  return { key: customKey(id), item: item.trim(), qty: 0, unit: '', section, from: [], second_trip: false, inferred: false, stocked: false, checked: false, custom: kind }
}

/**
 * The items a new version is created with: the solver's own lines, then every
 * staple once. It starts from SOLVER lines — anything custom already in the
 * input is dropped first — so feeding it a list that already carries its
 * staples cannot duplicate one. One-offs are not carried: they belonged to the
 * list they were added to. Staples come from the staples store, never from the
 * previous list.
 */
export function withStaples(lines: ListItem[], staples: StapleRow[]): ListItem[] {
  const seen = new Set<string>()
  const merged: ListItem[] = []
  for (const s of staples) {
    const key = customKey(s.id)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(customLine(s.id, s.item, s.store_section, 'staple'))
  }
  return [...solverLines(lines), ...merged]
}

/** The solver's own lines of a list — what a fresh solve is compared against, the athlete's lines aside. */
export const solverLines = (items: ListItem[]): ListItem[] => items.filter((l) => !isCustom(l))

/**
 * The main-shop sections in the order the store is walked: the household's
 * section order, then any section it does not name, in the order it first
 * appears. Each section once. Within a section the solver's lines keep their
 * order and the athlete's follow — so coffee lands in its aisle, in aisle
 * order with everything else, wherever it sits in the row.
 */
export function sectionsInOrder<T extends Pick<ListItem, 'section' | 'key'>>(lines: T[], sectionOrder: string[]): Array<{ section: string; items: T[] }> {
  const groups = new Map<string, T[]>()
  for (const l of lines) {
    const g = groups.get(l.section)
    if (g) g.push(l); else groups.set(l.section, [l])
  }
  const firstSeen = [...groups.keys()]
  const rank = (s: string) => { const i = sectionOrder.indexOf(s); return i < 0 ? sectionOrder.length : i }
  return [...firstSeen]
    .sort((a, b) => rank(a) - rank(b) || firstSeen.indexOf(a) - firstSeen.indexOf(b))
    .map((section) => {
      const items = groups.get(section) ?? []
      return { section, items: [...items.filter((l) => !isCustom(l)), ...items.filter((l) => isCustom(l))] }
    })
}

/**
 * Where a new item goes unless the athlete picks: Pantry when the household
 * walks one, otherwise the last aisle it walks. Never guessed from the name —
 * guessing is how diapers end up in Produce. (The ticket says "the last
 * section (Pantry)"; the default walk ends in Frozen, so the default is named,
 * not positional.)
 */
export function defaultSection(sectionOrder: string[]): string {
  return sectionOrder.includes('Pantry') ? 'Pantry' : sectionOrder[sectionOrder.length - 1] ?? 'Pantry'
}
