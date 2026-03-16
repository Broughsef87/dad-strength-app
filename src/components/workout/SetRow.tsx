'use client';

import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  isDone?: boolean;
}

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function SetRow({
  set,
  index,
  onToggle,
  onDelete
}: SetRowProps) {
  const isDone = set.isDone || false;

  return (
    <div 
      className={`group flex items-center gap-4 p-4 bg-gray-900/80 border transition-all duration-300 ${
        isDone 
          ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)] scale-[1.01]' 
          : 'border-gray-800 hover:border-gray-700'
      } rounded-2xl`}
    >
      <div className={`flex-none w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black italic transition-colors ${
        isDone ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-500'
      }`}>
        {index + 1}
      </div>

      <div className="flex-grow min-w-0">
        <p className={`font-black text-sm uppercase italic tracking-tighter truncate transition-colors ${isDone ? 'text-indigo-100' : 'text-white'}`}>
          {set.exercise}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDone ? 'text-indigo-300' : 'text-indigo-400'}`}>{set.weight} LBS</span>
          <span className="text-[8px] text-gray-700">/</span>
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDone ? 'text-indigo-200/50' : 'text-gray-400'}`}>{set.reps} REPS</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggle && (
          <button 
            onClick={() => onToggle(set.id)}
            className={`p-2 rounded-xl transition-all ${
              isDone 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                : 'bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700'
            }`}
          >
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        )}
        
        {onDelete && (
          <button 
            onClick={() => onDelete(set.id)}
            className="p-2 text-gray-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
