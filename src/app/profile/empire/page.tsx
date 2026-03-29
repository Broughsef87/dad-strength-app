'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The Empire page has been replaced by My Mission — a user-configurable goal tracker.
// This redirect ensures any old links / bookmarks still work.
export default function EmpireRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile/mission') }, [router])
  return null
}
