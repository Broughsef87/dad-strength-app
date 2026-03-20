'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Circle, ChevronDown, ChevronUp, Sun, BookOpen, PenLine, Target, Flame } from 'lucide-react'
import AmbientAudioPlayer from './AmbientAudioPlayer'
import RecommendedReading from './RecommendedReading'

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
  'Prayer':          'text-brand bg-brand/10 border-brand/20',
  'Meditation':      'text-foreground bg-muted border-border',
  'Reading':         'text-foreground bg-muted border-border',
  'Goals & Journal': 'text-foreground bg-muted border-border',
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
    if (next[i] && i < (protocol?.steps.length || 0) - 1) {
      setExpanded(i + 1)
    }
  }

  const doneCount = completed.filter(Boolean).length
  const totalSteps = protocol?.steps.length || 0
  const allDone = doneCount === totalSteps && totalSteps > 0

  if (!configured) {
    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun size={14} className="text-brand" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-brand font-medium">Morning Protocol</span>
          </div>
          <p className="text-xs text-muted-foreground font-light">Build your morning. Own your day.</p>
        </div>

        {/* Time */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-medium block mb-2.5">How much time?</label>
          <div className="flex gap-2">
            {TIME_OPTIONS.map(t => (
              <button key={t} onClick={() => setMinutes(t)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  minutes === t
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
                }`}
              >{t}m</button>
            ))}
          </div>
        </div>

        {/* Baby's night */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-medium block mb-2.5">How'd the baby sleep?</label>
          <div className="grid grid-cols-2 gap-2">
            {BABY_NIGHTS.map(b => (
              <button key={b.id} onClick={() => setBabyNight(b.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all border ${
                  babyNight === b.id
                    ? 'bg-brand/5 border-brand/30 text-foreground'
                    : 'bg-muted border-transparent text-muted-foreground hover:border-border'
                }`}
              >
                <span>{b.emoji}</span> <span className="text-xs">{b.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-medium block mb-2.5">Your energy right now?</label>
          <div className="space-y-2">
            {ENERGY_LEVELS.map(e => (
              <button key={e.id} onClick={() => setEnergy(e.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all border ${
                  energy === e.id
                    ? 'bg-brand/5 border-brand/30 text-foreground'
                    : 'bg-muted border-transparent text-muted-foreground hover:border-border'
                }`}
              >
                <span>{e.emoji}</span> <span className="text-xs">{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-red-500 text-xs">{error}</p>
            <button onClick={() => generate()} className="text-brand hover:underline text-xs">Try Again</button>
          </div>
        )}

        <button
          onClick={() => generate()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-foreground hover:opacity-90 disabled:opacity-50 text-background font-medium py-4 rounded-lg text-sm uppercase tracking-[0.1em] transition-all active:scale-[0.98]"
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Building...</>
            : <><Sun size={16} /> Build My Morning</>
          }
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Sun size={13} className="text-brand" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-brand font-medium">Morning Protocol</span>
          </div>
          <h3 className="font-light text-lg tracking-tight leading-tight">
            {protocol?.theme}
          </h3>
        </div>
        <button
          onClick={() => { setConfigured(false); setProtocol(null); setCompleted([]) }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          title="Rebuild"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Greeting */}
      <p className="text-sm text-muted-foreground font-light leading-relaxed">{protocol?.greeting}</p>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-medium">Progress</span>
          <span className="text-[10px] text-brand font-medium">{doneCount}/{totalSteps}</span>
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: totalSteps ? `${(doneCount / totalSteps) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {protocol?.steps.map((step, i) => {
          const Icon = PILLAR_ICONS[step.pillar] || Sun
          const colors = PILLAR_COLORS[step.pillar] || PILLAR_COLORS['Prayer']
          const isExpanded = expanded === i
          const isDone = completed[i]

          return (
            <div
              key={i}
              className={`rounded-xl border overflow-hidden transition-all ${
                isDone ? 'border-border opacity-60' : 'border-border'
              }`}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : i)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/50 transition-colors"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStep(i) }}
                  className="flex-shrink-0 transition-all"
                >
                  {isDone
                    ? <CheckCircle2 size={18} className="text-brand" />
                    : <Circle size={18} className="text-border hover:text-muted-foreground" />
                  }
                </button>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${colors}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {step.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] mt-0.5">
                    {step.pillar} · {step.minutes}m
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
              </button>

              {isExpanded && !isDone && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground font-light leading-relaxed">{step.guidance}</p>
                  {step.pillar === 'Meditation' && <AmbientAudioPlayer />}
                  {step.pillar === 'Reading' && <RecommendedReading />}
                  <div className={`rounded-lg px-4 py-3 border ${colors}`}>
                    <p className="text-[10px] uppercase tracking-[0.1em] font-medium mb-1 opacity-70">Focus Prompt</p>
                    <p className="text-sm font-light italic">{step.prompt}</p>
                  </div>
                  <button
                    onClick={() => toggleStep(i)}
                    className="w-full bg-muted hover:bg-foreground hover:text-background text-foreground font-medium py-2.5 rounded-lg text-xs uppercase tracking-[0.1em] transition-all"
                  >
                    Mark Complete ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allDone && protocol?.closingWord && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-center">
          <p className="text-[10px] text-brand uppercase tracking-[0.12em] font-medium mb-2">Morning Complete</p>
          <p className="text-sm font-light text-foreground leading-snug">{protocol.closingWord}</p>
        </div>
      )}
    </div>
  )
}
