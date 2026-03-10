'use client';

import { useState } from 'react';
import { Anchor, CheckCircle2, Circle, Moon, Sun, PenLine, Target, Scissors } from 'lucide-react';

interface RitualState {
  sleepHours: number;
  maintenance: boolean;
  prayer: boolean;
  journal: string;
  objectives: string[];
}

export default function MorningAnchor() {
  const [state, setState] = useState<RitualState>({
    sleepHours: 7,
    maintenance: false,
    prayer: false,
    journal: '',
    objectives: ['', '', ''],
  });

  const updateObjective = (index: number, value: string) => {
    const newObjectives = [...state.objectives];
    newObjectives[index] = value;
    setState({ ...state, objectives: newObjectives });
  };

  const toggleRitual = (key: 'maintenance' | 'prayer') => {
    setState({ ...state, [key]: !state[key] });
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

        {/* CHECKLISTS */}
        <div className="grid grid-cols-2 gap-3">
           <button 
             onClick={() => toggleRitual('prayer')}
             className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
               state.prayer ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-gray-950/50 border-gray-800 text-gray-600'
             }`}
           >
              {state.prayer ? <CheckCircle2 size={16} /> : <Sun size={16} />}
              <span className="text-[10px] font-black uppercase tracking-widest">Prayer/Med</span>
           </button>
           <button 
             onClick={() => toggleRitual('maintenance')}
             className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
               state.maintenance ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-gray-950/50 border-gray-800 text-gray-600'
             }`}
           >
              {state.maintenance ? <CheckCircle2 size={16} /> : <Scissors size={16} />}
              <span className="text-[10px] font-black uppercase tracking-widest">Maintenance</span>
           </button>
        </div>

        {/* JOURNAL */}
        <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
           <div className="flex items-center gap-2 mb-3">
              <PenLine size={14} className="text-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Journal / Log</p>
           </div>
           <textarea 
             value={state.journal}
             onChange={(e) => setState({...state, journal: e.target.value})}
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
