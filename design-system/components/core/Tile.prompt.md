Use `Tile` for any raised surface — a session card, a week list, the sign-in card. It is the only surface primitive; do not add borders to it.

```jsx
<Tile size="lg">
  <Eyebrow>wk 3 · day 2</Eyebrow>
  <StatNum>185</StatNum>
</Tile>
```

`size="lg"` (24px radius, 28px padding) is for a page's primary card — the sign-in card, the active session. Everything else is `md`. Tiles carry `--ds-shadow-tile`, which flips automatically under `[data-theme="graphite"]`.
