'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Edit3 } from 'lucide-react'
import ActiveSetRow from '../../../components/workout/ActiveSetRow'
import RestTimer from '../../../components/workout/RestTimer'
import WorkoutTimer from '../../../components/WorkoutTimer'
import ActiveSessionHeader from '../../../components/workout/ActiveSessionHeader'
import ExerciseCard from '../../../components/workout/ExerciseCard'
import WorkoutSummaryOverlay from '../../../components/workout/WorkoutSummaryOverlay'

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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [totalVolume, setTotalVolume] = useState(0)
  const [restTime, setRestTime] = useState(0)
  const [isGraceMode, setIsGraceMode] = useState(false)
  const [userId, setUserId] = useState('')

  // PERSISTENCE: Save state to localStorage
  useEffect(() => {
    if (!workout || showSummary) return
    const state = {
      logs,
      timer,
      timerRunning: timerRunning && !isGraceMode,
      isGraceMode,
      lastUpdated: Date.now()
    }
    localStorage.setItem(`workout-state-${workout.id}`, JSON.stringify(state))
  }, [logs, timer, timerRunning, isGraceMode, workout, showSummary])

  // PERSISTENCE: Load state from localStorage
  useEffect(() => {
    if (workout) {
      const saved = localStorage.getItem(`workout-state-${workout.id}`)
      if (saved) {
        try {
          const { logs: savedLogs, timer: savedTimer, isGraceMode: savedGrace } = JSON.parse(saved)
          setLogs(savedLogs || {})
          setTimer(savedTimer || 0)
          setIsGraceMode(savedGrace || false)
          // If it was running or in grace mode, we keep the timer state logical
          if (savedGrace) {
            setTimerRunning(false)
          } else {
            // Check if it was recently active to decide if we resume timer
            setTimerRunning(Object.keys(savedLogs || {}).length > 0)
          }
        } catch (e) {
          console.error('Error parsing saved workout state', e)
        }
      }
    }
  }, [workout])

  useEffect(() => {
    let interval: any
    if (restTime > 0 && !isGraceMode) {
      interval = setInterval(() => {
        setRestTime((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [restTime, isGraceMode])

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
    if (timerRunning && !isGraceMode) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning, isGraceMode])

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
      setRestTime(90) // 90 second rest
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
    setUserId(user.id)

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

  const isExerciseComplete = (exercise: Exercise) => {
    return Array.from({ length: exercise.sets }).every((_, i) => {
      const key = `${exercise.id}-${i}`
      return logs[key]?.completed
    })
  }

  const currentVolume = () => {
    let volume = 0
    if (!workout) return 0
    for (const exercise of workout.exercises) {
      for (let i = 0; i < exercise.sets; i++) {
        const key = `${exercise.id}-${i}`
        const log = logs[key]
        if (log && log.completed) {
          volume += (parseFloat(log.weight) || 0) * (parseInt(log.reps) || 0)
        }
      }
    }
    return volume
  }

  const getProgress = () => {
    if (!workout) return 0
    let totalSets = 0
    let completedSets = 0
    for (const exercise of workout.exercises) {
      totalSets += exercise.sets
      for (let i = 0; i < exercise.sets; i++) {
        if (logs[`${exercise.id}-${i}`]?.completed) {
          completedSets++
        }
      }
    }
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 font-sans">
      <header className="sticky top-0 z-20 bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 p-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h1 className="text-xs font-black uppercase tracking-widest text-gray-500">Live Session</h1>
          <WorkoutTimer seconds={timer} formatTime={formatTime} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/workout/${params?.id}/edit`)} className="p-2 text-gray-500 hover:text-white transition-colors">
            <Edit3 size={20} />
          </button>
          <button onClick={() => setShowFinishConfirm(true)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-black px-5 py-2.5 rounded-full transition-all active:scale-95 shadow-lg shadow-green-500/20">
            FINISH
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        <ActiveSessionHeader 
          workoutName={workout?.name || 'Workout'} 
          duration={formatTime(timer)} 
          volume={currentVolume()} 
          progress={getProgress()}
          isPaused={isGraceMode}
          onTogglePause={() => {
            setIsGraceMode(!isGraceMode)
            if (!isGraceMode) {
              setTimerRunning(false)
            } else {
              setTimerRunning(true)
            }
          }}
        />

        <RestTimer timeLeft={restTime} onSkip={() => setRestTime(0)} />

        {workout?.exercises.map((exercise) => (
          <ExerciseCard 
            key={exercise.id} 
            name={exercise.name} 
            target={exercise.target_reps}
            isCompleted={isExerciseComplete(exercise)}
          >
            {Array.from({ length: exercise.sets }).map((_, i) => {
              const key = `${exercise.id}-${i}`
              const log = logs[key] || { weight: '', reps: '', completed: false }
              return (
                <ActiveSetRow 
                  key={i}
                  index={i}
                  isDone={log.completed}
                  weight={log.weight}
                  reps={log.reps}
                  onWeightChange={(val) => !isGraceMode && handleInputChange(exercise.id, i, 'weight', val)}
                  onRepsChange={(val) => !isGraceMode && handleInputChange(exercise.id, i, 'reps', val)}
                  onToggle={() => !isGraceMode && toggleSet(exercise, i)}
                />
              )
            })}
          </ExerciseCard>
        ))}
      </div>

      {/* SUMMARY OVERLAY */}
      {showSummary && (
        <WorkoutSummaryOverlay
          workoutName={workout?.name || 'Workout'}
          totalVolume={totalVolume}
          duration={formatTime(timer)}
          workoutId={workout?.id || ''}
          userId={userId}
          onReturn={() => router.push('/dashboard')}
        />
      )}

      {/* FINISH CONFIRM OVERLAY */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 w-full max-w-sm text-center space-y-6 shadow-2xl">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Finish Workout?</h2>
            <p className="text-sm text-gray-400">This will log your session and end the timer.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowFinishConfirm(false); finishWorkout() }}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3.5 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-95"
              >
                Yes, I'm Done
              </button>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3.5 rounded-xl text-sm uppercase tracking-widest transition-all"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
