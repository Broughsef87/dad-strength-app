import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Orbitron } from 'next/font/google'
import './globals.css'
import PageTransition from '../components/PageTransition'
import { UserProvider } from '../contexts/UserContext'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500'],
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  weight: ['700', '900'],
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
  themeColor: '#E8572A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${orbitron.variable} dark overflow-x-hidden`}>
      <body className={`${geist.className} overflow-x-hidden`}>
        <UserProvider>
          <PageTransition>{children}</PageTransition>
        </UserProvider>
      </body>
    </html>
  )
}
