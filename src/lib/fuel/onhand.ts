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

/** The plan a build would REBUILD: its nights, and the rows on hand it was built with — its own snapshot. */
export interface PriorBuild {
  items: Pick<ListItem, 'item'>[]
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
  const shown = prior ? new Set(prior.items.map((l) => norm(l.item))) : null
  const ticked = new Set((prior?.inventory ?? []).flatMap((r) => (r.covers !== undefined ? [r.covers] : [])))
  return saved.filter((r) => {
    // ...and only while the line asks for no more than it did when it was
    // ticked: a tick was never a promise about a bigger amount (Codex r3).
    if (isTick(r)) { const now = amount.get(r.covers as string); return ticked.has(r.covers as string) && now !== undefined && r.qty >= now }
    if (!items.has(norm(r.item))) return true
    return counts && (!shown || shown.has(norm(r.item)))
  })
}

/** A line ticked "have it": covered whole, whatever was on hand for it before. Stock is left alone — it still goes to the lines that were not ticked. */
export function markHave(rows: InventoryItem[], line: Pick<ListItem, 'key' | 'item' | 'qty' | 'unit'>): InventoryItem[] {
  return [...rows.filter((r) => r.covers !== line.key), { item: line.item, qty: line.qty, unit: line.unit, covers: line.key }]
}

/**
 * A line put back on the list: its tick goes, and so does any stock of that
 * ingredient — the athlete has just said it is not there. After this the line
 * is bought in full, which is what makes the second tap an undo.
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
  const rest = clearLine(rows, line)
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
