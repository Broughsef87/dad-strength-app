'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Anchor, ArrowLeft, Sun, CheckCircle2, Timer, Play, Pause, RotateCcw } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import FamilyPulse from '../../components/FamilyPulse';
import Brotherhood from '../../components/Brotherhood';

export default function SpiritPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [prayerDone, setPrayerDone] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Restore daily reset state from localStorage
    const saved = localStorage.getItem('dad-strength-spirit-state');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === new Date().toLocaleDateString()) {
        setPrayerDone(data.prayerDone || false);
      }
    }
  }, []);

  const saveSpiritState = (done: boolean) => {
    localStorage.setItem('dad-strength-spirit-state', JSON.stringify({
      date: new Date().toLocaleDateString(),
      prayerDone: done,
    }));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const startTimer = (mins: number) => {
    setTimerSeconds(mins * 60);
    setTimerActive(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-indigo-500" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Spirit</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <FamilyPulse />
        </div>

        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <Brotherhood />
        </div>

        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <Anchor size={18} className="text-indigo-500" />
              <h3 className="font-bold text-lg uppercase tracking-tighter italic">Spiritual Reset</h3>
           </div>
           
           <div className="space-y-6">
              {/* Timer Display */}
              {timerSeconds > 0 && (
                <div className="bg-gray-950 p-6 rounded-2xl border border-indigo-500/20 text-center animate-in fade-in zoom-in duration-300">
                  <div className="text-4xl font-black text-white mb-4 font-mono tracking-tighter tabular-nums">
                    {formatTime(timerSeconds)}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTimerActive(!timerActive)}
                      className="flex-1 py-2 bg-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      {timerActive ? <Pause size={14} className="mx-auto" /> : <Play size={14} className="mx-auto" />}
                    </button>
                    <button 
                      onClick={() => { setTimerSeconds(0); setTimerActive(false); }}
                      className="px-4 py-2 bg-gray-900 rounded-lg text-gray-500"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Reset Buttons */}
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => startTimer(5)}
                   className="flex flex-col items-center gap-3 p-4 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-indigo-500/30 transition-all group"
                 >
                    <Timer size={20} className="text-gray-600 group-hover:text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">5 MIN PRAYER</span>
                 </button>
                 <button 
                   onClick={() => startTimer(10)}
                   className="flex flex-col items-center gap-3 p-4 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-indigo-500/30 transition-all group"
                 >
                    <Timer size={20} className="text-gray-600 group-hover:text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">10 MIN MEDITATION</span>
                 </button>
              </div>

              <button 
                onClick={() => { const next = !prayerDone; setPrayerDone(next); saveSpiritState(next); }}
                className={`w-full flex flex-col items-center justify-center p-8 rounded-3xl border-2 transition-all gap-4 ${
                  prayerDone 
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-2xl shadow-indigo-500/10' 
                    : 'bg-gray-950/50 border-gray-800 text-gray-700 hover:border-gray-700 hover:text-gray-500'
                }`}
              >
                  {prayerDone ? <CheckCircle2 size={32} /> : <Sun size={32} />}
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    {prayerDone ? 'Daily Reset Logged' : 'Log Daily Reset'}
                  </span>
              </button>
           </div>

           <p className="mt-6 text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center leading-relaxed italic px-4">
              "Quiet the noise to hear the signal. The legacy is built in the silence."
           </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
