'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Sun, BookOpen, PenLine, Target, Flame } from 'lucide-react'

const TIME_OPTIONS = [5, 10, 20, 30]

const BABY_NIGHTS = [
  { id: 'great',  label: 'Slept great',       emoji: '😴' },
  { id: 'ok',     label: 'Decent night',       emoji: '🙂' },
  { id: 'rough',  label: 'Rough night',        emoji: '😮‍💨' },
  { id: 'brutal', label: 'Up all night',       emoji: '💀' },
]

const ENERGY_LEVELS = [
  { id: 'high',   label: 'Ready to go',        emoji: '🔥' },
  { id: 'medium', label: 'Getting there',      emoji: '☕' },
  { id: 'low',    label: 'Running on fumes',   emoji: '🌫️' },
]

const PILLAR_ICONS: Record<string, any> = {
  'Prayer':          Flame,
  'Meditation':      Sun,
  'Reading':         BookOpen,
  'Goals & Journal': PenLine,
}

const PILLAR_COLORS: Record<string, string> = {
  'Prayer':          'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'Meditation':      'text-sky-400 bg-sky-500/10 border-sky-500/20',
  'Reading':         'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Goals & Journal': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
}

type Step = {
  pillar: string
  minutes: number
  title: string
  guidance: string
  prompt: string
}

type Protocol = {
  theme: string
  greeting: string
  steps: Step[]
  closingWord: string
}

const STORAGE_KEY = 'dad-strength-morning-protocol'
const todayKey = () => new Date().toLocaleDateString()

export default function MorningProtocol({ objectives = [] }: { objectives?: string[] }) {
  const [minutes, setMinutes] = useState(20)
  const [babyNight, setBabyNight] = useState('ok')
  const [energy, setEnergy] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [completed, setCompleted] = useState<boolean[]>([])
  const [expanded, setExpanded] = useState<number | null>(0)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState(false)

  // Load cached protocol for today
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.date === todayKey()) {
          setProtocol(data.protocol)
          setCompleted(data.completed || new Array(data.protocol.steps.length).fill(false))
          setConfigured(true)
        }
      }
    } catch {}
  }, [])

  const saveCache = (p: Protocol, c: boolean[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), protocol: p, completed: c }))
  }

  const generate = async (force = false) => {
    setLoading(true)
    setError('')
    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      const res = await fetch('/api/ai/morning-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          babyNight: BABY_NIGHTS.find(b => b.id === babyNight)?.label,
          energy: ENERGY_LEVELS.find(e => e.id === energy)?.label,
          objectives,
          dayOfWeek,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const fresh = data.protocol as Protocol
      const freshCompleted = new Array(fresh.steps.length).fill(false)
      setProtocol(fresh)
      setCompleted(freshCompleted)
      setExpanded(0)
      setConfigured(true)
      saveCache(fresh, freshCompleted)
    } catch {
      setError('Failed to generate. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleStep = (i: number) => {
    const next = [...completed]
    next[i] = !next[i]
    setCompleted(next)
    if (protocol) saveCache(protocol, next)
    // Auto-expand next incomplete step
    if (next[i] && i < (protocol?.steps.length || 0) - 1) {
      setExpanded(i + 1)
    }
  }

  const doneCount = completed.filter(Boolean).length
  const totalSteps = protocol?.steps.length || 0
  const allDone = doneCount === totalSteps && totalSteps > 0

  // Config screen
  if (!configured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-orange-400" />
          <h3 className="font-black text-lg uppercase italic tracking-tighter">Morning Protocol</h3>
        </div>
        <p className="text-xs text-gray-500 font-medium -mt-4">Build your morning. Own your day.</p>

        {/* Time */}
        <div>
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">How much time do you have?</label>
          <div className="flex gap-2">
            {TIME_OPTIONS.map(t => (
              <button key={t} onClick={() => setMinutes(t)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  minutes === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
              >{t}m</button>
            ))}
          </div>
        </div>

        {/* Baby's night */}
        <div>
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">How'd the baby sleep?</label>
          <div className="grid grid-cols-2 gap-2">
            {BABY_NIGHTS.map(b => (
              <button key={b.id} onClick={() => setBabyNight(b.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  babyNight === b.id
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                    : 'bg-gray-800/50 border border-transparent text-gray-400 hover:border-gray-700'
                }`}
              >
                <span>{b.emoji}</span> {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">Your energy right now?</label>
          <div className="space-y-2">
            {ENERGY_LEVELS.map(e => (
              <button key={e.id} onClick={() => setEnergy(e.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  energy === e.id
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                    : 'bg-gray-800/50 border border-transparent text-gray-400 hover:border-gray-700'
                }`}
              >
                <span>{e.emoji}</span> {e.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}

        <button
          onClick={() => generate()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20 text-base"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Building Your Morning...</>
            : <><Sun size={18} /> Build My Morning</>
          }
        </button>
      </div>
    )
  }

  // Protocol view
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun size={16} className="text-orange-400" />
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Morning Protocol</span>
          </div>
          <h3 className="font-black text-2xl italic uppercase tracking-tight leading-none">
            {protocol?.theme}
          </h3>
        </div>
        <button
          onClick={() => { setConfigured(false); setProtocol(null); setCompleted([]) }}
          className="p-1.5 text-gray-600 hover:text-gray-400 rounded-lg hover:bg-gray-800 transition-colors"
          title="Rebuild"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Greeting */}
      <p className="text-sm text-gray-300 font-medium leading-relaxed">{protocol?.greeting}</p>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Progress</span>
          <span className="text-[10px] font-black text-indigo-400">{doneCount}/{totalSteps}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: totalSteps ? `${(doneCount / totalSteps) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {protocol?.steps.map((step, i) => {
          const Icon = PILLAR_ICONS[step.pillar] || Sun
          const colors = PILLAR_COLORS[step.pillar] || PILLAR_COLORS['Prayer']
          const isExpanded = expanded === i
          const isDone = completed[i]

          return (
            <div
              key={i}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isDone ? 'border-gray-800 opacity-60' : 'border-gray-800'
              }`}
            >
              {/* Step header */}
              <button
                onClick={() => setExpanded(isExpanded ? null : i)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/30 transition-all"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStep(i) }}
                  className="flex-shrink-0 transition-all"
                >
                  {isDone
                    ? <CheckCircle2 size={22} className="text-indigo-500" />
                    : <Circle size={22} className="text-gray-700 hover:text-gray-500" />
                  }
                </button>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${colors}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-sm tracking-tight ${isDone ? 'line-through text-gray-600' : ''}`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">
                    {step.pillar} · {step.minutes}m
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-600 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-600 flex-shrink-0" />}
              </button>

              {/* Expanded content */}
              {isExpanded && !isDone && (
                <div className="px-5 pb-5 space-y-3 border-t border-gray-800/50 pt-4">
                  <p className="text-sm text-gray-400 leading-relaxed">{step.guidance}</p>
                  <div className={`rounded-xl px-4 py-3 border ${colors}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Focus Prompt</p>
                    <p className="text-sm font-bold italic">{step.prompt}</p>
                  </div>
                  <button
                    onClick={() => toggleStep(i)}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    Mark Complete ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Closing word */}
      {allDone && protocol?.closingWord && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 text-center animate-in fade-in duration-500">
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Morning Complete</p>
          <p className="text-base font-black italic text-white leading-snug">{protocol.closingWord}</p>
        </div>
      )}
    </div>
  )
}
