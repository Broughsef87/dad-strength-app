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
      <header className="hidden md:flex items-center justify-between bg-background px-8 py-3.5 sticky top-0 z-40 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo className="w-8 h-8" />
          <span className="font-display font-semibold text-base lowercase text-foreground">
            dad strength
          </span>
        </Link>
        <nav className="flex gap-8 text-sm text-muted-foreground lowercase">
          {navItem('home', '/dashboard', 'hq')}
          {navItem('train', '/body', 'train')}
          {navItem('history', '/history', 'history')}
          {navItem('profile', '/profile', 'profile')}
          <button
            onClick={handleSignOut}
            className="text-red-500/60 hover:text-red-500 transition-colors lowercase"
          >
            sign out
          </button>
        </nav>
      </header>

      {/* MOBILE */}
      <header className="md:hidden flex items-center justify-between bg-background px-6 pt-6 pb-2">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo className="w-8 h-8" />
          <span className="font-display font-semibold text-base lowercase leading-none">
            dad strength
          </span>
        </Link>
        <Link
          href="/profile"
          className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings size={16} />
        </Link>
      </header>
    </>
  )
}
