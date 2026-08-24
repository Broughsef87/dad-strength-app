import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Geist_Mono, Space_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'
import PageTransition from '../components/PageTransition'
import LegalGate from '../components/LegalGate'
import { Analytics } from '@vercel/analytics/next'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'

// CHALK/VOLT type: one confident grotesk carries the whole app —
// display, body, and the giant hero numerals.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

// The quiet mono for data: percentages, rep schemes, timers, week tags.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '600', '700'],
})

// Fallback mono kept while legacy components migrate off --font-space-mono.
const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  weight: ['400', '700'],
})

// Editorial serif italic — marketing-voice accents only (<HeroAccent>).
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700'],
  style: ['italic'],
})

export const metadata: Metadata = {
  title: 'Dad Strength',
  description: 'The Operating System for Modern Fatherhood.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/logo-suite/ds_app_icon.png', type: 'image/png', sizes: '1024x1024' },
    ],
    apple: '/logo-suite/ds_app_icon.png',
    shortcut: '/favicon.ico',
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF9F6' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0F10' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: the FOUC script below adds .dark to <html>
    // before React hydrates — without this, every load logs a class mismatch.
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${geistMono.variable} ${spaceMono.variable} ${playfair.variable} overflow-x-hidden`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo-suite/ds_app_icon.png" type="image/png" sizes="1024x1024" />
        <link rel="apple-touch-icon" href="/logo-suite/ds_app_icon.png" />
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
      {/* Chalk/volt grounds are flat — no ambient orbs, no vignettes, no
          chrome layer. The body face comes from --font-sans in globals. */}
      <body className="overflow-x-hidden">
        <ThemeProvider>
          <UserProvider>
            <SubscriptionProvider>
              <PageTransition>{children}</PageTransition>
              {/* First-run fitness/medical acknowledgement — blocks the
                  authed app until accepted once (per account, not device). */}
              <LegalGate />
              <Analytics />
            </SubscriptionProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
