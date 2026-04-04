'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react'

type Exercise = {
  id: string
  name: string
  sets: number
  target_reps: string
}

type Workout = {
  id: string
  name: string
  description: string
  exercises: Exercise[]
}

export default function EditWorkout({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchWorkout = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (error) {
        console.error('Error fetching workout:', error)
      } else {
        const exercisesWithIds = (data.exercises as any[]).map((ex, idx) => ({
          ...ex,
          id: ex.id || `ex-${idx}`,
          target_reps: ex.reps // Handle schema difference if needed
        }))
        setWorkout({ ...data, exercises: exercisesWithIds })
      }
      setLoading(false)
    }
    fetchWorkout()
  }, [supabase, params.id])

  const handleWorkoutChange = (field: 'name' | 'description', value: string) => {
    if (!workout) return
    setWorkout({ ...workout, [field]: value })
  }

  const handleExerciseChange = (index: number, field: keyof Exercise, value: string | number) => {
    if (!workout) return
    const newExercises = [...workout.exercises]
    newExercises[index] = { ...newExercises[index], [field]: value }
    setWorkout({ ...workout, exercises: newExercises })
  }

  const addExercise = () => {
    if (!workout) return
    const newExercise: Exercise = {
      id: `new-${Date.now()}`,
      name: '',
      sets: 3,
      target_reps: '10'
    }
    setWorkout({ ...workout, exercises: [...workout.exercises, newExercise] })
  }

  const removeExercise = (index: number) => {
    if (!workout) return
    const newExercises = workout.exercises.filter((_, i) => i !== index)
    setWorkout({ ...workout, exercises: newExercises })
  }

  const saveWorkout = async () => {
    if (!workout) return
    setSaving(true)

    // Map back to schema format (reps vs target_reps if needed)
    const exercisesToSave = workout.exercises.map(ex => ({
      name: ex.name,
      sets: Number(ex.sets),
      reps: ex.target_reps, // Assuming schema uses 'reps' for target
      id: ex.id
    }))

    const { error } = await supabase
      .from('workouts')
      .update({
        name: workout.name,
        description: workout.description,
        exercises: exercisesToSave
      })
      .eq('id', workout.id)

    if (error) {
      alert('Error updating workout')
      console.error(error)
    } else {
      router.push(`/workout/${workout.id}`)
      router.refresh()
    }
    setSaving(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white font-sans">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 font-sans">
      <header className="sticky top-0 z-20 bg-surface-2 border-b border-border p-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white flex items-center gap-1">
          <ChevronLeft size={20} />
          <span className="text-sm font-bold">Cancel</span>
        </button>
        <h1 className="text-xs font-black uppercase tracking-widest text-gray-500">Edit Program</h1>
        <button 
          onClick={saveWorkout} 
          disabled={saving}
          className="bg-brand hover:bg-brand/90 text-white text-xs font-black px-4 py-2 rounded-full transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'SAVING...' : <><Save size={14} /> SAVE</>}
        </button>
      </header>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        
        {/* WORKOUT DETAILS */}
        <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Program Name</label>
            <input 
              type="text" 
              value={workout?.name || ''}
              onChange={(e) => handleWorkoutChange('name', e.target.value)}
              className="w-full bg-gray-800 border-2 border-transparent focus:border-brand rounded-xl p-3 font-bold text-white outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Description</label>
            <input 
              type="text" 
              value={workout?.description || ''}
              onChange={(e) => handleWorkoutChange('description', e.target.value)}
              className="w-full bg-gray-800 border-2 border-transparent focus:border-brand rounded-xl p-3 font-medium text-gray-300 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* EXERCISES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Exercises</h2>
            <button 
              onClick={addExercise}
              className="text-brand text-xs font-black hover:text-brand flex items-center gap-1 uppercase tracking-wider"
            >
              <Plus size={14} /> Add New
            </button>
          </div>

          {workout?.exercises.map((exercise, index) => (
            <div key={exercise.id || index} className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl relative group">
              <button 
                onClick={() => removeExercise(index)}
                className="absolute top-4 right-4 text-gray-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Exercise Name</label>
                  <input 
                    type="text" 
                    value={exercise.name}
                    onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                    className="w-full bg-gray-800 border-2 border-transparent focus:border-brand rounded-xl p-3 font-bold text-white outline-none transition-all"
                    placeholder="e.g. Squat"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Sets</label>
                    <input 
                      type="number" 
                      value={exercise.sets}
                      onChange={(e) => handleExerciseChange(index, 'sets', e.target.value)}
                      className="w-full bg-gray-800 border-2 border-transparent focus:border-brand rounded-xl p-3 font-bold text-white text-center outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Target Reps</label>
                    <input 
                      type="text" 
                      value={exercise.target_reps}
                      onChange={(e) => handleExerciseChange(index, 'target_reps', e.target.value)}
                      className="w-full bg-gray-800 border-2 border-transparent focus:border-brand rounded-xl p-3 font-bold text-white text-center outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addExercise}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-800 text-gray-500 hover:border-brand hover:text-brand transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Add Exercise
          </button>
        </div>
      </div>
    </div>
  )
}
