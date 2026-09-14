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
  DEFAULT_HOUSEHOLD, createVersion, isMissingTable, loadHousehold, loadLatest, loadMeals, loadVersions,
  readItems, saveHousehold, setItemChecked, weekStartKey, type ListRow, type PlanRow,
} from '../../lib/fuel/store'
import { changed } from '../../lib/fuel/version'

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
  const weekStart = weekStartKey()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id)
      const [m, h, latest] = await Promise.all([loadMeals(supabase), loadHousehold(supabase, user.id), loadLatest(supabase, user.id, weekStart)])
      if (cancelled) return
      const err = m.error ?? h.error ?? latest.error
      if (isMissingTable(err)) { setNotReady(true); setLoading(false); return }
      if (err) setError(err.message ?? 'could not load')
      setMeals(m.meals)
      setHousehold(h.household)
      setPlan(latest.plan); setList(latest.list)
      setVersions((await loadVersions(supabase, user.id, weekStart)).map((v) => v.version))
      setStep(latest.list ? 'list' : h.household ? 'plan' : 'intake')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, router, weekStart])

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
    if (plan && !changed(plan.rules_snapshot, household, p)) { setStep('list'); return }
    setBusy(true); setError(null)
    const res = await createVersion(supabase, userId, weekStart, household, meals, p, plan?.version ?? null)
    setBusy(false)
    if (res.error || !res.plan || !res.list) { setError(res.error?.message ?? 'could not build the list'); return }
    setPlan(res.plan); setList(res.list)
    setVersions((await loadVersions(supabase, userId, weekStart)).map((v) => v.version))
    setStep('list')
  }

  const send = useCallback(async (key: string, checked: boolean) => {
    if (!list) return null
    const { items, error: e } = await setItemChecked(supabase, list.id, key, checked)
    return e ? null : items
  }, [supabase, list])
  const refetch = useCallback(async () => (list ? readItems(supabase, list.id) : null), [supabase, list])
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
                <PlanBuilder household={household} meals={meals} building={busy} onBuild={onBuild}
                  initial={plan ? { entries: plan.meal_ids } : null} />
              )}
              {step === 'list' && list && plan && (
                <Checklist listId={list.id} version={list.version} versions={versions} items={list.items}
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
