'use client'
import { motion, Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: i * 0.07 }
  })
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }
  }
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }
  })
}

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  }
}

export { motion }
