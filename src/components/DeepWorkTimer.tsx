'use client';

import { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';

export default function DeepWorkTimer() {
  const [timeLeft, setTimeLeft] = useState(90 * 60); // 90 minutes
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setTimeLeft(90 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-white">Deep Work</h3>
      </div>

      <div className="bg-gray-950 p-6 rounded-xl border border-gray-800 text-center">
        <div className="text-5xl font-black text-white mb-6 font-mono tracking-tighter">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggle}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${
              isActive 
                ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700' 
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500'
            }`}
          >
            {isActive ? <Pause size={18} /> : <Play size={18} />}
            {isActive ? 'PAUSE' : 'START SPRINT'}
          </button>
          <button
            onClick={reset}
            className="p-3 bg-gray-900 text-gray-500 border border-gray-800 rounded-lg hover:text-white transition-colors"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest">
        90 Minute Block // No Distractions
      </p>
    </div>
  );
}
