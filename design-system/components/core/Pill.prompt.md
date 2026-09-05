Use `Pill` for every action. There is one volt pill per view at most — it is the earned action ("start session", "finish session", "continue").

```jsx
<Pill>start session</Pill>
<Pill variant="quiet">skip</Pill>
<Pill full>finish session</Pill>
```

Press darkens to `--ds-volt-fill-pressed` over 90ms. Labels are lowercase and direct. Never put a volt pill next to another volt pill.
