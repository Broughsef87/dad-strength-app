'use client';

import { useState } from 'react';
import { Beef, Plus, RotateCcw } from 'lucide-react';

export default function FuelStation() {
  const [protein, setProtein] = useState(0);
  const target = 200;

  const addProtein = (amount: number) => {
    setProtein(prev => Math.min(prev + amount, 500));
  };

  const reset = () => {
    if (confirm('Reset protein tracker for the day?')) {
      setProtein(0);
    }
  };

  const percentage = Math.round((protein / target) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beef className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-slate-800">Fuel Station</h3>
        </div>
        <button 
          onClick={reset}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-3xl font-black text-slate-900">{protein}</span>
            <span className="text-slate-400 font-bold ml-1">/ {target}g</span>
          </div>
          <span className={`text-sm font-bold ${percentage >= 100 ? 'text-emerald-500' : 'text-blue-500'}`}>
            {percentage}%
          </span>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-3 mb-6 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ease-out ${
              percentage >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[10, 25, 50].map((amount) => (
            <button
              key={amount}
              onClick={() => addProtein(amount)}
              className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
            >
              <Plus className="w-3 h-3 text-slate-400 group-hover:text-blue-500 mb-1" />
              <span className="text-sm font-bold text-slate-700">{amount}g</span>
            </button>
          ))}
        </div>
      </div>
      
      <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
        Protein is the building block of dad strength.
      </p>
    </div>
  );
}
