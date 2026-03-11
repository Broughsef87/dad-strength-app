'use client';

import { useState, useEffect } from 'react';
import { Anchor, CheckCircle2, Circle, Moon, Sun, PenLine, Target, Scissors, Heart, BookOpen, Save } from 'lucide-react';

interface RitualState {
  sleepHours: number;
  maintenance: boolean;
  prayer: boolean;
  journal: string;
  objectives: string[];
  familyPresent: boolean;
}

export default function MorningAnchor() {
  const [state, setState] = useState<RitualState>({
    sleepHours: 7,
    maintenance: false,
    prayer: false,
    journal: '',
    objectives: ['', '', ''],
    familyPresent: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dad-strength-morning-anchor');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === new Date().toLocaleDateString()) {
        setState(data.state);
      }
    }
  }, []);

  const saveState = (newState?: RitualState) => {
    const data = {
      date: new Date().toLocaleDateString(),
      state: newState || state
    };
    localStorage.setItem('dad-strength-morning-anchor', JSON.stringify(data));
    // Mirror objectives to the mind state for interconnection
    const mindSaved = localStorage.getItem('dad-strength-mind-state');
    const mindData = mindSaved ? JSON.parse(mindSaved) : { date: new Date().toLocaleDateString() };
    if (mindData.date === new Date().toLocaleDateString()) {
      localStorage.setItem('dad-strength-mind-state', JSON.stringify({
        ...mindData,
        objectives: (newState || state).objectives
      }));
    }
  };

  const handleManualSave = () => {
    setIsSaving(true);
    saveState();
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  const updateObjective = (index: number, value: string) => {
    const newObjectives = [...state.objectives];
    newObjectives[index] = value;
    const next = { ...state, objectives: newObjectives };
    setState(next);
    saveState(next);
  };

  const toggleRitual = (key: 'maintenance' | 'prayer' | 'familyPresent') => {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    saveState(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Anchor className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-white uppercase tracking-tighter italic">System Reset</h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        
        {/* SLEEP TRACKER */}
        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Moon size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Sleep Depth</span>
           </div>
           <div className="flex items-center gap-4">
              <input 
                type="range" min="4" max="10" step="0.5" 
                value={state.sleepHours} 
                onChange={(e) => setState({...state, sleepHours: parseFloat(e.target.value)})}
                className="w-24 accent-indigo-500 h-1"
              />
              <span className="text-sm font-black text-white w-10">{state.sleepHours}h</span>
           </div>
        </div>

        {/* TOP 3 OBJECTIVES */}
        <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800">
           <div className="flex items-center gap-2 mb-4">
              <Target size={14} className="text-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Top 3 Objectives</p>
           </div>
           <div className="space-y-2">
              {state.objectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-3">
                   <div className="text-[10px] font-black text-gray-700 w-4">0{i+1}</div>
                   <input 
                     type="text" 
                     value={obj} 
                     onChange={(e) => updateObjective(i, e.target.value)}
                     placeholder="Deploy task..."
                     className="flex-1 bg-transparent border-b border-gray-800 focus:border-indigo-500 text-xs text-white py-1 transition-colors outline-none"
                   />
                </div>
              ))}
           </div>
        </div>

        {/* GROWTH / FAMILY OS */}
        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Heart size={14} className="text-pink-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Family OS / Growth</p>
              </div>
              <BookOpen size={12} className="text-gray-700" />
           </div>
           <button 
             onClick={() => toggleRitual('familyPresent')}
             className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
               state.familyPresent ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' : 'bg-gray-900/50 border-gray-800 text-gray-600 hover:border-gray-700'
             }`}
           >
              <span className="text-[10px] font-black uppercase tracking-widest">Presence: No Screens at Home</span>
              {state.familyPresent ? <CheckCircle2 size={16} /> : <Circle size={16} />}
           </button>
        </div>

        {/* JOURNAL */}
        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
           <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PenLine size={14} className="text-indigo-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Journal / Log</p>
              </div>
              <button 
                onClick={handleManualSave}
                disabled={isSaving}
                className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all ${isSaving ? 'text-indigo-400' : 'text-gray-600 hover:text-indigo-400'}`}
              >
                {isSaving ? 'Saved' : <><Save size={12} /> Save</>}
              </button>
           </div>
           <textarea 
             value={state.journal}
             onChange={(e) => {
               const next = {...state, journal: e.target.value};
               setState(next);
               saveState(next);
             }}
             placeholder="Gratitude, reflections, notes for the future..."
             className="w-full bg-transparent text-xs text-gray-400 h-20 resize-none outline-none italic"
           />
        </div>

      </div>
      
      <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest">
        Standard Operating Procedures for the Man.
      </p>
    </div>
  );
}
