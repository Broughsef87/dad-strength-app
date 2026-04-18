import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, Space_Grotesk, Space_Mono, Playfair_Display } from 'next/font/google'
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

// Editorial serif italic — used only inside <HeroAccent> for
// gravitas moments (hero headlines, week themes, empty states).
// Matches the forging-fathers.com marketing voice.
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
  themeColor: '#0D0F14',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${spaceGrotesk.variable} ${spaceMono.variable} ${playfair.variable} overflow-x-hidden`}>
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
      <body className={`${spaceGrotesk.className} overflow-x-hidden`}>
        {/* ── Kinetic ambient — drifting forge glow, dark mode only ── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          {/* Primary orb — large, slow, amber warmth */}
          <div style={{
            position: 'absolute',
            width: '750px',
            height: '750px',
            top: '5%',
            left: '50%',
            marginLeft: '-375px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,130,10,0.09) 0%, transparent 65%)',
            filter: 'blur(60px)',
            animation: 'orb-drift 32s ease-in-out infinite',
            opacity: 0,
          }} className="dark:!opacity-100" />
          {/* Secondary orb — lower, gold-steel tint */}
          <div style={{
            position: 'absolute',
            width: '420px',
            height: '420px',
            top: '55%',
            left: '30%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(160,110,8,0.07) 0%, transparent 65%)',
            filter: 'blur(70px)',
            animation: 'orb-drift-2 26s ease-in-out infinite',
            animationDelay: '8s',
            opacity: 0,
          }} className="dark:!opacity-100" />

          {/* Edge vignettes — pull focus inward */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: '200px',
            background: 'linear-gradient(to right, rgba(0,0,0,0.50) 0%, transparent 100%)',
            opacity: 0,
          }} className="dark:!opacity-100" />
          <div style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: '200px',
            background: 'linear-gradient(to left, rgba(0,0,0,0.50) 0%, transparent 100%)',
            opacity: 0,
          }} className="dark:!opacity-100" />
        </div>

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
