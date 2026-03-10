'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Save, Dumbbell, Home as HomeIcon } from 'lucide-react'

// Hardcoded movements for scaffolding
const EQUIPMENT_TRACKS = {
  'full-gym': {
    name: 'Iron Path (Full Gym)',
    icon: Dumbbell,
    movements: [
      { id: 'm1', name: 'Barbell Squat', category: 'Legs' },
      { id: 'm2', name: 'Bench Press', category: 'Chest' },
      { id: 'm3', name: 'Deadlift', category: 'Back' },
      { id: 'm4', name: 'Pull-up', category: 'Back' },
      { id: 'm5', name: 'Overhead Press', category: 'Shoulders' },
      { id: 'm6', name: 'Barbell Row', category: 'Back' },
    ]
  },
  'minimal': {
    name: 'Living Room Warrior',
    icon: HomeIcon,
    movements: [
      { id: 'mm1', name: 'Goblet Squat', category: 'Legs' },
      { id: 'mm2', name: 'Push-ups', category: 'Chest' },
      { id: 'mm3', name: 'Kettlebell Swing', category: 'Hinges' },
      { id: 'mm4', name: 'Dumbbell Row', category: 'Back' },
      { id: 'mm5', name: 'Dumbbell Shoulder Press', category: 'Shoulders' },
      { id: 'mm6', name: 'Lunges', category: 'Legs' },
    ]
  }
}

type TrackType = 'full-gym' | 'minimal';
type Movement = { id: string; name: string; category: string }

export default function EditProgram() {
  const router = useRouter()
  const [programName, setProgramName] = useState('Dad Strength Core')
  const [track, setTrack] = useState<TrackType>('full-gym')
  const [selectedExercises, setSelectedExercises] = useState<Movement[]>([
    EQUIPMENT_TRACKS['full-gym'].movements[0],
    EQUIPMENT_TRACKS['full-gym'].movements[1]
  ])
  const [isAdding, setIsAdding] = useState(false)

  const activeMovements = EQUIPMENT_TRACKS[track].movements;

  const handleTrackChange = (newTrack: TrackType) => {
    setTrack(newTrack);
    // Auto-swap selected exercises to match the new track type based on index to save time scaffolding
    setSelectedExercises([
      EQUIPMENT_TRACKS[newTrack].movements[0],
      EQUIPMENT_TRACKS[newTrack].movements[1]
    ]);
  }

  const handleAddExercise = (movement: Movement) => {
    if (!selectedExercises.find(e => e.id === movement.id)) {
      setSelectedExercises([...selectedExercises, movement])
    }
    setIsAdding(false)
  }

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises(selectedExercises.filter(e => e.id !== id))
  }

  const handleSave = () => {
    console.log('Saving program...', { track, programName, exercises: selectedExercises })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-4 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <span className="font-bold tracking-tight text-lg uppercase">Edit Program</span>
        <button 
          onClick={handleSave}
          className="text-indigo-400 hover:text-indigo-300 font-bold text-sm tracking-wider uppercase flex items-center gap-1"
        >
          <Save size={16} /> Save
        </button>
      </header>

      <main className="mx-auto max-w-md p-6 pb-24 space-y-8">
        
        {/* TRACK SELECTION */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Equipment Setup</label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(EQUIPMENT_TRACKS) as TrackType[]).map((t) => {
              const TrackIcon = EQUIPMENT_TRACKS[t].icon;
              return (
                <button
                  key={t}
                  onClick={() => handleTrackChange(t)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    track === t 
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' 
                      : 'border-gray-800 bg-gray-900 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  <TrackIcon size={24} />
                  <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">
                    {EQUIPMENT_TRACKS[t].name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PROGRAM NAME */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Program Name</label>
          <input 
            type="text" 
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white font-bold text-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* EXERCISES LIST */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-black tracking-widest text-gray-500">Movements</label>
            <span className="text-xs text-indigo-400 font-bold">{selectedExercises.length} Selected</span>
          </div>

          <div className="space-y-3">
            {selectedExercises.map((exercise, index) => (
              <div key={exercise.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 font-bold text-xs">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{exercise.name}</p>
                    <p className="text-xs text-gray-500">{exercise.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveExercise(exercise.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-2"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* ADD BUTTON */}
          {!isAdding ? (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-800 rounded-xl text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all font-bold text-sm uppercase tracking-wider"
            >
              <Plus size={18} /> Add Movement
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-indigo-400">Select Movement</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {activeMovements.filter(m => !selectedExercises.find(e => e.id === m.id)).map(movement => (
                  <button
                    key={movement.id}
                    onClick={() => handleAddExercise(movement)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 text-left transition-colors border border-transparent hover:border-gray-700"
                  >
                    <div>
                      <p className="font-bold text-sm text-gray-200">{movement.name}</p>
                      <p className="text-xs text-gray-600">{movement.category}</p>
                    </div>
                    <Plus size={16} className="text-indigo-500" />
                  </button>
                ))}
                {activeMovements.filter(m => !selectedExercises.find(e => e.id === m.id)).length === 0 && (
                  <p className="text-xs text-center text-gray-500 py-4">All available movements added.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}