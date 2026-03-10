'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';
import { Dumbbell, Activity, ShieldCheck } from 'lucide-react';
import HandoffChecklist from '@/components/HandoffChecklist';
import WorkoutLogger from '@/components/WorkoutLogger';
import Leaderboard from '@/components/Leaderboard';
import FuelStation from '@/components/FuelStation';
import RelationshipLedger from '@/components/RelationshipLedger';
import DeepWorkTimer from '@/components/DeepWorkTimer';
import MorningAnchor from '@/components/MorningAnchor';
import { useEffect, useState } from 'react';

export default function Home() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-24 text-white">
        <div className="z-10 w-full max-w-md items-center justify-between font-mono text-sm lg:flex-col gap-8">
          <h1 className="text-4xl font-bold mb-4 text-center">Dad Strength</h1>
          <p className="text-gray-400 text-center mb-8">
            Simple, effective training for busy fathers.
          </p>
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              theme="dark"
              providers={['google']}
              redirectTo={typeof window !== 'undefined' ? `${window.location.origin}` : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-slate-50 text-slate-900">
      <header className="w-full max-w-7xl flex items-center justify-between font-mono text-sm mb-12">
        <div className="font-black text-2xl flex items-center gap-2 tracking-tighter italic">
          <ShieldCheck className="w-8 h-8 text-blue-600 fill-blue-50" />
          FORGE OS <span className="text-slate-400 font-light">/ DAD STRENGTH</span>
        </div>
        <nav className="hidden md:flex gap-6 font-bold uppercase tracking-widest text-[10px]">
          <Link href="#" className="text-blue-600 border-b-2 border-blue-600 pb-1">Dashboard</Link>
          <Link href="#" className="text-slate-400 hover:text-slate-600 pb-1">Protocol</Link>
          <Link href="#" className="text-slate-400 hover:text-slate-600 pb-1">Equipment</Link>
          <Link href="#" className="text-slate-400 hover:text-slate-600 pb-1">Settings</Link>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="text-red-400 hover:text-red-600 pb-1"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stats & Social */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <FuelStation />
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <RelationshipLedger />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <Leaderboard />
          </div>
        </div>

        {/* Center Column: Active Session & Planning */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-blue-600 border-slate-100">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
              <Activity className="w-6 h-6 text-blue-600" />
              Active Session
            </h2>
            <WorkoutLogger />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <DeepWorkTimer />
          </div>
        </div>

        {/* Right Column: Routine & Handoff */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <MorningAnchor />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-slate-400 flex items-center gap-2">
              Morning Handoff
            </h2>
            <HandoffChecklist />
          </div>

          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl text-white">
            <h3 className="font-bold mb-2">Protocol Day 12</h3>
            <p className="text-xs text-slate-400 mb-4 italic">"The barrier to entry is high, but the reward is permanent."</p>
            <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
               <div className="bg-blue-500 h-full w-[12%]"></div>
            </div>
          </div>
        </div>

      </div>
      
      <footer className="mt-20 py-8 text-center">
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
          Built by Forge OS / 2026
        </div>
      </footer>
    </main>
  );
}
