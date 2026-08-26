import { redirect } from 'next/navigation'

// /mind held the Mind tab before the three-tab restructure. It is kept as a
// redirect for the same reason /body is: an INSTALLED PWA keeps the manifest
// it was installed with, so a home-screen "Morning Protocol" shortcut still
// launches /mind no matter what the current manifest says. Repointing the
// manifest fixes future installs; this catches everyone already on one.
export default function MindRedirect() {
  redirect('/dashboard?protocol=1')
}
