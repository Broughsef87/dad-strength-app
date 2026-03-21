'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { Heart, Shield, AlertTriangle, ChevronRight, Flame } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useUser } from '../contexts/UserContext'

interface Brother {
  id: string
  name: string
  last_contacted_at: string | null
}

function isOverdue(lastContacted: string | null): boolean {
  if (!lastContacted) return true
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return new Date(lastContacted) < sevenDaysAgo
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export default function SpiritVitals() {
  const supabase = createClient()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [familyScore, setFamilyScore] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [overdueNames, setOverdueNames] = useState<string[]>([])
  const [totalBrothers, setTotalBrothers] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!user) { setLoading(false); return }

      const thisMonday = getMondayOfWeek(new Date())

      // Fetch family pulse
      const { data: pulse } = await supabase
        .from('family_pulse')
        .select('marriage_vibe, kid_score')
        .eq('user_id', user.id)
        .eq('week_start', toISODate(thisMonday))
        .maybeSingle()

      if (pulse) {
        const mv = pulse.marriage_vibe ?? 0
        const ks = pulse.kid_score ?? 0
        if (mv && ks) setFamilyScore((mv + ks) / 2)
        else if (mv) setFamilyScore(mv)
        else if (ks) setFamilyScore(ks)
      }

      // Fetch brotherhood contacts
      const { data: brothers } = await supabase
        .from('brotherhood_contacts')
        .select('id, name, last_contacted_at')
        .eq('user_id', user.id)

      if (brothers) {
        setTotalBrothers(brothers.length)
        const overdue = brothers.filter((b: Brother) => isOverdue(b.last_contacted_at))
        setOverdueCount(overdue.length)
        setOverdueNames(overdue.slice(0, 2).map((b: Brother) => b.name))
      }

      setLoading(false)
    }
    load()
  }, [user])

  const scoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground'
    if (score >= 8) return 'text-green-400'
    if (score >= 5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const scoreLabel = (score: number | null) => {
    if (!score) return 'No data'
    if (score >= 8) return 'Strong'
    if (score >= 5) return 'Stable'
    return 'Needs Work'
  }

  if (loading) {
    return (
      <div className="bg-card/50 rounded-3xl p-6 border border-border animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-800 rounded w-1/3" />
      </div>
    )
  }

  return (
    <div
      className="glass-card rounded-3xl p-6 shadow-xl group hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
      onClick={() => router.push('/spirit')}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
            <Heart size={20} />
          </div>
          <h3 className="font-black italic uppercase tracking-tighter text-sm">Spirit Vitals</h3>
        </div>
        <ChevronRight size={16} className="text-gray-600 group-hover:text-purple-400 transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Family Pulse Score */}
        <div className="bg-card rounded-2xl p-4 border border-border group-hover:bg-purple-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Heart size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">Family</span>
          </div>
          <p className={`text-2xl font-black font-mono tracking-tighter ${scoreColor(familyScore)}`}>
            {familyScore ? familyScore.toFixed(1) : '--'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-widest">
            {scoreLabel(familyScore)}
          </p>
        </div>

        {/* Brotherhood Status */}
        <div className="bg-card rounded-2xl p-4 border border-border group-hover:bg-purple-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Shield size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">Brothers</span>
          </div>
          <p className={`text-2xl font-black font-mono tracking-tighter ${overdueCount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {totalBrothers - overdueCount}/{totalBrothers}
          </p>
          <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-widest">
            {overdueCount > 0 ? `${overdueCount} Overdue` : 'All Good'}
          </p>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
              {overdueNames.join(', ')}{overdueCount > 2 ? ` +${overdueCount - 2} more` : ''} — Call someone.
            </p>
          </div>
        </div>
      )}

      {overdueCount === 0 && totalBrothers > 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
          <Flame size={14} className="text-green-400 shrink-0" />
          <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">
            Brotherhood is solid. Keep it that way.
          </p>
        </div>
      )}

      {totalBrothers === 0 && (
        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl flex items-center gap-3">
          <Shield size={14} className="text-muted-foreground shrink-0" />
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            No brothers added yet → Spirit page
          </p>
        </div>
      )}
    </div>
  )
}

