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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-950/98 backdrop-blur-2xl animate-in fade-in duration-500 overflow-y-auto">
      <div className="w-full max-w-sm relative my-8">
        {/* Decorative Elements */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 blur-[80px] rounded-full" />
        
        <div className="bg-gray-900 border border-gray-800 rounded-[48px] p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-6">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Mission Accomplished</span>
            </div>

            <div className="mb-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 text-left ml-1">Your Proof of Work</p>
              <StatCard 
                type="workout"
                title={workoutName}
                subtitle="Functional Protocol"
                stats={stats}
              />
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-800">
              <button 
                onClick={onReturn}
                className="group w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20"
              >
                RETURN TO HQ
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
