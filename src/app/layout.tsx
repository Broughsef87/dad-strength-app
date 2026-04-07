import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Space_Grotesk, Space_Mono } from 'next/font/google'
import './globals.css'
import PageTransition from '../components/PageTransition'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'

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
  icons: {
    icon: '/logo-suite/ds_app_icon.svg',
    apple: '/logo-suite/ds_app_icon.png',
    shortcut: '/logo-suite/ds_app_icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dad Strength',
    startupImage: '/logo-suite/ds_app_icon.png',
  },
  openGraph: {
    title: 'Dad Strength',
    description: 'The Operating System for Modern Fatherhood.',
    type: 'website',
    url: 'https://dad-strength-app-rnz1.vercel.app',
    siteName: 'Dad Strength',
    images: [
      {
        url: 'https://dad-strength-app-rnz1.vercel.app/logo-suite/ds_banner_dark.png',
        width: 1500,
        height: 500,
        alt: 'Dad Strength — The OS for Modern Fatherhood',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad Strength',
    description: 'The Operating System for Modern Fatherhood.',
    images: ['https://dad-strength-app-rnz1.vercel.app/logo-suite/ds_banner_dark.png'],
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
    <html lang="en" className={`${bebasNeue.variable} ${spaceGrotesk.variable} ${spaceMono.variable} overflow-x-hidden`}>
      <head>
        {/* FOUC prevention: apply theme class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{
              var t=localStorage.getItem('dad-strength-theme');
              var dark=t==='dark'||((!t||t==='auto')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
              if(dark)document.documentElement.classList.add('dark');
            }catch(e){}
          })();
        `}} />
      </head>
      <body className={`${spaceGrotesk.className} overflow-x-hidden`}>
        <ThemeProvider>
          <UserProvider>
            <SubscriptionProvider>
              <PageTransition>{children}</PageTransition>
            </SubscriptionProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
