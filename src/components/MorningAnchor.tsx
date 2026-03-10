'use client';

import { useState } from 'react';
import { Anchor, CheckCircle2, Circle } from 'lucide-react';

const TASKS = [
  { id: 'hydrate', label: '16oz Water + Electrolytes' },
  { id: 'move', label: '5 Min Mobility / Sun' },
  { id: 'mind', label: 'Meditation / Prayer / Journal' },
  { id: 'plan', label: 'Top 3 Objectives Set' },
];

export default function MorningAnchor() {
  const [completed, setCompleted] = useState<string[]>([]);

  const toggle = (id: string) => {
    setCompleted(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Anchor className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-white">Morning Anchor</h3>
      </div>

      <div className="space-y-2">
        {TASKS.map((task) => (
          <button
            key={task.id}
            onClick={() => toggle(task.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              completed.includes(task.id)
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            {completed.includes(task.id) ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-bold tracking-tight">{task.label}</span>
          </button>
        ))}
      </div>
      
      <div className="pt-2">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
          <span>Morning Momentum</span>
          <span>{Math.round((completed.length / TASKS.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(completed.length / TASKS.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
