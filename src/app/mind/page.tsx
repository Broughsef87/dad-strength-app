'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Target, PenLine, Timer, ArrowLeft } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import DeepWorkTimer from '../../components/DeepWorkTimer';

export default function MindPage() {
  const supabase = createClient();
  const router = useRouter();
  const [objectives, setObjectives] = useState(['', '', '']);
  const [journal, setJournal] = useState('');

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-indigo-500" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Mind</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">
        {/* DEEP WORK TIMER (DEEP VIEW) */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <DeepWorkTimer />
        </div>

        {/* TOP 3 OBJECTIVES */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <Target size={18} className="text-indigo-500" />
              <h3 className="font-bold text-lg uppercase tracking-tighter italic">Daily Objectives</h3>
           </div>
           <div className="space-y-4">
              {objectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-4">
                   <div className="text-xs font-black text-gray-700 w-6">0{i+1}</div>
                   <input 
                     type="text" 
                     value={obj} 
                     onChange={(e) => {
                        const newObjs = [...objectives];
                        newObjs[i] = e.target.value;
                        setObjectives(newObjs);
                     }}
                     placeholder="Define objective..."
                     className="flex-1 bg-transparent border-b border-gray-800 focus:border-indigo-500 text-sm text-white py-2 transition-colors outline-none"
                   />
                </div>
              ))}
           </div>
        </div>

        {/* FULL JOURNAL */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <div className="flex items-center gap-2 mb-4">
              <PenLine size={18} className="text-indigo-500" />
              <h3 className="font-bold text-lg uppercase tracking-tighter italic">Journal</h3>
           </div>
           <textarea 
             value={journal}
             onChange={(e) => setJournal(e.target.value)}
             placeholder="What's on your mind? Capture the signal, ignore the noise..."
             className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-300 h-64 resize-none outline-none italic focus:ring-1 focus:ring-indigo-500/50"
           />
           <button className="w-full mt-4 bg-gray-800 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
              Save Entry
           </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
