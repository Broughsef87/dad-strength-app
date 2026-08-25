'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Shield, Bot, User } from 'lucide-react'

// Three tabs, matching what the app actually is. The four-pillar shell
// (home/mind/body/spirit) advertised pillars the product never grew: it left
// training and morning protocol without a tab while /mind and /spirit held five
// cards between them, one of which was a duplicate mount. Twelve dead components
// and twenty-three unreachable routes accumulated in that gap.
//
// Adding a fourth entry later is one line HERE and nothing else — which is the
// point of the table. Do not add a tab for a feature that does not exist yet;
// that is the exact mistake being undone. Fuel gets an entry when Fuel ships.
//
// Profile is a genuine addition, not a survivor: the old nav had no Profile tab
// at all, so settings, billing and account deletion were reachable only from a
// desktop-only header.
const NAV_ITEMS = [
  { id: 'today', label: 'today', path: '/dashboard', icon: Shield },
  { id: 'train', label: 'train', path: '/train', icon: Bot },
  { id: 'profile', label: 'profile', path: '/profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="tile pill fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-around gap-1 px-4 py-1.5 w-[calc(100%-2rem)] max-w-sm"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/')

        return (
          <Link
            key={item.id}
            href={item.path}
            className="relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[60px]"
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              size={17}
              strokeWidth={isActive ? 2 : 1.5}
              className={`transition-colors duration-200 ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            />
            <span
              className={`text-[11px] lowercase font-medium transition-colors duration-200 ${
                isActive ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <motion.span
                layoutId="nav-dot"
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                aria-hidden="true"
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
