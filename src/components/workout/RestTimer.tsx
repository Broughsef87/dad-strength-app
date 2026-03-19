'use client';

import { Timer, X } from 'lucide-react';

interface RestTimerProps {
  timeLeft: number;
  onSkip: () => void;
}

export default function RestTimer({ timeLeft, onSkip }: RestTimerProps) {
  if (timeLeft <= 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft <= 10;
  const progress = (timeLeft / 90) * 100; // Assuming default 90s for visualization

  return (
    <div className={`relative overflow-hidden p-5 rounded-3xl border-2 flex items-center justify-between transition-all duration-500 ${
      isLowTime 
        ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
        : 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.05)]'
    }`}>
      {/* Background Progress Bar */}
      <div 
        className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ease-linear ${
          isLowTime ? 'bg-red-500' : 'bg-indigo-500'
        }`}
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-3 rounded-2xl ${isLowTime ? 'bg-red-500/20 animate-pulse' : 'bg-indigo-500/20'}`}>
          <Timer className={`w-6 h-6 ${isLowTime ? 'text-red-500' : 'text-indigo-400'}`} />
        </div>
        
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
            Protocol Rest
            {isLowTime && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />}
          </p>
          <p className={`text-3xl font-mono font-black tabular-nums leading-none ${isLowTime ? 'text-red-500' : 'text-foreground'}`}>
            {formatTime(timeLeft)}
          </p>
        </div>
      </div>

      <button 
        onClick={onSkip}
        className="group relative z-10 p-2 rounded-xl bg-card/50 border border-border hover:border-gray-700 transition-all"
      >
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-black text-muted-foreground group-hover:text-foreground uppercase tracking-widest transition-colors">Skip</span>
          <X className="w-4 h-4 text-gray-600 group-hover:text-red-500 transition-colors" />
        </div>
      </button>
    </div>
  );
}

