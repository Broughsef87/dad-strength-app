'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Star, Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useUser } from '../contexts/UserContext';

interface PulseData {
  marriage_vibe: number;
  kid_score: number;
  moments: string[];
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getPulseScore(data: PulseData): number | null {
  const { marriage_vibe, kid_score } = data;
  if (!marriage_vibe && !kid_score) return null;
  if (!marriage_vibe) return kid_score;
  if (!kid_score) return marriage_vibe;
  return (marriage_vibe + kid_score) / 2;
}

export default function FamilyPulse() {
  const [supabase] = useState(() => createClient());
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [current, setCurrent] = useState<PulseData>({ marriage_vibe: 0, kid_score: 0, moments: [] });
  const [lastWeekScore, setLastWeekScore] = useState<number | null>(null);
  const [momentInput, setMomentInput] = useState('');
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thisMonday = getMondayOfWeek(new Date());
  const lastMonday = getMondayOfWeek(new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000));

  // Load this week + last week from Supabase
  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      // Current week
      const { data: cur } = await (supabase as any)
        .from('family_pulse')
        .select('marriage_vibe, kid_score, moments')
        .eq('user_id', userId)
        .eq('week_start', toISODate(thisMonday))
        .single();

      if (cur) {
        setCurrent({
          marriage_vibe: cur.marriage_vibe ?? 0,
          kid_score: cur.kid_score ?? 0,
          moments: cur.moments ?? [],
        });
      }

      // Last week
      const { data: last } = await (supabase as any)
        .from('family_pulse')
        .select('marriage_vibe, kid_score')
        .eq('user_id', userId)
        .eq('week_start', toISODate(lastMonday))
        .single();

      if (last) {
        setLastWeekScore(getPulseScore({ marriage_vibe: last.marriage_vibe ?? 0, kid_score: last.kid_score ?? 0, moments: [] }));
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user]);

  // Debounced save
  const scheduleSave = useCallback((data: PulseData) => {
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await (supabase as any)
        .from('family_pulse')
        .upsert({
          user_id: userId,
          week_start: toISODate(thisMonday),
          marriage_vibe: data.marriage_vibe || null,
          kid_score: data.kid_score || null,
          moments: data.moments,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week_start' });
      setSaving(false);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setMarriage = (val: number) => {
    const next = { ...current, marriage_vibe: val };
    setCurrent(next);
    scheduleSave(next);
  };

  const setKidScore = (val: number) => {
    const next = { ...current, kid_score: val };
    setCurrent(next);
    scheduleSave(next);
  };

  const addMoment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!momentInput.trim() || current.moments.length >= 5) return;
    const next = { ...current, moments: [...current.moments, momentInput.trim()] };
    setCurrent(next);
    setMomentInput('');
    scheduleSave(next);
  };

  const removeMoment = (idx: number) => {
    const next = { ...current, moments: current.moments.filter((_, i) => i !== idx) };
    setCurrent(next);
    scheduleSave(next);
  };

  const pulseScore = getPulseScore(current);
  const hasAnyData = current.marriage_vibe > 0 || current.kid_score > 0;

  // Trend
  let TrendIcon = Minus;
  let trendColor = 'text-muted-foreground';
  if (pulseScore !== null && lastWeekScore !== null) {
    if (pulseScore > lastWeekScore) { TrendIcon = TrendingUp; trendColor = 'text-emerald-400'; }
    else if (pulseScore < lastWeekScore) { TrendIcon = TrendingDown; trendColor = 'text-rose-400'; }
  }

  const weekLabel = (() => {
    const end = new Date(thisMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(thisMonday)} – ${fmt(end)}`;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <h3 className="font-black text-foreground uppercase tracking-tighter italic text-lg">Family Pulse</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 animate-pulse">Saving…</span>
          )}
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{weekLabel}</span>
        </div>
      </div>

      {/* Pulse Score */}
      <div className="bg-background/80 rounded-2xl border border-border p-5 flex items-center gap-5">
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pulse Score</p>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-black tracking-tighter text-foreground leading-none">
              {pulseScore !== null ? pulseScore.toFixed(1) : '–'}
            </span>
            <span className="text-gray-600 font-black text-lg mb-1">/ 5</span>
          </div>
          {!hasAnyData && (
            <p className="text-[9px] text-brand font-black uppercase tracking-widest mt-1">Rate below to start</p>
          )}
        </div>

        {/* Trend */}
        <div className="flex flex-col items-center gap-1">
          <TrendIcon size={28} className={trendColor} />
          {lastWeekScore !== null && (
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
              Last: {lastWeekScore.toFixed(1)}
            </span>
          )}
          {lastWeekScore === null && (
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">No prev</span>
          )}
        </div>
      </div>

      {/* Marriage Vibe */}
      <div className="bg-card/40 rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marriage Vibe</p>
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">
            {current.marriage_vibe > 0 ? `${current.marriage_vibe}/5` : 'Not set'}
          </span>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setMarriage(n)}
              className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
            >
              <Heart
                size={22}
                className={`transition-all ${
                  n <= current.marriage_vibe
                    ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                    : 'text-gray-700'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Kid Connection */}
      <div className="bg-card/40 rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Kid Connection</p>
          <span className="text-[9px] font-black text-brand uppercase tracking-widest">
            {current.kid_score > 0 ? `${current.kid_score}/5` : 'Not set'}
          </span>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setKidScore(n)}
              className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
            >
              <Star
                size={22}
                className={`transition-all ${
                  n <= current.kid_score
                    ? 'text-brand fill-brand drop-shadow-[0_0_6px_rgba(232,87,42,0.5)]'
                    : 'text-gray-700'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Intentional Moments */}
      <div className="bg-card/40 rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Intentional Moments</p>
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
            {current.moments.length}/5
          </span>
        </div>

        {current.moments.length === 0 && (
          <p className="text-[10px] text-gray-600 italic">Nothing logged yet. What did you do together?</p>
        )}

        <div className="space-y-2">
          {current.moments.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-background/60 border border-border group animate-in fade-in slide-in-from-left-1">
              <span className="text-[9px] font-black text-brand uppercase tracking-widest w-4 shrink-0">{i + 1}</span>
              <p className="flex-1 text-xs text-gray-300 italic truncate">"{m}"</p>
              <button
                onClick={() => removeMoment(i)}
                className="p-1 text-gray-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {current.moments.length < 5 && (
          <form onSubmit={addMoment} className="relative mt-1">
            <input
              type="text"
              value={momentInput}
              onChange={(e) => setMomentInput(e.target.value)}
              placeholder="What did you do together?"
              className="w-full bg-background border border-border rounded-xl p-3 pr-12 text-xs text-foreground placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand/50"
            />
            <button
              type="submit"
              className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-brand text-foreground hover:bg-brand/90 transition-colors shadow-lg shadow-brand/20"
            >
              <Plus size={16} />
            </button>
          </form>
        )}
      </div>

      {/* Tagline */}
      <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest italic">
        What gets measured gets protected.
      </p>
    </div>
  );
}

