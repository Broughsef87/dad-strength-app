'use client';

import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface ExerciseCardProps {
  name: string;
  target: string;
  isCompleted: boolean;
  children: React.ReactNode;
}

export default function ExerciseCard({ name, target, isCompleted, children }: ExerciseCardProps) {
  return (
    <div className={`bg-gray-900 rounded-3xl border transition-all duration-500 overflow-hidden ${
      isCompleted 
        ? 'border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.05)]' 
        : 'border-gray-800'
    }`}>
      {/* Exercise Header */}
      <div className={`p-6 pb-4 flex justify-between items-start ${isCompleted ? 'bg-green-500/5' : ''}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-black text-xl tracking-tight text-white">{name}</h3>
            {isCompleted && <CheckCircle2 size={16} className="text-green-500" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-2 py-0.5 bg-indigo-500/10 rounded-full">
              Target: {target}
            </span>
          </div>
        </div>
        
        {!isCompleted && (
          <div className="p-2 text-gray-700">
            <AlertCircle size={20} />
          </div>
        )}
      </div>

      {/* Sets Area */}
      <div className="p-6 pt-2 space-y-3">
        {children}
      </div>

      {/* Completion Indicator */}
      {isCompleted && (
        <div className="bg-green-500 py-1 text-center">
          <p className="text-[8px] font-black text-black uppercase tracking-[0.3em]">Exercise Complete</p>
        </div>
      )}
    </div>
  );
}
