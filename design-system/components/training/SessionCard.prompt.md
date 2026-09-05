Use `SessionCard` as the primary surface of a training day. It is the canonical assembly of the system: numeral leads, slab marks the load, mono carries metadata.

```jsx
<SessionCard
  name="back squat"
  load="185"
  meta="lb @ 65% · 4×5 · tgt rpe 7"
  sets={[{label:"set 1",value:"5 reps · rpe 6"},{label:"set 2",value:"5 reps · rpe 7"},{label:"set 3"}]}
  lit={2}
/>
```

One card per exercise. The finish pill is the only volt control on the screen.
