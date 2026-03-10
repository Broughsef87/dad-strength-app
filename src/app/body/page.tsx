'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Activity, Beef, ArrowLeft, Trophy } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import FuelStation from '../../components/FuelStation';
import WorkoutLogger from '../../components/WorkoutLogger';
import Leaderboard from '../../components/Leaderboard';

export default function BodyPage() {
  const supabase = createClient();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Dumbbell className="w-8 h-8 text-indigo-500" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Body</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">
        {/* ACTIVE SESSION */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <h2 className="text-lg font-black mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
              <Activity className="w-6 h-6 text-indigo-500" />
              Active Session
           </h2>
           <WorkoutLogger />
        </div>

        {/* FUEL STATION (FULL VIEW) */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <FuelStation />
        </div>

        {/* RECENT FEED */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <Leaderboard />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
