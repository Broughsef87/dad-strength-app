'use client';

import { CheckCircle2, Circle, AlertCircle, TrendingUp, Sparkles, ChevronRight, Activity, Zap, History } from 'lucide-react';

interface ExerciseCardProps {
  name: string;
  target: string;
  isCompleted: boolean;
  children: React.ReactNode;
  lastPerformed?: string;
  intensityScore?: number;
}

export default function ExerciseCard({ 
  name, 
  target, 
  isCompleted, 
  children,
  lastPerformed = "Yesterday",
  intensityScore = 88
}: ExerciseCardProps) {
  return (
    <div className={`group relative bg-card border-2 rounded-[40px] transition-all duration-700 overflow-hidden ${
      isCompleted 
        ? 'border-emerald-500/40 bg-emerald-500/[0.02] shadow-[0_15px_40px_-10px_rgba(16,185,129,0.1)]' 
        : 'border-border/80 hover:border-indigo-500/40 shadow-2xl'
    }`}>
      {/* Dynamic Background Element */}
      {!isCompleted && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors duration-700" />
      )}

      {/* Exercise Header Section */}
      <div className={`p-8 pb-5 flex justify-between items-start relative z-10 ${
        isCompleted ? 'bg-emerald-500/[0.03]' : ''
      }`}>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2.5">
            <h3 className={`font-black text-2xl tracking-tighter transition-all duration-500 ${
              isCompleted ? 'text-emerald-400' : 'text-foreground'
            }`}>
              {name.toUpperCase()}
            </h3>
            {isCompleted ? (
              <div className="bg-emerald-500/20 p-1.5 rounded-full animate-in zoom-in duration-500">
                <CheckCircle2 size={18} className="text-emerald-400" strokeWidth={3} />
              </div>
            ) : (
                <div className="bg-gray-800/50 p-1 rounded-lg border border-gray-700 group-hover:border-indigo-500/30 transition-all">
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-400 transition-colors" />
                </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                TARGET: {target}
              </span>
            </div>
            
            {!isCompleted && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-800/50 rounded-full border border-gray-700/50">
                <History size={10} className="text-muted-foreground" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                   {lastPerformed}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {!isCompleted && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-indigo-400/80 mb-1.5">
                <Zap size={14} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Intensity</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-foreground">{intensityScore}</span>
                <span className="text-[10px] font-black text-gray-600 italic">pts</span>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Header Stats Divider (Mobile-style Tabs) */}
      {!isCompleted && (
          <div className="px-8 flex items-center gap-4 mb-2">
              <div className="flex-1 h-px bg-gradient-to-r from-gray-800 via-gray-700 to-transparent" />
              <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                  <Activity size={10} className="text-indigo-400" />
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em]">Load Matrix</span>
              </div>
          </div>
      )}

      {/* Sets Area (Vertical Scroll or Flex Container) */}
      <div className={`p-8 pt-4 space-y-4 relative z-10 ${isCompleted ? 'opacity-60 blur-[0.5px] pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Completion Indicator Footer */}
      {isCompleted ? (
        <div className="bg-emerald-500 relative overflow-hidden py-2.5 group/complete">
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/complete:translate-x-full transition-transform duration-1000 ease-in-out" />
            <div className="flex items-center justify-center gap-3 relative z-10">
                <Sparkles size={12} className="text-black/80" />
                <p className="text-[10px] font-black text-black uppercase tracking-[0.4em]">Protocol Executed Successfully</p>
                <Sparkles size={12} className="text-black/80 rotate-12" />
            </div>
        </div>
      ) : (
          <div className="px-8 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500/30 w-1/3 rounded-full" />
              </div>
          </div>
      )}
    </div>
  );
}

