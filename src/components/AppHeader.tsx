'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import Logo from './Logo'
import { createClient } from '../utils/supabase/client'

interface AppHeaderProps {
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
    <Link
      href={href}
      className={`hover:text-foreground transition-colors ${
        active === key ? 'text-foreground font-medium' : ''
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      {/* DESKTOP */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-surface-2 px-8 py-3.5 sticky top-0 z-40">
        <Link href="/dashboard">
          {/* PNG lockups — fonts baked in at export time */}
          <img
            src="/logo-suite/ds_horizontal_dark.png"
            alt="Dad Strength"
            className="h-11 w-auto dark:block hidden"
          />
          <img
            src="/logo-suite/ds_horizontal_light.png"
            alt="Dad Strength"
            className="h-11 w-auto dark:hidden block"
          />
        </Link>
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
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo className="w-9 h-9" />
          <div className="flex flex-col leading-none">
            <span
              className="font-black text-base tracking-[0.08em] uppercase"
              style={{ fontFamily: 'var(--font-bebas, "Arial Black", sans-serif)' }}
            >
              Dad Strength
            </span>
            <span className="text-[9px] tracking-[0.15em] text-muted-foreground uppercase mt-0.5">
              by Forge OS
            </span>
          </div>
        </Link>
        <Link
          href="/profile"
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings size={16} />
        </Link>
      </header>
    </>
  )
}
