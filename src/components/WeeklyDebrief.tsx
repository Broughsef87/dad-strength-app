'use client'

import { useState, useEffect } from 'react'
import { Loader2, TrendingUp, RefreshCw, Trophy, Target, Flame } from 'lucide-react'

type Debrief = {
  headline: string
  summary: string
  win: string
  focus: string
  dadQuote: string
}

export default function WeeklyDebrief({
  weekSessions = 0,
  totalVolume = 0,
  topLift = '',
  streak = 0,
  objectives = [],
  journalEntries = [],
}: {
  weekSessions?: number
  totalVolume?: number
  topLift?: string
  streak?: number
  objectives?: string[]
  journalEntries?: string[]
}) {
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const STORAGE_KEY = 'ai-weekly-debrief'

  const getWeekKey = () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return start.toLocaleDateString()
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.weekKey === getWeekKey()) { setDebrief(data.debrief); return }
      }
    } catch {}
    generate()
  }, [])

  const generate = async (force = false) => {
    if (!force) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const data = JSON.parse(saved)
          if (data.weekKey === getWeekKey()) { setDebrief(data.debrief); return }
        }
      } catch {}
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekSessions, totalVolume, topLift, streak, objectives, journalEntries }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDebrief(data.debrief)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ weekKey: getWeekKey(), debrief: data.debrief }))
    } catch {
      setError('Could not generate debrief.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Loader2 size={20} className="animate-spin text-indigo-500" />
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Analyzing your week...</p>
    </div>
  )

  if (error) return <p className="text-xs text-red-400 font-bold text-center py-4">{error}</p>
  if (!debrief) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          <h3 className="font-black text-sm uppercase italic tracking-tighter">Weekly Debrief</h3>
        </div>
        <button onClick={() => generate(true)} className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-gray-800 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Headline */}
      <p className="font-black text-2xl italic tracking-tight leading-none">{debrief.headline}</p>

      {/* Summary */}
      <p className="text-sm text-gray-400 leading-relaxed">{debrief.summary}</p>

      {/* Win + Focus */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-gray-800/40 rounded-2xl p-4 flex gap-3">
          <Trophy size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Biggest Win</p>
            <p className="text-sm font-bold text-gray-200">{debrief.win}</p>
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-2xl p-4 flex gap-3">
          <Target size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Next Week Focus</p>
            <p className="text-sm font-bold text-gray-200">{debrief.focus}</p>
          </div>
        </div>
      </div>

      {/* Dad quote */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex gap-3">
          <Flame size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 italic leading-relaxed">{debrief.dadQuote}</p>
        </div>
      </div>
    </div>
  )
}
