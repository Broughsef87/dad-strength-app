'use client'

// ── Chalk/Volt proof harness ───────────────────────────────────────────────
// A gallery of every core surface rendered with the real kit classes and
// sample data, outside the auth wall. This page exists so the design system
// gets SEEN — in both themes, at phone width — before any real screen ships.
// The AS BUILT port failed for lack of exactly this.
//
// Where it renders is decided by ./layout.tsx: localhost and Vercel preview
// deployments, never the production deployment. ?theme=light|dark pins the
// ground; ?section=today|session|week|records|states|analytics renders one
// surface alone, so a phone-width screenshot is exactly that surface.

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTheme } from '../../contexts/ThemeContext'
import { TrainingDataView } from '../../components/TrainingData'
import { WeekPulseView } from '../../components/WeekPulse'
import { weeklyLoad } from '../../lib/analytics/training'
import {
  liftTrends, projections, adherence,
  DEFAULT_VELOCITY_SLOTS, DEFAULT_VELOCITY_LIFT_NAMES,
  type SetRow,
} from '../../lib/analytics/training'

// Synthetic history driven through the REAL analytics module, so this harness
// proves the actual math and not a hand-written mock of its output. Includes
// the traps: a deload week, a velocity slot, and a set at 11 reps.
const PROOF_ROWS: SetRow[] = (() => {
  const rows: SetRow[] = []
  const push = (w: number, d: number, name: string, slot: string | null, lb: number, reps: number) =>
    rows.push({ block_name: name, slot, weight_lbs: lb, reps, completed: true,
                completed_at: '2026-0' + Math.min(9, 1 + (w % 9)) + '-0' + (1 + (d % 9)) + 'T06:30:00Z',
                week_number: w, day_number: d, log_type: 'strength_set' })
  const ramp = [0, 1, 2, 3, 4, 5, 6, 7]
  ramp.forEach((i) => {
    const w = i + 1
    push(w, 1, 'Back Squat', 'back_squat_heavy', 255 + i * 10, 4)
    push(w, 1, 'Snatch', 'sn_top', 150 + i * 4, 2)
    push(w, 5, 'Power Clean', 'cl_top', 205 + i * 5, 2)
    push(w, 6, 'Deadlift', 'sat_dl', 330 + i * 11, 3)
    push(w, 6, 'Overhead Press', 'ohp_press', 105 + i * 3, 4)
    push(w, 3, 'Bench Press', 'bench', 175 + i * 5, 5)
    // traps: light by design, must never enter a strength trend
    push(w, 5, 'Speed Box Squat', 'speed_squat', 205, 2)
  })
  // a flagged deload — light on purpose, must not read as a crash
  push(9, 1, 'Back Squat', 'back_squat_heavy', 185, 5)
  push(9, 6, 'Deadlift', 'sat_dl', 245, 5)
  // Epley refuses above 10 reps
  push(10, 1, 'Back Squat', 'back_squat_heavy', 400, 11)
  return rows
})()

const PROOF_TRENDS = liftTrends(PROOF_ROWS, {
  deloadWeeks: [9],
  velocitySlots: [...DEFAULT_VELOCITY_SLOTS],
  velocityNames: [...DEFAULT_VELOCITY_LIFT_NAMES],
})
const PROOF_PROJS = Object.values(projections(
  PROOF_TRENDS,
  { back_squat: 365, snatch: 205, clean_jerk: 260, bench: 250, deadlift: 465, ohp: 155, front_squat: 315 },
  { latestWeek: 8 },
))
const PROOF_ADH = adherence(PROOF_ROWS, { daysPerWeek: 4 })
const PROOF_MAXES = { back_squat: 365, snatch: 205, clean_jerk: 260, bench: 250, deadlift: 465, ohp: 155, front_squat: 315 }
const PROOF_LOAD = weeklyLoad(PROOF_ROWS, PROOF_MAXES, {
  deloadWeeks: [9],
  velocitySlots: [...DEFAULT_VELOCITY_SLOTS],
  velocityNames: [...DEFAULT_VELOCITY_LIFT_NAMES],
})

const SAMPLE_SETS = [
  { idx: '01', wr: '225 × 2', state: 'hit' as const, label: 'hit · rpe 7' },
  { idx: '02', wr: '225 × 2', state: 'log' as const, label: 'log' },
]

