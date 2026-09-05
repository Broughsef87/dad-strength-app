Use `LedBar` for progress through a fixed, small count — sets in an exercise, days in a week.

```jsx
<LedBar total={4} lit={2} label="2 of 4 spent" />
```

Cells are 7px and never animate. Unlit cells are `--ds-line`, not a faded volt.
