'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import UpgradeModal from './UpgradeModal'

interface PremiumGateProps {
  children: React.ReactNode
  feature?: string
  /** If true, renders children with a locked overlay instead of replacing them */
  overlay?: boolean
}

/**
 * Wraps premium-only content. Free users see an upgrade prompt.
 * Pro users see the content.
 */
export default function PremiumGate({ children, feature, overlay = false }: PremiumGateProps) {
  const { isPro, loading } = useSubscription()
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (loading) {
    return <div className="rounded-xl bg-card border border-border h-24 animate-pulse" />
  }

  if (isPro) return <>{children}</>

  if (overlay) {
    return (
      <>
        <div className="relative">
          <div className="pointer-events-none select-none opacity-40 blur-[2px]">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-2 bg-brand text-foreground text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg hover:bg-brand/90 transition-all active:scale-95"
            >
              <Zap size={12} /> Upgrade to Unlock
            </button>
          </div>
        </div>
        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          trigger={feature}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowUpgrade(true)}
        className="w-full flex items-center justify-between p-4 rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand/10 rounded-lg group-hover:bg-brand/20 transition-colors">
            <Zap size={14} className="text-brand" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold">
              {feature || 'Premium Feature'}
            </p>
            <p className="text-xs text-muted-foreground">Upgrade to Dad Strong+ to unlock</p>
          </div>
        </div>
        <span className="text-xs font-black text-brand uppercase tracking-widest">
          Upgrade →
        </span>
      </button>
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        trigger={feature}
      />
    </>
  )
}
