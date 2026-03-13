'use client';

import { Activity } from 'lucide-react';

interface ActiveSessionHeaderProps {
  workoutName: string;
  duration: string;
  volume: number;
  progress: number;
}

export default function ActiveSessionHeader({ workoutName, duration, volume, progress }: ActiveSessionHeaderProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 mb-6 relative overflow-hidden">
      {/* Overall Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
        <div 
          className="h-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Activity className="w-4 h-4 text-indigo-400" />
        </div>
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Session</h2>
      </div>
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">{workoutName}</h1>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Protocol in Progress</p>
        </div>
        
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Time</p>
            <p className="text-lg font-mono font-black text-white leading-none">{duration}</p>
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Volume</p>
            <p className="text-lg font-black text-white leading-none">{volume.toLocaleString()}<span className="text-[10px] text-gray-500 ml-0.5">LB</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
