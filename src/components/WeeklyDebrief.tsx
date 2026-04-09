'use client'

import { useState, useEffect } from 'react'
import {
  Loader2, TrendingUp, RefreshCw, Trophy, Target, Flame,
  Dumbbell, Moon, CheckSquare, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { getMondayOfWeek, getSundayOfWeek, toLocalDateString } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonalizedDebrief = {
  overallGrade: 'Rise Up' | 'Grinding' | 'Solid' | 'Strong' | 'Dad Elite'
  assessmentHeadline: string
  wins: string[]
  gaps: string[]
  adjustments: string[]
  mindsetNote: string
  focusWord: string
}

type WeekStats = {
  workoutsCompleted: number
  roughNights: number
  objectivesCompleted: number
  totalObjectives: number
  checkinCount: number
}

type CachedDebrief = {
  weekKey: string
  debrief: PersonalizedDebrief
  generatedAt: string
}

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<
  PersonalizedDebrief['overallGrade'],
  { bg: string; text: string; border: string; glow?: string }
> = {
  'Rise Up':   { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/30' },
  'Grinding':  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Solid':     { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Strong':    { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/30' },
  'Dad Elite': {
    bg: 'bg-brand/10', text: 'text-brand', border: 'border-brand/40',
    glow: 'shadow-[0_0_18px_rgba(249,115,22,0.25)]',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds() {
  const now = new Date()
  const monday = getMondayOfWeek(now)
  const sunday = getSundayOfWeek(monday)
  return {
    weekStart: toLocalDateString(monday),
    weekEnd: toLocalDateString(sunday),
    cacheKey: `dad-strength-debrief-${toLocalDateString(monday)}`,
  }
}

function formatGeneratedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyDebrief() {
  const [supabase] = useState(() => createClient())
  const { user } = useUser()

  // Week stats (fetched on mount)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Form inputs
  const [biggestWin, setBiggestWin] = useState('')
  const [biggestChallenge, setBiggestChallenge] = useState('')
  const [intentionForNext, setIntentionForNext] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  // Debrief result
  const [debrief, setDebrief] = useState<PersonalizedDebrief | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Load cached debrief + fetch week stats on mount ──────────────────────
  useEffect(() => {
    const { cacheKey } = getWeekBounds()
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached: CachedDebrief = JSON.parse(raw)
        if (cached.weekKey === cacheKey) {
          setDebrief(cached.debrief)
          setGeneratedAt(cached.generatedAt)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchWeekStats()
  }, [user])

  const fetchWeekStats = async () => {
    setStatsLoading(true)
    if (!user) { setStatsLoading(false); return }

    const { weekStart, weekEnd } = getWeekBounds()

    const [workoutRes, objectivesRes, profileRes] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', new Date(weekStart + 'T00:00:00').toISOString())
        .lte('created_at', new Date(weekEnd + 'T23:59:59').toISOString()),

      supabase
        .from('daily_objectives')
        .select('completed')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),

      supabase
        .from('user_profiles')
        .select('sleep_log')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    // Distinct workout days
    const sessionDays = new Set(
      (workoutRes.data || []).map((l: { created_at: string }) => new Date(l.created_at).toDateString())
    )

    // Objectives
    const objs = objectivesRes.data || []
    const completed = objs.filter((o: { completed: boolean }) => o.completed).length

    // Rough nights from sleep_log (last 7)
    let roughNights = 0
    if (profileRes.data?.sleep_log && Array.isArray(profileRes.data.sleep_log)) {
      const last7 = (profileRes.data.sleep_log as { date: string; babyQuality: string }[])
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7)
      roughNights = last7.filter(e => e.babyQuality === 'rough').length
    }

    // Daily check-ins
    const { data: checkinData } = await supabase
      .from('daily_checkins')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd)

    setWeekStats({
      workoutsCompleted: sessionDays.size,
      roughNights,
      objectivesCompleted: completed,
      totalObjectives: objs.length,
      checkinCount: (checkinData || []).length,
    })
    setStatsLoading(false)
  }

  // ── Generate debrief ──────────────────────────────────────────────────────
  const generate = async (force = false) => {
    if (!user) { setError('Sign in to generate your debrief.'); return }

    const { weekStart, weekEnd, cacheKey } = getWeekBounds()

    if (!force) {
      try {
        const raw = localStorage.getItem(cacheKey)
        if (raw) {
          const cached: CachedDebrief = JSON.parse(raw)
          if (cached.weekKey === cacheKey) {
            setDebrief(cached.debrief)
            setGeneratedAt(cached.generatedAt)
            return
          }
        }
      } catch {}
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/debrief-personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          weekStart,
          weekEnd,
          userInputs: { biggestWin, biggestChallenge, intentionForNext },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const ts = new Date().toISOString()
      setDebrief(data.debrief)
      setGeneratedAt(ts)
      setFormOpen(false)
      localStorage.setItem(cacheKey, JSON.stringify({
        weekKey: cacheKey,
        debrief: data.debrief,
        generatedAt: ts,
      } satisfies CachedDebrief))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate debrief.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const gradeConfig = debrief ? GRADE_CONFIG[debrief.overallGrade] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand" />
          <h3 className="font-black text-sm uppercase italic tracking-tighter">Weekly Debrief</h3>
        </div>
        {debrief && (
          <button
            onClick={() => generate(true)}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:text-muted-foreground rounded-lg hover:bg-gray-800 transition-colors"
            title="Regenerate"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Week at a Glance */}
      {!statsLoading && weekStats && (
        <div>
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Your Week at a Glance
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800/40 rounded-xl p-3 flex flex-col items-center gap-1">
              <Dumbbell size={14} className="text-brand" />
              <span className="text-xl font-black text-foreground">{weekStats.workoutsCompleted}</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-center">Sessions</span>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3 flex flex-col items-center gap-1">
              <Moon size={14} className={weekStats.roughNights > 2 ? 'text-red-400' : 'text-yellow-500'} />
              <span className="text-xl font-black text-foreground">{weekStats.roughNights}</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-center">Rough Nights</span>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3 flex flex-col items-center gap-1">
              <CheckSquare size={14} className="text-green-500" />
              <span className="text-xl font-black text-foreground">
                {weekStats.totalObjectives > 0
                  ? `${weekStats.objectivesCompleted}/${weekStats.totalObjectives}`
                  : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-center">Objectives</span>
            </div>
          </div>
        </div>
      )}

      {/* Reflection Form */}
      <div className="bg-gray-800/30 rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setFormOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Add Your Reflection
          </span>
          {formOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {formOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            <div className="pt-3">
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                Biggest Win
              </label>
              <textarea
                value={biggestWin}
                onChange={e => setBiggestWin(e.target.value)}
                placeholder="What went well this week?"
                rows={2}
                className="w-full bg-gray-900/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-gray-600 resize-none focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                Biggest Challenge
              </label>
              <textarea
                value={biggestChallenge}
                onChange={e => setBiggestChallenge(e.target.value)}
                placeholder="What was hard or didn't go to plan?"
                rows={2}
                className="w-full bg-gray-900/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-gray-600 resize-none focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                Intention for Next Week
              </label>
              <textarea
                value={intentionForNext}
                onChange={e => setIntentionForNext(e.target.value)}
                placeholder="What's the one thing you want to lock in?"
                rows={2}
                className="w-full bg-gray-900/60 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-gray-600 resize-none focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Generate Button (shown when no debrief yet, or form is open) */}
      {(!debrief || formOpen) && !loading && (
        <button
          onClick={() => generate(!!debrief)}
          disabled={loading || !user}
          className="w-full py-3 rounded-2xl bg-brand text-white font-black text-sm uppercase tracking-widest hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {debrief ? 'Regenerate Debrief' : 'Generate My Debrief'}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={20} className="animate-spin text-brand" />
          <p className="text-xs font-black uppercase tracking-widest text-gray-600">Analyzing your week...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <p className="text-xs text-red-400 font-bold">{error}</p>
          <button onClick={() => generate(true)} className="text-brand hover:underline text-xs">Try Again</button>
        </div>
      )}

      {/* Debrief Results */}
      {debrief && !loading && gradeConfig && (
        <div className="space-y-4">
          {/* Grade pill */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-black uppercase tracking-widest ${gradeConfig.bg} ${gradeConfig.text} ${gradeConfig.border} ${gradeConfig.glow ?? ''}`}
            >
              {debrief.overallGrade}
            </span>
            {generatedAt && (
              <span className="text-[10px] text-gray-600 font-bold">
                Generated {formatGeneratedDate(generatedAt)}
              </span>
            )}
          </div>

          {/* Assessment headline pull-quote */}
          <div className="border-l-2 border-brand pl-4">
            <p className="font-black text-base italic tracking-tight leading-snug text-foreground">
              {debrief.assessmentHeadline}
            </p>
          </div>

          {/* Focus word */}
          <div className="text-center py-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
              Word of the Week
            </p>
            <p className="text-3xl font-black italic tracking-tighter text-brand">
              {debrief.focusWord.toUpperCase()}
            </p>
          </div>

          {/* Wins */}
          {debrief.wins.length > 0 && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={13} className="text-green-500" />
                <p className="text-xs font-black text-green-600 uppercase tracking-widest">Wins</p>
              </div>
              {debrief.wins.map((win, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-green-500 text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sm text-gray-300 leading-snug">{win}</p>
                </div>
              ))}
            </div>
          )}

          {/* Gaps */}
          {debrief.gaps.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Target size={13} className="text-red-400/70" />
                <p className="text-xs font-black text-red-400/70 uppercase tracking-widest">Gaps</p>
              </div>
              {debrief.gaps.map((gap, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-red-400/60 text-xs mt-0.5 flex-shrink-0">—</span>
                  <p className="text-sm text-gray-400 leading-snug">{gap}</p>
                </div>
              ))}
            </div>
          )}

          {/* Adjustments */}
          {debrief.adjustments.length > 0 && (
            <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} className="text-brand" />
                <p className="text-xs font-black text-brand uppercase tracking-widest">Next Week</p>
              </div>
              {debrief.adjustments.map((adj, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-brand text-xs mt-0.5 flex-shrink-0">→</span>
                  <p className="text-sm text-gray-300 leading-snug">{adj}</p>
                </div>
              ))}
            </div>
          )}

          {/* Mindset note */}
          <div className="border-t border-border pt-4">
            <div className="flex gap-3">
              <Flame size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground italic leading-relaxed">{debrief.mindsetNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
