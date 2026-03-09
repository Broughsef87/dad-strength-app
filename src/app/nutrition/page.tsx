'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Apple, Flame, ChevronRight, Plus, Info } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function Nutrition() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('daily')

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="flex flex-col border-b border-gray-800 bg-gray-900/50 pt-6 pb-2 px-6 backdrop-blur-md sticky top-0 z-10 space-y-4">
        <h1 className="text-2xl font-black italic uppercase">Fuel Station</h1>
        
        {/* Macros Summary Header */}
        <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-900/80 rounded-full p-2 ring-1 ring-gray-800">
          <div className="flex gap-4 px-4">
             <span className="text-white"><Flame size={12} className="inline mr-1 text-orange-500"/> 2400 Kcal</span>
             <span className="text-indigo-400">180g P</span>
             <span className="text-green-400">250g C</span>
             <span className="text-yellow-400">75g F</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 font-black uppercase tracking-widest text-[10px]">
          <button 
            onClick={() => setActiveTab('daily')}
            className={`pb-2 border-b-2 transition-colors ${activeTab === 'daily' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Daily Plan
          </button>
          <button 
            onClick={() => setActiveTab('prep')}
            className={`pb-2 border-b-2 transition-colors ${activeTab === 'prep' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Meal Prep
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24 space-y-6">
        
        {activeTab === 'daily' ? (
          <div className="space-y-4">
            <h2 className="font-black text-xs uppercase tracking-widest text-gray-500 mb-2">Today's Macros</h2>
            
            {/* Macro Progress Bars */}
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 shadow-xl space-y-4">
              {/* Protein */}
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                   <span className="text-indigo-400">Protein</span>
                   <span>120 / 180g</span>
                 </div>
                 <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500 w-[66%] transition-all"></div>
                 </div>
              </div>
              {/* Carbs */}
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                   <span className="text-green-400">Carbs</span>
                   <span>150 / 250g</span>
                 </div>
                 <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-green-500 w-[60%] transition-all"></div>
                 </div>
              </div>
              {/* Fats */}
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                   <span className="text-yellow-400">Fats</span>
                   <span>40 / 75g</span>
                 </div>
                 <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                   <div className="h-full bg-yellow-500 w-[53%] transition-all"></div>
                 </div>
              </div>
            </div>

            {/* Meals */}
            <h2 className="font-black text-xs uppercase tracking-widest text-gray-500 mt-8 mb-2">Meals Log</h2>
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Breakfast: 3 Eggs & Oats</h3>
                  <p className="text-xs text-gray-500 font-medium">450 kcal ? 25g P</p>
                </div>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Lunch: Chicken Rice Bowl</h3>
                  <p className="text-xs text-gray-500 font-medium">650 kcal ? 55g P</p>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-800 rounded-xl text-gray-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all font-bold text-sm uppercase tracking-wider">
                <Plus size={18} /> Add Meal
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-4 items-start">
               <Info size={24} className="text-indigo-400 shrink-0" />
               <p className="text-sm text-indigo-100 font-medium leading-relaxed">
                 Sunday is prep day. Cook your bulk proteins and carbs to survive the chaos of the week.
               </p>
            </div>

            <div className="space-y-4">
               <h3 className="font-black text-xs uppercase tracking-widest text-gray-500 pl-2">Dad Staples</h3>
               <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 group hover:border-gray-700 transition-colors cursor-pointer">
                  <h4 className="font-bold text-lg mb-1">Slow Cooker Salsa Chicken</h4>
                  <p className="text-xs text-gray-500 font-medium mb-4">5 mins prep. 4 hours cook time.</p>
                  <div className="flex gap-2">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800 px-2 py-1 rounded">High Protein</span>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800 px-2 py-1 rounded">Batch Cook</span>
                  </div>
               </div>
               
               <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 group hover:border-gray-700 transition-colors cursor-pointer">
                  <h4 className="font-bold text-lg mb-1">Overnight Protein Oats</h4>
                  <p className="text-xs text-gray-500 font-medium mb-4">Grab & go for the morning rush.</p>
                  <div className="flex gap-2">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800 px-2 py-1 rounded">Quick Prep</span>
                  </div>
               </div>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}