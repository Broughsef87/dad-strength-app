// ── Fuel step 2: what do you already have? (FOR-281) ─────────────────────────
// Andrew, 2026-10-12: "I've basically just been going through the shopping list
// beforehand and checking off the items I have at home rather than searching
// and adding everything in the on hand list." This is that, made the flow.
//
// The DRAFT is the solver's list with nothing on hand. A tap on a line says
// "have it"; a quantity says "have some". Neither makes a list: each becomes a
// ROW ON HAND — the household's inventory, the one place stock has ever lived —
// and the solver subtracts it exactly as it always has. A tick is a row that
// `covers` one line by its key; a quantity is a row of real stock. So the
// solver stays the only source of the list, the build's rows on hand are the
// household's inventory at the build and the plan's own snapshot of it, and
// nothing here is a second copy of either.
//
// Pure: rows in, rows out. No I/O, no clock.
import type { Household, InventoryItem, ListItem, MealRow, Plan, ShoppingList } from './types'
import { buildShoppingList, householdFor } from './solve'
import { customKey, type StapleRow } from './custom'

const norm = (s: string) => s.trim().toLowerCase()
const isTick = (r: InventoryItem) => r.covers !== undefined
const sameItem = (r: InventoryItem, line: Pick<ListItem, 'item'>) => norm(r.item) === norm(line.item)

/** The list before anything on hand comes off it: every line the menu needs, in the order the solver walks the store. */
export function draftList(household: Household, meals: MealRow[], plan: Plan): ShoppingList {
  return buildShoppingList(householdFor(household, false), meals, plan)
}

/** The same solve with these rows on hand — what the list will be if it is built now. */
export function listWith(household: Household, meals: MealRow[], plan: Plan, rows: InventoryItem[]): ShoppingList {
  return buildShoppingList({ ...household, inventory: rows }, meals, plan)
}

/**
 * The build a new one would REBUILD: the lines its list was stored with, and
 * the rows on hand it was built with — its own snapshot. The lines are the
 * STORED list's, never a fresh solve of its nights: a meal edited since would
 * solve to ingredients that build never showed anyone (Codex r5).
 */
export interface PriorBuild {
  /**
   * The SOLVER's lines of that list — the ingredients it showed. Null when the
   * stock was counted afresh in settings after that build: then every row was
   * put there since, on purpose, and all of it counts (Codex r6).
   */
  items: Pick<ListItem, 'item'>[] | null
  inventory: InventoryItem[]
}

/**
 * The rows step 2 opens with, from what the household last saved.
 *
 * `counts` is the rule the page has always had for whether saved stock counts
 * toward a build without being asked (FOR-177 rounds 15 to 18): yes for a
 * rebuild of a plan that counted it, and yes when it was saved after the newest
 * plan was built; no when a week has been eating it since. When it counts, the
 * saved rows stand and the lines they cover open ticked. When it does not,
 * nothing about this menu opens ticked — the stock is offered back a line at a
 * time, by `lastTime`, and counts only on a tap.
 *
 * Stock for something this menu does not cook is kept either way: it comes off
 * nothing here, and dropping it would lose the freezer over a week of soup.
 *
 * `prior` is the plan being rebuilt, when the build is a rebuild, and it is
 * what "counted" MEANS there (Codex r2). Stock counts on a rebuild because the
 * athlete was shown that ingredient at that build's step 2 and let the row
 * stand — so stock for an ingredient that build never cooked was never shown,
 * was carried along unseen, and does not count now that the menu has changed
 * to cook it: it is offered back like any other. And a tick is about one line
 * of ONE list: it is kept only if that build's own snapshot holds it, and its
 * line is still on the draft. A tick made for another week's list — the next
 * one, built ahead — is not this build's, however alike the line's key.
 */
