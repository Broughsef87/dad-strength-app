'use client'

import { createClient } from '../../utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, Settings as SettingsIcon, Bell, Shield, Activity, Target, TrendingUp, BookOpen } from 'lucide-react'
import BottomNav from '../../components/BottomNav'

export default function Profile() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 p-6 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-2xl font-black italic uppercase">Profile</h1>
        <button className="text-gray-400 hover:text-white transition-colors">
          <SettingsIcon size={24} />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 pb-24 space-y-8">
        
        {/* User Card */}
        <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 flex items-center gap-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
           <div className="h-16 w-16 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xl ring-4 ring-indigo-500/20 z-10">
             {user?.email?.charAt(0).toUpperCase() || 'D'}
           </div>
           <div className="z-10">
             <h2 className="font-black text-xl">{user?.email?.split('@')[0] || 'Dad Warrior'}</h2>
             <p className="text-xs text-gray-500">{user?.email}</p>
             <span className="inline-block mt-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Pro Member</span>
           </div>
        </div>

        {/* High-Level Navigation (Empire / Growth) */}
        <div className="grid grid-cols-2 gap-4">
           <button 
            onClick={() => router.push('/profile/edit-mission')}
            className="bg-gray-900 rounded-2xl p-5 border border-gray-800 hover:border-indigo-500/50 hover:bg-gray-800/50 transition-all flex flex-col items-center justify-center text-center group shadow-xl"
           >
             <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Target className="text-indigo-400" size={24} />
             </div>
             <p className="font-black text-sm uppercase tracking-widest text-white italic">Edit Mission</p>
             <p className="text-[10px] text-gray-500 mt-1 font-bold tracking-wider">Customize Goals</p>
           </button>
           
           <button 
            onClick={() => router.push('/profile/growth')}
            className="bg-gray-900 rounded-2xl p-5 border border-gray-800 hover:border-indigo-500/50 hover:bg-gray-800/50 transition-all flex flex-col items-center justify-center text-center group shadow-xl"
           >
             <div className="h-12 w-12 rounded-full bg-pink-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BookOpen className="text-pink-400" size={24} />
             </div>
             <p className="font-black text-sm uppercase tracking-widest text-white italic">Growth</p>
             <p className="text-[10px] text-gray-500 mt-1 font-bold tracking-wider">Mindset & Family</p>
           </button>
        </div>

        {/* Goals / Stats Summary */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
             <Target className="text-orange-500 mb-2" size={20} />
             <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Current Goal</p>
             <p className="font-bold text-sm mt-1">Recomp (Maintain Weight)</p>
           </div>
           <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
             <Activity className="text-green-500 mb-2" size={20} />
             <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Activity Level</p>
             <p className="font-bold text-sm mt-1">3-4 Sessions / Wk</p>
           </div>
        </div>

        {/* Settings Links */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">App Settings</h3>
          
          <button className="w-full flex items-center justify-between p-4 bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-all group">
             <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-800 rounded-lg group-hover:text-indigo-400"><Bell size={18} /></div>
                <div className="text-left">
                  <p className="font-bold text-sm">Notifications</p>
                  <p className="text-xs text-gray-500">Workout reminders & alerts</p>
                </div>
             </div>
          </button>

          <button className="w-full flex items-center justify-between p-4 bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-all group">
             <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-800 rounded-lg group-hover:text-indigo-400"><Shield size={18} /></div>
                <div className="text-left">
                  <p className="font-bold text-sm">Privacy & Security</p>
                  <p className="text-xs text-gray-500">Password, data export</p>
                </div>
             </div>
          </button>
        </div>

        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-4 mt-8 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all font-bold text-sm uppercase tracking-widest"
        >
          <LogOut size={18} /> Sign Out
        </button>

      </main>

      <BottomNav />
    </div>
  )
}