'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
import { Shield, ChevronRight } from 'lucide-react'
import { getMondayOfWeek, getSundayOfWeek, toLocalDateString } from '../lib/utils'

type ScoreBreakdown = {
  training: number   // 0-40
  habits: number     // 0-30
  family: number     // 0-20
  mind: number       // 0-10
  total: number
  grade: string
}

function getGrade(total: number): string {
  if (total >= 91) return 'Dad Elite'
  if (total >= 76) return 'Strong'
  if (total >= 61) return 'Solid'
  if (total >= 41) return 'Grinding'
  return 'Rise Up'
}

function getGradeColor(grade: string): string {
  if (grade === 'Dad Elite') return 'text-yellow-400'
  if (grade === 'Strong') return 'text-green-500'
  if (grade === 'Solid') return 'text-brand'
  return 'text-muted-foreground'
}

export default function DadScore() {
  const [supabase] = useState(() => createClient())
  const { user, loading: userLoading } = useUser()
  const [score, setScore] = useState<ScoreBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { calculate() }, [user])

  const calculate = async () => {
    if (!user) { setLoading(false); return }

    const monday = getMondayOfWeek(new Date())
    const sunday = getSundayOfWeek(monday)

    // Training score (0-40): sessions / target * 40
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('program_data, growth_data')
      .eq('id', user.id)
      .maybeSingle()

    const weeklyTarget = profile?.program_data?.frequency || 4

    const { data: weekLogs } = await supabase
      .from('workout_logs')
      .select('created_at, workout_id, generated_workout_id')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('created_at', monday.toISOString())
      .lte('created_at', sunday.toISOString())

    const uniqueSessions = new Set(
      (weekLogs || []).map((l: any) => `${toLocalDateString(new Date(l.created_at))}__${l.workout_id ?? l.generated_workout_id ?? 'standalone'}`)
    ).size

    const trainingScore = Math.min(Math.round((uniqueSessions / weeklyTarget) * 40), 40)

    // Habits score (0-30): average completion rate from daily_checkins this week
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('growth_state')
      .eq('user_id', user.id)
      .gte('date', monday.toISOString().split('T')[0])
      .lte('date', sunday.toISOString().split('T')[0])

    let habitScore = 0
    if (checkins && checkins.length > 0) {
      const habitCounts = checkins.map((c: any) => {
        const gs = c.growth_state as any
        if (!gs?.habits) return 0
        const done = gs.habits.filter(Boolean).length
        const total = gs.habits.length
        return total > 0 ? done / total : 0
      })
      const avgRate = habitCounts.reduce((a: number, b: number) => a + b, 0) / habitCounts.length
      habitScore = Math.round(avgRate * 30)
    }

    // Family score (0-20): family goals completed this week
    let familyScore = 0
    if (checkins && checkins.length > 0) {
      const familyDone = checkins.filter((c: any) => (c.growth_state as any)?.familyGoalDone === true).length
      familyScore = Math.min(Math.round((familyDone / 7) * 20), 20)
    }

    // Mind score (0-10): objectives locked in and completed
    let mindScore = 0
    if (checkins && checkins.length > 0) {
      const mindEntries = checkins.map((c: any) => {
        const ms = (c as any).mind_state as any
        if (!ms?.completedObjectives) return 0
        const done = ms.completedObjectives.filter(Boolean).length
        const total = ms.objectives?.length || 1
        return done / total
      })
      const avgMind = mindEntries.reduce((a: number, b: number) => a + b, 0) / mindEntries.length
      mindScore = Math.round(avgMind * 10)
    }

    const total = trainingScore + habitScore + familyScore + mindScore
    const grade = getGrade(total)

    setScore({ training: trainingScore, habits: habitScore, family: familyScore, mind: mindScore, total, grade })
    setLoading(false)
  }

  if (loading) return (
    <div className="bg-card rounded-xl p-5 border border-border animate-pulse">
      <div className="h-3 bg-muted rounded w-1/3 mb-3" />
      <div className="h-12 bg-muted rounded w-1/2" />
    </div>
  )

  if (!score) return null

  const gradeColor = getGradeColor(score.grade)

  return (
    <div className="bg-card rounded-xl p-5 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand/10 rounded-lg">
            <Shield size={15} strokeWidth={1.5} className="text-brand" />
          </div>
          <h3 className="font-medium text-sm font-display tracking-[0.06em]">Dad Score</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">This Week</span>
      </div>

      <div className="flex items-end gap-3">
        <p className="text-5xl font-black tabular-nums leading-none font-display">{score.total}</p>
        <div className="mb-1">
          <p className={`text-sm font-black uppercase tracking-[0.08em] font-display ${gradeColor}`}>{score.grade}</p>
          <p className="text-[10px] text-muted-foreground">/ 100</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-1000"
          style={{ width: `${score.total}%` }}
        />
      </div>

      {/* Breakdown */}
      <div className="space-y-2 pt-1">
        {[
          { label: 'Training', value: score.training, max: 40 },
          { label: 'Habits', value: score.habits, max: 30 },
          { label: 'Family', value: score.family, max: 20 },
          { label: 'Mind', value: score.mind, max: 10 },
        ].map(({ label, value, max }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium w-14">{label}</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand/60 rounded-full transition-all duration-700"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-black tabular-nums text-muted-foreground w-8 text-right">{value}/{max}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
