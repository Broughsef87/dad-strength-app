'use client'

// ── /fuel — the Pro anchor, Phase 1: plan + list ────────────────────────────
// Intake (taps and numbers) → pick the nights → the checklist. Behind
// PremiumGate. The solver is pure (src/lib/fuel/solve.ts); this page is the
// I/O around it. Every rule or plan change writes version + 1 and keeps the
// old versions (L6, L7). Check state is row-authoritative (ticks.ts).
//
// THE CYCLE MODEL (FOR-233): the page shows ONE cycle at a time — `plan`, the
// selected cycle, which defaults to today's live cycle `live` and is always one
// tap from it — and says which; the page does NOT re-read on waking or
// reconnecting — the row is the only truth — and the database refuses a tick on
// a superseded list (fuel_set_item_checked, SQLSTATE FU001), on which the page
// re-reads both and moves to the newer list, never changing the selection
// unless it has expired; a re-read that fails is shown and keeps the
// checklist paused until a retry succeeds.
//
// ROTATIONS (FOR-238), on that sentence and not beside it: a rotation is not a
// second thing the page shows. It is where the builder STARTS a version of the
// selected cycle — each meal at its rotation's default week, the plan's own
// week the athlete's — and which rotation a plan ran is read from its own
// picks, never stored beside them. Switching rotation builds the selected
// cycle's next version, so the list regenerates under the same sentence; a new
// cycle starts from the rotation the cycle before it did not run.
//
// Why no wake refresh: it only ever made staleness visible, and its
// interleavings with navigation and with itself cost four Codex rounds
// (FOR-177 r17–19, FOR-233 r1–3); the guard makes the write correct without
// it. A household changed in another tab is seen on reload, or when a tick
// is refused.
//
// The transition: a page loaded before this change keeps its old code until
// it reloads; its ticks still go through the database, which now refuses one
// on a superseded list, and that old page shows the refusal as "not saved ·
// tap again" until it reloads. Nothing is lost that was not already dead.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'
import BottomNav from '../../components/BottomNav'
import PremiumGate from '../../components/PremiumGate'
import IntakeForm from '../../components/fuel/IntakeForm'
import PlanBuilder from '../../components/fuel/PlanBuilder'
import Checklist from '../../components/fuel/Checklist'
import type { Household, ListItem, MealRow, Plan, RotationMealRow, RotationRow } from '../../lib/fuel/types'
import {
  DEFAULT_HOUSEHOLD, createVersion, isMissingTable, loadActive, loadHousehold, loadListFor, loadMeals, loadRotations, loadVersions,
  readItems, saveHousehold, setItemChecked, type ListRow, type PlanRow,
} from '../../lib/fuel/store'
import { changed, inventoryFresh, listUnchanged } from '../../lib/fuel/version'
import { buildShoppingList, householdFor, inventoryWarnings, validatePlan } from '../../lib/fuel/solve'
import { activeCycle, cycleKeyFor, expired, newestVersion, nextCycleKey, nextCycleStart, planningMode, rebuildKey, upcomingCycle, type CycleRow } from '../../lib/fuel/cycle'
import { builderStart } from '../../lib/fuel/rotation'

type Step = 'intake' | 'plan' | 'list'

const asCycle = (p: PlanRow): CycleRow => ({ week_start: p.week_start, version: p.version, shop_cadence_days: Number(p.rules_snapshot?.shop_cadence_days ?? 7) })

