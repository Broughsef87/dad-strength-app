// The public site's pages. They render graphite whatever the visitor's theme
// (Andrew, 2026-10-17): the root layout's pre-paint script and ThemeProvider
// both read this list, so the two cannot disagree about which pages are dark.
export const GRAPHITE_PATHS = ['/', '/programs'];
