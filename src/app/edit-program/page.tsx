'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Dumbbell, Home as HomeIcon, LayoutPanelLeft, LayoutPanelTop, Layout, Zap, Calendar, Loader2 } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'

// ─── Exercise Library by Focus + Track ───────────────────────────────────────

const EXERCISE_SETS: Record<string, Record<string, { name: string; sets: number; reps: string }[]>> = {
  full: {
    iron: [
      { name: 'Barbell Back Squat', sets: 4, reps: '6-8' },
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Dips', sets: 3, reps: '10-12' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '10-12' },
      { name: 'Push-ups', sets: 4, reps: '15-20' },
      { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
    ],
  },
  upper: {
    iron: [
      { name: 'Bench Press', sets: 4, reps: '6-8' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Pull-ups', sets: 4, reps: '6-8' },
      { name: 'Barbell Row', sets: 4, reps: '8-10' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Face Pulls', sets: 3, reps: '15' },
    ],
    home: [
      { name: 'Push-ups', sets: 4, reps: '20' },
      { name: 'Pike Push-ups', sets: 3, reps: '12-15' },
      { name: 'Dumbbell Row', sets: 4, reps: '10-12' },
      { name: 'Dumbbell Curl', sets: 3, reps: '12-15' },
      { name: 'Tricep Dips', sets: 3, reps: '12-15' },
      { name: 'Band Pull-Apart', sets: 3, reps: '20' },
    ],
  },
  lower: {
    iron: [
      { name: 'Back Squat', sets: 4, reps: '6-8' },
      { name: 'Romanian Deadlift', sets: 4, reps: '8-10' },
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Leg Curl', sets: 3, reps: '12-15' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '15-20' },
    ],
    home: [
      { name: 'Goblet Squat', sets: 4, reps: '12-15' },
      { name: 'Romanian Deadlift', sets: 4, reps: '10-12' },
      { name: 'Reverse Lunge', sets: 3, reps: '12 each' },
      { name: 'Nordic Curl', sets: 3, reps: '8-10' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each' },
      { name: 'Calf Raise', sets: 4, reps: '20' },
    ],
  },
  cond: {
    iron: [
      { name: 'Barbell Thruster', sets: 4, reps: '10' },
      { name: 'Kettlebell Swing', sets: 4, reps: '15' },
      { name: 'Box Jump', sets: 3, reps: '10' },
      { name: 'Farmer Carry', sets: 3, reps: '30m' },
      { name: 'Sled Push', sets: 3, reps: '20m' },
    ],
    home: [
      { name: 'Burpees', sets: 4, reps: '10' },
      { name: 'Jump Squat', sets: 4, reps: '15' },
      { name: 'Mountain Climbers', sets: 3, reps: '30s' },
      { name: 'High Knees', sets: 3, reps: '30s' },
      { name: 'Plank', sets: 3, reps: '45s' },
    ],
  },
}

const PROGRAM_FOCUSES = [
  { id: 'upper', name: 'Upper Body Focus', icon: LayoutPanelTop, desc: 'Prioritize chest, back, and shoulders.' },
  { id: 'lower', name: 'Lower Body Focus', icon: LayoutPanelLeft, desc: 'Heavy emphasis on legs and posterior chain.' },
  { id: 'full', name: 'Full Body', icon: Layout, desc: 'Complete coverage in every session.' },
  { id: 'cond', name: 'Conditioning', icon: Zap, desc: 'Work capacity, heart rate, and fat loss.' },
]

const EQUIPMENT_TRACKS = [
  { id: 'iron', name: 'Iron Path', icon: Dumbbell, desc: 'Full gym with barbells and racks.' },
  { id: 'home', name: 'At Home', icon: HomeIcon, desc: 'Dumbbells, bands, or bodyweight.' },
]

const DURATION_WEEKS = [4, 5, 6]
const FREQUENCY_DAYS = [3, 5]

const FOCUS_LABELS: Record<string, string> = {
  upper: 'Upper Body', lower: 'Lower Body', full: 'Full Body', cond: 'Conditioning',
}
const TRACK_LABELS: Record<string, string> = {
  iron: 'Iron Path', home: 'At Home',
}

export default function EditProgram() {
  const router = useRouter()
  const supabase = createClient()
  const [selectedFocus, setSelectedFocus] = useState('full')
  const [selectedTrack, setSelectedTrack] = useState('iron')
  const [selectedWeeks, setSelectedWeeks] = useState(4)
  const [selectedFrequency, setSelectedFrequency] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const exercises = EXERCISE_SETS[selectedFocus][selectedTrack]
      const workoutName = `${FOCUS_LABELS[selectedFocus]} · ${TRACK_LABELS[selectedTrack]}`
      const workoutDesc = `${selectedWeeks}-week cycle · ${selectedFrequency} days/week`

      // Insert new workout into Supabase
      const { data: newWorkout, error: insertError } = await supabase
        .from('workouts')
        .insert({
          name: workoutName,
          description: workoutDesc,
          exercises: exercises,
          status: 'active',
          user_id: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Save as the user's active program in localStorage
      localStorage.setItem('activeWorkoutId', newWorkout.id)
      localStorage.setItem('activeProgramConfig', JSON.stringify({
        focus: selectedFocus,
        track: selectedTrack,
        weeks: selectedWeeks,
        frequency: selectedFrequency,
      }))

      router.push('/dashboard')
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save program. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-12">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-4 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors p-1"
        >
          <ArrowLeft size={24} />
        </button>
        <span className="font-black tracking-tighter text-lg uppercase italic">Program Selector</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
        >
          {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : 'Save'}
        </button>
      </header>

      <main className="mx-auto max-w-md p-6 space-y-10">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-4 text-xs font-bold uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        {/* STEP 1: FOCUS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">1</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Select Your Focus</label>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {PROGRAM_FOCUSES.map((focus) => {
              const Icon = focus.icon
              const isSelected = selectedFocus === focus.id
              return (
                <button
                  key={focus.id}
                  onClick={() => setSelectedFocus(focus.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-xl shadow-indigo-500/5'
                      : 'border-gray-900 bg-gray-900/40 text-gray-500 hover:border-gray-800'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-600'}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className={`font-black uppercase tracking-tight italic ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>
                      {focus.name}
                    </h3>
                    <p className="text-[10px] font-medium text-gray-600 leading-tight mt-0.5">{focus.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* STEP 2: TRACK */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">2</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Choose Your Path</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {EQUIPMENT_TRACKS.map((track) => {
              const Icon = track.icon
              const isSelected = selectedTrack === track.id
              return (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrack(track.id)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 text-center transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-xl shadow-indigo-500/5'
                      : 'border-gray-900 bg-gray-900/40 text-gray-500 hover:border-gray-800'
                  }`}
                >
                  <div className={`p-3 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-600'}`}>
                    <Icon size={24} />
                  </div>
                  <h3 className={`font-black uppercase tracking-widest text-[10px] italic ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>
                    {track.name}
                  </h3>
                  <p className="text-[10px] text-gray-600">{track.desc}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* STEP 3: PROGRAM LOGIC */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">3</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Program Logic</label>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 ml-1">Cycle Length</label>
              <div className="flex bg-gray-900/50 p-1.5 rounded-2xl border border-gray-900">
                {DURATION_WEEKS.map((weeks) => (
                  <button
                    key={weeks}
                    onClick={() => setSelectedWeeks(weeks)}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      selectedWeeks === weeks ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {weeks} Weeks
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 ml-1">Weekly Frequency</label>
              <div className="flex bg-gray-900/50 p-1.5 rounded-2xl border border-gray-900">
                {FREQUENCY_DAYS.map((days) => (
                  <button
                    key={days}
                    onClick={() => setSelectedFrequency(days)}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      selectedFrequency === days ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {days} Days / Wk
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PREVIEW */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar size={12} className="text-indigo-500" /> Protocol Preview
          </p>
          <p className="font-black text-lg italic tracking-tight mb-1">
            {FOCUS_LABELS[selectedFocus]} · {TRACK_LABELS[selectedTrack]}
          </p>
          <p className="text-xs text-gray-500 mb-4">{selectedWeeks}-week cycle · {selectedFrequency} days/week</p>
          <div className="space-y-2">
            {EXERCISE_SETS[selectedFocus][selectedTrack].map((ex, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span className="text-gray-300 font-bold">{ex.name}</span>
                <span className="text-indigo-400 font-black">{ex.sets}×{ex.reps}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
