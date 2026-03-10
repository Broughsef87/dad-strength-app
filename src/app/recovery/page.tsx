'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, Battery, Clock, Dumbbell, ShieldAlert, HeartPulse, Brain, CheckCircle2, Circle, Sparkles, BookOpen, Save } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function Recovery() {
  const router = useRouter()
  
  // Minimal state for the morning anchor checklist
  const [gratitude, setGratitude] = useState(false)
  const [prayer, setPrayer] = useState(false)
  const [meditation, setMeditation] = useState(false)
  
  // Sleep state
  const [sleepHours, setSleepHours] = useState<number | ''>('')
  const [sleepSaved, setSleepSaved] = useState(false)

  const isAnchorComplete = gratitude && prayer && meditation

  const handleSaveSleep = () => {
    if (sleepHours !== '') {
      setSleepSaved(true)
      // In a real app, we'd push this to Supabase here
      setTimeout(() => setSleepSaved(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-2xl font-black italic uppercase">Recovery</h1>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24 space-y-8">
        
        {/* Morning Anchor (Mind & Spirit) */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2 flex items-center gap-2">
                 <Brain size={14} className="text-emerald-400" />
                 The Morning Anchor
              </h3>
              {isAnchorComplete && <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">Anchored</span>}
           </div>

           <div className={`bg-gray-900 rounded-3xl border transition-all shadow-xl p-5 ${isAnchorComplete ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-900/20 to-gray-900' : 'border-gray-800'}`}>
              <p className="text-xs text-gray-400 font-medium mb-4">Mind, body, and spirit. Start the day grounded before the chaos hits.</p>
              
              <div className="space-y-3">
                 <button 
                  onClick={() => setGratitude(!gratitude)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                 >
                    <div className="flex items-center gap-3">
                       <Sparkles size={18} className={gratitude ? "text-yellow-400" : "text-gray-500 group-hover:text-yellow-400/50"} />
                       <span className={`font-bold text-sm ${gratitude ? 'text-white' : 'text-gray-300'}`}>1 Point of Gratitude</span>
                    </div>
                    {gratitude ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-gray-600" />}
                 </button>

                 <button 
                  onClick={() => setPrayer(!prayer)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                 >
                    <div className="flex items-center gap-3">
                       <BookOpen size={18} className={prayer ? "text-indigo-400" : "text-gray-500 group-hover:text-indigo-400/50"} />
                       <span className={`font-bold text-sm ${prayer ? 'text-white' : 'text-gray-300'}`}>Daily Prayer / Scripture</span>
                    </div>
                    {prayer ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-gray-600" />}
                 </button>

                 <button 
                  onClick={() => setMeditation(!meditation)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                 >
                    <div className="flex items-center gap-3">
                       <Moon size={18} className={meditation ? "text-blue-400" : "text-gray-500 group-hover:text-blue-400/50"} />
                       <span className={`font-bold text-sm ${meditation ? 'text-white' : 'text-gray-300'}`}>3 Mins of Silence</span>
                    </div>
                    {meditation ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-gray-600" />}
                 </button>
              </div>
           </div>
        </div>

        {/* Manual Sleep Log */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2 flex items-center gap-2">
                 <Moon size={14} className="text-blue-400" />
                 Sleep Tracking
              </h3>
           </div>
           
           <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              
              <div className="relative z-10">
                <p className="text-sm text-gray-300 font-medium mb-4">How many hours did you catch last night?</p>
                
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      step="0.5"
                      min="0"
                      max="24"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 6.5"
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold text-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-700"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm uppercase tracking-wider">
                      Hours
                    </span>
                  </div>
                  
                  <button 
                    onClick={handleSaveSleep}
                    disabled={sleepHours === ''}
                    className={`h-[52px] px-6 rounded-xl font-bold flex items-center gap-2 transition-all ${
                      sleepSaved 
                        ? 'bg-emerald-500 text-white' 
                        : sleepHours !== '' 
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {sleepSaved ? <CheckCircle2 size={20} /> : <Save size={20} />}
                    {sleepSaved ? 'Saved' : 'Log'}
                  </button>
                </div>
              </div>
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

      </main>

      <BottomNav />
    </div>
  )
}