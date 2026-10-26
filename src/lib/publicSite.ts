// The public site's pages: readable signed out, and never behind the app's
// legal acknowledgement (LegalGate). They render graphite whatever the
// visitor's theme (Andrew, 2026-10-17): the root layout's pre-paint script and
// ThemeProvider both read this list, so no two places disagree about which
// pages are public or which are dark.
export const PUBLIC_PATHS = ['/', '/programs', '/privacy', '/terms', '/disclaimer'];
export const GRAPHITE_PATHS = PUBLIC_PATHS;

// The share image for every public page. Next merges metadata shallowly, so a
// page that sets its own openGraph must restate the image; they all read it
// here. 1200x630 is what link previews crop to.
export const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Dad Strength — strength training for dads',
};
