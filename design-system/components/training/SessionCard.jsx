import React from "react";
import { Tile } from "../core/Tile.jsx";
import { Eyebrow } from "../core/Eyebrow.jsx";
import { VoltSlab } from "../core/VoltSlab.jsx";
import { RecessedRow } from "../core/RecessedRow.jsx";
import { Pill } from "../core/Pill.jsx";
import { LedBar } from "../progress/LedBar.jsx";

/**
 * SessionCard — name · slab · eyebrow metadata · set rows · finish pill.
 */
export function SessionCard({ name, load, meta, sets = [], lit = 0, action = "finish session", onAction, style, ...rest }) {
  return (
    <Tile style={{ gap: "var(--ds-space-6)", ...style }} {...rest}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--ds-space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-3)" }}>
          <span style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>{name}</span>
          {meta && <Eyebrow>{meta}</Eyebrow>}
        </div>
        {load != null && <VoltSlab style={{ flex: "none" }}>{load}</VoltSlab>}
      </div>

      {sets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-2)" }}>
          {sets.map((s, i) => (
            <RecessedRow
              key={i}
              style={{ padding: "11px 14px" }}
              muted={!s.value}
              label={<Eyebrow size="sm" style={{ letterSpacing: "0" }}>{s.label}</Eyebrow>}
              value={s.value ?? "—"}
            />
          ))}
        </div>
      )}

      {sets.length > 0 && <LedBar total={sets.length} lit={lit} label={`${lit} of ${sets.length} spent`} />}

      <Pill full onClick={onAction}>{action}</Pill>
    </Tile>
  );
}
