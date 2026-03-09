'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Edit3, Trophy } from 'lucide-react'
import SetRow from '../../../components/SetRow'
import WorkoutTimer from '../../../components/WorkoutTimer'

type Exercise = {
  id: string
  name: string
  sets: number
  target_reps: string
}

type Workout = {
  id: string
  name: string
  exercises: Exercise[]
  status?: string
}

export default function ActiveWorkout() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any>({})
  const [timer, setTimer] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [totalVolume, setTotalVolume] = useState(0)

  useEffect(() => {
    const fetchWorkout = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', params?.id)
        .single()
      
      if (error) {
        console.error('Error fetching workout:', error)
      } else {
        const exercisesWithIds = (data.exercises as any[]).map((ex, idx) => ({
          ...ex,
          id: ex.id || `ex-${idx}`,
          target_reps: ex.reps
        }))
        setWorkout({ ...data, exercises: exercisesWithIds })
      }
      setLoading(false)
    }
    if (params?.id) {
      fetchWorkout()
    }
  }, [supabase, params?.id])

  useEffect(() => {
    let interval: any
    if (timerRunning) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const syncSetToSupabase = async (exerciseName: string, setIndex: number, isCompleted: boolean) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !workout) return

    const key = `${exerciseName}-${setIndex}`
    const log = logs[key] || {}

    // Upsert logic: if we had a log ID we'd use it, 
    // but here we match on workout_id, exercise_name, and set_number
    const { error } = await supabase
      .from('workout_logs')
      .upsert({
        user_id: user.id,
        workout_id: workout.id,
        exercise_name: exerciseName,
        set_number: setIndex + 1,
        weight_lbs: parseFloat(log.weight) || 0,
        reps: parseInt(log.reps) || 0,
        completed: isCompleted,
      }, {
        onConflict: 'user_id,workout_id,exercise_name,set_number'
      })

    if (error) console.error('Failed to sync set:', error)
  }

  const toggleSet = async (exercise: Exercise, setIndex: number) => {
    const key = `${exercise.id}-${setIndex}`
    const isNowCompleted = !logs[key]?.completed
    
    setLogs((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], completed: isNowCompleted }
    }))
    
    if (isNowCompleted) {
      setTimer(0)
      setTimerRunning(true)
    }

    // Persist to Supabase
    await syncSetToSupabase(exercise.name, setIndex, isNowCompleted)
  }

  const handleInputChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    const key = `${exerciseId}-${setIndex}`
    setLogs((prev: any) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const finishWorkout = async () => {
    if (!workout) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Calculate final volume for summary
    let volume = 0
    for (const exercise of workout.exercises) {
      for (let i = 0; i < exercise.sets; i++) {
        const key = `${exercise.id}-${i}`
        const log = logs[key]
        if (log && log.completed) {
          volume += (parseFloat(log.weight) || 0) * (parseInt(log.reps) || 0)
        }
      }
    }

    // Update workout status
    const { error } = await supabase
      .from('workouts')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', workout.id)

    if (error) {
      console.error('Error completing workout:', error)
      // Even if status update fails, we show summary because logs were synced per-set
    }
    
    setTotalVolume(volume)
    setShowSummary(true)
    setTimerRunning(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 font-sans">
      <header className="sticky top-0 z-20 bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 p-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h1 className="text-xs font-black uppercase tracking-widest text-gray-500">{workout?.name}</h1>
          <WorkoutTimer seconds={timer} formatTime={formatTime} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/workout/${params?.id}/edit`)} className="p-2 text-gray-500 hover:text-white transition-colors">
            <Edit3 size={20} />
          </button>
          <button onClick={finishWorkout} className="bg-green-600 hover:bg-green-500 text-white text-xs font-black px-4 py-2 rounded-full transition-all active:scale-95">
            FINISH
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        {workout?.exercises.map((exercise) => (
          <div key={exercise.id} className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-black text-xl tracking-tight">{exercise.name}</h3>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Target: {exercise.target_reps}</p>
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: exercise.sets }).map((_, i) => {
                const key = `${exercise.id}-${i}`
                const log = logs[key] || { weight: '', reps: '', completed: false }
                return (
                  <SetRow 
                    key={i}
                    index={i}
                    isDone={log.completed}
                    weight={log.weight}
                    reps={log.reps}
                    onWeightChange={(val) => handleInputChange(exercise.id, i, 'weight', val)}
                    onRepsChange={(val) => handleInputChange(exercise.id, i, 'reps', val)}
                    onToggle={() => toggleSet(exercise, i)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* SUMMARY OVERLAY */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-950/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
          <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <Trophy size={64} className="text-yellow-500 mx-auto mb-6 animate-bounce" />
             <h2 className="text-3xl font-black mb-2">WORKOUT DONE</h2>
             <p className="text-gray-400 font-medium mb-8">Another brick in the wall, Dad.</p>
             
             <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                <div className="bg-gray-800/50 p-4 rounded-2xl">
                   <p className="text-[10px] font-black text-gray-500 uppercase">Total Volume</p>
                   <p className="text-xl font-bold">{totalVolume.toLocaleString()} <span className="text-xs text-gray-500">lbs</span></p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-2xl">
                   <p className="text-[10px] font-black text-gray-500 uppercase">Time</p>
                   <p className="text-xl font-bold">{formatTime(timer)}</p>
                </div>
             </div>

             <button 
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
             >
               RETURN TO BASE
             </button>
          </div>
        </div>
      )}
    </div>
  )
}
