'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import ProgramSelector from '../../components/ProgramSelector'

// The old edit-program page (upper/lower/full/cond focus) has been replaced
// by the full ProgramSelector flow (Dad Strong, Hybrid, The Squeeze, etc.)

export default function EditProgram() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProgramSelector
        isOpen={open}
        onClose={() => {
          setOpen(false)
          router.push('/dashboard')
        }}
        onProgramSelected={() => {
          setOpen(false)
          router.push('/dashboard')
        }}
      />
      <BottomNav />
    </div>
  )
}
