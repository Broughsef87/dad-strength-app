/* dad strength — the week. */
function WeekScreen({ days, sessions }) {
  const { WeekList, Tile, Eyebrow, LedBar, Pill } = window.__DS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      <WeekList days={days} sessions={sessions} />
      <Tile style={{ gap: 14 }}>
        <Eyebrow size="sm">block progress</Eyebrow>
        <LedBar total={6} lit={3} label="wk 3 of 6" />
        <div style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.65 }}>
          two more weeks, then a test week. keep the same sets and let the load move.
        </div>
        <Pill variant="quiet" full>see the block</Pill>
      </Tile>
    </div>
  );
}
window.WeekScreen = WeekScreen;
