// ── The day's objectives: ONE outbox per tab (FOR-231) ───────────────────────
// Two screens change the day's objectives — the objectives card and the morning
// protocol's Goals step — and each used to write the row itself, so a Goals save
// that failed was remembered by nothing and its objectives were lost the moment
// the paint was replaced (Codex r7). There is one outbox now: wherever a change
// is made, it is an intent against the record here, kept until the row has it,
// written through the one check-in queue, and shown by whichever screen is up.
//
// It is a module, so it outlives the component the change was made on — moving
// to another page in the app unmounts that component and the change stays. Its
// book is made on first use, which is a click or an effect, never a render, so
// a server render cannot make one and hand one visitor's changes to the next.
import { createClient } from '../utils/supabase/client'
import { accountAtChange, runAs } from './checkinQueue'
import { fromRow, objectivesBook, toRow, type Intent, type MindRow } from './objectivesRecord'
import { localDay } from '../utils/day'
import { setUnloadGuard } from './unloadGuard'

/**
 * A change, the account it was made by — fixed at the change — and which run of
 * this tab it was made in. `owner` can resolve to null: the change was made
 * while nothing could reach the server to say who was signed in. Such a change
 * is this run's, and only this run's — after another account signs in it is
 * NOT theirs to save, whatever their row happens to hold (Codex r10, P1).
 */
export type Change = Intent & { owner: Promise<string | null>; run?: number }

const makeBook = () => objectivesBook<Change>(localDay())
let theBook: ReturnType<typeof makeBook> | null = null
export const book = () => (theBook ??= makeBook())

// ── the paint ────────────────────────────────────────────────────────────────
// What this device last saw, for an instant first frame. Never read by anything
// that decides or saves, and replaced by whatever the row says.
const MIND_KEY = 'dad-strength-mind-state'
/** The painted objectives for `day`, if this device has them. */
export function paintedMind(day: string): unknown | null {
  try {
    const cached = localStorage.getItem(MIND_KEY)
    if (!cached) return null
    const data = JSON.parse(cached)
    return data?.date === day ? data : null
  } catch { return null }
}
/** What the row says for `day` — including that it says nothing. */
export function paintMind(day: string, ms: unknown) {
  try {
    if (ms) localStorage.setItem(MIND_KEY, JSON.stringify(toRow(day, fromRow(ms))))
    else localStorage.removeItem(MIND_KEY)
  } catch { /* paint only */ }
}

// ── who is showing it ────────────────────────────────────────────────────────
// Two screens show the day's objectives and both change them, so what either
// shows has to be what the outbox holds — not a copy taken when it last
// rendered. A tick is applied to the objective the athlete is looking at, and
// with a stale copy that was a different objective (Codex r8).
const readers = new Set<() => void>()
/** Called whenever the objectives here change, for as long as you keep it. */
export function onObjectives(fn: () => void): () => void {
  readers.add(fn)
  return () => { readers.delete(fn) }
}

// ── whose tab this is ────────────────────────────────────────────────────────
// The account a screen has confirmed here. A different one signing in starts a
// new run: nothing made in the old one is the new account's to save.
let account: string | null = null
let run = 0
export function accountIs(me: string) {
  if (account !== null && account !== me) run++
  account = me
}

// ── changes on their way to the row ──────────────────────────────────────────
let writing = 0
const mark = () => {
  setUnloadGuard('objectives', writing > 0 || book().pending().length > 0)
  for (const fn of [...readers]) fn()
}
/** Is a save on its way? Nothing is "saved" while one is. */
export const savingObjectives = () => writing > 0
/** The account making a change, fixed AT the change; `known` is never written to. */
export const changedBy = (known: string | null): Promise<string | null> =>
  accountAtChange(createClient(), { current: known })

/** A change made on any screen, against the objectives that screen showed. */
export function intend(c: Change) {
  c.run = run
  book().intend(c)
  mark()
}

export type Landed = { day: string; ms: MindRow | null; seq: number }
/** What a save did: whether the row has what it carried, and what landed. */
export type Saved = { ok: boolean; landed: Landed[] }
/**
 * Was this change discarded — the objectives it was made against replaced, here
 * or on another device? Asked of the BOOK, not of one save's report: a change
 * can be overtaken by a row read that lands while its save is still queued, and
 * then no save reports it at all (Codex r9).
 */
export const wasDropped = (c: Change) => book().discarded(c)

/**
 * Every change the row does not have yet — the one just made AND any that
 * failed before it — written as one read-modify-write of the record per day,
 * inside the one queue. A failed change stays: the next change saves it, and so
 * does Retry, and opening a screen that shows objectives saves it.
 */
export async function flushObjectives(owner: Promise<string | null>): Promise<Saved> {
  writing++
  mark()
  const supabase = createClient()
  const res = await runAs(supabase, owner, async (me) => {
    accountIs(me)
    // A change made under another account is not this one's to save — and one
    // nobody could name an account for belongs to the run it was made in, not
    // to whoever signs in next (Codex r10, P1). Objectives are private: a
    // `set` made in one run fits any account whose row is empty, so text
    // matching is no kind of ownership.
    for (const c of book().pending()) {
      const who = await c.owner
      if (who === null ? c.run !== run : who !== me) book().settle([c], 'dropped')
    }
    const landed: Landed[] = []
    for (const day of book().days()) {
      const { data, error } = await supabase.from('daily_checkins').select('mind_state').eq('user_id', me).eq('date', day).maybeSingle()
      if (error) return { ok: false, landed }
      const seq = book().nextRead()
      const { write, applied, dead } = book().plan(day, data?.mind_state ?? null)
      let ms = (data?.mind_state ?? null) as MindRow | null
      if (write) {
        const row = toRow(day, write)
        const w = await supabase.from('daily_checkins').upsert(
          { user_id: me, date: day, mind_state: row, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' },
        )
        if (w.error) return { ok: false, landed }
        ms = row
      }
      // A change the record overtook — the objectives it was made against are
      // gone, replaced here or on another device. It is not saved, and saying
      // "saved" is the one answer that cannot be true (Codex r8).
      book().settle(applied, 'saved')
      book().settle(dead, 'dropped')
      landed.push({ day, ms, seq })
    }
    return { ok: true, landed }
  }).catch(() => ({ ok: false, landed: [] as Landed[] }))
  writing--
  // No `ok`: the account that made the change is not the one signed in.
  const out = 'ok' in res ? res : { ok: false, landed: [] as Landed[] }
  for (const l of out.landed) if (book().adopt(l.day, l.ms, l.seq)) paintMind(l.day, l.ms)
  mark()
  return out
}

/** A row read landed: it becomes the record unless a later read already has. */
export function adoptRead(day: string, ms: unknown, seq: number, load = false) {
  if (book().adopt(day, ms, seq, load)) paintMind(day, ms)
  mark()
}