export default function FuelPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meals, setMeals] = useState<MealRow[]>([])
  // The rotations and their membership (FOR-238): library data, read once
  // like the meals. Not a selection — nothing here says which rotation the
  // page is on; a plan's rotation is read from its picks.
  const [rotations, setRotations] = useState<RotationRow[]>([])
  const [members, setMembers] = useState<RotationMealRow[]>([])
  const [household, setHousehold] = useState<Household | null>(null)
  // `plan` is the SELECTED cycle; `live` is today's live cycle, held apart so
  // the way back to it always exists (FOR-233, finding 2).
  const [plan, setPlan] = useState<PlanRow | null>(null)
  const [live, setLive] = useState<PlanRow | null>(null)
  const [list, setList] = useState<ListRow | null>(null)
  const [upcoming, setUpcoming] = useState<PlanRow | null>(null)
  // Every cycle from five weeks back, all versions — the rules that look
  // across cycles (the monthly steak allowance) read it (Codex, round 10).
  const [recent, setRecent] = useState<PlanRow[]>([])
  const [householdSavedAt, setHouseholdSavedAt] = useState<string | null>(null)
  const [newestPlanAt, setNewestPlanAt] = useState<string | null>(null)
  const [newestPlanKnown, setNewestPlanKnown] = useState(false)
  // THE GENERATION: one counter, moved by every refresh start and by every
  // path that changes the page outside a refresh — a navigation, a build, a
  // household save. A refresh takes the generation when it starts and, after
  // every await, applies NOTHING if it has moved: not its data, not its
  // failure state, not its cleanup. Only the newest refresh ever speaks; a
  // refresh voided by anything else has its pause lifted by that thing. This
  // is the writes epoch of round 18 widened to navigation and to refreshes
  // overlapping each other (FOR-233, Codex rounds 1 and 2).
  const genRef = useRef(0)
  // The page is re-reading the household and the plan — on waking, on
  // reconnect — and the checklist sends nothing until it has (Codex, round
  // 17). A re-read that FAILED is a state of its own: shown, retryable, and
  // the checklist stays paused until a retry succeeds (FOR-233, finding 1).
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [versions, setVersions] = useState<number[]>([])
  const [step, setStep] = useState<Step>('intake')
  const [busy, setBusy] = useState(false)
  // Rebuild the live cycle, or plan the NEXT one? On a cycle's final day —
  // the Sunday before the next Monday — the default is the next cycle; a
  // rebuild that kept the old start would be live for a day and gone
  // (Codex, round 3). The athlete can flip it either way.
  const [nextCycle, setNextCycle] = useState(false)
  const liveCycle: CycleRow | null = plan ? asCycle(plan) : null
  // The identity the checklist keys on. Callbacks depend on THIS, not on the
  // list object, so a row update never recreates them and never re-triggers
  // the checklist's reconciliation (Codex, round 1).
  const listId = list?.id ?? null

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id)
      const [m, h, active, rot] = await Promise.all([loadMeals(supabase), loadHousehold(supabase, user.id), loadActive(supabase, user.id, new Date()), loadRotations(supabase)])
      if (cancelled) return
      const err = m.error ?? h.error ?? active.error ?? rot.error
      if (isMissingTable(err)) { setNotReady(true); setLoading(false); return }
      if (err) setError(err.message ?? 'could not load')
      setMeals(m.meals); setRotations(rot.rotations); setMembers(rot.members)
      setHousehold(h.household); setHouseholdSavedAt(h.updatedAt)
      setPlan(active.plan); setLive(active.plan); setList(active.list); setUpcoming(active.upcoming); setRecent(active.recent); setNewestPlanAt(active.newestPlanAt); setNewestPlanKnown(active.newestPlanKnown)
      if (active.plan) {
        setVersions((await loadVersions(supabase, user.id, active.plan.week_start)).map((v) => v.version))
        setNextCycle(planningMode(asCycle(active.plan), new Date()) === 'next' && !active.upcoming)
      }
      // A persisted list whose household has since changed opens on the
      // plan step, not on the stale list.
      const persistedStale = !!(active.plan && h.household && changed(active.plan.rules_snapshot, h.household, { entries: active.plan.meal_ids }))
      setStep(active.list && !persistedStale ? 'list' : h.household ? 'plan' : 'intake')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, router])

  // Re-read the household and the plan — when the database refuses a tick on
  // a superseded list, and on the retry of a re-read that failed. NOT on
  // waking or reconnecting: that wake refresh (Codex, round 17) is deleted
  // (FOR-233, Codex r3) — see the model above. Not while a build or a save is
  // in flight, and applied only if nothing moved meanwhile — a write, a
  // navigation, a newer refresh (round 18; FOR-233, Codex r2). The
  // cycle the athlete SELECTED — opened ahead, or built early — stays
  // selected at its newest version while it is still live or ahead; only an
  // expired selection gives way to today's live cycle (round 18). The
  // checklist is paused until the read lands.
  const busyRef = useRef(busy)
  busyRef.current = busy
  // The selection and the list, as refs: the refresh is not re-created when
  // they change, so it reads them here — the selection when it starts, under
  // the generation, which guarantees no navigation lands between that read
  // and its apply; the list when a refused tick answers (Codex r1, r2).
  const selectedStartRef = useRef<string | null>(null)
  selectedStartRef.current = plan?.week_start ?? null
  const listIdRef = useRef<string | null>(null)
  listIdRef.current = listId
  // Every path that changes the page outside a refresh passes through here
  // AS IT APPLIES. It moves the generation — a refresh in flight applies
  // nothing from here on — and lifts that refresh's pause, which has no owner
  // any more. A navigation also writes the selection it lands on, so a
  // refresh starting before the page has redrawn reads the new one (Codex r2).
  const moved = (selected?: PlanRow | null) => {
    genRef.current += 1
    if (selected !== undefined) selectedStartRef.current = selected?.week_start ?? null
    setRefreshing(false)
  }
  const refresh = useCallback(async () => {
    if (!userId || busyRef.current) return
    // This refresh's generation, and the selection it serves: moved by any
    // later refresh, navigation, build or save, after which this one applies
    // nothing — checked after every await.
    genRef.current += 1
    const gen = genRef.current
    const start = selectedStartRef.current
    setRefreshing(true)
    try {
      const now = new Date()
      const [h, active] = await Promise.all([loadHousehold(supabase, userId), loadActive(supabase, userId, now)])
      // Something moved meanwhile: this read is stale and whatever moved is
      // current — not a failure, just discarded.
      if (gen !== genRef.current) return
      // The read failed: shown, and the checklist stays paused until a retry
      // succeeds — ticks never resume on a guess (FOR-233, finding 1).
      if (h.error || active.error) { setRefreshFailed(true); return }
      const kept = start ? newestVersion(active.recent, start) : null
      const nextPlan = kept && !expired(asCycle(kept), now) ? kept : active.plan
      const nextList = nextPlan ? (nextPlan.id === active.plan?.id ? active.list : await loadListFor(supabase, nextPlan.id)) : null
      if (gen !== genRef.current) return
      setHousehold(h.household); setHouseholdSavedAt(h.updatedAt)
      setPlan(nextPlan); setLive(active.plan); setList(nextList); setRecent(active.recent); setNewestPlanAt(active.newestPlanAt); setNewestPlanKnown(active.newestPlanKnown)
      setUpcoming(active.upcoming && active.upcoming.week_start !== nextPlan?.week_start ? active.upcoming : null)
      setRefreshFailed(false)
      const persistedStale = !!(nextPlan && h.household && changed(nextPlan.rules_snapshot, h.household, { entries: nextPlan.meal_ids }))
      setStep((s) => (s === 'list' && (!nextList || persistedStale) ? 'plan' : s))
      if (nextPlan) {
        const vs = await loadVersions(supabase, userId, nextPlan.week_start)
        if (gen !== genRef.current) return
        setVersions(vs.map((v) => v.version))
      }
    } finally { if (gen === genRef.current) setRefreshing(false) }
  }, [supabase, userId])

  const onSaveHousehold = async (h: Household) => {
    if (!userId) return
    setBusy(true); setError(null)
    const { error: e } = await saveHousehold(supabase, userId, h)
    setBusy(false)
    if (e) { setError(e.message); return }
    moved()
    setHousehold(h); setHouseholdSavedAt(new Date().toISOString())
    // A rule change invalidates the list (L7): if a version exists and the
    // household differs from its snapshot, the next build writes version + 1.
    setStep('plan')
  }

  // Where a build lands, for `now`. A regeneration stays in the live cycle
  // — unless the cadence shortened past today, when it is a fresh cycle
  // keyed on this week (Codex, round 4). The next cycle starts where the
  // live one ends, or IS the cycle already planned ahead, so building twice
  // makes a version, not a second start. A fresh start keys on this week.
  // A next-cycle target that expired while the page sat open advances to
  // the cycle that covers today (Codex, round 9). Decided at BUILD time,
  // never cached from a render.
  const buildTarget = (now: Date): string => {
    if (!household) return cycleKeyFor(null, now)
    const next = !!(liveCycle && nextCycle)
    return next && liveCycle
      ? nextCycleKey(liveCycle, upcoming?.week_start ?? null, household.shop_cadence_days, now)
      : liveCycle ? rebuildKey(liveCycle, household.shop_cadence_days, now) : cycleKeyFor(null, now)
  }

  // Whether to count what is on hand is ASKED for anything but a rebuild of
  // a plan that already counted it — judged on the start the build would
  // actually land on: a fortnight shortened to weekly in its second week is
  // a NEW start under rebuildKey, and what week one ate is not on hand
  // (Codex, rounds 15 to 18). A next cycle, a rebuild of a plan built
  // without it, and a fresh start after a cycle expired all ask. The ask
  // defaults to the inventory's freshness; the saved choice stands unless
  // the athlete changes it.
  const startingNextNow = !!(liveCycle && nextCycle)
  const rebuildOfCounted = (start: string) => !!plan && !startingNextNow && start === plan.week_start && (plan.rules_snapshot?.inventory_counted ?? true)
  const askInventory = (household?.inventory.length ?? 0) > 0 && !rebuildOfCounted(buildTarget(new Date()))

  // Where the builder STARTS (FOR-238), decided in rotation.ts on the start
  // the build lands on — never on which toggle is set: picks already saved for
  // that start (the selected cycle rebuilt, or the cycle planned ahead), or
  // else the rotation the cycle before it did not run. A cadence shortened
  // into a new week is a new cycle, not a rebuild (Codex, FOR-238 r1). Before
  // the rotations migration is applied: the selected cycle's picks, as before.
  const startEntries = (targetStart: string, h: Household): Plan | null => {
    const entries = builderStart(targetStart, recent, rotations, members, meals, h, plan ? plan.meal_ids : null)
    return entries ? { entries } : null
  }

  const onBuild = async (p: Plan, opts: { countInventory: boolean }) => {
    if (!userId || !household) return
    const startingNext = !!(liveCycle && nextCycle)
    const weekStart = buildTarget(new Date())
    // The ask is judged again at build time, on the start the build lands
    // on: a page left open across a boundary was drawn for another target
    // (Codex, round 18). If the answer changed, nothing is built — the page
    // redraws with the ask where it now belongs.
    const askNow = household.inventory.length > 0 && !rebuildOfCounted(weekStart)
    if (askNow !== askInventory) { setError('the cycle has moved on since this page was drawn — check what is on hand, then build again'); return }
    // What is on hand counts only on say-so wherever the ask was shown —
    // otherwise always (Codex, rounds 15 and 16). Recorded in the snapshot,
    // so the plan is compared the way it was built.
    const inventoryCounted = askNow ? opts.countInventory : true
    // Validated again HERE, against the target the build actually lands on:
    // a builder left open across a cycle boundary was enabled against a
    // target that has since moved, with a different history around it
    // (Codex, round 14). Refused with the warnings, never saved.
    const late = validatePlan(p, meals, household, { cycles: { history: recent, targetStart: weekStart, cadenceDays: household.shop_cadence_days } })
    if (late.length) { setError(late.join(' · ')); return }
    // The unchanged-plan shortcut is a regeneration shortcut only: the next
    // cycle is always a new version under a new start — and so is a cycle
    // that expired while the page stayed open (Codex, round 8). The list is
    // reused only while its start is still the one a rebuild would get —
    // and only when a fresh solve comes out identical, because the library
    // itself can have been corrected since (Codex, round 11).
    if (!startingNext && plan && list && plan.week_start === weekStart && !changed(plan.rules_snapshot, household, p) && (plan.rules_snapshot?.inventory_counted ?? true) === inventoryCounted && listUnchanged(buildShoppingList(householdFor(household, inventoryCounted), meals, p).items, list.items)) { setStep('list'); return }
    setBusy(true); setError(null)
    const res = await createVersion(supabase, weekStart, household, meals, p, inventoryCounted)
    setBusy(false)
    if (res.error || !res.plan || !res.list) { setError(res.error?.message ?? 'could not build the list'); return }
    const built = res.plan
    moved(built)
    setPlan(built); setList(res.list); setRecent((r) => [...r, built]); setNewestPlanAt(built.created_at ?? new Date().toISOString()); setNewestPlanKnown(true)
    // `live` is today's live cycle BY DATE, never "whatever was just built":
    // a rebuild of the cycle selected ahead must not become this week, and
    // the way back stays on the page (FOR-233, finding 2; Codex r1).
    setLive(activeCycle([...recent, built].map((r) => ({ ...r, ...asCycle(r) })), new Date()))
    if (upcoming && (upcoming.week_start === weekStart || weekStart > upcoming.week_start)) setUpcoming(null)
    setVersions((await loadVersions(supabase, userId, weekStart)).map((v) => v.version))
    setNextCycle(false)
    setStep('list')
  }

  // Resume the cycle planned ahead (Codex, round 4). The live cycle stays
  // held; "back to this week" brings it back (FOR-233, finding 2).
  const openUpcoming = async () => {
    if (!upcoming || !userId) return
    const l = await loadListFor(supabase, upcoming.id)
    moved(upcoming)
    setPlan(upcoming); setList(l); setUpcoming(null); setNextCycle(false)
    setVersions((await loadVersions(supabase, userId, upcoming.week_start)).map((v) => v.version))
    setStep(l ? 'list' : 'plan')
  }
  // The way back: from any selection made ahead of it, this week's cycle is
  // one tap away, and the cycle just left is offered ahead again.
  const openLive = async () => {
    if (!live || !userId) return
    const l = await loadListFor(supabase, live.id)
    moved(live)
    setPlan(live); setList(l); setNextCycle(false)
    setUpcoming(upcomingCycle(recent.map((r) => ({ ...r, ...asCycle(r) })), new Date()))
    setVersions((await loadVersions(supabase, userId, live.week_start)).map((v) => v.version))
    setStep(l ? 'list' : 'plan')
  }

  const send = useCallback(async (key: string, checked: boolean) => {
    if (!listId) return null
    const { items, error: e, superseded } = await setItemChecked(supabase, listId, key, checked)
    // The database refused the tick because this list's cycle has a newer
    // version (FOR-233, the write-side guard): the page re-reads and moves to
    // it — only while this list is still the one selected; a refusal from a
    // list the athlete has since left steers nothing (Codex r1). The tick is
    // not retried against a list that is already dead.
    if (superseded && listIdRef.current === listId) void refresh()
    return e ? null : items
  }, [supabase, listId, refresh])
  const refetch = useCallback(async () => (listId ? readItems(supabase, listId) : null), [supabase, listId])
  // An answer belongs to the list that asked. A tick still in flight when
  // the plan is rebuilt must not land its old list's items on the new one
  // (Codex, round 2).
  const onRowItems = useCallback((forListId: string, items: ListItem[]) => setList((l) => (l && l.id === forListId ? { ...l, items } : l)), [])
  // A list is STALE when the household has changed since it was solved — a
  // rule change invalidates the list (L7), on load as much as on save. A
  // stale list is not ticked from; it is rebuilt.
  const stale = !!(plan && household && changed(plan.rules_snapshot, household, { entries: plan.meal_ids }))
  // A row on hand that comes off nothing is SEEN, on the nights and on the
  // list, not only in the household (FOR-239): the list otherwise looks right
  // while buying food that is already in the freezer.
  const onHandWarnings = household ? inventoryWarnings(household.inventory, meals) : []

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <header>
          <p className="eyebrow-mono">fuel · phase 1</p>
          <h1 className="text-2xl lowercase mt-1">automate the noise</h1>
          <p className="text-[12px] text-muted-foreground">Sunday: pick the nights. The list comes out in store order, minus what you already have.</p>
        </header>

        <PremiumGate feature="Fuel — meal planner + shopping list">
          {loading && <div className="tile h-24" aria-busy="true" />}
          {!loading && notReady && (
            <div className="status-msg danger text-[12px]">
              Fuel&apos;s tables are not applied to this database yet. Apply <span className="data-mono">supabase/migrations/20260914_fuel_phase_1.sql</span> and reload.
            </div>
          )}
          {!loading && !notReady && (
            <>
              <nav className="flex gap-2" aria-label="fuel steps">
                {(['intake', 'plan', 'list'] as Step[]).map((s) => (
                  <button key={s} type="button" onClick={() => setStep(s)} aria-current={step === s ? 'step' : undefined}
                    disabled={(s === 'plan' && !household) || (s === 'list' && !list)}
                    className={`${step === s ? 'pill-volt' : 'pill-quiet'} px-3 py-1.5 text-[12px] lowercase disabled:text-muted-foreground`}>
                    {s === 'intake' ? 'household' : s === 'plan' ? 'the nights' : 'the list'}
                  </button>
                ))}
              </nav>
              {error && <div className="status-msg danger text-[12px]" role="alert">{error}</div>}
              {step !== 'intake' && onHandWarnings.length > 0 && (
                <div className="status-msg danger text-[12px] space-y-2" role="alert">
                  {onHandWarnings.map((w) => <p key={w}>{w}</p>)}
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" onClick={() => setStep('intake')}>fix what is on hand</button>
                </div>
              )}
              {refreshFailed && (
                <div className="status-msg danger text-[12px] flex items-center justify-between gap-3" role="alert">
                  <span>could not re-read the household and the plan — ticks are held until it succeeds</span>
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={() => void refresh()}>retry</button>
                </div>
              )}
              {live && plan && plan.id !== live.id && (
                <div className="tile p-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-muted-foreground lowercase">showing the cycle starting {plan.week_start} · this week&apos;s started {live.week_start}</p>
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={() => void openLive()}>back to this week</button>
                </div>
              )}
              {upcoming && (
                <div className="tile p-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-muted-foreground lowercase">next cycle already planned · starts {upcoming.week_start}</p>
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={() => void openUpcoming()}>open it</button>
                </div>
              )}
              {step === 'intake' && <IntakeForm initial={household ?? DEFAULT_HOUSEHOLD} meals={meals} saving={busy} onSave={onSaveHousehold} />}
              {step === 'plan' && household && liveCycle && (
                <div className="tile p-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-muted-foreground lowercase">
                    {nextCycle ? `planning the next cycle · starts ${upcoming?.week_start ?? nextCycleStart(liveCycle)}` : `rebuilding this cycle · started ${liveCycle.week_start}`}
                  </p>
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={() => setNextCycle((n) => !n)}>
                    {nextCycle ? 'rebuild this cycle instead' : 'plan the next cycle'}
                  </button>
                </div>
              )}
              {step === 'plan' && household && (
                <PlanBuilder key={`${household.shop_cadence_days}-${household.cook_cap_minutes}-${plan?.id ?? 'new'}-${nextCycle ? 'next' : 'this'}-${rotations.length}`} household={household} meals={meals} building={busy} onBuild={onBuild} askInventory={askInventory} countByDefault={inventoryFresh(householdSavedAt, newestPlanAt, newestPlanKnown)}
                  initial={startEntries(buildTarget(new Date()), household)} rotations={rotations} members={members}
                  cycles={{ history: recent, targetStart: buildTarget(new Date()), cadenceDays: household.shop_cadence_days }} />
              )}
              {step === 'list' && list && plan && listId && stale && (
                <div className="tile p-4 space-y-3">
                  <div className="status-msg danger text-[12px]" role="status">
                    the household changed after this list was built — its quantities are out of date
                  </div>
                  <button type="button" className="pill-volt w-full py-3 text-sm" onClick={() => setStep('plan')}>rebuild the list</button>
                </div>
              )}
              {step === 'list' && list && plan && listId && !stale && (
                // Keyed by the list: opening another cycle REMOUNTS the checklist, so
                // its outbox, refs and effects never straddle two lists (Codex, round 5).
                <Checklist key={listId} listId={listId} version={list.version} versions={versions} items={list.items}
                  onRowItems={onRowItems} send={send} refetch={refetch} onRegenerate={() => setStep('plan')} paused={refreshing || refreshFailed} />
              )}
            </>
          )}
        </PremiumGate>
      </div>
      <BottomNav />
    </div>
  )
}
