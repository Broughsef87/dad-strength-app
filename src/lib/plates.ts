// Plate math, shared by the day page and the public site's sample session.

export const BAR = 45
const PLATE_SIZES = [45, 35, 25, 10, 5, 2.5]

// "45·25·5 /side" for a total barbell weight; null when it's not plate-able.
export function plateString(total: number | null | undefined): string | null {
  if (total == null || total < BAR) return null
  if (total <= BAR + 2.5) return 'empty bar'
  let side = (total - BAR) / 2
  const out: string[] = []
  for (const p of PLATE_SIZES) {
    while (side >= p - 0.01) { out.push(p === 2.5 ? '2.5' : String(p)); side -= p }
  }
  if (!out.length) return 'empty bar'
  return `${out.join('·')} /side${side > 0.01 ? ' +' : ''}`
}
