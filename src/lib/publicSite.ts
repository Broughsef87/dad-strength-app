// The public site's pages: readable signed out, and never behind the app's
// legal acknowledgement (LegalGate). They render graphite whatever the
// visitor's theme (Andrew, 2026-10-17): the root layout's pre-paint script and
// ThemeProvider both read this list, so no two places disagree about which
// pages are public or which are dark.
export const PUBLIC_PATHS = ['/', '/programs', '/privacy', '/terms', '/disclaimer'];
export const GRAPHITE_PATHS = PUBLIC_PATHS;
