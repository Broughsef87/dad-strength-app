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
import { cycleKeyFor } from '../../lib/fuel/cycle'

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
      if (active.plan) setVersions((await loadVersions(supabase, user.id, active.plan.week_start)).map((v) => v.version))
      setStep(active.list ? 'list' : h.household ? 'plan' : 'intake')
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
    if (plan && list && !changed(plan.rules_snapshot, household, p)) { setStep('list'); return }
    setBusy(true); setError(null)
    // A regeneration stays in the live cycle; a fresh start keys on this week.
    const weekStart = cycleKeyFor(plan ? { week_start: plan.week_start, version: plan.version, shop_cadence_days: Number(plan.rules_snapshot?.shop_cadence_days ?? 7) } : null, new Date())
    const res = await createVersion(supabase, weekStart, household, meals, p)
    setBusy(false)
    if (res.error || !res.plan || !res.list) { setError(res.error?.message ?? 'could not build the list'); return }
    setPlan(res.plan); setList(res.list)
    setVersions((await loadVersions(supabase, userId, weekStart)).map((v) => v.version))
    setStep('list')
  }

  const send = useCallback(async (key: string, checked: boolean) => {
    if (!listId) return null
    const { items, error: e } = await setItemChecked(supabase, listId, key, checked)
    return e ? null : items
  }, [supabase, listId])
  const refetch = useCallback(async () => (listId ? readItems(supabase, listId) : null), [supabase, listId])
  const onRowItems = useCallback((items: ListItem[]) => setList((l) => (l ? { ...l, items } : l)), [])

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
              {step === 'plan' && household && (
                <PlanBuilder key={`${household.shop_cadence_days}-${household.cook_cap_minutes}-${plan?.id ?? 'new'}`} household={household} meals={meals} building={busy} onBuild={onBuild}
                  initial={plan ? { entries: plan.meal_ids } : null} />
              )}
              {step === 'list' && list && plan && listId && (
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
