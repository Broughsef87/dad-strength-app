'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

// motion confirms, never performs: one quick fade + rise per screen
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
