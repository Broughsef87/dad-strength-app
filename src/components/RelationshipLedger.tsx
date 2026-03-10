'use client';

import { useState } from 'react';
import { Heart, Plus, Users } from 'lucide-react';

export default function RelationshipLedger() {
  const [deposits, setDeposits] = useState(3);
  const target = 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-white">Emotional Ledger</h3>
        </div>
        <div className="flex -space-x-2">
           <div className="w-6 h-6 rounded-full border-2 border-gray-950 bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-400">W</div>
           <div className="w-6 h-6 rounded-full border-2 border-gray-950 bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-400">K</div>
        </div>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500 font-medium">Daily Relationship Deposits</p>
          <span className="text-xs font-black text-rose-400 uppercase tracking-widest">{deposits}/{target}</span>
        </div>

        <div className="flex gap-2 mb-4">
          {[...Array(target)].map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 h-2 rounded-full transition-all ${
                i < deposits ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-gray-800'
              }`}
            ></div>
          ))}
        </div>

        <button 
          onClick={() => setDeposits(prev => Math.min(prev + 1, target))}
          className="w-full py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-700 hover:text-white transition-all group"
        >
          <Plus size={16} className="text-rose-500 group-hover:scale-125 transition-transform" />
          RECORD DEPOSIT
        </button>
      </div>

      <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest">
        The most important ROI is at home.
      </p>
    </div>
  );
}
