'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Dumbbell, Save, Home as HomeIcon, Activity } from 'lucide-react';
import SetRow from './workout/SetRow';
import RestTimer from './workout/RestTimer';

interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  isDone?: boolean;
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

  const addSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || weight === '' || reps === '') return;

    const newSet: WorkoutSet = {
      id: Math.random().toString(36).substring(2, 9),
      exercise,
      weight: Number(weight),
      reps: Number(reps),
      isDone: true,
    };

    setSets([...sets, newSet]);
    setWeight('');
    setReps('');
    startTimer(90);
  };

  const removeSet = (id: string) => {
    setSets(sets.filter(set => set.id !== id));
  };

  const toggleSet = (id: string) => {
    setSets(sets.map(set => 
      set.id === id ? { ...set, isDone: !set.isDone } : set
    ));
  };

  return (
    <div className="space-y-6">
      {/* Rest Timer */}
      <RestTimer timeLeft={timeLeft} onSkip={() => setTimeLeft(0)} />

      {/* Track Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {(Object.keys(TRACKS) as TrainingTrack[]).map((t) => {
          const TrackIcon = TRACKS[t].icon;
          return (
            <button
              key={t}
              onClick={() => { setTrack(t); setExercise(''); }}
              type="button"
              className={`p-4 rounded-2xl border text-left transition-all ${
                track === t 
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' 
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 font-black text-sm uppercase italic tracking-tighter mb-1">
                <TrackIcon className={`w-4 h-4 ${track === t ? 'text-indigo-400' : 'text-gray-600'}`} />
                {TRACKS[t].name}
              </div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{TRACKS[t].description}</div>
            </button>
          );
        })}
      </div>

      <form onSubmit={addSet} className="space-y-4 bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Select Exercise</label>
          <div className="flex flex-wrap gap-2">
            {activeTrack.exercises.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => setExercise(ex)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider transition-all ${
                  exercise === ex ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
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
            placeholder="Manual Entry..."
            className="w-full p-3 rounded-xl border border-gray-800 bg-gray-950 text-white placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">LBS</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full p-3 rounded-xl border border-gray-800 bg-gray-950 text-white placeholder:text-gray-700"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">REPS</label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full p-3 rounded-xl border border-gray-800 bg-gray-950 text-white placeholder:text-gray-700"
              required
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Log Set
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Active Session
        </h3>
        
        {sets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-900 rounded-3xl">
             <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Awaiting First Set...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...sets].reverse().map((set, idx) => (
              <SetRow 
                key={set.id}
                set={set}
                index={sets.length - 1 - idx}
                onToggle={toggleSet}
                onDelete={removeSet}
              />
            ))}
          </div>
        )}
      </div>

      {sets.length > 0 && (
        <button className="w-full border border-indigo-500/30 bg-indigo-500/5 text-indigo-400 p-4 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-500 hover:text-white transition-all">
          <Save className="w-4 h-4" />
          Save Protocol
        </button>
      )}
    </div>
  );
}
