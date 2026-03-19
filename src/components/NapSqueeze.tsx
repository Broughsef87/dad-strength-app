'use client';

import { Lock, Zap, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function NapSqueeze() {
  return (
    <div className="bg-card border-2 border-indigo-500/30 rounded-[32px] overflow-hidden relative group">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors" />
      
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Unlock The OS</span>
          </div>
          <div className="px-3 py-1 bg-indigo-500 text-[10px] font-black uppercase tracking-widest text-foreground rounded-full">
            Limited Time
          </div>
        </div>

        <h2 className="text-3xl font-black text-foreground tracking-tight mb-2 italic uppercase">
          Founder's Pass
        </h2>
        <p className="text-muted-foreground text-sm font-bold mb-8 leading-relaxed">
          Get the "Nap-Squeeze" productivity engine and all future premium protocols. One payment. Lifetime access.
        </p>

        <div className="space-y-4 mb-10">
          {[
            'Custom "Nap-Squeeze" AI Protocols',
            'Advanced Body Composition Tracking',
            'Founder-Only Leaderboard Badge',
            'Direct Access to Future Modules'
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline gap-2 mb-8">
          <span className="text-4xl font-black text-foreground leading-none">$47</span>
          <span className="text-sm font-bold text-muted-foreground uppercase line-through">$149</span>
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-auto">One-Time Fee</span>
        </div>

        <button className="w-full bg-white hover:bg-indigo-50 text-black font-black py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 group/btn">
          UPGRADE TO PRO
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="mt-6 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Secure Stripe Checkout</span>
        </div>
      </div>
    </div>
  );
}

