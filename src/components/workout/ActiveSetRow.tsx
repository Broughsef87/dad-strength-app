'use client';

import { CheckCircle2, Circle } from 'lucide-react';

interface ActiveSetRowProps {
  index: number;
  isDone: boolean;
  weight: string;
  reps: string;
  onWeightChange: (val: string) => void;
  onRepsChange: (val: string) => void;
  onToggle: () => void;
}

export default function ActiveSetRow({
  index,
  isDone,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  onToggle
}: ActiveSetRowProps) {
  return (
    <div className={`grid grid-cols-12 gap-3 items-center p-3 rounded-2xl transition-all duration-300 ${
      isDone 
        ? 'bg-green-500/10 border border-green-500/20 opacity-50' 
        : 'bg-gray-800/20 border border-gray-800/50'
    }`}>
      <div className="col-span-1 flex flex-col items-center">
        <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter">Set</span>
        <span className={`text-sm font-black italic ${isDone ? 'text-green-500' : 'text-gray-400'}`}>
          {index + 1}
        </span>
      </div>
      
      <div className="col-span-4 relative">
        <input 
          type="number" 
          inputMode="numeric"
          placeholder="LBS" 
          disabled={isDone}
          value={weight}
          className="w-full bg-gray-900/50 border-2 border-gray-800 focus:border-indigo-500 focus:bg-gray-900 rounded-xl p-3 text-center font-black text-white outline-none transition-all placeholder:text-gray-700 disabled:opacity-50"
          onChange={(e) => onWeightChange(e.target.value)}
        />
        {weight && !isDone && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-[8px] font-black px-1.5 rounded-full text-white uppercase tracking-tighter">Weight</span>
        )}
      </div>

      <div className="col-span-4 relative">
        <input 
          type="number" 
          inputMode="numeric"
          placeholder="REPS" 
          disabled={isDone}
          value={reps}
          className="w-full bg-gray-900/50 border-2 border-gray-800 focus:border-indigo-500 focus:bg-gray-900 rounded-xl p-3 text-center font-black text-white outline-none transition-all placeholder:text-gray-700 disabled:opacity-50"
          onChange={(e) => onRepsChange(e.target.value)}
        />
        {reps && !isDone && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-[8px] font-black px-1.5 rounded-full text-white uppercase tracking-tighter">Reps</span>
        )}
      </div>

      <button 
        onClick={onToggle}
        className={`col-span-3 h-12 rounded-xl flex items-center justify-center transition-all ${
          isDone 
            ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' 
            : 'bg-gray-900 border border-gray-800 text-gray-600 hover:text-white hover:border-indigo-500 transition-all active:scale-95'
        }`}
      >
        {isDone ? <CheckCircle2 size={24} strokeWidth={3} /> : <Circle size={24} strokeWidth={2} />}
      </button>
    </div>
  );
}
