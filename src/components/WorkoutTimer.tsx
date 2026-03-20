'use client'

import { Clock } from 'lucide-react'

interface WorkoutTimerProps {
  seconds: number
  formatTime: (s: number) => string
}

export default function WorkoutTimer({ seconds, formatTime }: WorkoutTimerProps) {
  return (
    <div className="flex items-center justify-center gap-1 text-lg font-black font-mono text-brand">
      <Clock size={16} className="mr-1" />
      {formatTime(seconds)}
    </div>
  )
}
