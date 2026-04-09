'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { toLocalDateString } from '../lib/utils'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getGrade(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: 'Dad Elite', color: 'text-brand' }
  if (pct >= 75) return { label: 'Strong', color: 'text-green-500' }
  if (pct >= 60) return { label: 'Solid', color: 'text-yellow-500' }
  if (pct >= 40) return { label: 'Grinding', color: 'text-brand' }
  return { label: 'Rise Up', color: 'text-red-500' }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function DadOfMonth() {
  const [supabase] = useState(() => createClient())
  const { user, loading: userLoading } = useUser()
  const [currentPct, setCurrentPct] = useState(0)
  const [prevPct, setPrevPct] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!userLoading) { calculate() } }, [user, userLoading])

  async function calculate() {
    if (!user) { setLoading(false); return }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    // Current month: first day to today
    const firstOfMonth = toLocalDateString(new Date(year, month, 1))
    const today = toLocalDateString(now)

    // Previous month
    const prevYear = month === 0 ? year - 1 : year
    const prevMonth = month === 0 ? 11 : month - 1
    const firstOfPrev = toLocalDateString(new Date(prevYear, prevMonth, 1))
    const lastOfPrev = toLocalDateString(new Date(prevYear, prevMonth + 1, 0))

    const [currentRes, prevRes] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('date, forge_state, habit_completions')
        .eq('user_id', user.id)
        .gte('date', firstOfMonth)
        .lte('date', today),
      supabase
        .from('daily_checkins')
        .select('date, forge_state, habit_completions')
        .eq('user_id', user.id)
        .gte('date', firstOfPrev)
        .lte('date', lastOfPrev),
    ])

    function activeDays(rows: { forge_state?: Record<string, unknown>; habit_completions?: number | Record<string, unknown> }[]): number {
      return (rows || []).filter(r => {
        const hasForge = r.forge_state && Object.keys(r.forge_state).length > 0
        const hasHabits = r.habit_completions && (
          typeof r.habit_completions === 'number'
            ? r.habit_completions > 0
            : Object.values(r.habit_completions as Record<string, unknown>).some(Boolean)
        )
        return hasForge || hasHabits
      }).length
    }

    const todayDate = now.getDate()
    const prevTotalDays = daysInMonth(prevYear, prevMonth)

    const cActive = activeDays(currentRes.data || [])
    const pActive = activeDays(prevRes.data || [])

    const cPct = todayDate > 0 ? Math.round((cActive / todayDate) * 100) : 0
    const pPct = prevTotalDays > 0 ? Math.round((pActive / prevTotalDays) * 100) : 0

    setCurrentPct(cPct)
    setPrevPct(pPct)
    setLoading(false)
  }

  if (loading) return null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const { label: gradeLabel, color: gradeColor } = getGrade(currentPct)
  const delta = currentPct - prevPct
  const showBestMonth = currentPct >= 85 && delta > 0

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Trophy size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm">This Month</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
          {monthLabel(year, month)}
        </span>
      </div>

      {/* Score row */}
      <div className="flex items-end gap-3">
        <p className="stat-num text-5xl font-black leading-none">{currentPct}%</p>
        <div className="mb-1 space-y-0.5">
          <p className={`text-sm font-black uppercase tracking-tight ${gradeColor}`}>{gradeLabel}</p>
          <p className="text-[10px] text-muted-foreground">consistency</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-1000"
          style={{ width: `${currentPct}%` }}
        />
      </div>

      {/* Month-over-month delta */}
      <div className="flex items-center gap-1.5">
        <span
          className={`text-xs font-semibold ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}
        >
          {delta >= 0 ? '+' : ''}{delta}% vs last month
        </span>
      </div>

      {/* Best Month Yet banner */}
      {showBestMonth && (
        <div className="flex items-center gap-2 bg-brand/10 border border-brand/25 rounded-xl px-3 py-2.5 brand-glow">
          <span className="text-base leading-none">🏆</span>
          <p className="text-xs font-bold text-brand uppercase tracking-[0.1em]">Best Month Yet</p>
        </div>
      )}
    </div>
  )
}
