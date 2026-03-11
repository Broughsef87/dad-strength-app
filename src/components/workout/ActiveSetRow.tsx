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
    <div className={`grid grid-cols-12 gap-3 items-center transition-all duration-300 ${isDone ? 'opacity-30 scale-[0.98]' : ''}`}>
      <div className="col-span-1 text-[10px] font-black text-gray-600 italic">
        {index + 1}
      </div>
      
      <div className="col-span-4 relative">
        <input 
          type="number" 
          placeholder="LBS" 
          value={weight}
          className="w-full bg-gray-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-3 text-center font-bold text-white outline-none transition-all placeholder:text-gray-700"
          onChange={(e) => onWeightChange(e.target.value)}
        />
        {weight && !isDone && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-[8px] font-black px-1.5 rounded-full text-white uppercase tracking-tighter">Weight</span>
        )}
      </div>

      <div className="col-span-4 relative">
        <input 
          type="number" 
          placeholder="REPS" 
          value={reps}
          className="w-full bg-gray-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-3 text-center font-bold text-white outline-none transition-all placeholder:text-gray-700"
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
            : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'
        }`}
      >
        {isDone ? <CheckCircle2 size={24} strokeWidth={3} /> : <Circle size={24} strokeWidth={2} />}
      </button>
    </div>
  );
}
