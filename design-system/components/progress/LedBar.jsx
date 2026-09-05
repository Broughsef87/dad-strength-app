import React from "react";

/**
 * LedBar — 7px cells, volt when lit.
 */
export function LedBar({ total = 4, lit = 0, label, style, ...rest }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-space-2)", ...style }} {...rest}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: "var(--ds-cell-width)",
            height: "var(--ds-cell-height)",
            borderRadius: "var(--ds-radius-cell)",
            background: i < lit ? "var(--ds-volt-fill)" : "var(--ds-line)",
          }}
        />
      ))}
      {label && (
        <span
          style={{
            fontFamily: "var(--ds-font-mono)",
            fontSize: "var(--ds-eyebrow-size-sm)",
            letterSpacing: "var(--ds-eyebrow-tracking-tight)",
            color: "var(--ds-concrete)",
            marginLeft: "var(--ds-space-2)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
