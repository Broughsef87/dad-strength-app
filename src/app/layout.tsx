import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Space_Grotesk, Space_Mono } from 'next/font/google'
import './globals.css'
import PageTransition from '../components/PageTransition'
import { UserProvider } from '../contexts/UserContext'

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  variable: '--font-bebas',
  weight: ['400'],
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: 'Dad Strength',
  description: 'The Operating System for Modern Fatherhood.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dad Strength',
  },
}

export const viewport: Viewport = {
  themeColor: '#0D0F14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${spaceGrotesk.variable} ${spaceMono.variable} dark overflow-x-hidden`}>
      <body className={`${spaceGrotesk.className} overflow-x-hidden`}>
        <UserProvider>
          <PageTransition>{children}</PageTransition>
        </UserProvider>
      </body>
    </html>
  )
}
