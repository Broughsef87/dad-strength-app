'use client';

import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  isDone?: boolean;
}

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function SetRow({
  set,
  index,
  onToggle,
  onDelete
}: SetRowProps) {
  const isDone = set.isDone || false;

  return (
    <div 
      className={`group flex items-center gap-4 p-4 bg-card/80 border transition-all duration-300 ${
        isDone 
          ? 'border-brand/50 bg-brand/10 scale-[1.01]' 
          : 'border-border hover:border-border'
      } rounded-2xl`}
    >
      <div className={`flex-none w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-display font-semibold italic transition-colors ${
        isDone ? 'bg-brand text-[hsl(var(--brand-ink))]' : 'border border-border text-foreground'
      }`}>
        {index + 1}
      </div>

      <div className="flex-grow min-w-0">
        <p className={`font-display font-semibold text-sm uppercase truncate transition-colors ${isDone ? 'text-foreground' : 'text-muted-foreground'} tracking-[0.08em]`}>
          {set.exercise}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-display font-semibold uppercase transition-colors ${isDone ? 'text-brand' : 'text-brand'} tracking-[0.08em]`}>{set.weight} LBS</span>
          <span className="text-[8px] text-muted-foreground">/</span>
          <span className={`text-[10px] font-display font-semibold uppercase transition-colors ${isDone ? 'text-brand/50' : 'text-muted-foreground'} tracking-[0.08em]`}>{set.reps} REPS</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggle && (
          <button 
            onClick={() => onToggle(set.id)}
            className={`p-2 rounded-xl transition-all ${
              isDone 
                ? 'bg-brand text-[hsl(var(--brand-ink))] shadow-lg shadow-brand/30' 
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        )}
        
        {onDelete && (
          <button 
            onClick={() => onDelete(set.id)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

