'use client'

import { useRouter, usePathname } from 'next/navigation'
import { PlayCircle, Calendar, Dumbbell, User, Apple, Moon } from 'lucide-react'

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { name: 'Train', path: '/dashboard', icon: <PlayCircle size={22} /> },
    { name: 'Meals', path: '/nutrition', icon: <Apple size={22} /> },
    { name: 'Library', path: '/library', icon: <Dumbbell size={22} /> },
    { name: 'Recovery', path: '/recovery', icon: <Moon size={22} /> },
    { name: 'Profile', path: '/profile', icon: <User size={22} /> },
  ]

  return (
    <nav className="fixed bottom-0 w-full border-t border-gray-800 bg-gray-950/80 backdrop-blur-xl p-2 flex justify-around items-center z-20 pb-8 sm:pb-4 shadow-2xl">
      {navItems.map((item) => {
        const isActive = pathname === item.path
        return (
          <button 
            key={item.name}
            onClick={() => router.push(item.path)}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${
              isActive ? 'text-indigo-400' : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
          </button>
        )
      })}
    </nav>
  )
}