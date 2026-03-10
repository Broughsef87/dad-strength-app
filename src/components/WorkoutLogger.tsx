'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Dumbbell, Save, Home as HomeIcon, Timer } from 'lucide-react';

interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
}

type TrainingTrack = 'full-gym' | 'minimal';

const TRACKS = {
  'full-gym': {
    name: 'Iron Path (Full Gym)',
    icon: Dumbbell,
    exercises: ['Barbell Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row'],
    description: 'Traditional barbell and machine access.'
  },
  'minimal': {
    name: 'Living Room Warrior (Minimal)',
    icon: HomeIcon,
    exercises: ['Goblet Squat', 'Push-ups', 'Kettlebell Swing', 'Dumbbell Row', 'Lunges'],
    description: 'Dumbbells, kettlebells, and bodyweight.'
  }
};

export default function WorkoutLogger() {
  const [track, setTrack] = useState<TrainingTrack>('full-gym');
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState<number | ''>('');
  const [reps, setReps] = useState<number | ''>('');
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  
  // Rest Timer State
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const activeTrack = TRACKS[track];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const startTimer = (seconds: number) => {
    setTimeLeft(seconds);
    setTimerActive(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || weight === '' || reps === '') return;

    const newSet: WorkoutSet = {
      id: Math.random().toString(36).substring(2, 9),
      exercise,
      weight: Number(weight),
      reps: Number(reps),
    };

    setSets([...sets, newSet]);
    setWeight('');
    setReps('');
    
    // Start 90s rest timer
    startTimer(90);
  };

  const removeSet = (id: string) => {
    setSets(sets.filter(set => set.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Rest Timer Overlay/Header */}
      {timeLeft > 0 && (
        <div className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
          timeLeft <= 10 ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-blue-50 border-blue-100'
        }`}>
          <div className="flex items-center gap-3">
            <Timer className={`w-6 h-6 ${timeLeft <= 10 ? 'text-red-500' : 'text-blue-600'}`} />
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Rest Timer</p>
              <p className={`text-2xl font-mono font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-slate-800'}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setTimeLeft(0)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-tight"
          >
            Skip
          </button>
        </div>
      )}

      {/* Track Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {(Object.keys(TRACKS) as TrainingTrack[]).map((t) => {
          const TrackIcon = TRACKS[t].icon;
          return (
            <button
              key={t}
              onClick={() => { setTrack(t); setExercise(''); }}
              type="button"
              className={`p-3 rounded-xl border text-left transition-all ${
                track === t 
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' 
                  : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                <TrackIcon className={`w-4 h-4 ${track === t ? 'text-blue-600' : 'text-slate-500'}`} />
                {TRACKS[t].name}
              </div>
              <div className="text-xs text-slate-500">{TRACKS[t].description}</div>
            </button>
          );
        })}
      </div>

      <form onSubmit={addSet} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between">
            <span>Exercise</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {activeTrack.exercises.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => setExercise(ex)}
                className={`text-xs px-2 py-1 rounded-md border ${
                  exercise === ex ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="e.g., Squat, Bench Press"
            className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weight (lbs)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reps</label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-blue-600 text-white p-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Set
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-blue-600" />
          Active Session - {activeTrack.name}
        </h3>
        
        {sets.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
            No sets logged yet. Time to hit the iron.
          </p>
        ) : (
          <div className="space-y-2">
            {[...sets].reverse().map((set) => (
              <div 
                key={set.id}
                className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-1"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">{set.exercise}</span>
                  <span className="text-xs text-slate-500">{set.weight} lbs × {set.reps} reps</span>
                </div>
                <button 
                  onClick={() => removeSet(set.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {sets.length > 0 && (
        <button className="w-full border-2 border-blue-600 text-blue-600 p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors mt-4">
          <Save className="w-4 h-4" />
          Complete Workout
        </button>
      )}
    </div>
  );
}
