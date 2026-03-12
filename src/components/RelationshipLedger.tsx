'use client';

import { useState } from 'react';
import { Heart, Plus, Users, Trash2 } from 'lucide-react';

interface Deposit {
  id: string;
  text: string;
  timestamp: string;
}

const STORAGE_KEY = 'dad-strength-relationship-ledger';
const todayKey = () => new Date().toLocaleDateString();

function loadDeposits(): Deposit[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const data = JSON.parse(saved);
    if (data.date !== todayKey()) return [];
    return data.deposits || [];
  } catch { return []; }
}

export default function RelationshipLedger() {
  const [deposits, setDeposits] = useState<Deposit[]>(() => loadDeposits());
  const [inputText, setInputText] = useState('');
  const target = 5;

  const persist = (next: Deposit[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), deposits: next }));
  };

  const addDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newDeposit: Deposit = {
      id: Math.random().toString(36).substring(2, 9),
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const next = [...deposits, newDeposit].slice(-target);
    setDeposits(next);
    persist(next);
    setInputText('');
  };

  const removeDeposit = (id: string) => {
    const next = deposits.filter(d => d.id !== id);
    setDeposits(next);
    persist(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-white uppercase tracking-tighter italic">Relationship Ledger</h3>
        </div>
        <div className="flex -space-x-2">
           <div className="w-6 h-6 rounded-full border-2 border-gray-950 bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-400">W</div>
           <div className="w-6 h-6 rounded-full border-2 border-gray-950 bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-400">K</div>
        </div>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Daily Deposits</p>
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{deposits.length}/{target}</span>
        </div>

        <div className="flex gap-2 mb-6">
          {[...Array(target)].map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 h-1.5 rounded-full transition-all ${
                i < deposits.length ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-gray-800'
              }`}
            ></div>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          {deposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-950/50 border border-gray-800 group animate-in fade-in slide-in-from-left-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-300 font-medium truncate italic">"{d.text}"</p>
                <p className="text-[8px] text-gray-600 font-black uppercase">{d.timestamp}</p>
              </div>
              <button 
                onClick={() => removeDeposit(d.id)}
                className="p-1 text-gray-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addDeposit} className="relative">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="What'd you do for her today?"
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 pr-12 text-xs text-white placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-400 transition-colors shadow-lg shadow-rose-500/20"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest">
        Small wins build the legacy.
      </p>
    </div>
  );
}
