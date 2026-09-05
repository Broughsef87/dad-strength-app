import React from "react";

/**
 * StatNum — the hero numeral. Tabular, tight, low leading.
 */
export function StatNum({ children, size = "lg", label, style, ...rest }) {
  const fontSize =
    size === "lg" ? "var(--ds-stat-num-size)" : size === "md" ? "var(--ds-stat-num-size-md)" : "var(--ds-stat-num-size-sm)";
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-2)" }} {...rest}>
      <span
        style={{
          fontFamily: "var(--ds-font-mono)",
          fontWeight: 600,
          fontSize,
          letterSpacing: "var(--ds-stat-num-tracking)",
          lineHeight: "var(--ds-stat-num-leading)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--ds-ink)",
          ...style,
        }}
      >
        {children}
      </span>
      {label && (
        <span
          style={{
            fontFamily: "var(--ds-font-mono)",
            fontSize: "var(--ds-eyebrow-size-sm)",
            letterSpacing: "var(--ds-eyebrow-tracking)",
            color: "var(--ds-concrete)",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
