import React from "react";

/**
 * StatusMessage — good or danger. Fill/ink pairs, never a single token.
 */
export function StatusMessage({ tone = "good", children, style, ...rest }) {
  const good = tone === "good";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--ds-space-4)",
        background: good ? "var(--ds-brand-muted)" : "var(--ds-recessed)",
        borderRadius: "var(--ds-radius-row)",
        padding: "12px 14px",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          width: "var(--ds-dot-size)",
          height: "var(--ds-dot-size)",
          borderRadius: "50%",
          background: good ? "var(--ds-good-fill)" : "var(--ds-danger-fill)",
          marginTop: "6px",
          flex: "none",
        }}
      />
      <span
        style={{
          fontFamily: "var(--ds-font-sans)",
          fontSize: "var(--ds-body-sm-size)",
          lineHeight: "1.6",
          color: good ? "var(--ds-good-ink)" : "var(--ds-danger-ink)",
        }}
      >
        {children}
      </span>
    </div>
  );
}
