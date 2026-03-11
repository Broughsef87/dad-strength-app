'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, ArrowLeft, Settings, PlayCircle, Plus, ChevronRight, Zap } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import FuelStation from '../../components/FuelStation';
import Leaderboard from '../../components/Leaderboard';

type Workout = {
  id: string;
  name: string;
  description: string;
  exercises: any[];
};

export default function BodyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchWorkouts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data } = await supabase
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false });

      setWorkouts(data || []);
      setLoading(false);
    };
    fetchWorkouts();
  }, [router, supabase]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24">
      <header className="flex items-center justify-between p-6 border-b border-gray-900">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 rounded-xl text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <Dumbbell className="w-7 h-7 text-indigo-500" />
            <h1 className="font-black text-2xl tracking-tighter italic uppercase">Body</h1>
          </div>
        </div>
        <button
          onClick={() => router.push('/edit-program')}
          className="p-2 bg-gray-900 rounded-xl text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all shadow-lg shadow-indigo-500/10"
        >
          <Settings size={20} />
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-8">

        {/* TRAINING PROGRAMS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <Zap size={12} className="text-indigo-500" /> Training Protocols
            </h2>
            <button
              onClick={() => router.push('/library')}
              className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
            >
              Library →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-gray-900 rounded-3xl p-5 border border-gray-800 animate-pulse h-24" />
              ))}
            </div>
          ) : workouts.length === 0 ? (
            <div className="bg-gray-900/50 rounded-3xl border border-dashed border-gray-800 p-8 text-center">
              <Dumbbell size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">No protocols yet</p>
              <p className="text-xs text-gray-600 mt-1 mb-4">Build your first training program.</p>
              <button
                onClick={() => router.push('/edit-program')}
                className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                + Build Program
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((workout) => (
                <div
                  key={workout.id}
                  className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all shadow-xl group"
                >
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <Dumbbell size={20} className="text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-base tracking-tight truncate">{workout.name}</h3>
                        <p className="text-xs text-gray-500 font-medium truncate">{workout.description}</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
                          {workout.exercises?.length || 0} exercises
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/workout/${workout.id}`)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20 uppercase tracking-widest ml-3 flex-shrink-0"
                    >
                      <PlayCircle size={14} />
                      Start
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => router.push('/edit-program')}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-gray-800 text-gray-600 hover:border-gray-700 hover:text-gray-400 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Plus size={14} /> Add Protocol
              </button>
            </div>
          )}
        </section>

        {/* FUEL STATION */}
        <section className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
          <FuelStation />
        </section>

        {/* LEADERBOARD */}
        <section className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
          <Leaderboard />
        </section>

      </main>

      <BottomNav />
    </div>
  );
}
