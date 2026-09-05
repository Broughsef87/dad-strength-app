import React from "react";

/**
 * AmmoCells — a spent cell is a completed set.
 */
export function AmmoCells({ total = 5, spent = 0, style, ...rest }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-space-1)", ...style }} {...rest}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: "10px",
            height: "18px",
            borderRadius: "var(--ds-radius-cell)",
            background: i < spent ? "var(--ds-volt-fill)" : "var(--ds-line)",
          }}
        />
      ))}
    </div>
  );
}
