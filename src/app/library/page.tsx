'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Dumbbell, Play } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

const EXERCISES = [
  { name: 'Back Squat', category: 'Legs', muscle: 'Quads/Glutes' },
  { name: 'Deadlift', category: 'Back/Legs', muscle: 'Hams/Back' },
  { name: 'Bench Press', category: 'Chest', muscle: 'Pectorals' },
  { name: 'Overhead Press', category: 'Shoulders', muscle: 'Deltoids' },
  { name: 'Pull Ups', category: 'Back', muscle: 'Lats' },
  { name: 'RDL', category: 'Legs', muscle: 'Hamstrings' },
  { name: 'Barbell Row', category: 'Back', muscle: 'Mid-Back' },
  { name: 'Bulgarian Split Squat', category: 'Legs', muscle: 'Quads/Glutes' },
  { name: 'Dips', category: 'Arms/Chest', muscle: 'Triceps/Chest' },
]

export default function Library() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = EXERCISES.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-4 pb-24">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ChevronLeft />
        </button>
        <h1 className="text-2xl font-black italic uppercase">Library</h1>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input 
          type="text" 
          placeholder="Search exercises..."
          className="w-full bg-gray-900 border-2 border-gray-800 rounded-2xl p-4 pl-12 focus:border-indigo-500 outline-none transition-all font-bold"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3 max-w-md mx-auto">
        {filtered.map((ex, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 p-5 rounded-2xl flex justify-between items-center group hover:border-indigo-500/50 transition-all shadow-lg">
            <div>
              <h3 className="font-black text-lg tracking-tight">{ex.name}</h3>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">{ex.category}</span>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-800 px-2 py-0.5 rounded">{ex.muscle}</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
               <Play size={16} fill="currentColor" />
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}