export function startRows(saved: InventoryItem[], draft: Pick<ListItem, 'key' | 'item' | 'qty'>[], counts: boolean, prior: PriorBuild | null = null): InventoryItem[] {
  const amount = new Map(draft.map((l) => [l.key, l.qty]))
  const items = new Set(draft.map((l) => norm(l.item)))
  const shown = prior?.items ? new Set(prior.items.map((l) => norm(l.item))) : null
  const ticked = new Map((prior?.inventory ?? []).flatMap((r) => (r.covers !== undefined ? [[r.covers, r.qty] as const] : [])))
  return saved.filter((r) => {
    // A tick is an amount of its line, so it rides at that amount whatever the
    // line asks for now — a part-tick stays a part-tick, and a line that has
    // grown buys the difference (the solver, Codex r3, r12).
    // The amount is the PRIOR build's own: the household's row may since have
    // been re-ticked, bigger, for another week's list under the same key, and
    // that says nothing about this one (Codex r4).
    if (isTick(r)) { const now = amount.get(r.covers as string), was = ticked.get(r.covers as string); return was !== undefined && now !== undefined && r.qty === was }
    if (!items.has(norm(r.item))) return true
    return counts && (!shown || shown.has(norm(r.item)))
  })
}

/** The draft a step 2 was working on, as one string: its lines and their amounts. Rows held for one draft are never given back to another — a meal edited between two visits changes the list under the same nights (Codex r4). */
export const draftSignature = (draft: Pick<ListItem, 'key' | 'qty'>[]): string => JSON.stringify(draft.map((l) => [l.key, l.qty]))

/**
 * A line ticked "have it": covered whole. The stock rows are left as they are,
 * so an undo finds them — the solver spends them on this line first, and the
 * tick covers the rest (Codex r7). So the tick's amount is THE REST: `left`,
 * what the line still buys with the rows as they stand. The whole line's
 * amount would count the stock a second time the day the line grew — a pound
 * typed, then ticked, then servings doubled (Codex r13). And the rest is ADDED
 * to a tick the line already carries — a part-tick from an earlier build, now
 * short because the line grew — never put in its place, or tapping "have it"
 * on a line buying its last 8 oz would forget the 24 already ticked (Codex
 * r14). With no `left` given the tick is the whole line, outright.
 */
export function markHave(rows: InventoryItem[], line: Pick<ListItem, 'key' | 'item' | 'qty' | 'unit'>, left?: number): InventoryItem[] {
  const already = rows.find((r) => r.covers === line.key)?.qty ?? 0
  const qty = left === undefined ? line.qty : Math.round((already + left) * 100) / 100
  return [...rows.filter((r) => r.covers !== line.key), { item: line.item, qty, unit: line.unit, covers: line.key }]
}

/**
 * The second tap on a line that shows as had. A tick comes off and NOTHING
 * else does: the pound typed into "have some" before the tick was still real,
 * and undoing the tick is not a statement about it (Codex r4). Only a line
 * with no tick — one the stock alone covers — is put back by taking the stock
 * as gone, because then the stock is the only thing the tap can be about.
 *
 * `others` are the OTHER lines of that ingredient, with how they stood — the
 * first trip's tomatoes, when it is the second trip's being put back. The tap
 * was about one line, so what the stock was doing for the rest is kept: a
 * line it covered whole is ticked in its own right (Codex r8), and a line it
 * covered in part is ticked for that part (Codex r10, r11) — so each other
 * line buys exactly what it did, and nothing nobody said was gone is bought back.
 */
export function putBack(rows: InventoryItem[], line: Pick<ListItem, 'key' | 'item'>, others: Array<{ line: Pick<ListItem, 'key' | 'item' | 'qty' | 'unit'>; state: LineState }> = []): InventoryItem[] {
  if (rows.some((r) => r.covers === line.key)) return rows.filter((r) => r.covers !== line.key)
  const same = others.filter((o) => o.line.key !== line.key && norm(o.line.item) === norm(line.item))
  let next = clearLine(rows, line)
  for (const o of same) {
    if (o.state.have) { next = markHave(next, o.line); continue }
    // What was covered of this line stays covered, ON THIS LINE: a tick for
    // that amount. Left as stock it would be spent on whichever line the
    // store walk reaches first — the very line just put back (Codex r11).
    const covered = Math.round((o.line.qty - o.state.buying) * 100) / 100
    if (covered > 0) next = [...next.filter((r) => r.covers !== o.line.key), { item: o.line.item, qty: covered, unit: o.line.unit, covers: o.line.key }]
  }
  return next
}

