'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Briefcase, DollarSign, TrendingUp, Users, Youtube, MonitorSmartphone } from 'lucide-react'

export default function BusinessGoals() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24">
      <header className="flex items-center gap-4 border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black italic uppercase">The Empire</h1>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8">
        
        {/* Operation Retire Wife */}
        <div className="relative overflow-hidden bg-gradient-to-br from-green-900 to-gray-900 rounded-3xl p-8 border border-green-500/30 shadow-2xl">
           <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
           
           <div className="flex items-center gap-2 mb-2">
              <DollarSign className="text-green-400" size={24} />
              <h2 className="font-black text-xs uppercase tracking-widest text-green-100">Primary Objective</h2>
           </div>
           
           <h3 className="text-2xl font-black tracking-tighter mb-1">Operation: Freedom</h3>
           <p className="text-sm font-medium text-green-200/70 mb-6 max-w-[80%]">$1M / Year Run Rate. Wife quits job.</p>

           <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-end mb-1">
                 <p className="font-bold text-xl">$125K</p>
                 <span className="text-[10px] font-black tracking-widest text-green-400 uppercase">12.5%</span>
              </div>
              <div className="h-3 w-full bg-gray-950/50 rounded-full overflow-hidden border border-green-900">
                <div className="h-full bg-green-500 w-[12.5%] relative overflow-hidden">
                   <div className="absolute inset-0 bg-white/20 skew-x-12 -ml-4 w-8 animate-[pulse_2s_infinite]"></div>
                </div>
              </div>
           </div>
        </div>

        {/* Dashboards */}
        <div className="grid grid-cols-2 gap-4">
           {/* YouTube */}
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group hover:border-gray-700 transition-colors">
             <div className="flex justify-between items-start mb-4">
                <Youtube className="text-red-500" size={20} />
                <TrendingUp size={14} className="text-green-500" />
             </div>
             <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">YouTube Subs</p>
             <p className="font-bold text-xl">12,450</p>
             <p className="text-[10px] text-gray-500 mt-1">+450 this month</p>
           </div>
           
           {/* SaaS App */}
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group hover:border-gray-700 transition-colors">
             <div className="flex justify-between items-start mb-4">
                <MonitorSmartphone className="text-indigo-400" size={20} />
                <TrendingUp size={14} className="text-green-500" />
             </div>
             <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">App MRR</p>
             <p className="font-bold text-xl">$2,100</p>
             <p className="text-[10px] text-gray-500 mt-1">+15% vs last month</p>
           </div>
        </div>

        {/* Active Projects / Funnels */}
        <div className="space-y-4">
           <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2 flex items-center gap-2">
              <Briefcase size={14} className="text-indigo-400" />
              Active Sprints
           </h3>
           
           <div className="bg-gray-900 rounded-3xl border border-gray-800 p-5 shadow-xl space-y-4">
              
              <div className="flex justify-between items-center group cursor-pointer hover:bg-gray-800/50 p-2 rounded-xl transition-all -m-2">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                       <MonitorSmartphone size={18} className="text-indigo-400" />
                    </div>
                    <div>
                       <h4 className="font-bold text-sm">Dad Strength App MVP</h4>
                       <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">In Development</p>
                    </div>
                 </div>
                 <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">V1.0</span>
              </div>

              <div className="w-full h-[1px] bg-gray-800"></div>

              <div className="flex justify-between items-center group cursor-pointer hover:bg-gray-800/50 p-2 rounded-xl transition-all -m-2">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                       <Youtube size={18} className="text-red-400" />
                    </div>
                    <div>
                       <h4 className="font-bold text-sm">The 5-Month Protocol</h4>
                       <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Video Scripting</p>
                    </div>
                 </div>
                 <span className="text-xs font-mono text-gray-500 border border-gray-700 px-2 py-1 rounded">Draft</span>
              </div>

              <div className="w-full h-[1px] bg-gray-800"></div>

              <div className="flex justify-between items-center group cursor-pointer hover:bg-gray-800/50 p-2 rounded-xl transition-all -m-2">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                       <Users size={18} className="text-blue-400" />
                    </div>
                    <div>
                       <h4 className="font-bold text-sm">Skool Community</h4>
                       <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Community Build</p>
                    </div>
                 </div>
                 <span className="text-xs font-mono text-gray-500 border border-gray-700 px-2 py-1 rounded">124 Members</span>
              </div>

           </div>
        </div>

      </main>
    </div>
  )
}