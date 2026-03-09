'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, Battery, Clock, Dumbbell, ShieldAlert, HeartPulse, Brain } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function Recovery() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-2xl font-black italic uppercase">Recovery</h1>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24 space-y-8">
        
        {/* Readiness Score */}
        <div className="bg-gradient-to-br from-indigo-900/80 to-gray-900 rounded-3xl p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden text-center">
           <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
           <Battery size={32} className="text-green-400 mx-auto mb-4 animate-pulse" />
           <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Daily Readiness</p>
           <h2 className="text-5xl font-black tracking-tighter">85<span className="text-xl text-indigo-400">/100</span></h2>
           <p className="text-xs text-indigo-200 mt-4 font-medium px-4">Sleep was solid. CNS is fresh. You are cleared to train heavy.</p>
        </div>

        {/* Quick Logs */}
        <div className="grid grid-cols-2 gap-4">
           {/* Sleep Log */}
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group hover:border-gray-700 transition-colors cursor-pointer">
             <Moon className="text-blue-400 mb-3" size={24} />
             <p className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Sleep Log</p>
             <p className="font-bold text-lg">7h 15m</p>
             <p className="text-[10px] text-gray-500 mt-1">Logged today</p>
           </div>
           
           {/* Stress/HRV */}
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 group hover:border-gray-700 transition-colors cursor-pointer">
             <HeartPulse className="text-red-400 mb-3" size={24} />
             <p className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Stress (HRV)</p>
             <p className="font-bold text-lg">Good</p>
             <p className="text-[10px] text-gray-500 mt-1">Slightly elevated</p>
           </div>
        </div>

        {/* Mobility routines */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2 flex items-center gap-2">
                 <Dumbbell size={14} className="text-indigo-400" />
                 Dad Maintenance
              </h3>
           </div>
           
           <div className="bg-gray-900 rounded-3xl border border-gray-800 p-5 group hover:border-indigo-500/50 transition-all cursor-pointer shadow-xl flex items-center justify-between">
              <div>
                 <h4 className="font-black text-lg mb-1">Morning Desk-Worker Fix</h4>
                 <p className="text-xs text-gray-500 font-medium mb-3">Undo the damage of the home office chair.</p>
                 <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">10 Mins</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800 px-2 py-0.5 rounded">Hips & Back</span>
                 </div>
              </div>
           </div>

           <div className="bg-gray-900 rounded-3xl border border-gray-800 p-5 group hover:border-indigo-500/50 transition-all cursor-pointer shadow-xl flex items-center justify-between">
              <div>
                 <h4 className="font-black text-lg mb-1">Pre-Bed Downregulation</h4>
                 <p className="text-xs text-gray-500 font-medium mb-3">Breathing and static stretches for sleep.</p>
                 <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">15 Mins</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800 px-2 py-0.5 rounded">CNS Reset</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Mental Health/Mindset Check-in */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex items-start gap-4">
           <div className="p-3 bg-gray-800 rounded-xl text-gray-400"><Brain size={20} /></div>
           <div>
              <p className="font-bold text-sm mb-1">Mindset Journal</p>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">Clear the head trash. Take 2 minutes to write down what's on your mind before the day starts.</p>
           </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}