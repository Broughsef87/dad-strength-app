'use client';

import { Activity, Coffee, Play, Timer, TrendingUp } from 'lucide-react';

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
}: ActiveSessionHeaderProps) {
  return (
    <div className={`group relative bg-surface-3 border-2 overflow-hidden transition-all duration-700 p-6 rounded-xl mb-8 ${
      isPaused
        ? 'border-status-danger-fill/30 bg-status-danger-fill/[0.03]'
        : 'border-border shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]'
    }`}>
      {/* Dynamic Progress Gradient */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-background/50">
        <div
          className={`h-full transition-all duration-1000 ease-out relative ${
            isPaused ? 'bg-status-danger-fill' : 'bg-brand'
          }`}
          style={{ width: `${progress}%` }}
        >
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {/* /10, not /20. The paused badge's danger ink is cut for graphite's
              dark card; a 20% red tint lightened that ground enough to drop it
              to 4.31:1. Found by contrast.mjs section 5 (FOR-198) on its first
              run — the first ink-on-tinted-fill it ever measured. /10 reads
              5.69 chalk, 4.65 graphite, and is the tint step the other branch
              already uses. */}
          <div className={`p-2.5 rounded-2xl transition-all duration-500 transform group-hover:rotate-12 ${
            isPaused ? 'bg-status-danger-fill/10 text-status-danger-ink' : 'bg-brand/10 text-brand'
          }`}>
            {isPaused ? <Coffee size={18} /> : <Activity size={18} />}
          </div>
          <div className="flex flex-col">
            <h2 className={`text-[10px] font-black lowercase leading-none mb-1 transition-colors ${
              isPaused ? 'text-status-danger-ink' : 'text-brand-text'
            }`}>
              {isPaused ? 'Grace Mode Active' : 'Live Protocol'}
            </h2>
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-status-good-fill" />
                <span className="text-[10px] font-bold text-status-good-ink lowercase">System Operational</span>
            </div>
          </div>
        </div>

        <button
          onClick={onTogglePause}
          className={`group/btn flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2 text-[10px] font-black lowercase transition-all active:scale-90 ${
            isPaused
              ? 'bg-status-danger-fill border-status-danger-fill text-destructive-foreground hover:bg-status-danger-fill'
              : 'bg-muted border-border text-muted-foreground hover:border-status-danger-fill/50 hover:text-status-danger-ink hover:bg-status-danger-fill/5'
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
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-1.5">{workoutName}</h1>
          <div className="flex items-center gap-2">
            <p className={`text-[11px] font-bold lowercase transition-colors ${
                isPaused ? 'text-status-danger-ink' : 'text-muted-foreground'
            }`}>
                {isPaused ? 'Monitoring Parent Duty' : 'Executing Functional Cycle'}
            </p>
            {!isPaused && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted border border-border rounded-md">
                    <TrendingUp size={10} className="text-brand" />
                    <span className="text-[9px] font-black text-brand">UP 8%</span>
                </div>
            )}
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="relative group/stat text-right">
            <p className="text-[9px] font-black text-muted-foreground lowercase mb-1.5 group-hover/stat:text-brand-text transition-colors">Session Time</p>
            <div className="flex items-baseline justify-end gap-1.5">
                <Timer size={14} className={`mb-0.5 ${isPaused ? 'text-status-danger-ink' : 'text-brand-text'}`} />
                <p className={`text-2xl font-mono font-black tabular-nums transition-all ${
                    isPaused ? 'text-status-danger-ink drop-' : 'text-foreground'
                }`}>{duration}</p>
            </div>
          </div>

          <div className="w-px h-10 bg-border" />

          <div className="relative group/stat text-right">
            <p className="text-[9px] font-black text-muted-foreground lowercase mb-1.5 group-hover/stat:text-status-good-ink transition-colors">Load Moved</p>
            <div className="flex items-baseline justify-end gap-1">
                <p className="text-3xl font-black text-foreground leading-none tracking-tight">
                    {volume.toLocaleString()}
                </p>
                <span className="text-[12px] font-black text-brand italic">LBS</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

