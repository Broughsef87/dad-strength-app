'use client'

import { useState, useEffect } from 'react'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'

type Briefing = {
  greeting: string
  protocol: string
  anchor: string
  intensity: 'low' | 'medium' | 'high'
}

const INTENSITY_COLOR = {
  low:    'text-blue-400 bg-blue-500/10',
  medium: 'text-indigo-400 bg-indigo-500/10',
  high:   'text-orange-400 bg-orange-500/10',
}

const INTENSITY_LABEL = {
  low:    'Recovery Day',
  medium: 'Standard Protocol',
  high:   'Full Send',
}

export default function AIMorningAnchor({
  streak = 0,
  totalWorkouts = 0,
  objectives = [],
  programName = '',
}: {
  streak?: number
  totalWorkouts?: number
  objectives?: string[]
  programName?: string
}) {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const STORAGE_KEY = 'ai-morning-briefing'

  const loadCached = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return null
      const data = JSON.parse(saved)
      if (data.date === new Date().toLocaleDateString()) return data.briefing
    } catch {}
    return null
  }

  useEffect(() => {
    const cached = loadCached()
    if (cached) { setBriefing(cached); return }
    generate()
  }, [])

  const generate = async (force = false) => {
    if (!force) {
      const cached = loadCached()
      if (cached) { setBriefing(cached); return }
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/morning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streak, totalWorkouts, objectives, programName }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBriefing(data.briefing)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: new Date().toLocaleDateString(),
        briefing: data.briefing,
      }))
    } catch {
      setError('Could not generate briefing.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Loader2 size={20} className="animate-spin text-indigo-500" />
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Generating your protocol...</p>
    </div>
  )

  if (error) return (
    <div className="text-center py-4">
      <p className="text-xs text-red-400 font-bold">{error}</p>
    </div>
  )

  if (!briefing) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          <h3 className="font-black text-sm uppercase italic tracking-tighter">Morning Anchor</h3>
        </div>
        <button
          onClick={() => generate(true)}
          className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-gray-800"
          title="Regenerate"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Intensity badge */}
      <span className={`inline-block text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${INTENSITY_COLOR[briefing.intensity]}`}>
        {INTENSITY_LABEL[briefing.intensity]}
      </span>

      {/* Greeting */}
      <p className="font-black text-lg italic tracking-tight leading-snug">{briefing.greeting}</p>

      {/* Protocol */}
      <p className="text-sm text-gray-400 leading-relaxed font-medium">{briefing.protocol}</p>

      {/* Anchor */}
      <div className="border-l-2 border-indigo-500/40 pl-4 mt-2">
        <p className="text-xs font-black italic text-indigo-300 leading-snug">{briefing.anchor}</p>
      </div>
    </div>
  )
}
