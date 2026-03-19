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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-brand" />
          <h1 className="font-light text-2xl tracking-tight">Mind</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">

        {/* Objectives */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand" />
              <h3 className="font-medium text-sm">Daily Objectives</h3>
            </div>
            <button
              onClick={() => {
                setLockedIn(!lockedIn);
                saveToLocal({ lockedIn: !lockedIn });
              }}
              className={`p-1.5 rounded-lg transition-all ${lockedIn ? 'text-brand bg-brand/10' : 'text-muted-foreground bg-muted hover:text-foreground'}`}
            >
              {lockedIn ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          <div className="space-y-4">
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="text-[10px] text-muted-foreground w-5 font-medium tabular-nums">0{i + 1}</div>
                {lockedIn ? (
                  <button
                    onClick={() => toggleObjective(i)}
                    className="flex-1 flex items-center gap-3 py-1.5 text-left transition-all"
                  >
                    {completedObjectives[i] ? (
                      <CheckCircle2 size={16} className="text-brand shrink-0" />
                    ) : (
                      <Circle size={16} className="text-border shrink-0 group-hover:text-muted-foreground" />
                    )}
                    <span className={`text-sm transition-all ${completedObjectives[i] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
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
                    className="flex-1 bg-transparent border-b border-border focus:border-foreground text-sm text-foreground py-1.5 transition-colors outline-none placeholder:text-muted-foreground"
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
              className="w-full mt-6 bg-foreground text-background py-3 rounded-lg text-xs font-medium uppercase tracking-[0.1em] hover:opacity-90 transition-opacity"
            >
              Lock In Objectives
            </button>
          )}
        </div>

        <div className="bg-card p-6 rounded-xl border border-border">
          <DeepWorkTimer availableObjectives={objectives} />
        </div>

        <div className="bg-card p-6 rounded-xl border border-border">
          <MindSqueeze objectives={objectives} />
        </div>

        {/* Journal */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            <PenLine size={16} className="text-brand" />
            <h3 className="font-medium text-sm">Journal</h3>
          </div>
          <textarea
            value={journal}
            onChange={(e) => {
              setJournal(e.target.value);
              saveToLocal({ journal: e.target.value });
            }}
            placeholder="What's on your mind? Capture the signal, ignore the noise..."
            className="w-full bg-background border border-border rounded-lg p-4 text-sm text-foreground h-48 resize-none outline-none focus:border-foreground/40 transition-colors placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSaveJournal}
            disabled={isSaving}
            className={`w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-medium uppercase tracking-[0.1em] transition-all ${
              savedMsg
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : isSaving
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-muted text-foreground hover:bg-foreground hover:text-background'
            }`}
          >
            {savedMsg ? '✓ Entry Saved' : isSaving ? 'Saving...' : <><Save size={12} /> Save Entry</>}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
