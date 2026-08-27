import type { Metadata, Viewport } from 'next'
import { Oswald, Courier_Prime, Kalam, Saira_Stencil_One, Playfair_Display } from 'next/font/google'
import './globals.css'
import PageTransition from '../components/PageTransition'
import LegalGate from '../components/LegalGate'
import { Analytics } from '@vercel/analytics/next'
import { UserProvider } from '../contexts/UserContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'

// THE PROGRAM CARD type (FOR-186). Four faces, and each one is a voice rather
// than a decoration — see the note at the top of globals.css.
//
// The variable names are the OLD ones on purpose. Every component already
// references --font-space-grotesk / --font-geist-mono through the @theme
// aliases, so repointing here turns the type over app-wide without editing a
// single component. They get renamed when the branch is merged, not tonight.

// CHROME. Labels, headings, tab names, the card masthead. Condensed and
// mechanical, the way a form's printed furniture is set.
const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600'],
})

// PRINTED — the engine's voice, and the app's body face. This app is mostly
// numbers and short labels inside cards, and inside a card the body text IS
// the printed prescription, so the typewriter face is the default rather than
// an accent. It is also a true monospace, which is what makes the columns of
// sets and loads line up.
const courierPrime = Courier_Prime({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
})

// WRITTEN — the athlete's hand. Logged loads, reps, RPE, ticked boxes.
// Never used for anything the engine decided.
const kalam = Kalam({
  subsets: ['latin'],
  variable: '--font-hand-face',
  weight: ['400', '700'],
})

// STAMPED — verdicts only, max two per screen. One weight exists and that is
// the whole family; a stamp does not have options.
const sairaStencil = Saira_Stencil_One({
  subsets: ['latin'],
  variable: '--font-stamp-face',
  weight: ['400'],
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
      { url: '/logo-suite/ds_favicon.svg', type: 'image/svg+xml' },
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
    { media: '(prefers-color-scheme: light)', color: '#F0EDE6' },
    { media: '(prefers-color-scheme: dark)', color: '#141310' },
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
    <html lang="en" suppressHydrationWarning className={`${oswald.variable} ${courierPrime.variable} ${kalam.variable} ${sairaStencil.variable} ${playfair.variable} overflow-x-hidden`}>
      <head>
        {/* SVG first: browsers that support it get the regenerated paper mark.
            The .ico is a legacy fallback and is still the volt-era raster —
            see the note in the commit; rasterising it is a manual step. */}
        <link rel="icon" href="/logo-suite/ds_favicon.svg" type="image/svg+xml" />
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
