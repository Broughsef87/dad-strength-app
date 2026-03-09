'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, BookOpen, HeartHandshake, Zap, Target, Flame } from 'lucide-react'

export default function PersonalGrowth() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24">
      <header className="flex items-center gap-4 border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black italic uppercase">Personal Growth</h1>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8">
        
        {/* The "Hero" Metric */}
        <div className="bg-gradient-to-br from-indigo-900 to-gray-900 rounded-3xl p-6 border border-indigo-500/30 shadow-2xl">
           <div className="flex items-center gap-3 mb-4">
              <HeartHandshake className="text-pink-500" size={24} />
              <h2 className="font-black text-lg uppercase tracking-widest text-indigo-100">Family OS</h2>
           </div>
           
           <div className="space-y-4">
              <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
                 <div className="flex justify-between items-end mb-2">
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Operation</p>
                       <p className="font-bold">Be a Present Father</p>
                    </div>
                    <span className="text-xs font-mono text-indigo-400">90%</span>
                 </div>
                 <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500 w-[90%]"></div>
                 </div>
                 <p className="text-[10px] text-gray-500 mt-2 font-medium italic">"Put the phone down when you walk in the door."</p>
              </div>

              <div className="flex items-center justify-between bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Wife Date Night</p>
                    <p className="font-bold text-sm mt-0.5">Scheduled for Friday</p>
                 </div>
                 <div className="bg-pink-500/10 text-pink-400 px-3 py-1 rounded-lg border border-pink-500/20 text-xs font-bold">
                    ON TRACK
                 </div>
              </div>
           </div>
        </div>

        {/* Stoic & Mindset */}
        <div className="space-y-4">
           <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2 flex items-center gap-2">
              <BookOpen size={14} className="text-indigo-400" />
              The Mind
           </h3>

           <div className="bg-gray-900 rounded-3xl p-5 border border-gray-800 shadow-xl group hover:border-indigo-500/30 transition-all cursor-pointer">
              <div className="flex gap-4 items-start">
                 <div className="h-16 w-12 bg-gray-800 rounded flex items-center justify-center shrink-0 border border-gray-700">
                    <BookOpen size={20} className="text-gray-500" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Current Book</p>
                    <h4 className="font-bold text-base leading-tight">Meditations</h4>
                    <p className="text-xs text-gray-500 mt-1">Marcus Aurelius</p>
                    <div className="mt-3 flex gap-2">
                       <span className="text-[10px] font-bold bg-gray-800 px-2 py-0.5 rounded text-gray-400 border border-gray-700">Ch. 4 / 12</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-gray-900 rounded-3xl p-5 border border-gray-800 shadow-xl flex items-center justify-between">
              <div>
                 <h4 className="font-bold text-sm">Morning Stoic Reflection</h4>
                 <p className="text-xs text-gray-500 mt-1">Written today at 06:15</p>
              </div>
              <div className="flex items-center gap-1 text-orange-500">
                 <Flame size={16} />
                 <span className="font-black text-sm">12</span>
              </div>
           </div>
        </div>

        {/* Habits */}
        <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl space-y-4">
           <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-sm uppercase tracking-widest text-white">Daily Discipline</h3>
              <Target size={18} className="text-green-500" />
           </div>
           
           <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-300">No Screens After 9PM</span>
                 <div className="w-5 h-5 rounded border-2 border-green-500 bg-green-500/20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div>
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-300">Read 10 Pages</span>
                 <div className="w-5 h-5 rounded border-2 border-green-500 bg-green-500/20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div>
                 </div>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-gray-300">Cold Shower (2 Min)</span>
                 <div className="w-5 h-5 rounded border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
                 </div>
              </div>
           </div>
        </div>

      </main>
    </div>
  )
}