const SCHEDULE = [
  { d: 'mon', name: 'power a — snatch', blocks: '6 blocks', done: true },
  { d: 'tue', name: 'resisted starts — sled', blocks: '1 block', done: true },
  { d: 'wed', name: 'athletic strength', blocks: '6 blocks', done: false, live: true },
  { d: 'thu', name: 'intervals — bike/row/run', blocks: '1 block', done: false },
  { d: 'fri', name: 'power b — clean', blocks: '6 blocks', done: false },
  { d: 'sat', name: 'power + engine', blocks: '6 blocks', done: false },
  { d: 'sun', name: 'steady z2 — or rest', blocks: '1 block', done: false },
]

const RECORDS = [
  { lift: 'deadlift', one: 465, three: 425, five: 405 },
  { lift: 'back squat', one: 365, three: 335, five: 315 },
  { lift: 'clean', one: 260, three: 240, five: null },
  { lift: 'snatch', one: 205, three: 185, five: null },
]

function Proof() {
  // Query params through useSearchParams, never window in a state
  // initializer: that rendered one tree on the server and another on the
  // client, and the hydration error regenerated the page mid-transition.
  const params = useSearchParams()
  // ?theme=light pins the ground so a screenshot pass can capture either
  // one deterministically instead of depending on click order.
  const [dark, setDark] = useState(params.get('theme') !== 'light')
  const only = params.get('section')
  const show = (id: string) => only == null || only === id

  // ThemeProvider applies the SAVED theme in its own effect, and a parent's
  // effect runs after its children's — so a plain toggle here was overwritten
  // on mount. Deferring one tick lands after it. The saved preference is not
  // touched: the harness pins the class, not the setting.
  useEffect(() => {
    const id = setTimeout(() => document.documentElement.classList.toggle('dark', dark), 0)
    return () => clearTimeout(id)
  }, [dark])

  // ...and on the way OUT, the ground goes back to the saved preference.
  // ThemeProvider re-applies only when resolvedTheme changes, and pinning a
  // class here does not change it — so after a client-side navigation the
  // rest of the app kept the harness's ground while context and localStorage
  // said otherwise (Codex, round 9). A ref carries the current resolved theme
  // into the unmount cleanup.
  const { resolvedTheme } = useTheme()
  const resolvedRef = useRef(resolvedTheme)
  useEffect(() => { resolvedRef.current = resolvedTheme }, [resolvedTheme])
  useEffect(() => () => {
    document.documentElement.classList.toggle('dark', resolvedRef.current === 'dark')
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className={`${only ? 'max-w-[390px]' : 'max-w-md'} mx-auto px-5 pt-8 space-y-10`}>

        {/* harness chrome */}
        {only == null && (<div className="flex items-center justify-between">
          <div>
            <p className="eyebrow-mono">chalk / volt · proof harness</p>
            <h1 className="text-2xl lowercase mt-1">every device, both grounds</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="pill-quiet px-4 py-2 text-xs lowercase">home</Link>
            <button
              onClick={() => setDark(d => !d)}
              className="pill-quiet px-4 py-2 text-xs lowercase"
            >
              {dark ? 'graphite' : 'chalk'} — flip
            </button>
          </div>
        </div>)}

        {/* ── 01 · home bento ── */}
        {show('today') && (<section className="space-y-3">
          <p className="eyebrow-mono">01 · home — the bento</p>

          <p className="eyebrow-mono">fri · aug 10</p>
          <h2 className="text-[26px] lowercase -mt-2">morning, andrew</h2>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="tile-lg col-span-2 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="eyebrow-mono mb-1">active protocol</p>
                  <p className="text-lg font-bold lowercase leading-tight tracking-tight">hybrid power</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">olympic power · sprint · engine</p>
                </div>
                <div className="text-right">
                  <p className="stat-num text-[44px]">05</p>
                  <p className="eyebrow-mono">week</p>
                </div>
              </div>
              <div className="day-pills mt-3.5 mb-1.5">
                {[1, 1, 1, 1, 0, 0, 0].map((on, i) => (
                  <span key={i} className={`day-pill ${on ? 'on' : ''}`} />
                ))}
              </div>
              <div className="flex justify-between data-mono">
                <span>sessions</span><span className="v">4/7</span>
              </div>
              <button className="pill-volt w-full mt-3.5 py-3 text-[13.5px] lowercase flex items-center justify-center gap-2">
                <span className="w-[7px] h-[7px] rounded-full bg-brand-ink inline-block" />
                start session — power b
              </button>
            </div>

            <div className="tile p-3.5">
              <p className="text-[11.5px] font-semibold lowercase">streak</p>
              <p className="stat-num text-[30px] mt-2">12<span className="text-[11px] font-medium tracking-normal text-muted-foreground ml-1">days</span></p>
            </div>

            <div className="tile p-3.5">
              <p className="text-[11.5px] font-semibold lowercase">recovery</p>
              <div className="relative w-[46px] h-[46px] mt-1.5">
                <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
                  <circle cx="23" cy="23" r="19" fill="none" className="ring-track" strokeWidth="5" />
                  <circle cx="23" cy="23" r="19" fill="none" className="ring-live" strokeWidth="5" strokeLinecap="round" strokeDasharray="89.5 119.4" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">3/4</span>
              </div>
            </div>

            <div className="tile p-3.5">
              <p className="text-[11.5px] font-semibold lowercase">dad score</p>
              <p className="stat-num text-[30px] mt-2">82</p>
            </div>

            <div className="tile p-3.5">
              <p className="text-[11.5px] font-semibold lowercase">morning</p>
              <span className="chip-live mt-2">done</span>
            </div>
          </div>

          {/* dock */}
          <div className="tile pill flex justify-between items-center px-5 py-2.5 text-[11px] font-semibold lowercase text-muted-foreground">
            <span className="text-foreground relative">home<span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1 h-1 rounded-full bg-brand" /></span>
            <span>mind</span>
            <span>body</span>
            <span>spirit</span>
          </div>
        </section>)}

        {/* ── 02 · the workout card ── */}
        {show('session') && (<section className="space-y-3">
          <p className="eyebrow-mono">02 · the workout card</p>

          <p className="eyebrow-mono">wk 05 · day 5 · power b</p>
          <h2 className="text-[26px] lowercase -mt-2">power clean</h2>

          <div className="tile-lg p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-[17px] font-bold lowercase tracking-tight">top double</p>
                <p className="eyebrow-mono mt-1">lb @ 83% · 2×2 · tgt rpe 8</p>
              </div>
              <span className="inline-block bg-brand rounded-[6px] px-2 py-0.5 shrink-0 self-start">
                <span className="stat-num text-4xl text-brand">225</span>
              </span>
            </div>
            <div className="flex flex-col gap-2 mt-3.5">
              {SAMPLE_SETS.map(s => (
                <div key={s.idx} className="row-recessed flex items-center gap-2.5 px-3 py-2.5 text-[12.5px]">
                  <span className="data-mono w-4">{s.idx}</span>
                  <span className="font-semibold tabular-nums flex-1">{s.wr}</span>
                  {s.state === 'hit'
                    ? <span className="pill-volt px-3 py-1 text-[10px] lowercase">{s.label}</span>
                    : <span className="pill-quiet px-3 py-1 text-[10px] lowercase">{s.label}</span>}
                </div>
              ))}
            </div>
            <div className="row-recessed pill flex items-center justify-between px-3.5 py-2.5 mt-3 text-[11px] font-semibold">
              <span className="lowercase text-muted-foreground">rest</span>
              <span className="data-mono text-[15px] v">1:42</span>
              <span className="lowercase text-muted-foreground">+30s · skip</span>
            </div>
            <div className="led-bar mt-3">
              {[1, 1, 0, 0].map((lit, i) => <span key={i} className={`led-cell ${lit ? 'lit' : ''}`} />)}
              <span className="eyebrow-mono eyebrow-mono-sm ml-1.5">2 of 4 spent</span>
            </div>
            <button className="pill-volt w-full mt-3 py-3 text-[13px] lowercase">finish session</button>
          </div>

          <div className="tile p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-[17px] font-bold lowercase tracking-tight">snatch pull</p>
                <p className="eyebrow-mono mt-1">lb @ 102% of snatch · 3×3</p>
              </div>
              <span className="inline-block bg-brand rounded-[6px] px-2 py-0.5 shrink-0 self-start">
                <span className="stat-num text-4xl text-brand">210</span>
              </span>
            </div>
          </div>
        </section>)}

        {/* ── 03 · schedule ── */}
        {show('week') && (<section className="space-y-3">
          <p className="eyebrow-mono">03 · the week</p>

          <div className="flex items-center justify-between">
            <h2 className="text-[26px] lowercase">week 05</h2>
            <span className="pill-quiet px-3 py-1.5 text-[10px] lowercase">flag deload</span>
          </div>

          <div className="flex flex-col gap-2">
            {SCHEDULE.map(row => (
              <div key={row.d} className={`tile flex items-center gap-3 px-3.5 py-3 ${row.live ? 'ring-2 ring-brand' : ''}`}>
                <span className="data-mono w-8">{row.d}</span>
                <span className={`text-[13px] font-bold lowercase tracking-tight flex-1 truncate ${row.done ? 'text-muted-foreground line-through decoration-brand/60' : ''}`}>
                  {row.name}
                </span>
                {row.done
                  ? <span className="chip-live">done</span>
                  : <span className="data-mono">{row.blocks}</span>}
              </div>
            ))}
          </div>

          <div className="tile p-4">
            <p className="eyebrow-mono mb-2">deload check — week 8</p>
            <p className="text-[13.5px] lowercase leading-relaxed">three loading weeks banked. feeling strong? ride into the heavy work. beat up? flag the deload and come back fresh.</p>
            <div className="flex gap-2 mt-3">
              <button className="pill-volt flex-1 py-2.5 text-[11px] lowercase">flag deload</button>
              <button className="pill-quiet flex-1 py-2.5 text-[11px] lowercase">ride on</button>
            </div>
          </div>
        </section>)}

        {/* ── 04 · records ── */}
        {show('records') && (<section className="space-y-3">
          <p className="eyebrow-mono">04 · records</p>

          <div className="tile-lg p-4">
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="text-lg lowercase">records</h2>
              <span className="data-mono">×1 · ×3 · ×5</span>
            </div>
            <div className="flex flex-col gap-2">
              {RECORDS.map(r => (
                <div key={r.lift} className="row-recessed grid grid-cols-[1fr_repeat(3,3rem)] gap-2 items-center px-3 py-2.5">
                  <span className="text-[13px] font-bold lowercase tracking-tight truncate">{r.lift}</span>
                  <span className="stat-num text-[15px] text-right">{r.one}</span>
                  <span className="data-mono text-right text-[13px]">{r.three ?? '—'}</span>
                  <span className="data-mono text-right text-[13px]">{r.five ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="chip-live mt-3">new record — snatch 210 · this week</div>
          </div>
        </section>)}

        {/* ── 05 · states & voice ── */}
        {show('states') && (<section className="space-y-3">
          <p className="eyebrow-mono">05 · states &amp; voice</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="tile p-3.5 space-y-2">
              <p className="text-[11.5px] font-semibold lowercase text-muted-foreground">session complete</p>
              <span className="stamp inline-block px-4 py-1.5 text-sm font-bold">done</span>
              <p className="text-[12px] lowercase text-muted-foreground">6 of 6 logged. 58 minutes.</p>
            </div>
            <div className="tile p-3.5 space-y-2">
              <p className="text-[11.5px] font-semibold lowercase text-muted-foreground">deload week</p>
              <p className="data-mono">loads down by design.<br />leave feeling fresh.</p>
              <span className="pill-quiet inline-block px-3 py-1 text-[10px] lowercase">deload</span>
            </div>
            <div className="tile p-3.5 space-y-2">
              <p className="text-[11.5px] font-semibold lowercase text-muted-foreground">test week</p>
              <p className="text-[13px] font-bold lowercase">new maxes. take your time.</p>
              <span className="pill-volt inline-block px-3 py-1 text-[10px] lowercase">test week</span>
            </div>
            <div className="tile p-3.5 space-y-2">
              <p className="text-[11.5px] font-semibold lowercase text-muted-foreground">danger — rosso&apos;s only job</p>
              <button className="w-full rounded-full py-2 text-[11px] lowercase font-bold bg-destructive text-destructive-foreground">delete account</button>
            </div>
          </div>
        </section>)}

        {show('analytics') && (<section className="space-y-3">
          <p className="eyebrow-mono">week pulse — volume vs intensity, both grounds</p>
          <WeekPulseView loaded weeks={PROOF_LOAD} />
          <WeekPulseView loaded weeks={PROOF_LOAD.slice(0, 9)} compact />
          <div className="data-mono text-[10px] space-y-0.5 mb-4">
            {PROOF_LOAD.map(w => (
              <p key={w.week}>
                {`wk ${w.week}${w.isDeload ? ' (deload)' : ''} · ${Math.round(w.tonnage)} lb · ${w.sets} sets · ${w.avgIntensityPct ?? '—'}% avg`}
              </p>
            ))}
          </div>
          <p className="eyebrow-mono">training data card — real analytics, synthetic history</p>
          <TrainingDataView
            loaded
            trends={Object.values(PROOF_TRENDS).sort((a, b) => b.current - a.current)}
            projs={PROOF_PROJS}
            adh={PROOF_ADH}
          />
        </section>)}

        <p className="eyebrow-mono pb-6">proof harness · not linked · 404s on the production deployment</p>
      </div>
    </div>
  )
}

// useSearchParams needs a Suspense boundary on a statically rendered route.
export default function DesignProofPage() {
  return (
    <Suspense fallback={null}>
      <Proof />
    </Suspense>
  )
}
