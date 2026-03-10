'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, Save, Dumbbell, Home as HomeIcon, LayoutPanelLeft, LayoutPanelTop, Layout, Zap, Calendar } from 'lucide-react'

// Programs Config
const PROGRAM_FOCUSES = [
  { id: 'upper', name: 'Upper Body Focus', icon: LayoutPanelTop, desc: 'Prioritize chest, back, and shoulders.' },
  { id: 'lower', name: 'Lower Body Focus', icon: LayoutPanelLeft, desc: 'Heavy emphasis on legs and posterior chain.' },
  { id: 'full', name: 'Full Body', icon: Layout, desc: 'Complete coverage in every session.' },
  { id: 'cond', name: 'Conditioning', icon: Zap, desc: 'Work capacity, heart rate, and fat loss.' },
]

const EQUIPMENT_TRACKS = [
  { id: 'iron', name: 'Iron Path', icon: Dumbbell, desc: 'Full gym with barbells and racks.' },
  { id: 'home', name: 'At Home', icon: HomeIcon, desc: 'Dumbbells, bands, or bodyweight.' },
]

const DURATION_WEEKS = [4, 5, 6]

export default function EditProgram() {
  const router = useRouter()
  const [selectedFocus, setSelectedFocus] = useState('full')
  const [selectedTrack, setSelectedTrack] = useState('iron')
  const [selectedWeeks, setSelectedWeeks] = useState(4)

  const handleSave = () => {
    console.log('Saving program configuration...', { focus: selectedFocus, track: selectedTrack, weeks: selectedWeeks })
    // In a real app, this would update the user's active program in Supabase
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-12">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-4 backdrop-blur-md sticky top-0 z-10">
        <button 
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <span className="font-black tracking-tighter text-lg uppercase italic">Program Selector</span>
        <button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/20"
        >
          Save
        </button>
      </header>

      <main className="mx-auto max-w-md p-6 space-y-10">
        
        {/* STEP 1: FOCUS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">1</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Select Your Focus</label>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {PROGRAM_FOCUSES.map((focus) => {
              const Icon = focus.icon;
              const isSelected = selectedFocus === focus.id;
              return (
                <button
                  key={focus.id}
                  onClick={() => setSelectedFocus(focus.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-xl shadow-indigo-500/5' 
                      : 'border-gray-900 bg-gray-900/40 text-gray-500 hover:border-gray-800'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-600'}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className={`font-black uppercase tracking-tight italic ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>
                      {focus.name}
                    </h3>
                    <p className="text-[10px] font-medium text-gray-600 leading-tight mt-0.5">
                      {focus.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* STEP 2: TRACK */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">2</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Choose Your Path</label>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {EQUIPMENT_TRACKS.map((track) => {
              const Icon = track.icon;
              const isSelected = selectedTrack === track.id;
              return (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrack(track.id)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 text-center transition-all ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-xl shadow-indigo-500/5' 
                      : 'border-gray-900 bg-gray-900/40 text-gray-500 hover:border-gray-800'
                  }`}
                >
                  <div className={`p-3 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-600'}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className={`font-black uppercase tracking-widest text-[10px] italic ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>
                      {track.name}
                    </h3>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* STEP 3: DURATION */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/30">3</div>
            <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500">Cycle Duration</label>
          </div>
          
          <div className="flex bg-gray-900/50 p-1.5 rounded-2xl border border-gray-900">
            {DURATION_WEEKS.map((weeks) => (
              <button
                key={weeks}
                onClick={() => setSelectedWeeks(weeks)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedWeeks === weeks 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {weeks} Weeks
              </button>
            ))}
          </div>
        </section>

        {/* PLACEHOLDER NOTE */}
        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 text-center">
          <Calendar className="w-6 h-6 text-indigo-500 mx-auto mb-3 opacity-50" />
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed italic">
            "The training cycle adapts to your life, not the other way around. Select your focus and start the forge."
          </p>
        </div>

      </main>
    </div>
  )
}
