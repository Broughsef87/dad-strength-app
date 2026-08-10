'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Dumbbell,
  Target,
  Heart,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type QuarterData = {
  workoutCount: number
  weeklyAvgSessions: number
  roughSleepNights: number
  activeCheckinDays: number
  totalDays: number
  weightChange: number | null
  quarterLabel: string
}

type Next90Focus = {
  theme: string
  primaryObjective: string
  trainingDirective: string
  familyCommitment: string
}

type ReviewResult = {
  quarterGrade: 'Rise Up' | 'Grinding' | 'Solid' | 'Strong' | 'Dad Elite'
  quarterHeadline: string
  topWins: string[]
  coreGaps: string[]
  next90Focus: Next90Focus
  letterToSelf: string
}

type CachedReview = {
  quarterLabel: string
  generatedAt: string
  review: ReviewResult
  inputs: {
    biggestWin: string
    biggestChallenge: string
    wantsDifferent: string
  }
}

// ── Quarter helpers ────────────────────────────────────────────────────────

function getCurrentQuarter(): { label: string; start: Date; end: Date; number: number; year: number } {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()

  let qNum: number
  let startMonth: number
  let endMonth: number

  if (month < 3) { qNum = 1; startMonth = 0; endMonth = 2 }
  else if (month < 6) { qNum = 2; startMonth = 3; endMonth = 5 }
  else if (month < 9) { qNum = 3; startMonth = 6; endMonth = 8 }
  else { qNum = 4; startMonth = 9; endMonth = 11 }

  const start = new Date(year, startMonth, 1, 0, 0, 0, 0)
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)

  return { label: `Q${qNum} ${year}`, start, end, number: qNum, year }
}

