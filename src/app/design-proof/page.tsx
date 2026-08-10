'use client'

// ── Chalk/Volt proof harness ───────────────────────────────────────────────
// Dev-only gallery of every core surface rendered with the real kit classes
// and sample data, outside the auth wall. This page exists so the design
// system gets SEEN — in both themes, at phone width — before any real screen
// ships. The AS BUILT port failed for lack of exactly this.

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'

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

export default function DesignProofPage() {
  const [dark, setDark] = useState(true)

  // Never ships to visitors: the harness is a dev tool.
  if (process.env.NODE_ENV === 'production') notFound()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-md mx-auto px-5 pt-8 space-y-10">

        {/* harness chrome */}
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow-mono">chalk / volt · proof harness</p>
            <h1 className="text-2xl lowercase mt-1">every device, both grounds</h1>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="pill-quiet px-4 py-2 text-xs lowercase"
          >
            {dark ? 'graphite' : 'chalk'} — flip
          </button>
        </div>

        {/* ── 01 · home bento ── */}
        <section className="space-y-3">
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
        </section>

        {/* ── 02 · the workout card ── */}
        <section className="space-y-3">
          <p className="eyebrow-mono">02 · the workout card</p>

          <p className="eyebrow-mono">wk 05 · day 5 · power b</p>
          <h2 className="text-[26px] lowercase -mt-2">power clean</h2>

          <div className="tile-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[17px] font-bold lowercase tracking-tight">top double</p>
                <p className="data-mono mt-1">83% · rpe 8 · singles up</p>
              </div>
              <p className="stat-num text-[46px]">225<span className="text-[12px] font-medium tracking-normal text-muted-foreground"> lb</span></p>
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
          </div>

          <div className="tile p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[17px] font-bold lowercase tracking-tight">snatch pull</p>
                <p className="data-mono mt-1">3 × 3 · 102% of snatch · heavy and fast</p>
              </div>
              <p className="stat-num text-[46px]">210<span className="text-[12px] font-medium tracking-normal text-muted-foreground"> lb</span></p>
            </div>
          </div>
        </section>

        {/* ── 03 · schedule ── */}
        <section className="space-y-3">
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
        </section>

        {/* ── 04 · records ── */}
        <section className="space-y-3">
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
        </section>

        {/* ── 05 · states & voice ── */}
        <section className="space-y-3">
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
        </section>

        <p className="eyebrow-mono pb-6">dev harness · not linked · 404s in production</p>
      </div>
    </div>
  )
}
