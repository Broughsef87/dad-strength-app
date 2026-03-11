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
      className={`group flex items-center gap-4 p-4 bg-gray-900/80 border border-gray-800 rounded-2xl transition-all duration-300 ${
        isDone ? 'opacity-40 border-green-500/20 bg-green-500/5' : 'hover:border-gray-700'
      }`}
    >
      <div className="flex-none w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 text-[10px] font-black text-gray-500 italic">
        {index + 1}
      </div>

      <div className="flex-grow min-w-0">
        <p className={`font-black text-sm uppercase italic tracking-tighter truncate ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}>
          {set.exercise}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{set.weight} LBS</span>
          <span className="text-[8px] text-gray-700">/</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{set.reps} REPS</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggle && (
          <button 
            onClick={() => onToggle(set.id)}
            className={`p-2 rounded-xl transition-all ${
              isDone 
                ? 'bg-green-500/20 text-green-500' 
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
