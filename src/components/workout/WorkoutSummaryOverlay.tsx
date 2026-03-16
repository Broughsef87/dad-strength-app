'use client';

import { Trophy, Clock, Zap, ArrowRight, Share2, Sparkles } from 'lucide-react';
import StatCard from '../StatCard';

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
  const stats = [
    { label: 'Total Volume', value: totalVolume.toLocaleString(), subtext: 'LB' },
    { label: 'Time Under Tension', value: duration },
    { label: 'Protocol Type', value: 'Functional Strength' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-950/95 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto">
      <div className="w-full max-w-sm relative my-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 ease-out">
        {/* Decorative Elements */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/30 blur-[100px] rounded-full animate-pulse" />
        
        <div className="bg-gray-900 border border-indigo-500/20 rounded-[48px] p-8 text-center shadow-[0_0_50px_rgba(99,102,241,0.2)] relative overflow-hidden">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_2px_10px_rgba(99,102,241,0.5)]" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Mission Accomplished</span>
            </div>

            <h2 className="text-4xl font-black text-white mb-2 italic tracking-tighter">ELITE PERFORMANCE</h2>
            <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-10">Session Data Logged</p>

            <div className="mb-10 space-y-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 transform hover:scale-[1.02] transition-transform">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Volume</p>
                <p className="text-4xl font-black text-white">{totalVolume.toLocaleString()}<span className="text-sm text-indigo-500 ml-1 italic">LBS</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-4">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-xl font-black text-white font-mono">{duration}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-4">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Rank</p>
                  <p className="text-xl font-black text-indigo-400 italic">OVR-99</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-800">
              <button 
                onClick={onReturn}
                className="group w-full bg-indigo-600 text-white font-black py-5 rounded-3xl hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(99,102,241,0.3)]"
              >
                RETURN TO HQ
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-white transition-colors py-2 text-[10px] font-black uppercase tracking-widest">
                <Share2 size={14} />
                Export Performance Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
