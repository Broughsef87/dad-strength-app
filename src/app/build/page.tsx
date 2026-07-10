'use client'

// ── Training Path Selection ────────────────────────────────────────────────────
// Three paths, config-driven. Selecting a path collects its required 1RMs
// (stored in user_maxes so other paths can reuse them), activates the program
// in user_programs, and launches Week 1 Day 1.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronRight, Lock } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { createClient } from '../../utils/supabase/client'
import { PROGRAMS, UPCOMING_PROGRAMS, ProgramConfig } from '../../lib/programs'
import UpgradeModal from '../../components/UpgradeModal'

export default function BuildPage() {
  const router = useRouter()
  const { user } = useUser()
  const { isPro } = useSubscription()
  const [supabase] = useState(() => createClient())

  const [selected, setSelected] = useState<ProgramConfig | null>(null)
  const [maxVals, setMaxVals] = useState<Record<string, string>>({})
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  // The user's claimed program. Free users are locked to it; pro can switch.
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null)

  const programs = Object.values(PROGRAMS)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_programs')
      .select('program_slug')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { program_slug: string } | null }) => {
        setClaimedSlug(data?.program_slug ?? null)
      })
  }, [user, supabase])

  // The /train/[program] server guard bounces here with ?locked=<slug> when a
  // user tries to open a program that isn't theirs. Read straight off the URL —
  // useSearchParams would force this page behind a Suspense boundary.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('locked')) setShowUpgrade(true)
  }, [])

  // Free users may claim one program; once claimed, the others are Pro-only.
  const isLocked = (slug: string) => !isPro && !!claimedSlug && claimedSlug !== slug

  const startProgram = async () => {
    if (!user || !selected) return
    setActivating(true)
    setError(null)
    try {
      // Persist maxes.
      const rows = selected.requiredMaxes
        .map(d => ({ key: d.key, val: parseFloat(maxVals[d.key] ?? '') }))
        .filter(r => Number.isFinite(r.val) && r.val > 0)
        .map(r => ({
          user_id: user.id,
          lift_key: r.key,
          value_lbs: r.val,
          updated_at: new Date().toISOString(),
        }))
      if (rows.length < selected.requiredMaxes.length) {
        setError('Enter all maxes — percentages are computed from them.')
        setActivating(false)
        return
      }
      const { error: maxErr } = await supabase
        .from('user_maxes')
        .upsert(rows, { onConflict: 'user_id,lift_key' })
      if (maxErr) throw new Error(`Saving maxes failed: ${maxErr.message}`)

      // user_programs.user_id is UNIQUE — one row per user, so switching is an
      // upsert, not an update-then-insert (which violated the constraint).
      const { error: progErr } = await supabase.from('user_programs').upsert({
        user_id: user.id,
        program_slug: selected.slug,
        started_at: new Date().toISOString(),
        current_week: 1,
        status: 'active',
        equipment: {},
        preferences: {},
      }, { onConflict: 'user_id' })

      if (progErr) {
        // 42501 = the user_programs_tier_gate trigger rejecting a free user's
        // attempt to switch programs. Surface the paywall, not a raw DB error.
        if (progErr.code === '42501') {
          setShowUpgrade(true)
          setActivating(false)
          return
        }
        throw new Error(`Activating program failed: ${progErr.message}`)
      }

      router.push(`/train/${selected.slug}/1`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => (selected ? setSelected(null) : router.push('/dashboard'))}
          className="p-2 border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <p className="telemetry-dim">SYS // PATH.SELECT</p>
          <h1 className="font-display text-xl tracking-[0.1em] uppercase">
            {selected ? selected.name : 'Choose Your Path'}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="status-dot" />
          <span className="telemetry">Online</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="paths"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="readout-rule" />

              {programs.map(p => {
                const locked = isLocked(p.slug)
                return (
                <button
                  key={p.slug}
                  onClick={() => (locked ? setShowUpgrade(true) : setSelected(p))}
                  className={`panel-cut hud-frame hud-scan-hover relative w-full text-left bg-card border p-5 pt-7 transition-colors group ${
                    locked ? 'border-border opacity-60 hover:border-brand/40' : 'border-border hover:border-brand/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="panel-id">HANGAR // {locked ? 'PRO.LOCKED' : p.slug.replace(/-/g, '.').toUpperCase()}</span>
                      <p className="telemetry mb-1">{p.tagline}</p>
                      <p className="font-display text-2xl tracking-[0.08em] uppercase text-foreground">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{p.description}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {locked ? (
                          <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-brand/40 text-brand rounded-sm">
                            Dad Strong+ to switch
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-brand/30 text-brand rounded-sm">
                            {p.daysPerWeek} days/week
                          </span>
                        )}
                        <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                          {p.macroWeeks}-week macro
                        </span>
                      </div>
                    </div>
                    {locked
                      ? <Lock size={15} className="text-brand/70 mt-1 shrink-0" />
                      : <ChevronRight size={16} className="text-muted-foreground group-hover:text-brand transition-colors mt-1 shrink-0" />
                    }
                  </div>
                </button>
                )
              })}

              {UPCOMING_PROGRAMS.map(p => (
                <div key={p.slug} className="panel-cut bg-card border border-border p-5 pt-7 opacity-45 relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="panel-id">HANGAR // LOCKED</span>
                      <p className="telemetry-dim mb-1">{p.tagline}</p>
                      <p className="font-display text-2xl tracking-[0.08em] uppercase text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-2">{p.description}</p>
                    </div>
                    <Lock size={14} className="text-muted-foreground mt-1 shrink-0" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="maxes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="readout-rule" />
              <div className="panel-cut hud-frame relative bg-card border border-border p-5 pt-8 space-y-4">
                <div>
                  <span className="panel-id">CALIBRATION CONSOLE</span>
                  <p className="telemetry mb-1">CAL // ENTER.MAXES</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every prescribed weight is computed from these. Use your best recent single —
                    honest numbers, not all-time PRs from years ago. You&apos;ll retest at the end of the macro.
                  </p>
                </div>

                {selected.requiredMaxes.map(d => (
                  <div key={d.key} className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {d.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={maxVals[d.key] ?? ''}
                        onChange={e => setMaxVals(v => ({ ...v, [d.key]: e.target.value }))}
                        placeholder={d.hint ?? 'lbs'}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-brand/60"
                      />
                      <span className="text-xs text-muted-foreground w-8">{d.unit ?? 'lbs'}</span>
                    </div>
                  </div>
                ))}

                {error && (
                  <p className="text-xs text-red-400 border border-red-500/30 bg-red-500/5 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  onClick={() => void startProgram()}
                  disabled={activating}
                  className="panel-cut carbon mecha-glow w-full py-3.5 text-brand border border-brand/60 text-sm font-semibold uppercase tracking-[0.14em] hover:border-brand disabled:opacity-50 transition-all"
                >
                  {activating ? 'IGNITION…' : 'Deploy Unit'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        trigger="Training on all 3 programs"
      />
    </div>
  )
}
