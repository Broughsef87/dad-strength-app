'use client'

import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import Logo from './Logo'
import { createClient } from '../utils/supabase/client'

interface AppHeaderProps {
  /** Highlight which nav item is active */
  active?: 'hq' | 'train' | 'history' | 'profile'
}

export default function AppHeader({ active }: AppHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItem = (label: string, href: string, key: string) => (
    <button
      onClick={() => router.push(href)}
      className={`hover:text-foreground transition-colors ${
        active === key ? 'text-foreground font-medium' : ''
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* DESKTOP */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-background/90 px-8 py-4 backdrop-blur-md sticky top-0 z-40">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-3"
        >
          <Logo className="w-9 h-9" />
          <span
            className="font-black text-base tracking-[0.08em] uppercase text-foreground"
            style={{ fontFamily: 'var(--font-orbitron, "Arial Black", sans-serif)' }}
          >
            Dad Strength
          </span>
        </button>
        <nav className="flex gap-8 text-xs text-muted-foreground uppercase tracking-[0.12em]">
          {navItem('HQ', '/dashboard', 'hq')}
          {navItem('Train', '/body', 'train')}
          {navItem('History', '/history', 'history')}
          {navItem('Profile', '/profile', 'profile')}
          <button
            onClick={handleSignOut}
            className="text-red-500/60 hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </nav>
      </header>

      {/* MOBILE */}
      <header className="md:hidden flex items-center justify-between px-6 pt-6 pb-2">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2.5"
        >
          <Logo className="w-9 h-9" />
          <span
            className="font-black text-base tracking-[0.08em] uppercase"
            style={{ fontFamily: 'var(--font-orbitron, "Arial Black", sans-serif)' }}
          >
            Dad Strength
          </span>
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings size={16} />
        </button>
      </header>
    </>
  )
}
