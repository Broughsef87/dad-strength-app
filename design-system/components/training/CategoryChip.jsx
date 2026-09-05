import React from "react";

const AXES = ["push", "pull", "legs", "core", "condition", "general"];

/**
 * CategoryChip — one of six axes. Its own ink on its own 10% tint.
 */
export function CategoryChip({ axis = "general", children, style, ...rest }) {
  const a = AXES.includes(axis) ? axis : "general";
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "var(--ds-radius-control)",
        background: `var(--ds-cat-${a}-tint)`,
        color: `var(--ds-cat-${a}-ink)`,
        fontFamily: "var(--ds-font-sans)",
        fontSize: "12px",
        fontWeight: 500,
        ...style,
      }}
      {...rest}
    >
      {children ?? a}
    </span>
  );
}

export const CATEGORY_AXES = AXES;
