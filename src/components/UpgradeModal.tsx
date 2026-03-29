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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="relative bg-brand/10 border-b border-border p-6">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand rounded-lg">
                  <Zap size={18} className="text-foreground" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-brand font-medium">Dad Strong+</p>
                  <h2 className="text-lg font-black uppercase italic tracking-tight">Unlock Everything</h2>
                </div>
              </div>
              {trigger && (
                <p className="text-xs text-muted-foreground mt-1">
                  {trigger} is a premium feature.
                </p>
              )}
            </div>

            {/* Features */}
            <div className="p-6 space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <Check size={13} className="text-brand shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>

            {/* Pricing options */}
            <div className="px-6 pb-6 space-y-3">
              {/* Monthly */}
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-brand/40 bg-muted/30 hover:bg-brand/5 transition-all disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">Monthly</p>
                  <p className="text-xs text-muted-foreground">Cancel anytime</p>
                </div>
                <div className="text-right">
                  {loading === 'monthly'
                    ? <Loader2 size={16} className="animate-spin text-brand" />
                    : <p className="font-black text-lg">$9.99<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  }
                </div>
              </button>

              {/* Yearly — recommended */}
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-brand bg-brand/10 hover:bg-brand/15 transition-all disabled:opacity-50 relative"
              >
                <div className="absolute -top-2.5 left-4 bg-brand text-foreground text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                  Best Value
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Annual</p>
                  <p className="text-xs text-muted-foreground">Save 34% vs monthly</p>
                </div>
                <div className="text-right">
                  {loading === 'yearly'
                    ? <Loader2 size={16} className="animate-spin text-brand" />
                    : (
                      <>
                        <p className="font-black text-lg">$79<span className="text-xs text-muted-foreground font-normal">/yr</span></p>
                        <p className="text-[9px] text-muted-foreground">≈ $6.58/mo</p>
                      </>
                    )
                  }
                </div>
              </button>

              {/* Founder Pass divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-border" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Or</p>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Founder Pass */}
              <button
                onClick={() => handleCheckout('founder')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-foreground/20 bg-muted/20 hover:bg-muted/40 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Shield size={14} className="text-brand shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Founder's Pass</p>
                    <p className="text-xs text-muted-foreground">Lifetime access — one-time payment</p>
                  </div>
                </div>
                {loading === 'founder'
                  ? <Loader2 size={16} className="animate-spin text-brand" />
                  : (
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-black text-base">$47</p>
                      <p className="text-[9px] text-muted-foreground line-through">$149</p>
                    </div>
                  )
                }
              </button>

              <p className="text-center text-[10px] text-muted-foreground pt-1">
                Secure checkout via Stripe. Cancel anytime.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
