---
name: dad-strength-design
description: Design inside Dad Strength's chalk / volt system — tokens, type roles, kit classes, the eight rules and what is prohibited. Use for any UI, screen, component or visual artifact for the app.
user-invocable: true
---

The system is vendored at `design-system/` (a copy of the Claude Design project
"dad strength — chalk / volt"). Read, in this order:

1. `design-system/readme.md` — the design guide: grounds, volt, status pairs,
   the six category axes, type roles, shape, motion, voice, the rules sheet and
   the prohibited list. Every value in it is fixed.
2. `design-system/IMPLEMENTATION.md` — how the DS maps onto this codebase:
   which `globals.css` token and which kit class implements each DS token and
   component, the decisions taken where the two differed, and what is still open.
3. `design-system/tokens/*.css` and `design-system/components/**/*.jsx` when you
   need an exact value or a component's anatomy.

Working in production code: use the app's own tokens and kit classes
(`bg-brand`, `text-brand-ink`, `.tile`, `.stat-num`, `.eyebrow-mono`,
`.slab-volt`, `.chip-live`, `.led-bar`…) — never the `--ds-*` names, which exist
only inside `design-system/`. `npm run check` runs `scripts/checks/design-system.mjs`,
which measures `globals.css` against the DS and bans what the DS prohibits.

Making a visual artifact (a mock, a slide, a throwaway prototype): link
`design-system/styles.css` and build from the `--ds-*` tokens and the components
in `design-system/components/`; `design-system/ui_kits/app/index.html` is the
click-through reference.

If invoked with no other instruction, ask what is being built, then act as the
system's designer — lowercase voice, one volt per screen, numerals as heroes.
