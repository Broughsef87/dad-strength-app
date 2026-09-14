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
  DEFAULT_HOUSEHOLD, createVersion, isMissingTable, loadActive, loadHousehold, loadMeals, loadVersions,
  readItems, saveHousehold, setItemChecked, type ListRow, type PlanRow,
} from '../../lib/fuel/store'
import { changed } from '../../lib/fuel/version'
import { cycleKeyFor, nextCycleStart, planningMode, type CycleRow } from '../../lib/fuel/cycle'

type Step = 'intake' | 'plan' | 'list'

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
  const [versions, setVersions] = useState<number[]>([])
  const [step, setStep] = useState<Step>('intake')
  const [busy, setBusy] = useState(false)
  // Rebuild the live cycle, or plan the NEXT one? On a cycle's final day —
  // the Sunday before the next Monday — the default is the next cycle; a
  // rebuild that kept the old start would be live for a day and gone
  // (Codex, round 3). The athlete can flip it either way.
  const [nextCycle, setNextCycle] = useState(false)
  const liveCycle: CycleRow | null = plan ? { week_start: plan.week_start, version: plan.version, shop_cadence_days: Number(plan.rules_snapshot?.shop_cadence_days ?? 7) } : null
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
      setPlan(active.plan); setList(active.list)
      if (active.plan) {
        setVersions((await loadVersions(supabase, user.id, active.plan.week_start)).map((v) => v.version))
        setNextCycle(planningMode({ week_start: active.plan.week_start, version: active.plan.version, shop_cadence_days: Number(active.plan.rules_snapshot?.shop_cadence_days ?? 7) }, new Date()) === 'next')
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

  const onBuild = async (p: Plan) => {
    if (!userId || !household) return
    const startingNext = !!(liveCycle && nextCycle)
    // The unchanged-plan shortcut is a regeneration shortcut only: the next
    // cycle is always a new version under a new start.
    if (!startingNext && plan && list && !changed(plan.rules_snapshot, household, p)) { setStep('list'); return }
    setBusy(true); setError(null)
    // A regeneration stays in the live cycle; the next cycle starts where the
    // live one ends; a fresh start keys on this week.
    const weekStart = startingNext && liveCycle ? nextCycleStart(liveCycle) : cycleKeyFor(liveCycle, new Date())
    const res = await createVersion(supabase, weekStart, household, meals, p)
    setBusy(false)
    if (res.error || !res.plan || !res.list) { setError(res.error?.message ?? 'could not build the list'); return }
    setPlan(res.plan); setList(res.list)
    setVersions((await loadVersions(supabase, userId, weekStart)).map((v) => v.version))
    setNextCycle(false)
    setStep('list')
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
              {step === 'intake' && <IntakeForm initial={household ?? DEFAULT_HOUSEHOLD} saving={busy} onSave={onSaveHousehold} />}
              {step === 'plan' && household && liveCycle && (
                <div className="tile p-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] text-muted-foreground lowercase">
                    {nextCycle ? `planning the next cycle · starts ${nextCycleStart(liveCycle)}` : `rebuilding this cycle · started ${liveCycle.week_start}`}
                  </p>
                  <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={() => setNextCycle((n) => !n)}>
                    {nextCycle ? 'rebuild this cycle instead' : 'plan the next cycle'}
                  </button>
                </div>
              )}
              {step === 'plan' && household && (
                <PlanBuilder key={`${household.shop_cadence_days}-${household.cook_cap_minutes}-${plan?.id ?? 'new'}-${nextCycle ? 'next' : 'this'}`} household={household} meals={meals} building={busy} onBuild={onBuild}
                  initial={plan ? { entries: plan.meal_ids } : null} />
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
                <Checklist listId={listId} version={list.version} versions={versions} items={list.items}
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
