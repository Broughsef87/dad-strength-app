'use client';

import { motion } from 'framer-motion';
import { staggerContainer, fadeUp } from '../../components/ui/motion';
import { createClient } from '../../utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Target, PenLine, Lock, Unlock, CheckCircle2, Circle, Save, Plus, X } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import AppHeader from '../../components/AppHeader';
import DeepWorkTimer from '../../components/DeepWorkTimer';
import MindSqueeze from '../../components/MindSqueeze';

export default function MindPage() {
  const [supabase] = useState(() => createClient());
  const [objectives, setObjectives] = useState(['', '', '']);
  const [completedObjectives, setCompletedObjectives] = useState<boolean[]>([false, false, false]);
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
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null }; error: Error | null }) => {
      if (!user) return;
      supabase
        .from('daily_checkins')
        .select('mind_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()
        .then(({ data }: { data: { mind_state: unknown } | null; error: Error | null }) => {
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
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null }; error: Error | null }) => {
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

  if (!mounted) return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-4 space-y-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 font-display">Mental</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Mind</h1>
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="ds-card p-6 animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-4">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 font-display">Mental</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Mind</h1>
        </div>
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >

        {/* Objectives */}
        <motion.div variants={fadeUp} className="ds-card p-6">
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
                <div className="text-xs text-muted-foreground w-5 font-medium tabular-nums shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </div>
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
                {!lockedIn && objectives.length > 1 && (
                  <button
                    onClick={() => {
                      const newObjs = objectives.filter((_, idx) => idx !== i);
                      const newCompleted = completedObjectives.filter((_, idx) => idx !== i);
                      setObjectives(newObjs);
                      setCompletedObjectives(newCompleted);
                      saveToLocal({ objectives: newObjs, completedObjectives: newCompleted });
                    }}
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!lockedIn && (
            <div className="mt-4 space-y-3">
              {objectives.length < 5 && (
                <button
                  onClick={() => {
                    const newObjs = [...objectives, ''];
                    const newCompleted = [...completedObjectives, false];
                    setObjectives(newObjs);
                    setCompletedObjectives(newCompleted);
                    saveToLocal({ objectives: newObjs, completedObjectives: newCompleted });
                  }}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus size={14} /> Add Objective
                </button>
              )}
              <button
                onClick={() => {
                  setLockedIn(true);
                  saveToLocal({ lockedIn: true });
                }}
                className="w-full bg-brand text-background py-3 rounded-md text-xs font-semibold uppercase tracking-[0.14em] hover:bg-brand/90 transition-colors brand-glow"
              >
                Lock In Objectives
              </button>
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="ds-card p-6">
          <DeepWorkTimer availableObjectives={objectives} />
        </motion.div>

        <motion.div variants={fadeUp} className="ds-card p-6">
          <MindSqueeze objectives={objectives} />
        </motion.div>

        {/* Journal */}
        <motion.div variants={fadeUp} className="ds-card p-6">
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
        </motion.div>

        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
