import * as React from 'react'

/**
 * Stamp — the verdict ink.
 *
 * Grease-red stencil, rotated, multiplied into the paper. Reserved for
 * VERDICTS: session complete, and progression calls like ADD LOAD. Never for
 * labels, never for decoration, and never more than TWO on a screen. That cap
 * is the whole reason a stamp reads as a verdict — a mark that appears
 * everywhere is just a colour.
 *
 * Motion: one 200ms scale-settle on entrance and nothing else. Under
 * prefers-reduced-motion it renders in its final state with no animation at
 * all — not a shortened one.
 */

export interface StampProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  /** 'lg' is the corner verdict; 'sm' sits inline after a value. */
  size?: 'lg' | 'sm'
  /** Absolute-position into a relatively-positioned parent's top-right. */
  corner?: boolean
}

export function Stamp({
  children,
  size = 'lg',
  corner = false,
  className = '',
  ...rest
}: StampProps) {
  const base =
    'ds-stamp inline-block border-[hsl(var(--ink-stamped))] text-[hsl(var(--ink-stamped))] ' +
    'uppercase select-none pointer-events-none'

  const scale =
    size === 'lg'
      ? 'border-[3px] rounded-[6px] px-[14px] py-[2px] text-[22px]'
      : 'border-2 rounded-[4px] px-2 py-[1px] text-[13px] ml-2'

  const place = corner ? 'absolute right-4 top-4 z-[3]' : ''

  return (
    <span
      className={`${base} ${scale} ${place} ${className}`}
      data-stamp-size={size}
      {...rest}
    >
      {children}
    </span>
  )
}

export default Stamp
