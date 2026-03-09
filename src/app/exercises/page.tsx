'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Dumbbell } from 'lucide-react'
import EXERCISES from '../../data/exercises.json'

export default function ExerciseLibrary() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredExercises = EXERCISES.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.target.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movement Library</h1>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Master Your Form</p>
        </div>
      </header>

      {/* SEARCH */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input 
          type="text" 
          placeholder="Search exercise or muscle group..." 
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:border-indigo-500 transition-all"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* GRID */}
      <div className="grid gap-4">
        {filteredExercises.map((ex) => (
          <div key={ex.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:bg-gray-800/50 transition-all group">
            <div className="flex justify-between items-start">
               <div>
                  <h3 className="font-bold text-lg">{ex.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest">{ex.target}</span>
                    <span className="text-[10px] text-gray-600">•</span>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">{ex.mechanic}</span>
                  </div>
               </div>
               <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Dumbbell size={20} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
