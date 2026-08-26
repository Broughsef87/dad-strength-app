import { redirect } from 'next/navigation'

// /spirit was a bottom-nav destination for the whole four-pillar era, so it is
// in browser history, bookmarks and any link ever shared. Same migration shim
// as /body and /mind. It carried MorningProtocol, so it lands on the protocol
// rather than merely somewhere valid.
export default function SpiritRedirect() {
  redirect('/dashboard?protocol=1')
}
