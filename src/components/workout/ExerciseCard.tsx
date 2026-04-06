'use client';

import { useState } from 'react';
import {
  CheckCircle2, Activity, Zap, History, Sparkles,
  MoreVertical, StickyNote, ArrowUp, ArrowDown,
  RefreshCw, AlertTriangle, Plus, SkipForward, Trash2, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  name: string;
  target: string;
  isCompleted: boolean;
  children: React.ReactNode;
  lastPerformed?: string;
  intensityScore?: number;
  // Menu callbacks — all optional; items are hidden if callback not provided
  onAddNote?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onReplace?: () => void;
  onJointPain?: () => void;
  onAddSet?: () => void;
  onSkipSets?: () => void;
  onRemove?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseCard({
  name,
  target,
  isCompleted,
  children,
  lastPerformed = 'Yesterday',
  intensityScore = 88,
  onAddNote,
  onMoveUp,
  onMoveDown,
  onReplace,
  onJointPain,
  onAddSet,
  onSkipSets,
  onRemove,
}: ExerciseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const hasAnyAction = onAddNote || onMoveUp || onMoveDown || onReplace ||
    onJointPain || onAddSet || onSkipSets || onRemove;

  function handleAction(fn?: () => void) {
    setMenuOpen(false);
    fn?.();
  }

  return (
    <>
      <div className={`group relative bg-card border-2 rounded-[40px] transition-all duration-700 overflow-hidden ${
        isCompleted
          ? 'border-emerald-500/40 bg-emerald-500/[0.02] shadow-[0_15px_40px_-10px_rgba(16,185,129,0.1)]'
          : 'border-border/80 hover:border-brand/40 shadow-2xl'
      }`}>
        {/* Dynamic Background Element */}
        {!isCompleted && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-brand/10 transition-colors duration-700" />
        )}

        {/* Exercise Header Section */}
        <div className={`p-8 pb-5 flex justify-between items-start relative z-10 ${
          isCompleted ? 'bg-emerald-500/[0.03]' : ''
        }`}>
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <h3 className={`font-black text-2xl tracking-tighter transition-all duration-500 ${
                isCompleted ? 'text-emerald-400' : 'text-foreground'
              }`}>
                {name.toUpperCase()}
              </h3>
              {isCompleted && (
                <div className="bg-emerald-500/20 p-1.5 rounded-full animate-in zoom-in duration-500">
                  <CheckCircle2 size={18} className="text-emerald-400" strokeWidth={3} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-brand/10 border border-brand/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                <span className="text-[10px] font-black text-brand uppercase tracking-widest">
                  TARGET: {target}
                </span>
              </div>

              {!isCompleted && (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-surface-3 rounded-full border border-border">
                  <History size={10} className="text-muted-foreground" />
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    {lastPerformed}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right side: intensity + menu */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {!isCompleted && (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-brand/80 mb-1.5">
                  <Zap size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Intensity</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-foreground">{intensityScore}</span>
                  <span className="text-[10px] font-black text-muted-foreground italic">pts</span>
                </div>
              </div>
            )}

            {/* Three-dot menu button */}
            {hasAnyAction && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/60 hover:text-emerald-400'
                    : 'bg-surface-3 border-border text-muted-foreground hover:text-foreground hover:border-brand/30'
                }`}
                aria-label="Exercise options"
              >
                <MoreVertical size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Sub-Header Stats Divider */}
        {!isCompleted && (
          <div className="px-8 flex items-center gap-4 mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-border via-border/60 to-transparent" />
            <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
              <Activity size={10} className="text-brand" />
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em]">Load Matrix</span>
            </div>
          </div>
        )}

        {/* Sets Area */}
        <div className={`p-8 pt-4 space-y-4 relative z-10 ${isCompleted ? 'opacity-60 blur-[0.5px] pointer-events-none' : ''}`}>
          {children}
        </div>

        {/* Completion Footer */}
        {isCompleted ? (
          <div className="bg-emerald-500 relative overflow-hidden py-2.5 group/complete">
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/complete:translate-x-full transition-transform duration-1000 ease-in-out" />
            <div className="flex items-center justify-center gap-3 relative z-10">
              <Sparkles size={12} className="text-black/80" />
              <p className="text-[10px] font-black text-black uppercase tracking-[0.4em]">Protocol Executed Successfully</p>
              <Sparkles size={12} className="text-black/80 rotate-12" />
            </div>
          </div>
        ) : (
          <div className="px-8 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-brand/30 w-1/3 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* ── Exercise Menu Bottom Sheet ───────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setMenuOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-2 border-t border-border rounded-t-2xl pb-safe"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Exercise</p>
                  <p className="font-display tracking-[0.06em] uppercase text-sm text-foreground">{name}</p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-7 h-7 rounded-lg bg-surface-3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Menu items */}
              <div className="px-4 py-3 space-y-1 max-w-md mx-auto">

                {/* Standard actions group */}
                <MenuGroup>
                  {onAddNote && (
                    <MenuItem
                      icon={StickyNote}
                      label="New Note"
                      onClick={() => handleAction(onAddNote)}
                    />
                  )}
                  {onAddSet && (
                    <MenuItem
                      icon={Plus}
                      label="Add Set"
                      onClick={() => handleAction(onAddSet)}
                    />
                  )}
                  {onSkipSets && (
                    <MenuItem
                      icon={SkipForward}
                      label="Skip Sets"
                      onClick={() => handleAction(onSkipSets)}
                    />
                  )}
                </MenuGroup>

                {/* Reorder + Replace group */}
                {(onMoveUp || onMoveDown || onReplace) && (
                  <MenuGroup>
                    {onMoveUp && (
                      <MenuItem
                        icon={ArrowUp}
                        label="Move Up"
                        onClick={() => handleAction(onMoveUp)}
                      />
                    )}
                    {onMoveDown && (
                      <MenuItem
                        icon={ArrowDown}
                        label="Move Down"
                        onClick={() => handleAction(onMoveDown)}
                      />
                    )}
                    {onReplace && (
                      <MenuItem
                        icon={RefreshCw}
                        label="Replace Exercise"
                        onClick={() => handleAction(onReplace)}
                      />
                    )}
                  </MenuGroup>
                )}

                {/* Modifiers + remove group */}
                {(onJointPain || onRemove) && (
                  <MenuGroup>
                    {onJointPain && (
                      <MenuItem
                        icon={AlertTriangle}
                        label="Joint Pain Modifier"
                        onClick={() => handleAction(onJointPain)}
                        className="text-amber-400"
                      />
                    )}
                    {onRemove && (
                      <MenuItem
                        icon={Trash2}
                        label="Remove Exercise"
                        onClick={() => handleAction(onRemove)}
                        className="text-red-400"
                        destructive
                      />
                    )}
                  </MenuGroup>
                )}

              </div>

              {/* Bottom safe area spacer */}
              <div className="h-6" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MenuGroup({ children }: { children: React.ReactNode }) {
  const valid = Array.isArray(children) ? children.filter(Boolean) : children;
  if (!valid || (Array.isArray(valid) && valid.length === 0)) return null;
  return (
    <div className="ds-card overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  className = 'text-foreground',
  destructive = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-surface-3 active:bg-surface-3 ${
        destructive ? 'text-red-400 hover:bg-red-500/5' : className
      }`}
    >
      <Icon size={16} className="flex-shrink-0" />
      {label}
    </button>
  );
}
