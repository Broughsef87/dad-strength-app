// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE WIRED — the auth middleware is a file Next actually builds.
//
// middleware.ts sat at the repo root while the app lives in src/app. Next
// only compiles middleware beside the app directory, so the root file was
// never built: .next/server/middleware-manifest.json was `"middleware": {}`,
// no page was protected server-side, and the Google ?signin=oauth handoff in
// the file was dead. Every check that READ the file (fuel-solve's protected
// path assertion among them) passed the whole time.
//
// So this reads what the build produced, not the source. Two parts:
//   1. placement: a middleware/proxy file exists beside src/app and none at
//      the root, where it would be silently ignored;
//   2. the build: when a .next build newer than the file exists, its manifest
//      must register middleware. (`npm run build` first for part 2 to bite.)
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const names = ['middleware.ts', 'middleware.js', 'proxy.ts', 'proxy.js']
const inSrc = names.map((n) => join(ROOT, 'src', n)).filter(existsSync)
const atRoot = names.map((n) => join(ROOT, n)).filter(existsSync)
const fails = []

if (!existsSync(join(ROOT, 'src/app'))) fails.push('expected the app under src/app — re-check where middleware must live')
if (inSrc.length !== 1) fails.push(`expected exactly one middleware/proxy file in src/, found ${inSrc.length}`)
if (atRoot.length) fails.push(`middleware at the repo root is ignored while the app is under src/: ${atRoot.join(', ')}`)

const manifest = join(ROOT, '.next/server/middleware-manifest.json')
let built = 'no build present — placement checked only'
if (inSrc.length === 1 && existsSync(manifest) && statSync(manifest).mtimeMs >= statSync(inSrc[0]).mtimeMs) {
  const m = JSON.parse(readFileSync(manifest, 'utf8'))
  const n = Object.keys(m.middleware ?? {}).length + Object.keys(m.functions ?? {}).length
  built = `build registers ${n} middleware entr${n === 1 ? 'y' : 'ies'}`
  if (n === 0) fails.push('the build\'s middleware manifest is empty: the middleware is not running')
}

if (fails.length) {
  console.log('  ✗ middleware wired:')
  for (const f of fails) console.log('    - ' + f)
  process.exit(1)
}
console.log(`  ✓ middleware wired: src/${inSrc[0].split(/[\\/]/).pop()} beside src/app; ${built}`)
