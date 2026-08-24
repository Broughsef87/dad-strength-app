import withPWAInit from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  env: {
    // Build fingerprint for the boot sequence — lets the user verify which
    // build a (possibly stale) PWA install is actually running.
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
  },
};

// Sentry wraps the PWA-wrapped config. Source-map upload only runs when
// SENTRY_AUTH_TOKEN is present in the build env; without it the build is
// unchanged apart from SDK bundling.
export default withSentryConfig(withPWA(nextConfig), {
  org: "the-forge-agency",
  project: "dad-strength-app",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Proxy ingest through the app's own origin so ad-blockers don't eat events
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
