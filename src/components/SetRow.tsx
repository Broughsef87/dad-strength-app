'use client'

import { CheckCircle2, Circle } from 'lucide-react'

interface SetRowProps {
  index: number
  isDone: boolean
  weight: string
  reps: string
  onWeightChange: (val: string) => void
  onRepsChange: (val: string) => void
  onToggle: () => void
}

export default function SetRow({
  index,
  isDone,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  onToggle
}: SetRowProps) {
  return (
    <div className={`grid grid-cols-12 gap-3 items-center transition-all duration-300 ${isDone ? 'opacity-30 scale-95' : ''}`}>
      <div className="col-span-1 text-[10px] font-black text-gray-600">{index + 1}</div>
      <input 
        type="number" 
        placeholder="LBS" 
        value={weight}
        className="col-span-4 bg-gray-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-3 text-center font-bold text-white outline-none transition-all"
        onChange={(e) => onWeightChange(e.target.value)}
      />
      <input 
        type="number" 
        placeholder="REPS" 
        value={reps}
        className="col-span-4 bg-gray-800 border-2 border-transparent focus:border-indigo-500 rounded-xl p-3 text-center font-bold text-white outline-none transition-all"
        onChange={(e) => onRepsChange(e.target.value)}
      />
      <button 
        onClick={onToggle}
        className={`col-span-3 h-12 rounded-xl flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
      >
        {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
      </button>
    </div>
  )
}
