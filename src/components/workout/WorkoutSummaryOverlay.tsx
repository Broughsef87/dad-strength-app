'use client';

import { Trophy, Clock, Zap, ArrowRight, Share2 } from 'lucide-react';

interface WorkoutSummaryOverlayProps {
  workoutName: string;
  totalVolume: number;
  duration: string;
  onReturn: () => void;
}

export default function WorkoutSummaryOverlay({ 
  workoutName, 
  totalVolume, 
  duration, 
  onReturn 
}: WorkoutSummaryOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-950/98 backdrop-blur-2xl animate-in fade-in duration-500">
      <div className="w-full max-w-sm relative">
        {/* Decorative Elements */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full" />
        
        <div className="bg-gray-900 border border-gray-800 rounded-[48px] p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          
          <div className="relative z-10">
            <div className="inline-flex p-5 rounded-[32px] bg-gray-800 border border-gray-700 mb-6 shadow-inner">
              <Trophy size={48} className="text-yellow-500 animate-bounce" />
            </div>
            
            <h2 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Protocol Complete</h2>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight leading-none uppercase">{workoutName}</h1>
            <p className="text-gray-500 font-bold text-sm mb-10">You just got 1% better today, Dad.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-gray-800/80 p-5 rounded-3xl border border-gray-700/50 text-left">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                  <Zap size={14} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Total Volume</p>
                </div>
                <p className="text-2xl font-black text-white leading-none">
                  {totalVolume.toLocaleString()} <span className="text-[10px] text-gray-500">LBS</span>
                </p>
              </div>
              
              <div className="bg-gray-800/80 p-5 rounded-3xl border border-gray-700/50 text-left">
                <div className="flex items-center gap-2 mb-2 text-gray-500">
                  <Clock size={14} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Duration</p>
                </div>
                <p className="text-2xl font-black text-white leading-none font-mono">
                  {duration}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={onReturn}
                className="group w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-indigo-50 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                RETURN TO BASE
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="w-full bg-gray-800/50 text-gray-400 font-black py-4 rounded-2xl hover:text-white transition-all flex items-center justify-center gap-2 text-sm border border-transparent hover:border-gray-700">
                <Share2 size={16} />
                SHARE PROGRESS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
