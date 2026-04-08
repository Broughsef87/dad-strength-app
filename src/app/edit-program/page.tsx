// Legacy route — redirects to the canonical program builder.
// Kept as a redirect (not deleted) so any bookmarked /edit-program URLs
// still resolve without a 404.
import { redirect } from 'next/navigation'

export default function EditProgram() {
  redirect('/build')
}
