'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Youtube, MonitorSmartphone, ArrowRight, Target, Activity } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '../utils/supabase/client'

const ICON_MAP = {
  trending: TrendingUp,
  dollar: DollarSign,
  youtube: Youtube,
  saas: MonitorSmartphone,
  target: Target,
  activity: Activity
}

export default function EmpireWidget() {
  const supabase = createClient()
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

    }
    loadMission()
  }, [supabase])

  const percentage = Math.round((mission.current / mission.target) * 100)
  const isCurrency = mission.unit === '$'
  const displayCurrent = isCurrency ? `${(mission.current / 1000).toFixed(0)}K` : mission.current.toLocaleString()
  const displayTarget = isCurrency ? `${(mission.target / 1000000).toFixed(0)}M` : mission.target.toLocaleString()

  const S1Icon = ICON_MAP[mission.secondary1Icon as keyof typeof ICON_MAP] || TrendingUp
  const S2Icon = ICON_MAP[mission.secondary2Icon as keyof typeof ICON_MAP] || MonitorSmartphone

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <h3 className="font-black text-foreground uppercase tracking-tighter italic">{mission.title}</h3>
        </div>
        <Link href="/profile/edit-mission" className="text-gray-600 hover:text-foreground transition-colors p-2 bg-background rounded-lg border border-border">
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Primary Target Progress */}
      <div className="bg-background/50 p-4 rounded-2xl border border-border shadow-inner">
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{mission.primaryMetric}</p>
            <p className="font-black text-xl text-foreground tracking-tighter tabular-nums">
              {isCurrency && '$'}{displayCurrent} 
              <span className="text-gray-700 text-xs ml-1 font-bold">/ {isCurrency && '$'}{displayTarget} {mission.unit !== '$' && mission.unit}</span>
            </p>
          </div>
          <span className="text-xs font-black text-indigo-400 tabular-nums">{percentage}%</span>
        </div>
        <div className="h-2 w-full bg-card rounded-full overflow-hidden border border-border p-[1px]">
          <div 
            className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background/50 p-3 rounded-xl border border-border flex items-center gap-3 group hover:border-indigo-500/30 transition-all">
          <div className="p-2 bg-card rounded-lg">
             <S1Icon size={16} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest truncate">{mission.secondary1Label}</p>
            <p className="text-xs font-black text-foreground tracking-tighter tabular-nums">{mission.secondary1Value}</p>
          </div>
        </div>
        <div className="bg-background/50 p-3 rounded-xl border border-border flex items-center gap-3 group hover:border-indigo-500/30 transition-all">
          <div className="p-2 bg-card rounded-lg">
             <S2Icon size={16} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest truncate">{mission.secondary2Label}</p>
            <p className="text-xs font-black text-foreground tracking-tighter tabular-nums">{mission.secondary2Value}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