function storageKey(quarterLabel: string): string {
  return `dad-strength-quarterly-${quarterLabel.replace(' ', '-').toLowerCase()}`
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weeksElapsed(start: Date, now: Date): number {
  const ms = now.getTime() - start.getTime()
  return Math.max(ms / (7 * 24 * 60 * 60 * 1000), 1)
}

// ── Grade colors ───────────────────────────────────────────────────────────

function gradeStyle(grade: ReviewResult['quarterGrade']): { bg: string; text: string } {
  switch (grade) {
    case 'Rise Up':   return { bg: 'bg-red-500/15',    text: 'text-red-500' }
    case 'Grinding':  return { bg: 'bg-yellow-500/15', text: 'text-yellow-500' }
    case 'Solid':     return { bg: 'bg-blue-500/15',   text: 'text-blue-400' }
    case 'Strong':    return { bg: 'bg-green-500/15',  text: 'text-green-500' }
    case 'Dad Elite': return { bg: 'bg-brand/15',      text: 'text-brand' }
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function QuarterlyReview() {
  const { user } = useUser()
  const [supabase] = useState(() => createClient())
  const quarter = getCurrentQuarter()

  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [quarterData, setQuarterData] = useState<QuarterData | null>(null)
  const [cached, setCached] = useState<CachedReview | null>(null)

  const [biggestWin, setBiggestWin] = useState('')
  const [biggestChallenge, setBiggestChallenge] = useState('')
  const [wantsDifferent, setWantsDifferent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // ── Mount: load cache + fetch data ──────────────────────────────────────

  useEffect(() => {
    setMounted(true)

    // Load cached review
    try {
      const raw = localStorage.getItem(storageKey(quarter.label))
      if (raw) {
        const data: CachedReview = JSON.parse(raw)
        if (data.quarterLabel === quarter.label) {
          setCached(data)
          setExpanded(true)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted || !user) return
    fetchQuarterData()
  }, [mounted, user])

  // ── Supabase data fetch ──────────────────────────────────────────────────

  async function fetchQuarterData() {
    if (!user) return
    setLoadingData(true)

    const startISO = toISO(quarter.start)
    const endISO = toISO(quarter.end)
    const now = new Date()
    const totalDays = Math.max(
      Math.floor((now.getTime() - quarter.start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
      1
    )

    // Workout count: distinct dates with completed logs
    const { data: wlogs } = await supabase
      .from('workout_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('created_at', startISO)
      .lte('created_at', endISO + 'T23:59:59')

    const distinctWorkoutDates = new Set(
      (wlogs || []).map((l: { created_at: string }) => new Date(l.created_at).toDateString())
    )
    const workoutCount = distinctWorkoutDates.size
    const weeklyAvgSessions = workoutCount / weeksElapsed(quarter.start, now)

    // Daily check-ins
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('date, forge_state, sleep_quality')
      .eq('user_id', user.id)
      .gte('date', startISO)
      .lte('date', endISO)

    const checkinList = checkins || []
    const activeCheckinDays = checkinList.length

    // Count rough sleep nights (sleep_quality <= 2 or forge_state marks poor sleep)
    const roughSleepNights = checkinList.filter((c: { sleep_quality?: number | null }) => {
      const sq = c.sleep_quality
      return sq !== null && sq !== undefined && Number(sq) <= 2
    }).length

    // Weight change: compare first vs last body_composition entry in quarter
    let weightChange: number | null = null
    const { data: bodyComp } = await supabase
      .from('body_composition')
      .select('weight_lbs, recorded_at')
      .eq('user_id', user.id)
      .gte('recorded_at', startISO)
      .lte('recorded_at', endISO + 'T23:59:59')
      .order('recorded_at', { ascending: true })

    const bcList = (bodyComp || []).filter((b: { weight_lbs?: number | null }) => b.weight_lbs != null)
    if (bcList.length >= 2) {
      weightChange = bcList[bcList.length - 1].weight_lbs - bcList[0].weight_lbs
    }

    setQuarterData({
      workoutCount,
      weeklyAvgSessions,
      roughSleepNights,
      activeCheckinDays,
      totalDays,
      weightChange,
      quarterLabel: quarter.label,
    })
    setLoadingData(false)
  }

  // ── Generate review ──────────────────────────────────────────────────────

  async function generate() {
    if (!quarterData) return
    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/ai/quarterly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quarterData,
          userInputs: { biggestWin, biggestChallenge, wantsDifferent },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const entry: CachedReview = {
        quarterLabel: quarter.label,
        generatedAt: new Date().toISOString(),
        review: data.review,
        inputs: { biggestWin, biggestChallenge, wantsDifferent },
      }
      localStorage.setItem(storageKey(quarter.label), JSON.stringify(entry))
      setCached(entry)
      setExpanded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate. Try again.')
    }

    setGenerating(false)
  }

  function regenerate() {
    if (!cached) return
    setBiggestWin(cached.inputs.biggestWin)
    setBiggestChallenge(cached.inputs.biggestChallenge)
    setWantsDifferent(cached.inputs.wantsDifferent)
    setCached(null)
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!mounted) return null

  const hasReview = !!cached?.review
  const consistencyRate = quarterData
    ? Math.round((quarterData.activeCheckinDays / Math.max(quarterData.totalDays, 1)) * 100)
    : 0

  // ── Header subtitle ───────────────────────────────────────────────────────

  const headerSub = hasReview
    ? cached!.review.quarterGrade
    : loadingData
    ? 'Loading data...'
    : quarterData
    ? `${quarterData.workoutCount} workouts · ${quarterData.weeklyAvgSessions.toFixed(1)}/wk`
    : 'Tap to review your quarter'

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Calendar size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-sm">{quarter.label} Quarterly Review</h3>
            {hasReview ? (
              <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${gradeStyle(cached!.review.quarterGrade).text}`}>
                {headerSub}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{headerSub}</p>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-muted-foreground" />
          : <ChevronDown size={16} className="text-muted-foreground" />
        }
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-border">

          {/* Quarter at a Glance */}
          {quarterData && (
            <div className="px-5 pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-3">
                Quarter at a Glance
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Dumbbell size={11} className="text-brand" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Workouts</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight stat-num">{quarterData.workoutCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{quarterData.weeklyAvgSessions.toFixed(1)}/week avg</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target size={11} className="text-brand" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Consistency</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight stat-num">{consistencyRate}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{quarterData.activeCheckinDays} active days</p>
                </div>
                {quarterData.roughSleepNights > 0 && (
                  <div className="bg-muted rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap size={11} className="text-yellow-500" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Rough Nights</span>
                    </div>
                    <p className="text-2xl font-black tracking-tight stat-num">{quarterData.roughSleepNights}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">poor sleep logged</p>
                  </div>
                )}
                {quarterData.weightChange !== null && (
                  <div className="bg-muted rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {quarterData.weightChange > 0
                        ? <TrendingUp size={11} className="text-brand" />
                        : quarterData.weightChange < 0
                        ? <TrendingDown size={11} className="text-green-500" />
                        : <Minus size={11} className="text-muted-foreground" />
                      }
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Weight</span>
                    </div>
                    <p className="text-2xl font-black tracking-tight stat-num">
                      {quarterData.weightChange > 0 ? '+' : ''}{quarterData.weightChange.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">lbs this quarter</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading state for data */}
          {loadingData && (
            <div className="px-5 py-6 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading your quarter data...</p>
            </div>
          )}

          {/* ── Form (no cached review) ── */}
          {!hasReview && !loadingData && quarterData && (
            <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Answer three questions. The AI delivers your full 90-day performance review.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                    What was your biggest win this quarter?
                  </label>
                  <textarea
                    rows={2}
                    value={biggestWin}
                    onChange={e => setBiggestWin(e.target.value)}
                    placeholder="A specific result, habit, or moment..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                    What held you back most?
                  </label>
                  <textarea
                    rows={2}
                    value={biggestChallenge}
                    onChange={e => setBiggestChallenge(e.target.value)}
                    placeholder="Work, schedule, energy, mindset..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                    What do you most want to be different next quarter?
                  </label>
                  <textarea
                    rows={2}
                    value={wantsDifferent}
                    onChange={e => setWantsDifferent(e.target.value)}
                    placeholder="Be specific. One clear intention."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground resize-none"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={generate}
                disabled={generating}
                className="w-full bg-brand text-white font-black text-xs uppercase tracking-[0.15em] py-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing your quarter...
                  </>
                ) : (
                  'Generate My Quarterly Review'
                )}
              </button>
            </div>
          )}

          {/* ── Review results ── */}
          {hasReview && cached && (
            <div className="px-5 pb-5 pt-3 space-y-5 border-t border-border animate-float-up">

              {/* Grade + headline */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${gradeStyle(cached.review.quarterGrade).bg} ${gradeStyle(cached.review.quarterGrade).text}`}>
                    {cached.review.quarterGrade}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{quarter.label}</span>
                </div>
                <p className="text-sm font-bold text-foreground leading-snug border-l-2 border-brand pl-3 italic">
                  &quot;{cached.review.quarterHeadline}&quot;
                </p>
              </div>

              {/* Top Wins */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-2.5">Top Wins</p>
                <div className="space-y-2">
                  {cached.review.topWins.map((win, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground leading-relaxed">{win}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Gaps */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-2.5">Core Gaps</p>
                <div className="space-y-2">
                  {cached.review.coreGaps.map((gap, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <AlertCircle size={13} className="text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{gap}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next 90 Days */}
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-1">Next 90 Days</p>
                  <p className="text-lg font-black uppercase tracking-tight text-brand">{cached.review.next90Focus.theme}</p>
                </div>
                <div className="space-y-2.5">
                  <div className="flex gap-2.5 items-start">
                    <Target size={12} className="text-brand shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-0.5">Primary Objective</p>
                      <p className="text-xs text-foreground">{cached.review.next90Focus.primaryObjective}</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <Dumbbell size={12} className="text-brand shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-0.5">Training Directive</p>
                      <p className="text-xs text-foreground">{cached.review.next90Focus.trainingDirective}</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <Heart size={12} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-0.5">Family Commitment</p>
                      <p className="text-xs text-foreground">{cached.review.next90Focus.familyCommitment}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Letter to Self */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Letter to Self</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  &quot;{cached.review.letterToSelf}&quot;
                </p>
              </div>

              {/* Footer: generated date + regenerate */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground">
                  Generated {new Date(cached.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <button
                  onClick={regenerate}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest font-medium"
                >
                  <RefreshCw size={10} /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
