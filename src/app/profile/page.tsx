'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronLeft, User, Shield, Target, LogOut, Award } from 'lucide-react'

export default function Profile() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
      } else {
        setUser(user)
      }
      setLoading(false)
    }
    getUser()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </header>

      {/* USER CARD */}
      <div className="bg-gradient-to-br from-gray-900 to-indigo-950 border border-gray-800 rounded-3xl p-8 text-center mb-8 shadow-2xl shadow-indigo-500/10">
         <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/5">
            <User size={48} className="text-white" />
         </div>
         <h2 className="text-2xl font-black italic uppercase">{user?.email?.split('@')[0]}</h2>
         <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">Master Dad • Level 4</p>
         
         <div className="mt-8 flex justify-center gap-4">
            <div className="text-center">
               <p className="text-2xl font-bold">12</p>
               <p className="text-[10px] text-gray-500 uppercase font-black">Workouts</p>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="text-center">
               <p className="text-2xl font-bold">85k</p>
               <p className="text-[10px] text-gray-500 uppercase font-black">Vol (lbs)</p>
            </div>
             <div className="w-px h-10 bg-white/10"></div>
            <div className="text-center">
               <p className="text-2xl font-bold">3</p>
               <p className="text-[10px] text-gray-500 uppercase font-black">PRs</p>
            </div>
         </div>
      </div>

      {/* SETTINGS LIST */}
      <div className="space-y-4">
         <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center gap-4 hover:border-indigo-500/50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
               <Target size={20} />
            </div>
            <div className="flex-1">
               <p className="text-sm font-bold">My Goals</p>
               <p className="text-[10px] text-gray-500 font-medium">Adjust your target weight and reps</p>
            </div>
         </div>

         <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center gap-4 hover:border-indigo-500/50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center">
               <Shield size={20} />
            </div>
            <div className="flex-1">
               <p className="text-sm font-bold">Integrations</p>
               <p className="text-[10px] text-gray-500 font-medium">Sync with Health Kit or MyFitnessPal</p>
            </div>
         </div>

         <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center gap-4 hover:border-indigo-500/50 transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
               <Award size={20} />
            </div>
            <div className="flex-1">
               <p className="text-sm font-bold">Badges</p>
               <p className="text-[10px] text-gray-500 font-medium">View your unlocked achievements</p>
            </div>
         </div>

         <button 
           onClick={handleSignOut}
           className="w-full mt-8 bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
         >
            <LogOut size={16} />
            Sign Out of Account
         </button>
      </div>
    </div>
  )
}
