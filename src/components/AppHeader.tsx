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
      className={`steel-label transition-colors ${
        active === key
          ? 'text-brand'
          : 'hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      {/* DESKTOP */}
      <header className="hidden md:flex items-center justify-between border-b border-border bg-surface-2 px-8 py-3.5 sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-0.5 h-6 bg-brand" />
          <span className="font-display text-lg tracking-[0.08em] uppercase text-foreground">
            Dad Strength
          </span>
        </Link>
        <nav className="flex items-center gap-8">
          {navItem('HQ', '/dashboard', 'hq')}
          {navItem('Train', '/body', 'train')}
          {navItem('History', '/history', 'history')}
          {navItem('Profile', '/profile', 'profile')}
          <button
            onClick={handleSignOut}
            className="steel-label text-red-500/60 hover:text-red-500 transition-colors"
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
            <span className="font-display text-base tracking-[0.08em] uppercase text-foreground">
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
