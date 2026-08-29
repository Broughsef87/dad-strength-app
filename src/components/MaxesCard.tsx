'use client'

import { useEffect, useState } from 'react'

/**
 * The editor for your training maxes.
 *
 * It used to live inside the session runner, rendered only during test week or
 * when a max was missing — so once your numbers were filled in it disappeared
 * and there was no way to change them again. That was invisible on Power Dad,
 * which asks for seven maxes (snatch, clean & jerk, front squat…) so one is
 * usually blank and the card keeps reappearing. On Dad Built there are four,
 * you finish them, and the door closes behind you.
 *
 * Shared now, so the program hub can offer it permanently while the session
 * runner keeps showing it in context.
 */
export default function MaxesCard({
  maxDefs,
  current,
  onSave,
  title = 'Update Your Maxes',
  subtitle = 'New numbers drive next macro’s percentages.',
}: {
  maxDefs: Array<{ key: string; label: string; unit?: string }>
  current: Record<string, number>
  onSave: (vals: Record<string, number>) => Promise<void>
  title?: string
  subtitle?: string
}) {
  const asText = (c: Record<string, number>) =>
    Object.fromEntries(maxDefs.map((d) => [d.key, c[d.key] ? String(c[d.key]) : '']))

  const [vals, setVals] = useState<Record<string, string>>(() => asText(current))
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Re-sync when the stored maxes change under us — the hub loads them async,
  // so the first render can happen before they arrive.
  const stamp = maxDefs.map((d) => current[d.key] ?? '').join('|')
  useEffect(() => {
    setVals(asText(current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp])

  const dirty = maxDefs.some((d) => (vals[d.key] ?? '') !== (current[d.key] ? String(current[d.key]) : ''))

  return (
    <div className="tile p-4 space-y-3 border border-brand/30">
      <p className="text-[10px] font-bold lowercase text-brand-text">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>

      {maxDefs.map((d) => (
        <div key={d.key} className="flex items-center gap-3">
          <span className="text-xs text-foreground w-32">{d.label}</span>
          <input
            type="number"
            inputMode="decimal"
            value={vals[d.key] ?? ''}
            onChange={(e) => {
              setVals((v) => ({ ...v, [d.key]: e.target.value }))
              setSaved(false)
            }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">{d.unit ?? 'lbs'}</span>
        </div>
      ))}

      <button
        onClick={async () => {
          setBusy(true)
          const out: Record<string, number> = {}
          for (const [k, v] of Object.entries(vals)) {
            const n = parseFloat(v)
            if (Number.isFinite(n) && n > 0) out[k] = n
          }
          await onSave(out)
          setBusy(false)
          setSaved(true)
        }}
        // `saved` resets the moment a field changes, because this is now a place
        // you come back to. A permanent editor stuck on "Saved ✓" reads broken.
        disabled={busy || (!dirty && saved)}
        className="w-full py-2.5 bg-brand text-brand-ink rounded-lg text-xs font-medium lowercase hover:bg-brand-deep transition-colors disabled:opacity-60"
      >
        {busy ? 'Saving…' : saved && !dirty ? 'Saved ✓' : 'Save Maxes'}
      </button>
    </div>
  )
}
