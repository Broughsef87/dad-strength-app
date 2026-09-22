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

/** A change, and the account it was made by — fixed at the change. */
export type Change = Intent & { owner: Promise<string | null> }

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

// ── changes on their way to the row ──────────────────────────────────────────
let writing = 0
const mark = () => setUnloadGuard('objectives', writing > 0 || book().pending().length > 0)
/** Is a save on its way? Nothing is "saved" while one is. */
export const savingObjectives = () => writing > 0
/** The account making a change, fixed AT the change; `known` is never written to. */
export const changedBy = (known: string | null): Promise<string | null> =>
  accountAtChange(createClient(), { current: known })

/** A change made on any screen, against the objectives that screen showed. */
export function intend(c: Change) {
  book().intend(c)
  mark()
}

export type Landed = { day: string; ms: MindRow | null; seq: number }

/**
 * Every change the row does not have yet — the one just made AND any that
 * failed before it — written as one read-modify-write of the record per day,
 * inside the one queue. A failed change stays: the next change saves it, and so
 * does Retry, and opening a screen that shows objectives saves it.
 */
export async function flushObjectives(owner: Promise<string | null>): Promise<{ ok: boolean; landed: Landed[] }> {
  writing++
  mark()
  const supabase = createClient()
  const res = await runAs(supabase, owner, async (me) => {
    // A change made under another account is not this one's to save. One made
    // while no account was known is saved by the account that saves it — and
    // only onto a record holding the objectives it was made on.
    for (const c of book().pending()) { const who = await c.owner; if (who && who !== me) book().settle([c]) }
    const landed: Landed[] = []
    for (const day of book().days()) {
      const { data, error } = await supabase.from('daily_checkins').select('mind_state').eq('user_id', me).eq('date', day).maybeSingle()
      if (error) return { ok: false, landed }
      const seq = book().nextRead()
      const { write, settles } = book().plan(day, data?.mind_state ?? null)
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
      book().settle(settles)
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
