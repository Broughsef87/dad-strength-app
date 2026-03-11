'use client'

import { useState } from 'react'
import { Zap, Clock, Loader2, PlayCircle, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'

const TIME_OPTIONS = [15, 20, 30, 45]
const SITUATIONS = [
  { id: 'standard', label: 'Standard session' },
  { id: 'tired', label: 'Rough night with baby' },
  { id: 'energized', label: 'Feeling strong' },
  { id: 'stressed', label: 'High stress day' },
  { id: 'sore', label: 'Still sore from last time' },
]

type GeneratedWorkout = {
  title: string
  tagline: string
  coachNote: string
  exercises: { name: string; sets: number; reps: string; note?: string }[]
}

export default function NapSqueeze({ track = 'iron' }: { track?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [minutes, setMinutes] = useState(20)
  const [situation, setSituation] = useState('standard')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GeneratedWorkout | null>(null)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)

  const generate = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, situation: SITUATIONS.find(s => s.id === situation)?.label, track }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.workout)
    } catch (err: any) {
      setError('Failed to generate. Check your API key is set.')
    } finally {
      setLoading(false)
    }
  }

  const deployWorkout = async () => {
    if (!result) return
    setDeploying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: workout, error: insertError } = await supabase
        .from('workouts')
        .insert({
          name: result.title,
          description: result.tagline,
          exercises: result.exercises,
          status: 'active',
          user_id: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError
      localStorage.setItem('activeWorkoutId', workout.id)
      router.push(`/workout/${workout.id}`)
    } catch {
      setError('Failed to save workout.')
      setDeploying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={18} className="text-indigo-500" />
        <h3 className="font-black text-lg uppercase italic tracking-tighter">Nap-Squeeze Mode</h3>
      </div>
      <p className="text-xs text-gray-500 font-medium -mt-4">Tell me what you've got. I'll build your session.</p>

      {/* Time selector */}
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

      {/* Situation selector */}
      <div>
        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block mb-3">Current State</label>
        <div className="space-y-2">
          {SITUATIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSituation(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                situation === s.id
                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                  : 'bg-gray-800/50 border border-transparent text-gray-400 hover:border-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Building Session...</> : <><Zap size={16} /> Generate Session</>}
      </button>

      {error && (
        <p className="text-red-400 text-xs font-bold text-center">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="bg-gray-900 rounded-3xl border border-indigo-500/20 p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div>
            <h4 className="font-black text-xl italic uppercase tracking-tight">{result.title}</h4>
            <p className="text-indigo-400 text-sm font-medium mt-1">{result.tagline}</p>
          </div>

          <div className="space-y-3">
            {result.exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-2xl px-4 py-3">
                <div>
                  <p className="font-black text-sm">{ex.name}</p>
                  {ex.note && <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{ex.note}</p>}
                </div>
                <span className="font-black text-indigo-400 text-sm">{ex.sets}×{ex.reps}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 italic border-t border-gray-800 pt-4">{result.coachNote}</p>

          <button
            onClick={deployWorkout}
            disabled={deploying}
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-950 font-black py-4 rounded-2xl uppercase tracking-widest transition-all active:scale-95 hover:bg-indigo-50 shadow-xl disabled:opacity-50"
          >
            {deploying ? <Loader2 size={16} className="animate-spin" /> : <><PlayCircle size={16} /> Deploy This Session</>}
          </button>
        </div>
      )}
    </div>
  )
}
