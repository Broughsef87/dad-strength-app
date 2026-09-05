import React from "react";
import { Tile } from "../core/Tile.jsx";
import { Eyebrow } from "../core/Eyebrow.jsx";
import { RecessedRow } from "../core/RecessedRow.jsx";
import { DayPills } from "../progress/DayPills.jsx";
import { CategoryChip } from "./CategoryChip.jsx";

/**
 * WeekList — day pills over the week's sessions, including an "anytime" day.
 */
export function WeekList({ title = "the week", days = [], sessions = [], style, ...rest }) {
  return (
    <Tile style={{ gap: "var(--ds-space-4)", ...style }} {...rest}>
      <Eyebrow size="sm">{title}</Eyebrow>
      {days.length > 0 && <DayPills days={days} />}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-space-2)" }}>
        {sessions.map((s, i) => (
          <RecessedRow key={i}>
            <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>{s.name}</span>
              <Eyebrow size="sm">{s.when}</Eyebrow>
            </span>
            {s.axis && <CategoryChip axis={s.axis} />}
          </RecessedRow>
        ))}
      </div>
    </Tile>
  );
}
