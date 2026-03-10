'use client';

import { useState } from 'react';
import { Sun, Battery, Brain, Activity, ArrowRight } from 'lucide-react';

export default function MorningAnchor() {
  const [metrics, setMetrics] = useState({
    sleep: 3,
    stress: 3,
    soreness: 3
  });

  const updateMetric = (key: keyof typeof metrics, val: number) => {
    setMetrics(prev => ({ ...prev, [key]: val }));
  };

  const score = metrics.sleep + (6 - metrics.stress) + (6 - metrics.soreness);
  // Max score: 5 + 5 + 5 = 15
  // Min score: 1 + 1 + 1 = 3
  
  const recommendation = score >= 10 
    ? { path: 'Iron Path', color: 'text-blue-600', bg: 'bg-blue-50', desc: 'System is GO. Hit the heavy weights.' }
    : { path: 'Living Room', color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Focus on mobility and high reps today.' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sun className="w-5 h-5 text-yellow-500" />
        <h3 className="font-bold text-slate-800">The Morning Anchor</h3>
      </div>

      <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        {[
          { key: 'sleep', label: 'Sleep Quality', icon: Battery },
          { key: 'stress', label: 'Stress Level', icon: Brain },
          { key: 'soreness', label: 'Body Soreness', icon: Activity },
        ].map((m) => {
          const Icon = m.icon;
          const val = metrics[m.key as keyof typeof metrics];
          return (
            <div key={m.key} className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                <div className="flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {m.label}
                </div>
                <span>{val}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={val}
                onChange={(e) => updateMetric(m.key as keyof typeof metrics, parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          );
        })}
      </div>

      <div className={`p-4 rounded-xl border-2 border-dashed flex items-start gap-3 ${recommendation.bg} border-slate-200`}>
        <div className="p-2 bg-white rounded-lg shadow-sm">
           <ArrowRight className={`w-5 h-5 ${recommendation.color}`} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recommendation</p>
          <p className={`font-bold ${recommendation.color}`}>{recommendation.path} Warrior</p>
          <p className="text-xs text-slate-500 leading-tight">{recommendation.desc}</p>
        </div>
      </div>
    </div>
  );
}
