'use client';

import { useState } from 'react';
import { ArrowRight, Share2, Sparkles, Check } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

interface WorkoutSummaryOverlayProps {
  workoutName: string;
  totalVolume: number;
  duration: string;
  workoutId?: string;
  userId?: string;
  newPRs?: Array<{exercise: string, weight: number, reps: number}>;
  onReturn: () => void;
}

export default function WorkoutSummaryOverlay({
  totalVolume,
  duration,
  workoutId,
  userId,
  newPRs,
  onReturn
}: WorkoutSummaryOverlayProps) {
  const supabase = createClient();
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    if (!note.trim() || !userId || !workoutId) return;
    setSavingNote(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('workout_notes')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
      const notes = { ...(existing?.workout_notes || {}), [workoutId]: note };
      await supabase
        .from('daily_checkins')
        .upsert(
          { user_id: userId, date: today, workout_notes: notes, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date' }
        );
      setNoteSaved(true);
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/98 animate-in fade-in duration-500 overflow-y-auto">
      <div className="w-full max-w-sm relative my-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 ease-out">
        <div className="ds-card p-8 text-center relative overflow-hidden">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 w-full h-2 bg-brand shadow-[0_2px_10px_rgba(0,0,0,0.2)]" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-brand/10 rounded-full border border-brand/20">
              <Sparkles className="w-4 h-4 text-brand" />
              <span className="text-xs font-black uppercase tracking-[0.4em] text-brand">Mission Accomplished</span>
            </div>

            <h2 className="text-4xl font-black text-foreground mb-2 italic tracking-tighter">ELITE PERFORMANCE</h2>
            <p className="text-brand text-xs font-black uppercase tracking-widest mb-10">Session Data Logged</p>

            <div className="mb-10 space-y-4">
              <div className="glass-card rounded-3xl p-6 transform hover:scale-[1.02] transition-transform">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Total Volume</p>
                <p className="text-4xl font-black stat-num text-foreground">{totalVolume.toLocaleString()}<span className="text-sm text-brand ml-1 italic">LBS</span></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-3xl p-4">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-xl font-black stat-num text-foreground">{duration}</p>
                </div>
                <div className="glass-card rounded-3xl p-4">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Rank</p>
                  <p className="text-xl font-black text-brand italic">OVR-99</p>
                </div>
              </div>
            </div>

            {newPRs && newPRs.length > 0 && (
              <div className="mb-6 p-5 bg-yellow-400/10 border border-yellow-400/30 rounded-3xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl font-black">🏆</span>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">New Personal Records</p>
                </div>
                <div className="space-y-2">
                  {newPRs.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">{pr.exercise}</p>
                      <p className="text-sm font-black text-yellow-400">{pr.weight} lbs × {pr.reps}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-6 border-t border-border">
              {/* Session Note */}
              <div className="text-left space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How was the session? What will you remember?"
                  rows={3}
                  disabled={noteSaved}
                  className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-brand disabled:opacity-70"
                />
                {noteSaved ? (
                  <div className="flex items-center gap-2 text-sm text-green-500 font-medium">
                    <Check size={14} /> Note saved
                  </div>
                ) : (
                  <button
                    onClick={handleSaveNote}
                    disabled={!note.trim() || savingNote}
                    className="w-full bg-muted border border-border text-foreground font-black text-xs uppercase tracking-widest py-2.5 rounded-xl hover:border-foreground/30 transition-colors disabled:opacity-40"
                  >
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                )}
              </div>

              <button
                onClick={onReturn}
                className="group w-full bg-brand text-foreground font-black py-5 rounded-3xl hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg"
              >
                RETURN TO HQ
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors py-2 text-xs font-black uppercase tracking-widest">
                <Share2 size={14} />
                Export Performance Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
