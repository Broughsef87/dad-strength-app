// ── One JSON value, one text — whatever order its keys arrived in ────────────
// Postgres jsonb reorders object keys, so a value read back from a row never
// compares equal by string to the same value built fresh. Every level is sorted,
// not just the top (a replacer array would drop nested keys). A key whose value
// is undefined is omitted, as JSON omits it: a value read back from jsonb must
// compare equal to one built fresh (Codex, FOR-177 round 12).
//
// Defined ONCE. It was written twice — the Fuel snapshot key and the session
// plan — byte-identical, and a third caller (FOR-231) is where two copies start
// to drift.
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

/** The same JSON value, whatever order its keys arrived in. */
export function sameJson(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}
