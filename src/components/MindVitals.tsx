'use client'

import { Brain, Timer, CheckCircle2, ChevronRight } from 'lucide-react'

interface MindVitalsProps {
  deepWorkMinutes: number
  completedObjectives: number
  totalObjectives: number
}

export default function MindVitals({ deepWorkMinutes, completedObjectives, totalObjectives }: MindVitalsProps) {
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const isDone = totalObjectives > 0 && completedObjectives >= totalObjectives

  return (
    <div className="glass-card rounded-xl p-5 transition-colors group">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand/10 rounded-lg text-brand">
            <Brain size={16} />
          </div>
          <h3 className="font-medium text-sm">Mind Vitals</h3>
        </div>
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded">
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background rounded-lg p-3.5 border border-border">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Timer size={12} />
            <span className="text-[9px] uppercase tracking-[0.12em] font-medium">Deep Work</span>
          </div>
          <p className="text-xl font-light font-mono tabular-nums tracking-tight text-foreground">
            {formatTime(deepWorkMinutes)}
          </p>
        </div>

        <div className="bg-background rounded-lg p-3.5 border border-border">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <CheckCircle2 size={12} />
            <span className="text-[9px] uppercase tracking-[0.12em] font-medium">Objectives</span>
          </div>
          <p className="text-xl font-light font-mono tabular-nums tracking-tight text-foreground">
            {completedObjectives}<span className="text-sm text-muted-foreground">/{totalObjectives}</span>
          </p>
        </div>
      </div>

      {isDone && (
        <div className="mt-4 p-3 bg-green-500/8 border border-green-500/20 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-medium text-green-600 uppercase tracking-[0.1em]">
            Daily Mission Complete
          </span>
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
      )}

      {!isDone && totalObjectives > 0 && (
        <div className="mt-4 p-3 bg-brand/5 border border-brand/20 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-medium text-brand uppercase tracking-[0.1em]">
            {totalObjectives - completedObjectives} remaining
          </span>
          <ChevronRight size={12} className="text-brand" />
        </div>
      )}
    </div>
  )
}
