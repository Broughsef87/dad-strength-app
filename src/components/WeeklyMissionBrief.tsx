'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { Map, RefreshCw, ChevronDown, ChevronUp, Target, Heart, Dumbbell, Zap } from 'lucide-react'

type Brief = {
  weekTheme: string
  missionStatement: string
  primaryObjective: string
  familyMission: string
  trainingDirective: string
  dailyEdge: string
}

type BriefState = {
  weekKey: string
  weekObjective: string
  familyIntention: string
  trainingFocus: string
  brief: Brief | null
}

const STORAGE_KEY = 'dad-strength-mission-brief'

function getWeekKey() {
  const monday = new Date()
  monday.setDate(monday.getDate() - monday.getDay() + 1)
  return monday.toISOString().split('T')[0]
}

export default function WeeklyMissionBrief() {
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<BriefState>({
    weekKey: getWeekKey(),
    weekObjective: '',
    familyIntention: '',
    trainingFocus: '',
    brief: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const data: BriefState = JSON.parse(saved)
        if (data.weekKey === getWeekKey()) {
          setState(data)
          if (data.brief) setExpanded(true)
        }
      } catch {}
    }
  }, [])

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/mission-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekObjective: state.weekObjective,
          familyIntention: state.familyIntention,
          trainingFocus: state.trainingFocus,
          weekNumber: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const newState = { ...state, brief: data.brief }
      setState(newState)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      setExpanded(true)
      setShowForm(false)
    } catch (err: any) {
      setError(err.message || 'Failed to generate. Try again.')
    }
    setLoading(false)
  }

  if (!mounted) return null

  const hasBrief = !!state.brief

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => hasBrief ? setExpanded(!expanded) : setShowForm(!showForm)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Map size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-sm">Weekly Mission Brief</h3>
            {state.brief && (
              <p className="text-[10px] text-brand font-black uppercase tracking-widest mt-0.5">{state.brief.weekTheme}</p>
            )}
          </div>
        </div>
        {hasBrief ? (
          expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <span className="text-[10px] text-brand font-black uppercase tracking-widest">Generate →</span>
        )}
      </button>

      {/* Form to generate */}
      {!hasBrief && showForm && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Answer three questions. The AI builds your week's battle plan.</p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                #1 Objective This Week
              </label>
              <input
                type="text"
                value={state.weekObjective}
                onChange={e => setState(s => ({ ...s, weekObjective: e.target.value }))}
                placeholder="What must get done this week?"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                Family Intention
              </label>
              <input
                type="text"
                value={state.familyIntention}
                onChange={e => setState(s => ({ ...s, familyIntention: e.target.value }))}
                placeholder="One thing for your family this week..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1.5">
                Training Focus
              </label>
              <input
                type="text"
                value={state.trainingFocus}
                onChange={e => setState(s => ({ ...s, trainingFocus: e.target.value }))}
                placeholder="Strength, endurance, recovery..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand transition-colors placeholder:text-muted-foreground"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-brand text-white font-black text-xs uppercase tracking-[0.15em] py-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? 'Generating Mission Brief...' : 'Generate This Week\'s Brief'}
          </button>
        </div>
      )}

      {/* Brief content */}
      {hasBrief && expanded && state.brief && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {/* Mission Statement */}
          <p className="text-sm text-foreground leading-relaxed italic border-l-2 border-brand pl-3">
            "{state.brief.missionStatement}"
          </p>

          {/* Breakdown */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <Target size={14} className="text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-0.5">Primary Objective</p>
                <p className="text-xs text-foreground">{state.brief.primaryObjective}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Heart size={14} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-0.5">Family Mission</p>
                <p className="text-xs text-foreground">{state.brief.familyMission}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Dumbbell size={14} className="text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-0.5">Training Directive</p>
                <p className="text-xs text-foreground">{state.brief.trainingDirective}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Zap size={14} className="text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-0.5">Daily Edge</p>
                <p className="text-xs text-foreground italic">{state.brief.dailyEdge}</p>
              </div>
            </div>
          </div>

          {/* Regenerate */}
          <button
            onClick={() => { setState(s => ({ ...s, brief: null })); setShowForm(true); setExpanded(false) }}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest font-medium"
          >
            <RefreshCw size={10} /> Regenerate
          </button>
        </div>
      )}
    </div>
  )
}
