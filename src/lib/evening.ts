// ── The evening review (FOR-332) ─────────────────────────────────────────────
// A short look back at the day before bed, modelled on the classic nightly
// review: where was I resentful, selfish, dishonest or afraid; do I owe an
// apology; am I carrying something I should talk over with someone; did I give
// more than I got; what could I have done better; and did I hit my one thing.
//
// NO AI ANYWHERE IN IT. It is a form. Every answer is a tap except the two
// optional lines, so a tired night is six taps and a save.
//
// It lives at daily_checkins.mind_state.evening, written through checkin_patch
// at the single path ['evening'], so it never touches the objectives keys the
// daily objectives card owns.
//
// This file is pure — no Supabase, no React — so scripts/checks/evening.mjs can
// execute it rather than read it.
import { localDayWithCutoff, localDayBefore } from '../utils/day'

export const SHORTFALLS = ['resentful', 'selfish', 'dishonest', 'afraid'] as const
export type Shortfall = (typeof SHORTFALLS)[number]

export type OneThing = 'yes' | 'partly' | 'no'
export const ONE_THING: readonly OneThing[] = ['yes', 'partly', 'no']

/** The longest either free-text line may be. One line, not a journal. */
export const LINE_MAX = 140

/** What the screen collects. `null` means not answered yet. */
export type EveningAnswers = {
  shortfalls: Shortfall[]
  apology: boolean | null
  apologyTo: string
  holding: boolean | null
  gaveMore: boolean | null
  better: string
  oneThing: OneThing | null
}

/** What the row holds. */
export type EveningEntry = {
  day: string
  shortfalls: Shortfall[]
  apology: boolean
  apologyTo: string | null
  holding: boolean
  gaveMore: boolean
  better: string | null
  oneThing: OneThing | null
  /** The objective the "one thing" answer was about, as it stood at save. */
  oneThingText: string | null
  savedAt: string
}

export const emptyAnswers = (): EveningAnswers => ({
  shortfalls: [], apology: null, apologyTo: '', holding: null, gaveMore: null, better: '', oneThing: null,
})

/**
 * THE EVENING'S DAY. The same 4am boundary the morning routine uses, so a
 * review done at 1am still belongs to the day it reviews.
 */
export const eveningDay = (d: Date = new Date()): string => localDayWithCutoff(4, d)

/** The card shows from 5pm until the 4am boundary. */
export const inEveningWindow = (d: Date = new Date()): boolean => d.getHours() >= 17 || d.getHours() < 4

/**
 * The day whose review a MORNING should read: the calendar day before.
 * Before 4am it is still "last night", so the review is today's evening day
 * and there is nothing to carry yet — return null.
 */
export const lastNightDay = (d: Date = new Date()): string | null =>
  d.getHours() < 4 ? null : localDayBefore(d)

const clip = (s: string): string => s.trim().replace(/\s+/g, ' ').slice(0, LINE_MAX)

/**
 * Ready to save? The four tap questions need an answer; the one-thing question
 * only when there was an objective to ask about. The two lines are optional.
 */
export function isComplete(a: EveningAnswers, hasOneThing: boolean): boolean {
  return a.apology !== null && a.holding !== null && a.gaveMore !== null && (!hasOneThing || a.oneThing !== null)
}

/** The entry a save writes. Throws on an incomplete form: the button cannot reach it. */
export function toEntry(a: EveningAnswers, day: string, oneThingText: string | null, now: Date = new Date()): EveningEntry {
  if (!isComplete(a, oneThingText !== null)) throw new Error('evening review is not complete')
  const shortfalls = SHORTFALLS.filter((s) => a.shortfalls.includes(s))
  return {
    day,
    shortfalls,
    apology: a.apology as boolean,
    apologyTo: a.apology && clip(a.apologyTo) ? clip(a.apologyTo) : null,
    holding: a.holding as boolean,
    gaveMore: a.gaveMore as boolean,
    better: clip(a.better) || null,
    oneThing: oneThingText !== null ? a.oneThing : null,
    oneThingText,
    savedAt: now.toISOString(),
  }
}

