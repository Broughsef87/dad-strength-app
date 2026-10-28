'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '../utils/supabase/client'
import { PRO_FIELDS, hasPro } from '../lib/proStatus'

export type SubscriptionTier = 'free' | 'pro'

export interface SubscriptionState {
  tier: SubscriptionTier
  isFounder: boolean
  isPro: boolean
  status: string | null
  loading: boolean
}

const SubscriptionContext = createContext<SubscriptionState>({
  tier: 'free',
  isFounder: false,
  isPro: false,
  status: null,
  loading: true,
})

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    isFounder: false,
    isPro: false,
    status: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState(s => ({ ...s, loading: false }))
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select(PRO_FIELDS)
        .eq('id', user.id)
        .maybeSingle()

      const isFounder = profile?.founder_pass === true
      const isPro = hasPro(profile)

      setState({
        tier: isPro ? 'pro' : 'free',
        isFounder,
        isPro,
        status: profile?.subscription_status ?? null,
        loading: false,
      })
    }

    load()

    // Refresh on auth state change (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext)
}
