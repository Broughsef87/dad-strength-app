'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase/client'

export type SubscriptionTier = 'free' | 'pro'

export interface SubscriptionState {
  tier: SubscriptionTier
  isFounder: boolean
  isPro: boolean
  status: string | null
  loading: boolean
}

export function useSubscription(): SubscriptionState {
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
        .select('subscription_tier, subscription_status, founder_pass')
        .eq('id', user.id)
        .maybeSingle()

      const isFounder = profile?.founder_pass === true
      const isActivePro = profile?.subscription_tier === 'pro' && profile?.subscription_status === 'active'
      const isPro = isFounder || isActivePro

      setState({
        tier: isPro ? 'pro' : 'free',
        isFounder,
        isPro,
        status: profile?.subscription_status ?? null,
        loading: false,
      })
    }

    load()
  }, [])

  return state
}
