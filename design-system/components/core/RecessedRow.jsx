import React from "react";

/**
 * RecessedRow — a row that sits below the tile surface. Separated by fill, not a line.
 */
export function RecessedRow({ label, value, muted = false, style, children, ...rest }) {
  return (
    <div
      style={{
        background: "var(--ds-recessed)",
        borderRadius: "var(--ds-radius-row)",
        padding: "var(--ds-row-padding-y) var(--ds-row-padding-x)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--ds-space-5)",
        fontFamily: "var(--ds-font-sans)",
        color: "var(--ds-ink)",
        ...style,
      }}
      {...rest}
    >
      {children ?? (
        <>
          <span style={{ fontSize: "14px", fontWeight: 500 }}>{label}</span>
          <span
            style={{
              fontFamily: "var(--ds-font-mono)",
              fontSize: "var(--ds-data-size-sm)",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: muted ? "var(--ds-concrete)" : "var(--ds-ink)",
            }}
          >
            {value}
          </span>
        </>
      )}
    </div>
  );
}
