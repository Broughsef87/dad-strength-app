/* dad strength — today. the live session. */
function TodayScreen({ session, onFinish, finished }) {
  const { Tile, Eyebrow, ChipLive, StatNum, SessionCard, StatusMessage, CategoryChip } = window.__DS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      <Tile style={{ gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Eyebrow>wk 3 · day 2</Eyebrow>
          {finished ? <CategoryChip axis="legs">logged</CategoryChip> : <ChipLive size="sm">live</ChipLive>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <StatNum size="md" label="lb · working max">225</StatNum>
          <StatNum size="sm" label="day streak">14</StatNum>
        </div>
      </Tile>

      {finished && <StatusMessage>morning done. next week adds five pounds to the squat.</StatusMessage>}

      <SessionCard
        name={session.name}
        load={session.load}
        meta={session.meta}
        sets={session.sets}
        lit={finished ? session.sets.length : 2}
        action={finished ? "session logged" : "finish session"}
        onAction={onFinish}
      />
    </div>
  );
}
window.TodayScreen = TodayScreen;