/**
 * A line cleared outright: its tick goes, and so does any stock of that
 * ingredient. After this the line is bought in full. What "have some" builds
 * on, and what a tap does to a line the stock alone covers.
 */
export function clearLine(rows: InventoryItem[], line: Pick<ListItem, 'key' | 'item'>): InventoryItem[] {
  return rows.filter((r) => (isTick(r) ? r.covers !== line.key : !sameItem(r, line)))
}

/**
 * The unit "have some" is counted in. The line's own — except that a line the
 * library measures in ounces is counted in POUNDS, because that is how a
 * freezer is counted and how the stock that lasts has always been saved
 * (Andrew, FOR-281: the meat lines "come in pounds"). The solver converts
 * between the two, so the row comes off the ounce line exactly.
 */
export const haveUnit = (line: Pick<ListItem, 'unit'>): string => (norm(line.unit) === 'oz' ? 'lb' : line.unit)

/**
 * "Have some": this much of the ingredient is on hand, in the line's have-unit.
 * It REPLACES what was on hand for that ingredient — the number typed is the
 * number in the freezer — and it is real stock, so what one line does not use
 * goes on to the next. Nothing, or a number that is not one, clears it.
 */
export function setSome(rows: InventoryItem[], line: Pick<ListItem, 'key' | 'item' | 'unit'>, qty: number): InventoryItem[] {
  // The number is EVERYTHING on hand of that ingredient: stock, this line's
  // tick, and any tick on its other lines — a part-tick left on the second
  // trip would come off on top of the pound just typed (Codex r12).
  const rest = rows.filter((r) => !sameItem(r, line))
  return Number.isFinite(qty) && qty > 0 ? [...rest, { item: line.item, qty, unit: haveUnit(line) }] : rest
}

/** The stock on hand for a line's ingredient, in its have-unit — what the "have some" box shows. Null when there is none in that unit. */
export function someQty(rows: InventoryItem[], line: Pick<ListItem, 'item' | 'unit'>): number | null {
  const mine = rows.filter((r) => !isTick(r) && sameItem(r, line) && norm(r.unit) === norm(haveUnit(line)))
  return mine.length ? Math.round(mine.reduce((n, r) => n + r.qty, 0) * 100) / 100 : null
}

/** What the household last saved for this ingredient, in the line's have-unit — offered back as "still have it?" when it did not count on its own. */
export const lastTime = (saved: InventoryItem[], line: Pick<ListItem, 'item' | 'unit'>): number | null => someQty(saved, line)

/** How a draft line stands with these rows on hand: covered, part covered, or bought in full. */
export interface LineState {
  /** Nothing to buy: ticked, or the stock on hand covers it. */
  have: boolean
  /** What is still bought, in the line's unit. */
  buying: number
  /** Why nothing is bought, in the solver's words. */
  reason?: string
}

/** Each draft line's state, read from the solve — never worked out a second way. */
export function lineStates(draft: ListItem[], solved: Pick<ShoppingList, 'items'>): Map<string, LineState> {
  const byKey = new Map(solved.items.map((l) => [l.key, l]))
  return new Map(draft.map((d) => {
    const l = byKey.get(d.key)
    return [d.key, l ? { have: l.stocked, buying: l.qty, reason: l.stocked_reason } : { have: false, buying: d.qty }]
  }))
}

/**
 * The staples as lines on the draft. The database is the only source of staple
 * lines on a built list (FOR-240, ruling A) and that does not change: these are
 * for showing what the list WILL carry, keyed exactly as the database keys
 * them, so a staple ticked "have it" here can be taken off the built list by
 * that key, through the guarded remove.
 */
export function stapleLines(staples: StapleRow[]): ListItem[] {
  return staples.map((s) => ({ key: customKey(s.id), item: s.item, qty: 0, unit: '', section: s.store_section, from: [], second_trip: false, inferred: false, stocked: false, checked: false, custom: 'staple' as const }))
}
