Use `RecessedRow` for set rows, week rows, and form fields — anything listed inside a `Tile`.

```jsx
<RecessedRow label="set 1" value="5 reps · rpe 6" />
<RecessedRow label="set 3" value="—" muted />
```

Prose goes in `label`, engine-printed values in `value`. `muted` swaps the value to concrete — never dim an ink with opacity.
