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
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('dad-strength-spirit-state');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === new Date().toLocaleDateString()) {
        setPrayerDone(data.prayerDone || false);
      }
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('daily_checkins')
        .select('spirit_state')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()
        .then(({ data }) => {
          if (data?.spirit_state) {
            const ss = data.spirit_state as { prayerDone?: boolean };
            setPrayerDone(ss.prayerDone || false);
          }
        });
    });
  }, [supabase]);

  const saveSpiritState = (done: boolean) => {
    const state = { date: new Date().toLocaleDateString(), prayerDone: done };
    localStorage.setItem('dad-strength-spirit-state', JSON.stringify(state));
    const today = new Date().toISOString().split('T')[0];
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('daily_checkins').upsert(
        { user_id: user.id, date: today, spirit_state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      ).then(() => {});
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(prev => prev - 1), 1000);
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

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-brand" />
          <h1 className="font-light text-2xl tracking-tight">Spirit</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">

        <div className="bg-card p-6 rounded-xl border border-border">
          <FamilyPulse />
        </div>

        <div className="bg-card p-6 rounded-xl border border-border">
          <Brotherhood />
        </div>

        {/* Spiritual Reset */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-6">
            <Anchor size={16} className="text-brand" />
            <h3 className="font-medium text-sm">Spiritual Reset</h3>
          </div>

          <div className="space-y-5">
            {timerSeconds > 0 && (
              <div className="bg-background p-5 rounded-xl border border-border text-center">
                <div className="text-4xl font-light text-foreground mb-4 font-mono tabular-nums tracking-tight">
                  {formatTime(timerSeconds)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTimerActive(!timerActive)}
                    className="flex-1 py-2.5 bg-foreground text-background rounded-lg text-xs font-medium uppercase tracking-[0.1em]"
                  >
                    {timerActive ? <Pause size={14} className="mx-auto" /> : <Play size={14} className="mx-auto" />}
                  </button>
                  <button
                    onClick={() => { setTimerSeconds(0); setTimerActive(false); }}
                    className="px-4 py-2.5 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startTimer(5)}
                className="flex flex-col items-center gap-2.5 p-4 bg-background border border-border rounded-xl hover:border-foreground/30 transition-colors group"
              >
                <Timer size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground group-hover:text-foreground transition-colors">5 Min Prayer</span>
              </button>
              <button
                onClick={() => startTimer(10)}
                className="flex flex-col items-center gap-2.5 p-4 bg-background border border-border rounded-xl hover:border-foreground/30 transition-colors group"
              >
                <Timer size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground group-hover:text-foreground transition-colors">10 Min Meditation</span>
              </button>
            </div>

            <button
              onClick={() => { const next = !prayerDone; setPrayerDone(next); saveSpiritState(next); }}
              className={`w-full flex flex-col items-center justify-center p-8 rounded-xl border-2 transition-all gap-3 ${
                prayerDone
                  ? 'bg-brand/5 border-brand/30 text-brand'
                  : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              }`}
            >
              {prayerDone ? <CheckCircle2 size={28} /> : <Sun size={28} />}
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]">
                {prayerDone ? 'Daily Reset Logged' : 'Log Daily Reset'}
              </span>
            </button>
          </div>

          <p className="mt-5 text-[11px] text-muted-foreground text-center leading-relaxed italic px-4">
            "Quiet the noise to hear the signal."
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
