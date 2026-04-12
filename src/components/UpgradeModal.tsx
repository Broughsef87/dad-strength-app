'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Check, Shield, Loader2 } from 'lucide-react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  trigger?: string // what feature triggered this upgrade prompt
}

const PRO_FEATURES = [
  'All 5 training programs + program builder',
  'The Squeeze — unlimited AI-generated sessions',
  'AI Weekly Check-In (grades, wins, adjustments)',
  'AI Morning Protocol — personalized daily',
  'Body composition tracking + nutrition',
  'Unlimited workout history + full heatmap',
  'My Mission tracker + milestone check-ins',
  'Streak shields (1/month)',
  'Brotherhood leaderboard + Dad Score rankings',
]

export default function UpgradeModal({ isOpen, onClose, trigger }: UpgradeModalProps) {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | 'founder' | null>(null)

  const handleCheckout = async (type: 'monthly' | 'yearly' | 'founder') => {
    setLoading(type)
    try {
      const priceMap: Record<string, { priceId: string; mode: string }> = {
        monthly: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || '',
          mode: 'subscription',
        },
        yearly: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID || '',
          mode: 'subscription',
        },
        founder: {
          priceId: process.env.NEXT_PUBLIC_STRIPE_FOUNDER_PRICE_ID || '',
          mode: 'payment',
        },
      }

      const { priceId, mode } = priceMap[type]

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, mode }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Checkout failed')
      }
    } catch (err) {
      console.error('Upgrade error:', err)
      setLoading(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
            className="relative w-full max-w-md overflow-hidden rounded-xl premium-surface"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header — steel-edge platform feel */}
            <div className="relative p-6 border-b border-border/60">
              <button
                onClick={onClose}
                aria-label="Close upgrade modal"
                className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center">
                  <Zap size={16} className="text-brand" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-brand font-semibold font-display">Dad Strong+</p>
                  <h2 id="upgrade-modal-title" className="font-display text-2xl tracking-[0.06em] uppercase text-foreground leading-tight">Unlock Everything</h2>
                </div>
              </div>
              {trigger && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {trigger} requires Dad Strong+.
                </p>
              )}
            </div>

            {/* Features */}
            <div className="px-6 py-5 space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check size={12} className="text-brand shrink-0" strokeWidth={2.5} />
                  <span className="text-sm text-muted-foreground leading-snug">{f}</span>
                </div>
              ))}
            </div>

            {/* Pricing options */}
            <div className="px-6 pb-6 space-y-2.5">

              {/* Yearly — recommended — most prominent */}
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={!!loading}
                className="btn-forge-shimmer annual-card w-full flex items-center justify-between p-4 rounded-lg relative transition-all disabled:opacity-50"
              >
                <div className="absolute -top-2.5 left-4 bg-brand text-background text-[8px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm">
                  Best Value
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">Annual</p>
                  <p className="text-xs text-muted-foreground">Save 34% — $6.58/mo</p>
                </div>
                <div className="text-right">
                  {loading === 'yearly'
                    ? <Loader2 size={15} className="animate-spin text-brand" />
                    : <p className="font-black text-lg text-foreground">$79<span className="text-xs text-muted-foreground font-normal">/yr</span></p>
                  }
                </div>
              </button>

              {/* Monthly */}
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-border/60 hover:border-border bg-muted/20 hover:bg-muted/30 transition-all disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="font-semibold text-sm">Monthly</p>
                  <p className="text-xs text-muted-foreground">Cancel anytime</p>
                </div>
                <div className="text-right">
                  {loading === 'monthly'
                    ? <Loader2 size={15} className="animate-spin text-brand" />
                    : <p className="font-bold text-base">$9.99<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  }
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="flex-1 h-px bg-border/50" />
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Or</p>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Founder Pass */}
              <button
                onClick={() => handleCheckout('founder')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-border/70 bg-muted/10 hover:bg-muted/20 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Shield size={13} className="text-steel shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Founder&apos;s Pass</p>
                    <p className="text-xs text-muted-foreground">Lifetime access · one-time</p>
                  </div>
                </div>
                {loading === 'founder'
                  ? <Loader2 size={15} className="animate-spin text-brand" />
                  : (
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-base">$47</p>
                      <p className="text-[9px] text-muted-foreground line-through">$149</p>
                    </div>
                  )
                }
              </button>

              <p className="text-center text-[9px] text-muted-foreground pt-0.5 tracking-wide">
                Secure checkout · Stripe · Cancel anytime
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
