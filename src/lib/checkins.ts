'use client'

import { useRef } from 'react'
import { createClient } from '../utils/supabase/client'

/**
 * WRITE YOUR OWN FIELDS, NOT THE WHOLE ENTRY (FOR-231 v2, round 3).
 *
 * `daily_checkins.spirit_state` and `.mind_state` are each one jsonb column
 * with several writers. While every writer sent the whole entry, two that
 * overlap clobbered each other: tick a step, then leave a gratitude input
 * before that write lands, and the gratitude write carries the completion
 * flags it read BEFORE the tick. The tick is undone in the row while the
 * screen still shows it ticked.
 *
 * `checkin_patch` (supabase/migrations/20261003_checkin_set_path.sql) merges at
 * the path inside one INSERT ... ON CONFLICT DO UPDATE, whose right-hand side
 * reads the row inside the statement that writes it. Two concurrent calls to
 * different paths serialize on the row lock and the second applies to the
 * first's result. Neither needs to know the other exists and nothing has to
 * decide which of them wins — which is why this is a function and not a
 * queue, an outbox or a merge rule.
 *
 * THIS MODULE IS THE ONLY PLACE A CHECK-IN IS WRITTEN. Two components write
 * these columns and both own paths the other must not reach; the mapping from
 * writer to call belongs in one file so the two cannot drift apart.
 */
export type CheckinColumn = 'spirit_state' | 'mind_state'

/** One field and its new value. The path names at least one key — replacing a
 *  whole column is unrepresentable, by the function's own check. */
export type CheckinPatch = { path: string[]; value: unknown }

/**
 * Patch one check-in's fields. Returns whether the row took it.
 *
 * SEVERAL PATCHES ARE ONE STATEMENT, and that is the reason this takes a list
 * rather than a single path: `mind_state.objectives` and
 * `.completedObjectives` are paired BY INDEX. Written as two calls they are
 * two statements, and between them the row holds a new objective list against
 * the old list's flags.
 *
 * The row is addressed by `auth.uid()` inside the function, so there is no
 * user id to read first and none to pass. A caller with no session is refused
 * by the function (SQLSTATE 28000) and that arrives here as a failed write,
 * which is the same thing the screen already says.
 */
export async function patchCheckin(
  column: CheckinColumn,
  date: string,
  patches: CheckinPatch[],
): Promise<boolean> {
  if (patches.length === 0) return false
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('checkin_patch', {
      p_date: date,
      p_column: column,
      p_patches: patches,
    })
    return !error
  } catch { return false }
}

/**
 * ONLY THE NEWEST OPERATION MAY PAINT.
 *
 * A read that started before a write must not paint its stale row over the
 * write's result, and a read that started before a newer read must not paint
 * after it. Both are the same question — which of two in-flight operations
 * describes the screen now — and the answer never looks at their contents, so
 * there is nothing to compare, nothing to vouch for and nothing to negotiate:
 * the loser is DISCARDED, never queued and never replayed.
 *
 * WRITES TAKE A CLAIM AND NEVER CHECK IT. A write paints what it just put in
 * the row, so there is no older state it could be painting over. READS CHECK:
 * if anything claimed after the read started, the row it is holding is no
 * longer what the screen should show, and it paints nothing.
 *
 * Claim before the first await; a read checks before every setState that
 * follows one, except the one that stops the loading skeleton.
 */
export type PaintGate = {
  /** Take the newest claim. Everything claimed before it may no longer paint. */
  claim: () => number
  /** Is this claim still the newest? */
  mayPaint: (claim: number) => boolean
}

/**
 * The rule itself, as a plain factory holding one number.
 *
 * It is separated from the hook so it can be EXECUTED. This repo has no
 * component renderer, so an ordering rule written inside a component can only
 * be asserted by reading the source, and a source regex is satisfied by code
 * that is wired up wrong (FOR-256). As a factory it is ordinary JavaScript:
 * `scripts/checks/checkin-record.mjs` imports this and runs it.
 *
 * What that proves is the RULE, not its wiring. The claim/check calls inside
 * the two components are still only asserted by reading the source.
 */
export function paintGate(): PaintGate {
  let seq = 0
  return {
    claim: () => ++seq,
    mayPaint: (c) => c === seq,
  }
}

/** One gate per component, kept across renders. */
export function usePaintGate(): PaintGate {
  const gate = useRef<PaintGate | null>(null)
  if (gate.current === null) gate.current = paintGate()
  return gate.current
}
