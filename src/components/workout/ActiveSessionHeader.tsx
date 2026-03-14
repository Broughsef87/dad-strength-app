'use client';

import { Activity, Coffee, Play } from 'lucide-react';

interface ActiveSessionHeaderProps {
  workoutName: string;
  duration: string;
  volume: number;
  progress: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export default function ActiveSessionHeader({ 
  workoutName, 
  duration, 
  volume, 
  progress,
  isPaused = false,
  onTogglePause
}: ActiveSessionHeaderProps) {
  return (
    <div className={`bg-gray-900/50 border ${isPaused ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-800'} rounded-3xl p-6 mb-6 relative overflow-hidden transition-all duration-500`}>
      {/* Overall Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
        <div 
          className={`h-full ${isPaused ? 'bg-amber-500' : 'bg-indigo-500'} transition-all duration-700 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 ${isPaused ? 'bg-amber-500/20' : 'bg-indigo-500/20'} rounded-lg transition-colors`}>
            {isPaused ? (
              <Coffee className="w-4 h-4 text-amber-400" />
            ) : (
              <Activity className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          <h2 className={`text-[10px] font-black ${isPaused ? 'text-amber-400' : 'text-gray-400'} uppercase tracking-[0.2em] transition-colors`}>
            {isPaused ? 'Grace Mode Active' : 'Active Session'}
          </h2>
        </div>

        <button 
          onClick={onTogglePause}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
            isPaused 
              ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' 
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-amber-400'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-3 h-3 fill-current" />
              Resume
            </>
          ) : (
            <>
              <Coffee className="w-3 h-3" />
              Grace Mode
            </>
          )}
        </button>
      </div>
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">{workoutName}</h1>
          <p className={`text-[10px] font-bold ${isPaused ? 'text-amber-400/70' : 'text-indigo-400'} uppercase tracking-widest transition-colors`}>
            {isPaused ? 'Paused for Parent Duty' : 'Protocol in Progress'}
          </p>
        </div>
        
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Time</p>
            <p className={`text-lg font-mono font-black ${isPaused ? 'text-amber-400' : 'text-white'} leading-none transition-colors`}>{duration}</p>
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
