'use client'

import { useState } from 'react'
import { Brain, Clock, Loader2, Zap, Play, SkipForward, Lock } from 'lucide-react'

const TIME_OPTIONS = [10, 20, 30, 45]

const STATES = [
  { id: 'focused',   label: 'Locked in',          emoji: '🎯' },
  { id: 'scattered', label: 'Scattered / distracted', emoji: '🌀' },
  { id: 'tired',     label: 'Running on fumes',    emoji: '😮‍💨' },
  { id: 'anxious',   label: 'Anxious / overwhelmed', emoji: '⚡' },
  { id: 'creative',  label: 'Creative energy',     emoji: '🔥' },
]

const BLOCK_COLORS: Record<string, string> = {
  focus:      'border-indigo-500/30 bg-indigo-500/5 text-indigo-300',
  transition: 'border-gray-700 bg-gray-800/40 text-gray-400',
  review:     'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
}

const BLOCK_ICONS: Record<string, any> = {
  focus:      Zap,
  transition: SkipForward,
  review:     Brain,
}

type Block = { minutes: number; task: string; type: 'focus' | 'transition' | 'review' }
type Sprint = {
  title: string
  primaryFocus: string
  blocks: Block[]
  mindset: string
  skip: string
}

export default function MindSqueeze({ objectives = [] }: { objectives?: string[] }) {
  const [minutes, setMinutes] = useState(20)
  const [state, setState] = useState('focused')
  const [loading, setLoading] = useState(false)
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const [activeBlock, setActiveBlock] = useState(0)

  const generate = async () => {
    setLoading(true)
    setError('')
    setSprint(null)
    setActive(false)
    setActiveBlock(0)
    try {
      const res = await fetch('/api/ai/mind-sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes,
          state: STATES.find(s => s.id === state)?.label,
          objectives,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSprint(data.sprint)
    } catch {
      setError('Failed to generate. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-indigo-500" />
        <h3 className="font-black text-lg uppercase italic tracking-tighter">Mind Squeeze</h3>
      </div>
      <p className="text-xs text-gray-500 font-medium -mt-4">Stolen time. Optimized focus. Let's go.</p>

      {/* Time */}
      <div>
        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">
          <Clock size={10} className="inline mr-1" /> Available Time
        </label>
        <div className="flex gap-2">
          {TIME_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setMinutes(t)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                minutes === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}m
            </button>
          ))}
        </div>
      </div>

      {/* Mental state */}
      <div>
        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">Mental State</label>
        <div className="space-y-2">
          {STATES.map(s => (
            <button
              key={s.id}
              onClick={() => setState(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
                state === s.id
                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                  : 'bg-gray-800/50 border border-transparent text-gray-400 hover:border-gray-700'
              }`}
            >
              <span>{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Objectives preview */}
      {objectives.filter(Boolean).length > 0 && (
        <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-800">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Pulling from your objectives</p>
          {objectives.filter(Boolean).map((o, i) => (
            <p key={i} className="text-xs text-gray-400 font-medium">· {o}</p>
          ))}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> Building Sprint...</>
          : <><Brain size={16} /> Generate Sprint</>
        }
      </button>

      {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}

      {/* Sprint result */}
      {sprint && (
        <div className="bg-gray-900 rounded-3xl border border-indigo-500/20 p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {/* Header */}
          <div>
            <h4 className="font-black text-xl italic uppercase tracking-tight">{sprint.title}</h4>
            <div className="flex items-center gap-2 mt-2">
              <Zap size={12} className="text-indigo-400" />
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{sprint.primaryFocus}</p>
            </div>
          </div>

          {/* Mindset anchor */}
          <div className="border-l-2 border-indigo-500/40 pl-4">
            <p className="text-xs text-indigo-300 italic font-bold leading-snug">"{sprint.mindset}"</p>
          </div>

          {/* Time blocks */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sprint Protocol</p>
            {sprint.blocks.map((block, i) => {
              const Icon = BLOCK_ICONS[block.type] || Zap
              const isActive = active && activeBlock === i
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10'
                      : BLOCK_COLORS[block.type] || BLOCK_COLORS.focus
                  }`}
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-gray-800/60 text-gray-500'
                  }`}>
                    {block.minutes}m
                  </div>
                  <p className="text-sm font-bold flex-1">{block.task}</p>
                  {isActive && <Icon size={14} className="text-indigo-400 animate-pulse flex-shrink-0" />}
                </div>
              )
            })}
          </div>

          {/* Skip note */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl px-4 py-3 flex gap-3 items-start">
            <Lock size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-0.5">Do Not Touch</p>
              <p className="text-xs text-gray-400 font-medium">{sprint.skip}</p>
            </div>
          </div>

          {/* Deploy */}
          {!active ? (
            <button
              onClick={() => setActive(true)}
              className="w-full flex items-center justify-center gap-2 bg-white text-gray-950 font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 hover:bg-indigo-50 shadow-xl"
            >
              <Play size={16} /> Start Sprint
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setActiveBlock(b => Math.min(b + 1, sprint.blocks.length - 1))}
                disabled={activeBlock >= sprint.blocks.length - 1}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
              >
                Next Block →
              </button>
              <button
                onClick={() => { setActive(false); setActiveBlock(0) }}
                className="px-4 bg-gray-800 text-gray-400 font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-gray-700 transition-all"
              >
                End
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
