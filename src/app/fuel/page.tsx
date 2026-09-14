'use client'

// ── /fuel — the Pro anchor, Phase 1: plan + list ────────────────────────────
// Intake (taps and numbers) → pick the nights → the checklist. Behind
// PremiumGate. The solver is pure (src/lib/fuel/solve.ts); this page is the
// I/O around it. Every rule or plan change writes version + 1 and keeps the
// old versions (L6, L7). Check state is row-authoritative (ticks.ts).
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'
import BottomNav from '../../components/BottomNav'
import PremiumGate from '../../components/PremiumGate'
import IntakeForm from '../../components/fuel/IntakeForm'
import PlanBuilder from '../../components/fuel/PlanBuilder'
import Checklist from '../../components/fuel/Checklist'
import type { Household, ListItem, MealRow, Plan } from '../../lib/fuel/types'
import {
  DEFAULT_HOUSEHOLD, createVersion, isMissingTable, loadActive, loadHousehold, loadListFor, loadMeals, loadVersions,
  readItems, saveHousehold, setItemChecked, type ListRow, type PlanRow,
} from '../../lib/fuel/store'
import { changed, listUnchanged } from '../../lib/fuel/version'
import { buildShoppingList, steakNightsElsewhere } from '../../lib/fuel/solve'
import { cycleKeyFor, nextCycleKey, nextCycleStart, planningMode, rebuildKey, type CycleRow } from '../../lib/fuel/cycle'

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
  const [household, setHousehold] = useState<Household | null>(null)
  const [plan, setPlan] = useState<PlanRow | null>(null)
  const [list, setList] = useState<ListRow | null>(null)
  const [upcoming, setUpcoming] = useState<PlanRow | null>(null)
  // Every cycle from five weeks back, all versions — the rules that look
  // across cycles (the monthly steak allowance) read it (Codex, round 10).
  const [recent, setRecent] = useState<PlanRow[]>([])
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
      const [m, h, active] = await Promise.all([loadMeals(supabase), loadHousehold(supabase, user.id), loadActive(supabase, user.id, new Date())])
      if (cancelled) return
      const err = m.error ?? h.error ?? active.error
      if (isMissingTable(err)) { setNotReady(true); setLoading(false); return }
      if (err) setError(err.message ?? 'could not load')
      setMeals(m.meals)
      setHousehold(h.household)
      setPlan(active.plan); setList(active.list); setUpcoming(active.upcoming); setRecent(active.recent)
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

  const onSaveHousehold = async (h: Household) => {
    if (!userId) return
    setBusy(true); setError(null)
    const { error: e } = await saveHousehold(supabase, userId, h)
    setBusy(false)
    if (e) { setError(e.message); return }
    setHousehold(h)
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

  const onBuild = async (p: Plan) => {
    if (!userId || !household) return
    const startingNext = !!(liveCycle && nextCycle)
    const weekStart = buildTarget(new Date())
    // The unchanged-plan shortcut is a regeneration shortcut only: the next
    // cycle is always a new version under a new start — and so is a cycle
    // that expired while the page stayed open (Codex, round 8). The list is
    // reused only while its start is still the one a rebuild would get —
    // and only when a fresh solve comes out identical, because the library
    // itself can have been corrected since (Codex, round 11).
    if (!startingNext && plan && list && plan.week_start === weekStart && !changed(plan.rules_snapshot, household, p) && listUnchanged(buildShoppingList(household, meals, p).items, list.items)) { setStep('list'); return }
    setBusy(true); setError(null)
    const res = await createVersion(supabase, weekStart, household, meals, p)
    setBusy(false)
    if (res.error || !res.plan || !res.list) { setError(res.error?.message ?? 'could not build the list'); return }
    const built = res.plan
    setPlan(built); setList(res.list); setRecent((r) => [...r, built])
    if (upcoming && (upcoming.week_start === weekStart || weekStart > upcoming.week_start)) setUpcoming(null)
    setVersions((await loadVersions(supabase, userId, weekStart)).map((v) => v.version))
    setNextCycle(false)
    setStep('list')
  }

  // Resume the cycle planned ahead (Codex, round 4).
  const openUpcoming = async () => {
    if (!upcoming || !userId) return
    const l = await loadListFor(supabase, upcoming.id)
    setPlan(upcoming); setList(l); setUpcoming(null); setNextCycle(false)
    setVersions((await loadVersions(supabase, userId, upcoming.week_start)).map((v) => v.version))
    setStep(l ? 'list' : 'plan')
  }

  const send = useCallback(async (key: string, checked: boolean) => {
    if (!listId) return null
    const { items, error: e } = await setItemChecked(supabase, listId, key, checked)
    return e ? null : items
  }, [supabase, listId])
  const refetch = useCallback(async () => (listId ? readItems(supabase, listId) : null), [supabase, listId])
  // An answer belongs to the list that asked. A tick still in flight when
  // the plan is rebuilt must not land its old list's items on the new one
  // (Codex, round 2).
  const onRowItems = useCallback((forListId: string, items: ListItem[]) => setList((l) => (l && l.id === forListId ? { ...l, items } : l)), [])
  // A list is STALE when the household has changed since it was solved — a
  // rule change invalidates the list (L7), on load as much as on save. A
  // stale list is not ticked from; it is rebuilt.
  const stale = !!(plan && household && changed(plan.rules_snapshot, household, { entries: plan.meal_ids }))

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
                <PlanBuilder key={`${household.shop_cadence_days}-${household.cook_cap_minutes}-${plan?.id ?? 'new'}-${nextCycle ? 'next' : 'this'}`} household={household} meals={meals} building={busy} onBuild={onBuild}
                  initial={plan ? { entries: plan.meal_ids } : null}
                  steakNightsElsewhere={steakNightsElsewhere(recent, meals, buildTarget(new Date()), household.shop_cadence_days)} />
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
                  onRowItems={onRowItems} send={send} refetch={refetch} onRegenerate={() => setStep('plan')} />
              )}
            </>
          )}
        </PremiumGate>
      </div>
      <BottomNav />
    </div>
  )
}
