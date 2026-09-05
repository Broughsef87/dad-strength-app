// The one enumeration of the DS component sources, shared by the bundle builder
// and the design-system check, so the hash the builder stamps and the hash the
// check recomputes cannot drift apart.
import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

export const COMPONENT_GROUPS = ['core', 'progress', 'training']

/** `components/<group>/<Name>.jsx`, forward slashes, sorted within each group. */
export const componentSources = (ds) =>
  COMPONENT_GROUPS.flatMap((g) =>
    readdirSync(join(ds, 'components', g)).filter((f) => f.endsWith('.jsx')).sort().map((f) => 'components/' + g + '/' + f))

/** First 16 hex of sha256 over `path\ncontents` for every source, LF-normalised. */
export const sourcesDigest = (ds, files = componentSources(ds)) => {
  const h = createHash('sha256')
  for (const f of files) h.update(f + '\n' + readFileSync(join(ds, f), 'utf8').replace(/\r\n/g, '\n'))
  return h.digest('hex').slice(0, 16)
}
