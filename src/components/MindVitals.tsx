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
    <div className="bg-card/50 rounded-3xl p-6 border border-border shadow-xl group hover:border-indigo-500/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Brain size={20} />
          </div>
          <h3 className="font-black italic uppercase tracking-tighter text-sm">Mind Vitals</h3>
        </div>
        <div className="px-2 py-1 rounded-md bg-gray-800/50 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Live Data
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Deep Work */}
        <div className="bg-card rounded-2xl p-4 border border-border group-hover:bg-indigo-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Timer size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">Deep Work</span>
          </div>
          <p className="text-2xl font-black font-mono tracking-tighter text-foreground">
            {formatTime(deepWorkMinutes)}
          </p>
        </div>

        {/* Objectives */}
        <div className="bg-card rounded-2xl p-4 border border-border group-hover:bg-indigo-500/5 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <CheckCircle2 size={14} />
            <span className="text-[10px] uppercase font-black tracking-widest">Objectives</span>
          </div>
          <p className="text-2xl font-black font-mono tracking-tighter text-foreground">
            {completedObjectives}/{totalObjectives}
          </p>
        </div>
      </div>

      {isDone && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
          <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">
            Daily Mission Complete
          </span>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        </div>
      )}

      {!isDone && totalObjectives > 0 && (
        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            {totalObjectives - completedObjectives} Objectives Remaining
          </span>
          <ChevronRight size={14} className="text-indigo-400" />
        </div>
      )}
    </div>
  )
}

