import withPWAInit from "next-pwa";

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

export default withPWA(nextConfig);
