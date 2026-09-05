import React from "react";

/**
 * Eyebrow — quiet lowercase mono micro-label carrying metadata.
 */
export function Eyebrow({ children, size = "md", style, ...rest }) {
  return (
    <span
      style={{
        fontFamily: "var(--ds-font-mono)",
        fontSize: size === "sm" ? "var(--ds-eyebrow-size-sm)" : "var(--ds-eyebrow-size)",
        letterSpacing: size === "sm" ? "var(--ds-eyebrow-tracking-tight)" : "var(--ds-eyebrow-tracking)",
        color: "var(--ds-concrete)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
