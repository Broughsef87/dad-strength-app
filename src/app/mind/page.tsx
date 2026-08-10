'use client';

import { motion } from 'framer-motion';
import { staggerContainer, fadeUp } from '../../components/ui/motion';
import { createClient } from '../../utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Target, Lock, Unlock, CheckCircle2, Circle, Plus, X } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import AppHeader from '../../components/AppHeader';
import LearningTracker from '../../components/LearningTracker';
import { localDay } from '../../utils/day';

// ── Seeded objective chips — broad, tap-first. Anything custom a user adds
// joins their personal library (user_objective_presets) and floats by use.
const SEED_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: 'Train',  items: ["Complete today's session", 'Recovery session', '10k steps', '15 min mobility'] },
  { label: 'Family', items: ['Phone-free time with the kids', 'Plan date night', 'Call mom & dad', 'One-on-one time with a kid'] },
  { label: 'Work',   items: ['90-min deep work block', 'Ship the #1 priority', 'Clear the inbox', 'Prep tomorrow before logoff'] },
  { label: 'Health', items: ['In bed by 10', 'Hit protein target', 'No alcohol', '20 min of sunlight'] },
  { label: 'Life',   items: ['Meal prep', 'Fix one thing in the house', 'Read 20 min', 'Budget check-in'] },
];

const MAX_OBJECTIVES = 5;

// Drop empty labels and keep completion flags aligned to the survivors.
function cleanObjectives(objs: unknown, comps: unknown): { o: string[]; c: boolean[] } {
  const o: string[] = []; const c: boolean[] = [];
  (Array.isArray(objs) ? objs : []).forEach((x, i) => {
    if (typeof x === 'string' && x.trim()) {
      o.push(x);
      c.push(Boolean(Array.isArray(comps) ? comps[i] : false));
    }
  });
  return { o, c };
}

