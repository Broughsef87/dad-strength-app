'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { toLocalDateString } from '../lib/utils'
import { motion } from 'framer-motion'

export default function TrainingHeatmap() {
  const supabase = createClient()
  const [trainedDays, setTrainedDays] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('workout_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', sevenDaysAgo.toISOString())
      const days = new Set((data || []).map((l: any) => toLocalDateString(new Date(l.created_at))))
      setTrainedDays(days)
      setLoading(false)
    }
    load()
  }, [])

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">7-Day Training</p>
      <div className="flex items-center gap-1.5">
        {days.map((day, i) => {
          const key = toLocalDateString(day)
          const trained = trainedDays.has(key)
          const isToday = toLocalDateString(day) === toLocalDateString(new Date())
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`w-full aspect-square rounded-md ${
                  loading
                    ? 'skeleton'
                    : trained
                    ? 'bg-brand brand-glow'
                    : isToday
                    ? 'bg-muted border-2 border-brand/40'
                    : 'bg-muted'
                }`}
              />
              <span className={`text-[8px] font-medium uppercase ${isToday ? 'text-brand' : 'text-muted-foreground'}`}>
                {dayLabels[day.getDay()]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
