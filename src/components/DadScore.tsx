'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { useUser } from '../contexts/UserContext'
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
      .select('growth_state, mind_state')
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
    <div className="space-y-3 animate-pulse">
      <div className="h-2 bg-muted/30 rounded-none w-1/4" />
      <div className="h-16 bg-muted/20 rounded-none w-1/3" />
    </div>
  )

  if (!score) return null

  const gradeColor = getGradeColor(score.grade)

  return (
    <div>
      <p className="text-[9px] font-semibold tracking-[0.3em] text-muted-foreground/40 uppercase mb-4">Dad Score</p>
      <div className="flex items-baseline gap-5 mb-8">
        <span className="font-mono text-8xl text-foreground leading-none tabular-nums">{score.total}</span>
        <div>
          <span className={`font-display text-3xl tracking-[0.06em] ${gradeColor}`}>{score.grade}</span>
          <p className="text-[9px] text-muted-foreground/30 tracking-[0.2em] uppercase mt-1">/ 100</p>
        </div>
      </div>
      <div className="space-y-4">
        {[
          { label: 'Training', value: score.training, max: 40 },
          { label: 'Habits', value: score.habits, max: 30 },
          { label: 'Family', value: score.family, max: 20 },
          { label: 'Mind', value: score.mind, max: 10 },
        ].map(({ label, value, max }) => (
          <div key={label} className="flex items-center gap-4">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/40 uppercase w-16 shrink-0">{label}</span>
            <div className="flex-1 h-px bg-border/30 relative">
              <div
                className="absolute top-0 left-0 h-px bg-foreground/60 transition-all duration-700"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/40 w-10 text-right tabular-nums">{value}/{max}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
