'use client';

import { useState } from 'react';
import { Heart, Plus, Sparkles, Coffee, Utensils, Gift, MessageCircle } from 'lucide-react';

interface Entry {
  id: string;
  type: string;
  note: string;
  timestamp: Date;
}

const TYPES = [
  { label: 'Act of Service', icon: Utensils, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: 'Quality Time', icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-50' },
  { label: 'Words', icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { label: 'Gift', icon: Gift, color: 'text-purple-500', bg: 'bg-purple-50' },
];

export default function RelationshipLedger() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [note, setNote] = useState('');
  const [selectedType, setSelectedType] = useState(TYPES[0].label);

  const addEntry = () => {
    if (!note) return;
    const newEntry: Entry = {
      id: Math.random().toString(36).substring(2, 9),
      type: selectedType,
      note,
      timestamp: new Date(),
    };
    setEntries([newEntry, ...entries]);
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
        <h3 className="font-bold text-slate-800">Relationship Ledger</h3>
      </div>

      <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                onClick={() => setSelectedType(t.label)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                  selectedType === t.label 
                    ? `border-rose-200 ${t.bg} ${t.color}` 
                    : 'border-slate-200 bg-white text-slate-500 hover:border-rose-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you do today?"
            className="flex-1 p-2.5 rounded-lg border border-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white text-sm"
          />
          <button
            onClick={addEntry}
            className="bg-rose-500 text-white p-2.5 rounded-lg hover:bg-rose-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
            <Sparkles className="w-6 h-6 text-rose-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400 italic">No deposits in the ledger yet.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="p-3 bg-white border border-slate-100 rounded-lg flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-tighter text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                  {entry.type}
                </span>
                <span className="text-[10px] text-slate-400">
                  {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium">{entry.note}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
