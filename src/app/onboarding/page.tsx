import { redirect } from 'next/navigation'

// Legacy onboarding flow (pre-Greek-god era). Retired in favor of /build.
// Keeping the route as a redirect so any stale links or bookmarks land
// users in the right place instead of re-offering Iron Path / Full Body.
export default function LegacyOnboardingRedirect() {
  redirect('/build')
}
