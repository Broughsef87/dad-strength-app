import React from "react";

/**
 * VoltSlab — the highlighter. Marks the prescribed load. 6px radius, tight padding.
 */
export function VoltSlab({ children, size = "md", style, ...rest }) {
  const fontSize = size === "lg" ? "var(--ds-stat-num-size-md)" : size === "sm" ? "22px" : "var(--ds-stat-num-size-sm)";
  return (
    <span
      style={{
        display: "inline-block",
        background: "var(--ds-volt-fill)",
        color: "var(--ds-on-volt)",
        borderRadius: "var(--ds-radius-slab)",
        padding: "2px 8px",
        fontFamily: "var(--ds-font-mono)",
        fontWeight: 600,
        fontSize,
        letterSpacing: "var(--ds-stat-num-tracking)",
        lineHeight: 1.05,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
