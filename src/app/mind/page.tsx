'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Target, PenLine, ArrowLeft, Lock, Unlock, CheckCircle2, Circle, Save } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import DeepWorkTimer from '../../components/DeepWorkTimer';
import MindSqueeze from '../../components/MindSqueeze';

export default function MindPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [objectives, setObjectives] = useState(['', '', '']);
  const [completedObjectives, setCompletedObjectives] = useState([false, false, false]);
  const [lockedIn, setLockedIn] = useState(false);
  const [journal, setJournal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split('T')[0];
    // Try localStorage first (fast, no network)
    const saved = localStorage.getItem('dad-strength-mind-state');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === new Date().toLocaleDateString()) {
        setObjectives(data.objectives || ['', '', '']);
        setCompletedObjectives(data.completedObjectives || [false, false, false]);
        setLockedIn(data.lockedIn || false);
        setJournal(data.journal || '');
      }
    }
    // Then fetch from Supabase (authoritative, wins if present)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('daily_checkins')
        .select('mind_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()
        .then(({ data }) => {
          if (data?.mind_state) {
            const ms = data.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean; journal?: string };
            setObjectives(ms.objectives || ['', '', '']);
            setCompletedObjectives(ms.completedObjectives || [false, false, false]);
            setLockedIn(ms.lockedIn || false);
            setJournal(ms.journal || '');
          }
        });
    });
  }, [supabase]);

  const saveToLocal = (overrides = {}) => {
    const state = {
      date: new Date().toLocaleDateString(),
      objectives,
      completedObjectives,
      lockedIn,
      journal,
      ...overrides
    };
    localStorage.setItem('dad-strength-mind-state', JSON.stringify(state));
    // Also persist to Supabase (background, silent)
    const today = new Date().toISOString().split('T')[0];
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: today, mind_state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      ).then(() => {});
    });
  };

  const handleSaveJournal = () => {
    setIsSaving(true);
    saveToLocal();
    setTimeout(() => {
      setIsSaving(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    }, 300);
  };

  const toggleObjective = (index: number) => {
    const next = [...completedObjectives];
    next[index] = !next[index];
    setCompletedObjectives(next);
    saveToLocal({ completedObjectives: next });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-card rounded-xl text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-indigo-500" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Mind</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">
        <div className="bg-card/50 p-6 rounded-3xl border border-border shadow-xl relative overflow-hidden">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-500" />
                <h3 className="font-bold text-lg uppercase tracking-tighter italic">Daily Objectives</h3>
              </div>
              <button 
                onClick={() => {
                  setLockedIn(!lockedIn);
                  saveToLocal({ lockedIn: !lockedIn });
                }}
                className={`p-2 rounded-lg transition-all ${lockedIn ? 'text-indigo-500 bg-indigo-500/10' : 'text-gray-600 bg-gray-800/50 hover:text-muted-foreground'}`}
              >
                {lockedIn ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
           </div>

           <div className="space-y-4">
              {objectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-4 group">
                   <div className="text-[10px] font-black text-gray-700 w-6 italic">0{i+1}</div>
                   {lockedIn ? (
                     <button 
                       onClick={() => toggleObjective(i)}
                       className="flex-1 flex items-center gap-3 py-2 text-left transition-all"
                     >
                       {completedObjectives[i] ? (
                         <CheckCircle2 size={18} className="text-indigo-500 shrink-0" />
                       ) : (
                         <Circle size={18} className="text-gray-800 shrink-0 group-hover:text-gray-600" />
                       )}
                       <span className={`text-sm font-medium transition-all ${completedObjectives[i] ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
                         {obj || 'Undefined Objective'}
                       </span>
                     </button>
                   ) : (
                     <input 
                       type="text" 
                       value={obj} 
                       onChange={(e) => {
                          const newObjs = [...objectives];
                          newObjs[i] = e.target.value;
                          setObjectives(newObjs);
                          saveToLocal({ objectives: newObjs });
                       }}
                       placeholder="Define objective..."
                       className="flex-1 bg-transparent border-b border-border focus:border-indigo-500 text-sm text-foreground py-2 transition-colors outline-none"
                     />
                   )}
                </div>
              ))}
           </div>

           {!lockedIn && (
              <button 
                onClick={() => {
                  setLockedIn(true);
                  saveToLocal({ lockedIn: true });
                }}
                className="w-full mt-6 bg-indigo-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-foreground hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
              >
                Lock In Objectives
              </button>
           )}
        </div>

        <div className="bg-card/50 p-6 rounded-3xl border border-border shadow-xl">
           <DeepWorkTimer availableObjectives={objectives} />
        </div>

        <div className="bg-card/50 p-6 rounded-3xl border border-border shadow-xl">
           <MindSqueeze objectives={objectives} />
        </div>

        <div className="bg-card/50 p-6 rounded-3xl border border-border shadow-xl">
           <div className="flex items-center gap-2 mb-4">
              <PenLine size={18} className="text-indigo-500" />
              <h3 className="font-bold text-lg uppercase tracking-tighter italic">Journal</h3>
           </div>
           <textarea 
             value={journal}
             onChange={(e) => {
               setJournal(e.target.value);
               saveToLocal({ journal: e.target.value });
             }}
             placeholder="What's on your mind? Capture the signal, ignore the noise..."
             className="w-full bg-background border border-border rounded-2xl p-4 text-sm text-gray-300 h-64 resize-none outline-none italic focus:ring-1 focus:ring-indigo-500/50 transition-all"
           />
           <button 
             onClick={handleSaveJournal}
             disabled={isSaving}
             className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               savedMsg
                 ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                 : isSaving
                 ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                 : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-foreground'
             }`}
           >
              {savedMsg ? 'âœ“ Entry Saved' : isSaving ? 'Saving...' : <><Save size={14} /> Save Entry</>}
           </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

