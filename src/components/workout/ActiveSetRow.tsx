'use client';

import { CheckCircle2, Circle, History } from 'lucide-react';

interface ActiveSetRowProps {
  index: number;
  isDone: boolean;
  weight: string;
  reps: string;
  isPR?: boolean;
  onWeightChange: (val: string) => void;
  onRepsChange: (val: string) => void;
  onToggle: () => void;
  previousWeight?: string;
  previousReps?: string;
}

export default function ActiveSetRow({
  index,
  isDone,
  weight,
  reps,
  isPR,
  onWeightChange,
  onRepsChange,
  onToggle,
  previousWeight,
  previousReps
}: ActiveSetRowProps) {
  return (
    <div className={`group relative grid grid-cols-12 gap-3 items-center p-3 rounded-2xl transition-all duration-500 ${
      isDone
        ? 'bg-emerald-500/5 border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.02)]'
        : 'bg-gray-800/20 border border-border/40 hover:border-brand/30 hover:bg-gray-800/30'
    }`}>
      {/* Set Number Indicator */}
      <div className="col-span-1 flex flex-col items-center justify-center">
        <span className={`text-[9px] font-black uppercase tracking-tighter mb-0.5 transition-colors ${
          isDone ? 'text-emerald-500/50' : 'text-gray-600 group-hover:text-brand/50'
        }`}>
          Set
        </span>
        <span className={`text-base font-black italic leading-none ${
          isDone ? 'text-emerald-500' : 'text-muted-foreground group-hover:text-foreground'
        }`}>
          {index + 1}
        </span>
      </div>

      {/* Weight Input */}
      <div className="col-span-4 relative group/input">
        <input
          type="number"
          inputMode="decimal"
          placeholder={previousWeight || "0"}
          disabled={isDone}
          value={weight}
          className={`w-full bg-background/50 border-2 rounded-xl p-3 text-center font-black text-xl stat-num text-foreground outline-none transition-all placeholder:text-gray-800 disabled:opacity-40 ${
            isDone
              ? 'border-transparent'
              : 'border-border/50 focus:border-brand focus:bg-background focus:ring-4 focus:ring-brand/10'
          }`}
          onChange={(e) => onWeightChange(e.target.value)}
        />
        {weight && !isDone && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-[8px] font-black px-2 py-0.5 rounded-full text-foreground uppercase tracking-widest shadow-lg shadow-brand/20 animate-in fade-in zoom-in-75 duration-200">
            LBS
          </span>
        )}
        {previousWeight && !weight && !isDone && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                <History size={8} className="text-gray-600" />
                <span className="text-[8px] font-bold text-gray-600">{previousWeight}</span>
            </div>
        )}
      </div>

      {/* Reps Input */}
      <div className="col-span-4 relative group/input">
        <input
          type="number"
          inputMode="numeric"
          placeholder={previousReps || "0"}
          disabled={isDone}
          value={reps}
          className={`w-full bg-background/50 border-2 rounded-xl p-3 text-center font-black text-xl stat-num text-foreground outline-none transition-all placeholder:text-gray-800 disabled:opacity-40 ${
            isDone
              ? 'border-transparent'
              : 'border-border/50 focus:border-brand focus:bg-background focus:ring-4 focus:ring-brand/10'
          }`}
          onChange={(e) => onRepsChange(e.target.value)}
        />
        {reps && !isDone && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-[8px] font-black px-2 py-0.5 rounded-full text-foreground uppercase tracking-widest shadow-lg shadow-brand/20 animate-in fade-in zoom-in-75 duration-200">
            REPS
          </span>
        )}
        {previousReps && !reps && !isDone && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                <History size={8} className="text-gray-600" />
                <span className="text-[8px] font-bold text-gray-600">{previousReps}</span>
            </div>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={onToggle}
        className={`col-span-3 h-14 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
          isDone
            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 rotate-0'
            : 'bg-card border border-border text-gray-700 hover:text-brand hover:border-brand/50 hover:bg-gray-800 shadow-sm'
        }`}
      >
        {isDone ? (
          <CheckCircle2 size={28} strokeWidth={3} className="animate-in zoom-in duration-300" />
        ) : (
          <Circle size={28} strokeWidth={2} />
        )}
      </button>

      {/* Previous Data Tooltip / Hint (Mobile Optimized) */}
      {!isDone && !weight && !reps && previousWeight && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full pr-2 hidden lg:block">
              <div className="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 whitespace-nowrap">
                  <p className="text-[8px] font-black text-muted-foreground uppercase">Last: {previousWeight}x{previousReps}</p>
              </div>
          </div>
      )}
      {isDone && isPR && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-yellow-400/30 animate-in zoom-in duration-300 z-10">
          PR
        </div>
      )}
    </div>
  );
}

