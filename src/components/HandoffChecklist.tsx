'use client';

import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, Circle } from 'lucide-react';

const HANDOFF_ITEMS = [
  { id: 'dishes', label: 'Kitchen / Dishes Reset' },
  { id: 'trash', label: 'Trash / Diaper Pail Emptied' },
  { id: 'bottles', label: 'Bottles Prepped / Sanitized' },
  { id: 'tomorrow', label: 'Tomorrow Plan / Gear Out' },
];

export default function HandoffChecklist() {
  const [done, setDone] = useState<string[]>([]);

  const toggle = (id: string) => {
    setDone(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-foreground uppercase tracking-tighter italic">Evening Handoff</h3>
      </div>

      <div className="space-y-2">
        {HANDOFF_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              done.includes(item.id)
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                : 'bg-card/50 border-border text-muted-foreground hover:border-gray-700'
            }`}
          >
            {done.includes(item.id) ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-xs font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

