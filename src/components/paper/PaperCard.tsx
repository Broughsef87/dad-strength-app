import * as React from 'react'

/**
 * PaperCard — the card chrome.
 *
 * A printed training card: paper ground, hairline rule, a masthead separated by
 * a heavy 2.5px rule, and an optional meta strip under it. Replaces the tile
 * look from chalk/volt, which separated cards by shadow. Paper does not cast a
 * shadow onto more paper; it has an edge.
 *
 * The grain lives on .tile in globals.css, so this composes with it rather than
 * duplicating the texture — one definition, one place to change it.
 */

export interface PaperCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Masthead, left. Set in Oswald, tracked out, uppercased by CSS. */
  title?: React.ReactNode
  /** Masthead, right — a card number, week tag, date. Quiet.
      Deliberately NOT called `stamp`: this is a printed label, and <Stamp>
      carries rules (red, rotated, max two per screen) that this must not
      inherit by association. */
  aside?: React.ReactNode
  /** Meta strip under the masthead: label/value pairs, printed small. */
  meta?: Array<{ label: string; value: React.ReactNode }>
  /** Drop the outer padding when a child needs to reach the edge (tables). */
  flush?: boolean
}

export function PaperCard({
  title,
  aside,
  meta,
  flush = false,
  className = '',
  children,
  ...rest
}: PaperCardProps) {
  const hasHead = title != null || aside != null

  return (
    <div className={`tile ${flush ? '' : 'p-[18px]'} ${className}`} {...rest}>
      {hasHead && (
        <div className="flex items-baseline justify-between border-b-[2.5px] border-[hsl(var(--foreground))] pb-2">
          {title != null && (
            <span className="font-display text-[15px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground))]">
              {title}
            </span>
          )}
          {aside != null && (
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{aside}</span>
          )}
        </div>
      )}

      {meta && meta.length > 0 && (
        <div className="flex flex-wrap gap-x-[18px] gap-y-1 border-b border-[hsl(var(--border))] pt-2 pb-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          {meta.map((m) => (
            <span key={m.label}>
              {m.label}{' '}
              <b className="font-normal text-[hsl(var(--foreground))]">{m.value}</b>
            </span>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}

export default PaperCard
