Use `VoltSlab` for the prescribed load, and for nothing else. It is the one place full-chroma volt appears as a highlight on the light theme.

```jsx
<VoltSlab>185</VoltSlab>
```

Its 6px radius is deliberate: every control in the system is a 999px pill, so a squared slab cannot be mistaken for a button. Do not put a slab on a label, a date, or a percentage — only the load.
