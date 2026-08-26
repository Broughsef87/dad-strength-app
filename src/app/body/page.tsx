import { redirect } from 'next/navigation'

// The Train hub lived at /body through the four-pillar era. Kept as a redirect
// so existing bookmarks and any installed PWA shortcut land on the real route
// instead of 404ing — same convention as /exercises and /edit-program.
export default function BodyRedirect() {
  redirect('/train')
}
