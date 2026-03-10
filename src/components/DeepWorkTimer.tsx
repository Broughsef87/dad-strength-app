'use client';

import { useState, useEffect } from 'react';
import { Zap, Play, Square, Trophy, Clock } from 'lucide-react';

export default function DeepWorkTimer() {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const toggle = () => {
    if (isActive) {
      setDailyTotal(prev => prev + seconds);
      setSeconds(0);
    }
    setIsActive(!isActive);
  };

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotal = (s: number) => {
    const mins = Math.floor(s / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h3 className="font-bold text-slate-800">Nap-Squeeze</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-slate-500">
          <Trophy className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-tight">Today: {formatTotal(dailyTotal)}</span>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${
        isActive ? 'bg-amber-50 border-amber-200 shadow-inner' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="flex items-center gap-2 text-slate-400">
           <Clock className="w-4 h-4" />
           <span className="text-xs font-bold uppercase tracking-widest">Focus Session</span>
        </div>
        
        <div className={`text-5xl font-mono font-black tabular-nums transition-colors ${
          isActive ? 'text-amber-600' : 'text-slate-300'
        }`}>
          {formatTime(seconds)}
        </div>

        <button
          onClick={toggle}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
            isActive 
              ? 'bg-slate-900 text-white hover:bg-slate-800' 
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200'
          }`}
        >
          {isActive ? (
            <>
              <Square className="w-4 h-4 fill-white" />
              Finish Squeeze
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              Start Squeeze
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-slate-400 uppercase font-bold tracking-tight">
        When the baby sleeps, the business grows.
      </p>
    </div>
  );
}
