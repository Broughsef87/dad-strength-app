'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

export default function Schedule() {
  const router = useRouter()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date().getDay()

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans pb-24">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">
          <ChevronLeft />
        </button>
        <h1 className="font-bold text-lg">This Week</h1>
        <button className="text-gray-400 hover:text-white">
          <Calendar size={20} />
        </button>
      </header>

      {/* DAYS ROW */}
      <div className="flex justify-between items-center bg-gray-900 rounded-xl p-2 mb-8 overflow-x-auto gap-2">
        {days.map((day, i) => (
          <div 
            key={day} 
            className={`flex flex-col items-center justify-center p-2 rounded-lg min-w-[40px] ${
              i === today 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'text-gray-500 hover:bg-gray-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider">{day}</span>
            <span className="text-lg font-bold">{new Date().getDate() - (today - i)}</span>
          </div>
        ))}
      </div>

      {/* WORKOUT LIST */}
      <div className="space-y-4">
        <h3 className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 pl-2">Scheduled</h3>
        
        {/* Monday */}
        <div className="flex gap-4 items-center opacity-50">
           <div className="w-12 text-center text-gray-500 text-sm font-mono">Mon</div>
           <div className="flex-1 bg-gray-900 border border-gray-800 p-3 rounded-xl flex justify-between items-center">
             <div>
               <p className="font-bold text-gray-400 line-through">Upper Body Power</p>
               <span className="text-xs text-green-500 flex items-center gap-1"><Check size={12} /> Completed</span>
             </div>
           </div>
        </div>

        {/* Wednesday (Today) */}
        <div className="flex gap-4 items-center">
           <div className="w-12 text-center text-indigo-400 font-bold text-sm font-mono">Wed</div>
           <div className="flex-1 bg-gradient-to-br from-indigo-900/50 to-gray-900 border border-indigo-500/30 p-4 rounded-xl flex justify-between items-center shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500">
             <div>
               <p className="font-bold text-white">Lower Body Hypertrophy</p>
               <span className="text-xs text-indigo-300">Today • 45m</span>
             </div>
             <button onClick={() => router.push('/workout/1')} className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-full hover:bg-gray-200">
               Start
             </button>
           </div>
        </div>

        {/* Friday */}
        <div className="flex gap-4 items-center opacity-70">
           <div className="w-12 text-center text-gray-400 text-sm font-mono">Fri</div>
           <div className="flex-1 bg-gray-900 border border-gray-800 p-3 rounded-xl flex justify-between items-center">
             <div>
               <p className="font-bold text-white">Upper Body Pump</p>
               <span className="text-xs text-gray-500">Upcoming</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  )
}
