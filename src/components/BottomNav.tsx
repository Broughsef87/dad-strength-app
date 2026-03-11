'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Shield, 
  Brain, 
  Dumbbell, 
  Flame 
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'hq', label: 'HQ', path: '/dashboard', icon: Shield },
  { id: 'mind', label: 'Mind', path: '/mind', icon: Brain },
  { id: 'body', label: 'Body', path: '/body', icon: Dumbbell },
  { id: 'spirit', label: 'Spirit', path: '/spirit', icon: Flame },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-900 px-6 py-4 flex items-center justify-between z-[100] backdrop-blur-md bg-gray-950/90">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        
        return (
          <Link 
            key={item.id} 
            href={item.path}
            className={`flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-indigo-500 scale-110' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <Icon size={20} className={isActive ? 'shadow-[0_0_15px_rgba(79,70,229,0.3)]' : ''} />
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
