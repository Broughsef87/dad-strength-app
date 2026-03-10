'use client';

import { createClient } from '../../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Anchor, Heart, ArrowLeft, Sun, CheckCircle2 } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import RelationshipLedger from '../../components/RelationshipLedger';

export default function SpiritPage() {
  const supabase = createClient();
  const router = useRouter();
  const [prayerDone, setPrayerDone] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 p-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/dashboard')} className="p-2 bg-gray-900 rounded-xl text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-indigo-500" />
          <h1 className="font-black text-2xl tracking-tighter italic uppercase">Spirit</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-8">
        {/* RELATIONSHIP LEDGER (FULL VIEW) */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <RelationshipLedger />
        </div>

        {/* PRAYER / MEDITATION (DEEP VIEW) */}
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <Anchor size={18} className="text-indigo-500" />
              <h3 className="font-bold text-lg uppercase tracking-tighter italic">Spiritual Reset</h3>
           </div>
           
           <button 
             onClick={() => setPrayerDone(!prayerDone)}
             className={`w-full flex flex-col items-center justify-center p-12 rounded-3xl border-2 transition-all gap-4 ${
               prayerDone 
                 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-2xl shadow-indigo-500/10' 
                 : 'bg-gray-950/50 border-gray-800 text-gray-700 hover:border-gray-700 hover:text-gray-500'
             }`}
           >
              {prayerDone ? <CheckCircle2 size={48} className="animate-in zoom-in" /> : <Sun size={48} />}
              <span className="text-sm font-black uppercase tracking-[0.3em]">
                {prayerDone ? 'Session Complete' : '5-10 MIN PRAYER / MED'}
              </span>
           </button>
           <p className="mt-6 text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center leading-relaxed italic px-4">
              "Quiet the noise to hear the signal. The legacy is built in the silence."
           </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
