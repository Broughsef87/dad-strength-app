'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, PlayCircle, Dumbbell, Loader2, SlidersHorizontal } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import BottomNav from '../../components/BottomNav'
import EXERCISES from '../../data/exercises.json'

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']

const CATEGORY_COLORS: Record<string, string> = {
  Chest:     'text-rose-400 bg-rose-500/10 border-rose-500/20',
  Back:      'text-sky-400 bg-sky-500/10 border-sky-500/20',
  Legs:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Shoulders: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Arms:      'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Core:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Cardio:    'text-brand bg-brand/10 border-brand/20',
}

const MECHANIC_BADGE: Record<string, string> = {
  Compound:  'text-brand bg-brand/10',
  Isolation: 'text-muted-foreground bg-gray-800',
  Isometric: 'text-teal-400 bg-teal-500/10',
}

type Exercise = typeof EXERCISES[0]

export default function Library() {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [equipFilter, setEquipFilter] = useState<'all' | 'iron' | 'home'>('all')

  const filtered = EXERCISES.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.target.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'All' || ex.category === activeCategory
    const matchEquip = equipFilter === 'all' || ex.equipment === equipFilter || ex.equipment === 'both'
    return matchSearch && matchCat && matchEquip
  })

  const handleQuickStart = async (ex: Exercise) => {
    setLoadingId(ex.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Create a quick one-exercise workout in Supabase
      const { data: workout, error } = await supabase
        .from('workouts')
        .insert({
          name: `Quick: ${ex.name}`,
          description: `Single-exercise session — ${ex.target}`,
          exercises: [{ name: ex.name, sets: 4, reps: '8-12' }],
          status: 'active',
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      localStorage.setItem('activeWorkoutId', workout.id)
      router.push(`/workout/${workout.id}`)
    } catch (err) {
      console.error('Quick start failed:', err)
      setLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-28">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-surface-2 border-b border-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Movement Library</h1>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{filtered.length} exercises</p>
          </div>
        </div>

        {/* SEARCH */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
          <input
            type="text"
            placeholder="Search exercises or muscles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-gray-700 focus:outline-none focus:border-brand transition-all font-medium"
          />
        </div>

        {/* EQUIPMENT FILTER */}
        <div className="flex gap-2 mb-3">
          {(['all', 'iron', 'home'] as const).map((eq) => (
            <button
              key={eq}
              onClick={() => setEquipFilter(eq)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                equipFilter === eq
                  ? 'bg-brand border-brand text-foreground'
                  : 'bg-card border-border text-muted-foreground hover:border-gray-700'
              }`}
            >
              {eq === 'all' ? '🏋️ All' : eq === 'iron' ? '🔩 Iron Path' : '🏠 At Home'}
            </button>
          ))}
        </div>

        {/* CATEGORY TABS */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeCategory === cat
                  ? 'bg-brand text-foreground shadow-lg shadow-brand/20'
                  : 'bg-card text-muted-foreground hover:text-gray-300 border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* EXERCISE LIST */}
      <main className="p-4 space-y-3 max-w-md mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <Dumbbell size={40} className="mx-auto mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest">No exercises found.</p>
          </div>
        ) : (
          filtered.map((ex) => {
            const catColor = CATEGORY_COLORS[ex.category] || 'text-muted-foreground bg-gray-800 border-gray-700'
            const mechBadge = MECHANIC_BADGE[ex.mechanic] || 'text-muted-foreground bg-gray-800'
            const isLoading = loadingId === ex.id

            return (
              <div
                key={ex.id}
                className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between group hover:border-gray-700 transition-all shadow-lg"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${catColor}`}>
                    <Dumbbell size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm tracking-tight truncate">{ex.name}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">{ex.target}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${mechBadge}`}>
                        {ex.mechanic}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${catColor}`}>
                        {ex.category}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickStart(ex)}
                  disabled={!!loadingId}
                  className="flex items-center gap-1.5 bg-brand hover:bg-brand/90 disabled:opacity-40 text-foreground text-[10px] font-black px-3 py-2.5 rounded-xl transition-all active:scale-95 uppercase tracking-widest ml-3 flex-shrink-0 shadow-lg shadow-brand/10"
                >
                  {isLoading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <><PlayCircle size={14} /> Start</>
                  }
                </button>
              </div>
            )
          })
        )}
      </main>

      <BottomNav />
    </div>
  )
}

