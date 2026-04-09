'use client';

import { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, Baby } from 'lucide-react';

interface DeepWorkTimerProps {
  availableObjectives?: string[];
}

export default function DeepWorkTimer({ availableObjectives = [] }: DeepWorkTimerProps) {
  const [timeLeft, setTimeLeft] = useState(90 * 60); // 90 minutes
  const [isActive, setIsActive] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setTimeLeft(90 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const validObjectives = availableObjectives.filter(obj => obj.trim() !== '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-foreground italic uppercase tracking-tighter">Deep Work Sprint</h3>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-brand/10 rounded-full border border-brand/20">
          <Baby size={10} className="text-brand" />
          <span className="text-[8px] font-black text-brand uppercase">Nap-Squeeze Mode</span>
        </div>
      </div>

      <div className="bg-background p-6 rounded-2xl border border-border shadow-inner">
        <div className="text-5xl font-black text-foreground mb-6 font-mono tracking-tighter tabular-nums flex justify-center items-baseline gap-1">
          {minutes}<span className="text-gray-700 text-3xl">:</span>{seconds.toString().padStart(2, '0')}
        </div>

        {validObjectives.length > 0 && (
          <div className="mb-6">
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 text-center">
              Focusing On:
            </label>
            <select 
              value={selectedObjective}
              onChange={(e) => setSelectedObjective(e.target.value)}
              className="w-full bg-card border border-border rounded-lg py-2 px-3 text-xs text-brand outline-none focus:border-brand/50 appearance-none text-center cursor-pointer"
            >
              <option value="">-- Select Objective --</option>
              {validObjectives.map((obj, i) => (
                <option key={i} value={obj}>{obj}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={toggle}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all text-xs tracking-widest ${
              isActive 
                ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700' 
                : 'bg-brand text-foreground shadow-lg shadow-brand/20 hover:bg-brand/90'
            }`}
          >
            {isActive ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            {isActive ? 'PAUSE' : 'START SPRINT'}
          </button>
          <button
            onClick={reset}
            className="p-3 bg-card text-muted-foreground border border-border rounded-xl hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-brand/5 border border-brand/10 rounded-xl p-3">
        <p className="text-[9px] text-muted-foreground font-medium leading-relaxed italic text-center">
          &quot;The Nap-Squeeze: Baby is down. The clock is ticking. This is 90 minutes of pure execution. No noise, just the mission.&quot;
        </p>
      </div>
    </div>
  );
}