export default function MindPage() {
  const [supabase] = useState(() => createClient());
  const [objectives, setObjectives] = useState<string[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<boolean[]>([]);
  const [lockedIn, setLockedIn] = useState(false);
  const [library, setLibrary] = useState<Array<{ label: string; use_count: number }>>([]);
  const [customObj, setCustomObj] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const today = localDay();
    const saved = localStorage.getItem('dad-strength-mind-state');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === localDay()) {
        const { o, c } = cleanObjectives(data.objectives, data.completedObjectives);
        setObjectives(o);
        setCompletedObjectives(c);
        setLockedIn(data.lockedIn || false);
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
            const ms = data.mind_state as { objectives?: string[]; completedObjectives?: boolean[]; lockedIn?: boolean };
            const { o, c } = cleanObjectives(ms.objectives, ms.completedObjectives);
            setObjectives(o);
            setCompletedObjectives(c);
            setLockedIn(ms.lockedIn || false);
          }
        });
      // Personal chip library — most-used first.
      supabase
        .from('user_objective_presets')
        .select('label, use_count')
        .eq('user_id', user.id)
        .order('use_count', { ascending: false })
        .then(({ data }: { data: Array<{ label: string; use_count: number }> | null }) => {
          if (data) setLibrary(data);
        });
    });
  }, [supabase]);

  const saveToLocal = (overrides = {}) => {
    const state = {
      date: localDay(),
      objectives,
      completedObjectives,
      lockedIn,
      ...overrides
    };
    localStorage.setItem('dad-strength-mind-state', JSON.stringify(state));
    const today = localDay();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null }; error: Error | null }) => {
      if (!user) return;
      supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: today, mind_state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      ).then(() => {});
    });
  };

  const toggleObjective = (index: number) => {
    const next = [...completedObjectives];
    next[index] = !next[index];
    setCompletedObjectives(next);
    saveToLocal({ completedObjectives: next });
  };

  // ── Chip picker handlers ────────────────────────────────────────────────────
  const selectChip = (label: string) => {
    if (objectives.includes(label)) {
      const idx = objectives.indexOf(label);
      const newObjs = objectives.filter((_, i) => i !== idx);
      const newComps = completedObjectives.filter((_, i) => i !== idx);
      setObjectives(newObjs); setCompletedObjectives(newComps);
      saveToLocal({ objectives: newObjs, completedObjectives: newComps });
      return;
    }
    if (objectives.length >= MAX_OBJECTIVES) return;
    const newObjs = [...objectives, label];
    const newComps = [...completedObjectives, false];
    setObjectives(newObjs); setCompletedObjectives(newComps);
    saveToLocal({ objectives: newObjs, completedObjectives: newComps });
  };

  const addCustom = () => {
    const label = customObj.trim();
    if (!label) return;
    setCustomObj('');
    if (!objectives.includes(label) && objectives.length < MAX_OBJECTIVES) selectChip(label);
    // Custom chips join the permanent library immediately.
    if (!library.some(l => l.label === label)) {
      setLibrary(prev => [...prev, { label, use_count: 0 }]);
      supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null }; error: Error | null }) => {
        if (!user) return;
        supabase.from('user_objective_presets')
          .upsert({ user_id: user.id, label, use_count: 0 }, { onConflict: 'user_id,label' })
          .then(() => {});
      });
    }
  };

  // Lock in: every selected label joins the library with use_count bumped, so
  // your real objectives float to the front of the picker over time.
  const lockIn = () => {
    if (objectives.length === 0) return;
    setLockedIn(true);
    saveToLocal({ lockedIn: true });
    const bumped = objectives.map(label => ({
      label,
      use_count: (library.find(l => l.label === label)?.use_count ?? 0) + 1,
    }));
    setLibrary(prev => {
      const next = [...prev];
      for (const b of bumped) {
        const i = next.findIndex(l => l.label === b.label);
        if (i >= 0) next[i] = b; else next.push(b);
      }
      return next.sort((a, b) => b.use_count - a.use_count);
    });
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null }; error: Error | null }) => {
      if (!user) return;
      supabase.from('user_objective_presets')
        .upsert(bumped.map(b => ({ user_id: user.id, ...b })), { onConflict: 'user_id,label' })
        .then(() => {});
    });
  };

  if (!mounted) return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader />
      <main className="max-w-md mx-auto px-6 pt-4 space-y-6">
        <div className="mb-6 livery-slash pl-4">
          <p className="telemetry mb-1">SYS // NEURAL.LINK</p>
          <h1 className="font-display text-4xl tracking-[0.08em] uppercase">Neural</h1>
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="glass-card rounded-xl p-6 animate-pulse space-y-3">
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
        <div className="mb-6 livery-slash pl-4">
          <p className="telemetry mb-1">SYS // NEURAL.LINK</p>
          <h1 className="font-display text-4xl tracking-[0.08em] uppercase">Neural</h1>
        </div>
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >

        {/* Objectives */}
        <motion.div variants={fadeUp} className="glass-card relative rounded-xl p-6 pt-8">
          <span className="panel-id">MND-01 // OBJECTIVES</span>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand" />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wide">Daily Objectives</h3>
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

            {/* Selected objectives — numbered; checkboxes once locked */}
            <div className="space-y-3">
            {objectives.length === 0 && !lockedIn && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-brand/30 pl-3">
                Tap chips below to build today&apos;s list — up to {MAX_OBJECTIVES}.
              </p>
            )}
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="readout-num text-xs text-muted-foreground w-5 shrink-0">
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
                      {obj}
                    </span>
                  </button>
                ) : (
                  <span className="flex-1 text-sm text-foreground py-1">{obj}</span>
                )}
                {!lockedIn && (
                  <button
                    onClick={() => selectChip(obj)}
                    className="text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!lockedIn && (
            <div className="mt-5 space-y-4">
              {/* Your library — most-used chips first */}
              {library.length > 0 && (
                <div>
                  <p className="telemetry-dim mb-2">YOUR LIBRARY</p>
                  <div className="flex flex-wrap gap-1.5">
                    {library.map(l => {
                      const on = objectives.includes(l.label);
                      return (
                        <button key={l.label} onClick={() => selectChip(l.label)}
                          className={`panel-cut-sm border px-2.5 py-1.5 text-xs transition-colors ${
                            on ? 'border-brand text-brand bg-brand/10' : 'border-border text-foreground/80 hover:border-brand/40 hover:text-foreground'
                          }`}>
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seed chips, broad groups — hidden once a label lives in your library */}
              {SEED_GROUPS.map(g => {
                const items = g.items.filter(s => !library.some(l => l.label === s));
                if (!items.length) return null;
                return (
                  <div key={g.label}>
                    <p className="telemetry-dim mb-2">{g.label.toUpperCase()}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map(s => {
                        const on = objectives.includes(s);
                        return (
                          <button key={s} onClick={() => selectChip(s)}
                            className={`panel-cut-sm border px-2.5 py-1.5 text-xs transition-colors ${
                              on ? 'border-brand text-brand bg-brand/10' : 'border-border/70 text-muted-foreground hover:border-brand/40 hover:text-foreground'
                            }`}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Custom fallback — writes once, becomes a chip forever */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customObj}
                  onChange={e => setCustomObj(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()}
                  placeholder="Add your own (saves as a chip)..."
                  className="flex-1 bg-transparent border-b border-border focus:border-foreground text-sm text-foreground py-1.5 transition-colors outline-none placeholder:text-muted-foreground"
                />
                <button onClick={addCustom} disabled={!customObj.trim()}
                  className="p-1.5 border border-border/70 text-muted-foreground hover:text-brand hover:border-brand/50 disabled:opacity-40 transition-colors panel-cut-sm">
                  <Plus size={13} />
                </button>
              </div>

              <button
                onClick={lockIn}
                disabled={objectives.length === 0}
                className="panel-cut-sm mecha-glow w-full bg-brand text-white py-3 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Lock In Objectives
              </button>
            </div>
          )}
        </motion.div>

        {/* Currently Learning */}
        <motion.div variants={fadeUp}>
          <LearningTracker />
        </motion.div>

        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
