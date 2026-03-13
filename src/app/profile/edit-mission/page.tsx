'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, TrendingUp, DollarSign, Youtube, MonitorSmartphone, Target, Activity } from 'lucide-react'
import { createClient } from '../../../utils/supabase/client'

const ICON_OPTIONS = [
  { id: 'trending', icon: TrendingUp, color: 'text-indigo-400' },
  { id: 'dollar', icon: DollarSign, color: 'text-green-400' },
  { id: 'youtube', icon: Youtube, color: 'text-red-500' },
  { id: 'saas', icon: MonitorSmartphone, color: 'text-indigo-400' },
  { id: 'target', icon: Target, color: 'text-orange-400' },
  { id: 'activity', icon: Activity, color: 'text-blue-400' }
]

export default function MissionEditor() {
  const router = useRouter()
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  
  const [mission, setMission] = useState({
    title: 'The Empire',
    primaryMetric: 'Operation: Freedom',
    current: 125000,
    target: 1000000,
    unit: '$',
    secondary1Label: 'Subs',
    secondary1Value: '12,450',
    secondary1Icon: 'youtube',
    secondary2Label: 'MRR',
    secondary2Value: '$2,100',
    secondary2Icon: 'saas'
  })

  useEffect(() => {
    async function loadMission() {
      setMounted(true)
      
      // Try Supabase first
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('mission_data')
            .eq('id', user.id)
            .single()
          
          if (profile?.mission_data) {
            setMission(profile.mission_data as any)
            return
          }
        }
      } catch (err) {
        console.error('Error loading mission from Supabase:', err)
      }

      // Fallback to localStorage
      const saved = localStorage.getItem('dad-strength-mission-state')
      if (saved) {
        setMission(JSON.parse(saved))
      }
    }
    loadMission()
  }, [supabase])

  const handleSave = async () => {
    // Save to localStorage (fallback)
    localStorage.setItem('dad-strength-mission-state', JSON.stringify(mission))
    
    // Save to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          mission_data: mission
        }, { onConflict: 'id' })
      }
    } catch (err) {
      console.error('Error saving mission to Supabase:', err)
    }

    router.push('/dashboard')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-black italic uppercase italic">Mission Editor</h1>
        </div>
        <button 
          onClick={handleSave}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
        >
          <Save size={14} /> Save
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-10">
        
        {/* SECTION 1: THE MISSION TITLE */}
        <section className="space-y-4">
          <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500 pl-1">Project Identity</label>
          <div className="space-y-4 bg-gray-900/40 p-6 rounded-3xl border border-gray-800">
             <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Pillar Name</label>
                <input 
                  type="text" 
                  value={mission.title}
                  onChange={(e) => setMission({...mission, title: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g. The Empire / My Vision"
                />
             </div>
             <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">North Star Name</label>
                <input 
                  type="text" 
                  value={mission.primaryMetric}
                  onChange={(e) => setMission({...mission, primaryMetric: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g. Operation: Freedom"
                />
             </div>
          </div>
        </section>

        {/* SECTION 2: THE PRIMARY TARGET */}
        <section className="space-y-4">
          <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500 pl-1">Progress Tracking</label>
          <div className="bg-gray-900/40 p-6 rounded-3xl border border-gray-800 space-y-6">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Current Value</label>
                   <input 
                     type="number" 
                     value={mission.current}
                     onChange={(e) => setMission({...mission, current: parseFloat(e.target.value)})}
                     className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500 outline-none transition-all"
                   />
                </div>
                <div>
                   <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Target Value</label>
                   <input 
                     type="number" 
                     value={mission.target}
                     onChange={(e) => setMission({...mission, target: parseFloat(e.target.value)})}
                     className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500 outline-none transition-all"
                   />
                </div>
             </div>
             <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Unit Type</label>
                <div className="flex gap-2">
                   {['$', 'LBS', '%', 'HRS', 'QTY'].map(u => (
                     <button
                       key={u}
                       onClick={() => setMission({...mission, unit: u})}
                       className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                         mission.unit === u 
                           ? 'bg-indigo-600 border-indigo-500 text-white' 
                           : 'bg-gray-950 border-gray-800 text-gray-600 hover:text-gray-400'
                       }`}
                     >
                        {u}
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </section>

        {/* SECTION 3: SECONDARY METRICS */}
        <section className="space-y-4">
          <label className="text-xs uppercase font-black tracking-[0.2em] text-gray-500 pl-1">Secondary Stats</label>
          
          {[1, 2].map((num) => {
            const prefix = num === 1 ? 'secondary1' : 'secondary2' as const;
            return (
              <div key={num} className="bg-gray-900/40 p-6 rounded-3xl border border-gray-800 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Stat Label</label>
                       <input 
                         type="text" 
                         value={mission[prefix + 'Label' as keyof typeof mission]}
                         onChange={(e) => setMission({...mission, [prefix + 'Label']: e.target.value})}
                         className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white font-bold focus:border-indigo-500 outline-none transition-all"
                         placeholder="e.g. Subscribers"
                       />
                    </div>
                    <div>
                       <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2">Current Stat</label>
                       <input 
                         type="text" 
                         value={mission[prefix + 'Value' as keyof typeof mission]}
                         onChange={(e) => setMission({...mission, [prefix + 'Value']: e.target.value})}
                         className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white font-bold focus:border-indigo-500 outline-none transition-all"
                         placeholder="e.g. 12,450"
                       />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase font-black tracking-widest text-gray-700 block mb-2 text-center">Icon Select</label>
                    <div className="flex justify-between bg-gray-950 p-2 rounded-xl border border-gray-800">
                       {ICON_OPTIONS.map((opt) => {
                         const Icon = opt.icon;
                         const isSelected = mission[prefix + 'Icon' as keyof typeof mission] === opt.id;
                         return (
                           <button
                             key={opt.id}
                             onClick={() => setMission({...mission, [prefix + 'Icon']: opt.id})}
                             className={`p-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-700 hover:text-gray-500'}`}
                           >
                             <Icon size={18} />
                           </button>
                         )
                       })}
                    </div>
                 </div>
              </div>
            )
          })}
        </section>

      </main>
    </div>
  )
}
