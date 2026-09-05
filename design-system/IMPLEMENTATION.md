# chalk / volt — how the app implements it

`readme.md` is the specification. It is a vendored copy of the Claude Design
project [dad strength — chalk / volt](https://claude.ai/design/p/13147fbf-fce1-497b-a791-eb3f029a64ce)
and is not edited here — a change to the system starts in Claude Design, is
re-vendored into this directory, and then lands in the code. This file is the
other half: which token, class or utility in `src/` carries each thing the DS
names, the decisions taken where the app and the DS differed, and what is still
open.

`scripts/checks/design-system.mjs` (in `npm run checks`) measures the two
against each other — every colour in both themes, the radii, the cells, the
curves and durations, the type roles — and bans what the DS prohibits. When it
fails, the DS is right.

## Where things live

| DS | app | notes |
|---|---|---|
| `tokens/colors.css` | `src/app/globals.css` `:root` / `.dark` | hsl triplets, consumed through Tailwind's `@theme` as `bg-*` / `text-*` utilities |
| `tokens/shape.css`, `elevation.css`, `motion.css`, `typography.css` | `globals.css` `@theme` + `:root` + the kit | see the tables below |
| `tokens/spacing.css` | Tailwind's default scale | every DS step is on the 4px grid (see Spacing) |
| `components/**/*.jsx` | kit classes in `globals.css` | the app is not React-inline-styled; each component has a class |
| `assets/*.svg` | `src/components/Logo.tsx`, `scripts/generate-logo-suite.mjs` | see Brand marks |
| `ui_kits/app/index.html` | the app itself | the DS's click-through recreation; open it in a browser as the visual reference |
| `guidelines/*.html` | — | specimen cards; reference only |
| `Dad Strength Design System.dc.html` + `support.js` | — | the spec sheet as a canvas; open the html in a browser |

## Themes

The DS switches themes with `[data-theme="graphite"]`. The app switches with
`.dark` on `<html>` (`src/contexts/ThemeContext.tsx`), and the whole check suite
keys on that selector, so `.dark` **is** graphite here. Do not add a
`data-theme` selector alongside it — `contrast.mjs` parses the `.dark` block by
name.

## Colour

DS semantic name → app token. The app's names predate the DS and stay, because
240+ call sites read them; what the check pins is the value, both themes, ±2 rgb.

| DS | app token | utilities |
|---|---|---|
| `--ds-background` | `--background` | `bg-background` |
| `--ds-tile` | `--card` / `--surface-3` | `bg-card`, `.tile` |
| `--ds-recessed` | `--surface-2` | `bg-surface-2`, `.row-recessed`, `.pill-quiet` |
| `--ds-line` | `--muted` / `--border` | `bg-muted`, `border-border` |
| `--ds-ink` | `--foreground` | `text-foreground` |
| `--ds-concrete` | `--muted-foreground` | `text-muted-foreground` |
| `--ds-volt-fill` | `--brand` | `bg-brand` (a **fill**) |
| `--ds-volt-fill-pressed` | `--brand-deep` | `.pill-volt:active`, `focus-visible` outline |
| `--ds-on-volt` | `--brand-ink` | `text-brand-ink` — the only ink on a volt fill |
| `--ds-brand-text` | `--brand-text` | `text-brand` **remaps here** (`globals.css`, last block) |
| `--ds-brand-muted` | `--brand-muted` | `.chip-live`, `.status-msg.good` |
| `--ds-good-fill` / `-ink` | `--status-good-fill` / `-ink` | `bg-status-good-fill`, `text-status-good-ink` |
| `--ds-danger-fill` / `-ink` | `--status-danger-fill` / `-ink` | `bg-status-danger-fill`, `text-status-danger-ink` |
| `--ds-on-danger-fill` | `--destructive-foreground` | 98% white; the DS says `#FFFFFF`. 6.7:1 either way |
| `--ds-cat-<axis>-ink` | `--category-<axis>` | `text-category-<axis>` |
| `--ds-cat-<axis>-tint` | *(composited)* | `bg-category-<axis>/10` — the same 10% tint, computed rather than stored |

**Volt is a fill.** `text-brand`, `fill-brand` and `stroke-brand` resolve to
`--brand-text` everywhere (olive on chalk, volt itself on graphite), and flip to
`--brand-ink` inside `.bg-brand` and `.pill-volt`. Never set volt as a text
colour directly. On a solid `bg-brand`, the ink is `text-brand-ink` — the check
fails a `text-foreground` sitting there (near-white on volt, 1.02:1 in graphite).

**Category.** The DS's six hues replaced the app's earlier six on 2026-09-04
(the DS flagged them "derived, for review"; they measure 5.4–7.2:1 on their own
tints across both themes and are now the system's). Six axes, closed:
`contrast.mjs` fails a seventh.

**No warning colour.** Still none. Anything that is not fine or broken is prose
or low-emphasis danger.

## Type

Two families, loaded in `src/app/layout.tsx` with `next/font`: Space Grotesk
300–700 (`--font-sans`, `--font-display`) and Geist Mono 400/500/600/700
(`--font-mono`, Space Mono as fallback). There is no serif.

| DS role | app | spec |
|---|---|---|
| `stat-num` | `.stat-num` | **Geist Mono 600**, tabular, `-0.045em`, `0.92`. Size from the call site — the DS scale is 72 / 44 / 30px (`text-[72px]`, `text-[44px]`, `text-3xl`) |
| `display` | `h1`–`h3` base styles, `.font-display` | Space Grotesk; h1 700 at `-0.045em`, h2 600 at `-0.03em`, h3 600 at `-0.02em`. Lowercase is applied by components, never forced |
| `body` | `body` | Space Grotesk **300** at `1.65` — light on purpose, so prose stays under the numerals |
| `eyebrow-mono` | `.eyebrow-mono` / `.eyebrow-mono-sm` | 11px `0.16em` / 10px `0.14em`, lowercase, concrete |
| `data-mono` | `.data-mono` | 12px (the DS's xs step) 500 tabular, concrete, with `b` / `.v` in ink |

The hero numeral moving from the sans to the mono is the largest visible change
of the 2026-09-04 alignment. It follows the DS type sheet ("geist mono 600 · 72px")
and the readme's rule that engine-printed values are mono.

## Shape

| DS | value | app |
|---|---|---|
| `--ds-radius-tile` | 20px | `.tile` (`1.25rem`), `rounded-lg` |
| `--ds-radius-tile-lg` | 24px | `.tile-lg` (`1.5rem`), `rounded-3xl` |
| `--ds-radius-row` | 14px | `.row-recessed` (`0.875rem`), `rounded-sm` |
| `--ds-radius-control` | 999px | `.pill`, `.pill-volt`, `.pill-quiet`, `.chip-live`, `.chip-cat`, `.day-dot`, `rounded-full` |
| `--ds-radius-slab` | **6px** | `--radius-slab` → `rounded-slab`, `.slab-volt` |
| `--ds-radius-cell` | 2px | `--radius-cell` → `rounded-cell`, `.led-cell`, `.ammo-cell` |

Every control is a pill. The 6px slab is reserved for the prescribed load, and
2px for led / ammo cells — the shapes that cannot be mistaken for a control.

## Components → kit classes

| DS component | kit class | anatomy |
|---|---|---|
| `Tile` | `.tile`, `.tile-lg` | surface-3, shadow-tile, no border. Padding from the call site (DS: 22 / 28px) |
| `RecessedRow` | `.row-recessed` | surface-2, 14px. Padding from the call site (DS: 12px 14px) |
| `Pill` volt | `.pill-volt` | volt fill, brand-ink, 600; `:active` → volt-deep |
| `Pill` quiet | `.pill-quiet` | recessed fill, ink, 500; `:active` → line |
| `ChipLive` | `.chip-live`, `.chip-live-sm` | brand-muted tint, brand-text, mono 11px, a **volt** dot |
| `VoltSlab` | `.slab-volt` | volt, brand-ink, 6px, `2px 8px`, mono 600. The load page pins its own markup (see `contrast.mjs` §5) |
| `StatNum` | `.stat-num` | above |
| `Eyebrow` | `.eyebrow-mono` | above |
| `LedBar` | `.led-bar` > `.led-cell.lit` | 20×7 cells, 6px gap, volt when lit. `.day-pills` / `.day-pill.on` are the same thing |
| `AmmoCells` | `.ammo-cell.spent` | 10×18, volt when spent |
| `DayPills` | `.day-dot.on` | 36px labelled circles, volt when done |
| `CategoryChip` | `.chip-cat` + `text-category-<axis> bg-category-<axis>/10` | a word on its own tint |
| `StatusMessage` | `.status-msg.good` / `.status-msg.danger` | dot + line, fill/ink pairs |
| `SessionCard`, `WeekList`, `SignInCard` | — | compositions; the screens build them from the classes above |

## Elevation

`--shadow-tile` and `--shadow-tile-lg` carry the DS strings verbatim
(`--ds-shadow-tile` / `--ds-shadow-tile-raised`), both themes: a 1px contact
shadow plus a long, negative-spread lift; black at higher alpha on graphite.
No inset sheen, no coloured shadow, no glow.

## Motion

| DS | app |
|---|---|
| `--ds-ease-spring` | `--ease-spring` (`@theme` → `ease-spring`) |
| `--ds-ease-out` | `--ease-out` — **replaces Tailwind's default**, so `ease-out` means the system curve |
| `--ds-dur-press` 90ms | `--dur-press`; every `button`/`a` transitions its fill on it. No `:active` scale |
| `--ds-dur-mount` 240ms | `--dur-mount`; `.rise` / `.animate-float-up` |
| `--ds-dur-stamp` 420ms | `--dur-stamp`; `.stamp` (4° → −1° → 0) |

Nothing loops. `.skeleton` is a static block; `animate-pulse` is banned. The
one accepted loop is the loader (`forge-pulse`, `forge-spin`), named in the check.

## Spacing

The DS scale — 4 · 6 · 8 · 10 · 14 · 20 · 28 · 40 · 64 — is Tailwind's default
scale at 1 · 1.5 · 2 · 2.5 · 3.5 · 5 · 7 · 10 · 16. Tile padding 22 / 28px is
`p-5.5` / `p-7`; row padding 12 / 14px is `py-3 px-3.5`. No spacing tokens were
added.

## Prohibited, and enforced

`design-system.mjs` fails a `src/` file that renders: `bg-gradient-*`,
`backdrop-blur`, `blur-*`, `drop-shadow`, a `shadow-[0_0_…]` glow,
`animate-pulse|ping|bounce`, `font-serif`, `uppercase`, or `text-foreground` on
a solid `bg-brand`. `palette.mjs` fails a raw hue; `contrast.mjs` fails an ink
under 4.5:1 on any ground or fill it sits on, both themes, and a faded ink.

## Brand marks

The DS readme says no logo was provided and proposes a plate-stack mark in
`assets/`. **The app already has a mark** — the soft-cornered tile with the volt
monogram in `src/components/Logo.tsx`, with the SVG suite generated by
`scripts/generate-logo-suite.mjs` — and it stays. The DS proposals are kept as
proposals. Open question for the product owner.

## Open questions (from the DS readme, still open)

- **Icons.** The DS is near icon-free and adopts no set. The app uses
  `lucide-react` at 1.5px stroke in `currentColor`, which is the DS's own
  recommendation should icons be needed. Not a conflict; not yet a ruling.
- **Imagery.** None in the DS; none in the app.
- **Brand marks.** Above.

## Re-vendoring

The vendored copy is the project's files with one change: the Claude Design
viewer injects a `data-omelette-injected` style/script pair into every served
HTML file (the viewer's runtime, ~20KB, not the design), and that pair is
stripped. The check fails a vendored HTML file that still carries it.
