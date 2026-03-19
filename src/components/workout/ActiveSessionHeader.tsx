'use client';

import { Activity, Coffee, Play, Timer, TrendingUp, Volume2 } from 'lucide-react';

interface ActiveSessionHeaderProps {
  workoutName: string;
  duration: string;
  volume: number;
  progress: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  predictedVolume?: number;
}

export default function ActiveSessionHeader({ 
  workoutName, 
  duration, 
  volume, 
  progress,
  isPaused = false,
  onTogglePause,
  predictedVolume
}: ActiveSessionHeaderProps) {
  return (
    <div className={`group relative bg-card/40 border-2 overflow-hidden transition-all duration-700 backdrop-blur-3xl p-6 rounded-[32px] mb-8 ${
      isPaused 
        ? 'border-amber-500/30 bg-amber-500/[0.03] shadow-[0_0_40px_rgba(245,158,11,0.05)]' 
        : 'border-border shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]'
    }`}>
      {/* Dynamic Progress Gradient */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-background/50">
        <div 
          className={`h-full transition-all duration-1000 ease-out relative ${
            isPaused ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
          }`}
          style={{ width: `${progress}%` }}
        >
            <div className={`absolute top-0 right-0 h-full w-8 bg-gradient-to-r from-transparent to-white/20 animate-pulse`} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl transition-all duration-500 transform group-hover:rotate-12 ${
            isPaused ? 'bg-amber-500/20 text-amber-500' : 'bg-indigo-500/20 text-indigo-400'
          }`}>
            {isPaused ? <Coffee size={18} /> : <Activity size={18} className="animate-pulse" />}
          </div>
          <div className="flex flex-col">
            <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] leading-none mb-1 transition-colors ${
              isPaused ? 'text-amber-500/70' : 'text-indigo-400/80'
            }`}>
              {isPaused ? 'Grace Mode Active' : 'Live Protocol'}
            </h2>
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">System Operational</span>
            </div>
          </div>
        </div>

        <button 
          onClick={onTogglePause}
          className={`group/btn flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-90 ${
            isPaused 
              ? 'bg-amber-500 border-amber-400 text-black shadow-[0_8px_25px_rgba(245,158,11,0.3)] hover:bg-amber-400' 
              : 'bg-gray-800/40 border-gray-700/50 text-muted-foreground hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5'
          }`}
        >
          {isPaused ? (
            <>
              <Play size={14} fill="currentColor" className="transition-transform group-hover/btn:scale-110" />
              Resume Protocol
            </>
          ) : (
            <>
              <Coffee size={14} className="transition-transform group-hover/btn:rotate-[-10deg]" />
              Grace Mode
            </>
          )}
        </button>
      </div>
      
      <div className="flex justify-between items-end">
        <div className="relative">
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-1.5 drop-shadow-sm">{workoutName}</h1>
          <div className="flex items-center gap-2">
            <p className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${
                isPaused ? 'text-amber-500/60' : 'text-muted-foreground'
            }`}>
                {isPaused ? 'Monitoring Parent Duty' : 'Executing Functional Cycle'}
            </p>
            {!isPaused && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-800/80 border border-gray-700 rounded-md">
                    <TrendingUp size={10} className="text-indigo-400" />
                    <span className="text-[9px] font-black text-indigo-400">UP 8%</span>
                </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-8 items-center">
          <div className="relative group/stat text-right">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5 group-hover/stat:text-indigo-400/70 transition-colors">Session Time</p>
            <div className="flex items-baseline justify-end gap-1.5">
                <Timer size={14} className={`mb-0.5 ${isPaused ? 'text-amber-400' : 'text-indigo-500/50'}`} />
                <p className={`text-2xl font-mono font-black tabular-nums transition-all ${
                    isPaused ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-foreground'
                }`}>{duration}</p>
            </div>
          </div>

          <div className="w-px h-10 bg-gray-800" />

          <div className="relative group/stat text-right">
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5 group-hover/stat:text-emerald-400/70 transition-colors">Load Moved</p>
            <div className="flex items-baseline justify-end gap-1">
                <p className="text-3xl font-black text-foreground leading-none tracking-tight">
                    {volume.toLocaleString()}
                </p>
                <span className="text-[12px] font-black text-indigo-500 italic">LBS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Background Glows */}
      <div className={`absolute -bottom-12 -right-12 w-32 h-32 blur-[80px] rounded-full transition-colors duration-1000 ${
          isPaused ? 'bg-amber-500/10' : 'bg-indigo-500/10'
      }`} />
    </div>
  );
}