/** Read a stored entry back, or null if the row holds nothing usable for `day`. */
export function readEntry(raw: unknown, day: string): EveningEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.day !== day) return null
  if (typeof r.apology !== 'boolean' || typeof r.holding !== 'boolean' || typeof r.gaveMore !== 'boolean') return null
  const shortfalls = Array.isArray(r.shortfalls) ? SHORTFALLS.filter((s) => (r.shortfalls as unknown[]).includes(s)) : []
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? clip(v) : null)
  return {
    day,
    shortfalls,
    apology: r.apology,
    apologyTo: str(r.apologyTo),
    holding: r.holding,
    gaveMore: r.gaveMore,
    better: str(r.better),
    oneThing: ONE_THING.includes(r.oneThing as OneThing) ? (r.oneThing as OneThing) : null,
    oneThingText: str(r.oneThingText),
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : '',
  }
}

/** A saved entry back into the form, for editing. */
export const toAnswers = (e: EveningEntry): EveningAnswers => ({
  shortfalls: [...e.shortfalls], apology: e.apology, apologyTo: e.apologyTo ?? '', holding: e.holding,
  gaveMore: e.gaveMore, better: e.better ?? '', oneThing: e.oneThing,
})

/** The day's first objective — "your one thing" — or null when none was set. */
export function firstObjective(mind: unknown): string | null {
  const objs = (mind as { objectives?: unknown } | null)?.objectives
  if (!Array.isArray(objs)) return null
  const first = objs.find((o): o is string => typeof o === 'string' && o.trim() !== '')
  return first ? first.trim() : null
}

/** What last night hands this morning. */
export type CarryOver = {
  /** The one thing to offer again: it slipped or only partly landed. */
  oneThing: string | null
  /** An apology is owed. `to` is who, when the review said. */
  apology: { to: string | null } | null
  /** Something was being carried that should be talked over. */
  holding: boolean
}

export function carryOver(lastNightMind: unknown, lastNight: string): CarryOver | null {
  const e = readEntry((lastNightMind as { evening?: unknown } | null)?.evening, lastNight)
  if (!e) return null
  const oneThing = e.oneThingText && (e.oneThing === 'partly' || e.oneThing === 'no') ? e.oneThingText : null
  const apology = e.apology ? { to: e.apologyTo } : null
  if (!oneThing && !apology && !e.holding) return null
  return { oneThing, apology, holding: e.holding }
}

// ── On awakening (FOR-332) ───────────────────────────────────────────────────
// The other half of the same passage, at the top of the morning: the day
// ahead, one line asking that the day's thinking stay free of self-pity,
// dishonesty and self-seeking, and whatever last night handed over. It sits
// BEFORE the morning routine and is not part of its AI call — nothing here is
// generated. Ticking the line writes spirit_state.awakening for the morning's
// day (the same 4am boundary as the routine).

// Andrew's wording, 2026-11-01: reference "before we begin, we ask God to
// direct our thinking".
export const AWAKENING_ANCHOR = 'Before we begin, we ask God to direct our thinking.'
export const AWAKENING_LINE = 'Free of self-pity, dishonesty and self-seeking.'

/** The card shows from the 4am boundary until noon. */
export const inMorningWindow = (d: Date = new Date()): boolean => d.getHours() >= 4 && d.getHours() < 12

/** The morning's day: the routine's own boundary. */
export const morningDay = (d: Date = new Date()): string => localDayWithCutoff(4, d)

export type Awakening = { day: string; at: string }

export function readAwakening(raw: unknown, day: string): Awakening | null {
  const r = raw as { day?: unknown; at?: unknown } | null
  return r && r.day === day && typeof r.at === 'string' ? { day, at: r.at } : null
}

/** "The 24 hours ahead" for training, from the week's own counts. */
export function trainingAhead(program: string | null, done: number, prescribed: number): string {
  if (!program) return 'No program running. Pick one when you get a minute.'
  if (prescribed > 0 && done >= prescribed) return `${program}: this week's sessions are done.`
  return `${program}: session ${done + 1} of ${prescribed} this week.`
}
