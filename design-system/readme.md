# dad strength — chalk / volt

The design system for **Dad Strength**, a strength-training app for fathers: AI-programmed lifting for people with no time and no gym. The app already shipped a named system called **chalk / volt**. This project formalizes and extends it — it does not replace it.

> **gym chalk and paper by day, graphite by night, one loud volt accent that is earned, not decorative.**

The tone is a calm training log, not a gamified dashboard. Quiet mono labels, big tabular numerals, lowercase voice. It should feel like a well-made notebook a serious lifter keeps, with one highlighter. The earlier mech / cockpit / HUD era of the app is retired and must not resurface.

## Sources

- **The brief.** A written specification of chalk / volt supplied by the product owner in conversation: both grounds, the volt rules, the status pairs, the six category axes, type roles, shape, motion, and voice. Every color value, radius, and type role in this project comes from that brief and is treated as fixed.
- **No codebase, Figma file, or repository was provided.** Nothing here is derived from running code. Where the brief did not specify a value, this readme says so explicitly and flags it as an open question rather than inventing a convention.
- **No logo or brand assets were provided.** The marks in `assets/` are new proposals authored for this system, not recovered brand files — see [Brand marks](#brand-marks).

### What was added, and why

The brief permits additions of "a spacing step, a component state, or a motion curve — not a color." Everything added is one of those, plus the two unavoidable derivations:

| Addition | Reason |
|---|---|
| `--ds-space-4: 10px` | The gap between a volt slab and its eyebrow had no step on the original scale. |
| Motion curves (`--ds-ease-spring`, three durations) | The brief describes motion in prose ("springy and brief", "a stamp lands with a slight rotation") but names no curve. |
| Pressed states on `Pill` | `volt-deep` was given as "hover/pressed on a volt fill" with no component to hang it on. |
| **Six category ink + tint pairs** | The brief names six axes and the rule (desaturated, own ink on own 10% tint) but not the hues. These were derived at low chroma and measured; see [Category](#category-six-axes). **Flagged for review.** |
| `--ds-on-danger-fill: #FFFFFF` | The brief gives a danger *fill* but no ink for text sitting on it. White measures 6.7:1 on `#AE2929`. **Flagged for review.** |

## Index

| Path | What it is |
|---|---|
| `readme.md` | This file — the design guide and manifest. |
| `SKILL.md` | Agent-skill entry point, for use in Claude Code. |
| `styles.css` | The global CSS entry point. `@import` lines only. Consumers link this one file. |
| `tokens/` | `fonts`, `colors`, `typography`, `spacing`, `shape`, `elevation`, `motion`. |
| `assets/` | Brand marks (SVG). |
| `components/core/` | `Tile`, `RecessedRow`, `Pill`, `ChipLive`, `VoltSlab`, `StatNum`, `Eyebrow` |
| `components/progress/` | `LedBar`, `AmmoCells`, `DayPills` |
| `components/training/` | `SessionCard`, `WeekList`, `CategoryChip`, `StatusMessage`, `SignInCard` |
| `guidelines/` | 19 foundation specimen cards — colors, type, spacing, brand. |
| `ui_kits/app/` | Click-through recreation of the app: sign in → today → week → log, both themes. |

**Start here for:** building a screen → `ui_kits/app/`. Picking colors → `tokens/colors.css` and the Colors cards. Writing copy → [Content fundamentals](#content-fundamentals).

## Themes

Two grounds, both first-class. Chalk is `:root`; graphite is `[data-theme="graphite"]`. Set the attribute on any container and every token below it re-resolves — components never branch on theme in JS.

```html
<div data-theme="graphite"> … </div>
```

---

## Content fundamentals

**Voice.** Lowercase. Direct. Second person. The app talks the way a training partner does when there is no time to talk: "start session", "finish session", "done", "morning done", "test week", "the week", "pick a path".

**Who's talking.** The system, not a personality. It reports and it prescribes. It does not congratulate, encourage, or narrate. The sign-in card reads `pilot authentication` and the footer reads `DS-01 // built for the long haul` — that is the level of restraint to hold everywhere.

**Casing.** Lowercase for headings, buttons, labels, and prose. Mono eyebrows are lowercase too — they are quiet, not shouted. The only capitals in the whole system are in `DS-01` and in unit abbreviations where lowercase would be wrong (`RPE` is written `rpe`; `lb` stays `lb`).

**Division of labor.** Mono eyebrows carry metadata; prose carries intent. Engine-printed values are mono; prose is never mono. `lb @ 65% · 4×5 · tgt rpe 7` is metadata. "if the last set feels lighter than rpe 7, add five pounds next week" is intent.

**Punctuation.** Middle dot `·` separates metadata fields. Periods end sentences. Never exclamation marks. Never "awesome", "crushed it", "let's go", or any other gym-app cheerleading.

**Numbers.** Specific and unadorned. "four working sets", "add five pounds", "wk 3 of 6". A number is never rounded up for effect, and a numeral is never decorated with an arrow or a delta chip.

### Verbatim examples

| Surface | Copy |
|---|---|
| Primary action | `start session` · `finish session` · `continue` |
| Completion | `done` · `morning done` · `session logged` |
| Section eyebrow | `the week` · `the log` · `block progress` |
| Metadata eyebrow | `wk 3 · day 2` · `lb @ 65% · 4×5 · tgt rpe 7` · `mon · morning done` |
| Anytime session | `anytime` |
| Good status | `week logged. next week adds five pounds to the squat.` |
| Danger status | `no connection. the session is saved on this device.` |
| Sign-in | `pilot authentication` → `sign in` |
| Footer | `DS-01 // built for the long haul` |
| Program prose | `two more weeks, then a test week. keep the same sets and let the load move.` |

### Do not

- Say "we". The system is not a team.
- Use exclamation marks, or any praise language.
- Set prose in mono, or metadata in the sans.
- Uppercase an eyebrow.
- Add emoji. **None are used anywhere in this system.**
- Gamify: no badges, no levels, no confetti, no streak fire.

---

## Visual foundations

**The one-line brief.** Paper-white tiles floating on soft shadow, big tabular numerals doing the talking, and exactly one acid-green fill marking the thing you are about to lift.

### Color

Dark and light are equals, not a mode and its afterthought. Neither ground is pure: chalk is `#FAF9F6` (warm paper), graphite is `#0E0F10` (never black). Text is `#141412` / `#EDEDEA` — also never pure.

**The rule that matters most: volt is a FILL, never an ink on a light ground.** Raw volt as text on white measures 1.18:1 and is invisible. On chalk, volt-as-text must be `--ds-brand-text` (`#5C7A0E`, a darkened olive, 4.7:1 on the ground / 4.9:1 on a white tile). On graphite, volt itself reads at 16.5:1 and is used directly. The only way full-chroma volt appears on the light theme is as a solid fill with `--ds-on-volt` (`#131608`) on top, at 15.5:1. **Design every volt moment as a fill.**

**Volt means exactly three things:**
1. **live** — in progress (`ChipLive`)
2. **earned** — done (a lit `LedBar` cell, a filled `DayPills` pill)
3. **the number you lift** — the prescribed load, as a solid `VoltSlab`

Nothing else gets it. If everything is volt, nothing is. One volt control per screen, at most.

**Status is fill/ink pairs, never single tokens.** `good` is volt fill with brand-text ink. `danger` is `#AE2929` on chalk; on graphite the fill (`#BE2D2D`) and the ink (`#DA6262`) are deliberately different values, because the fill must hold white and the ink must hold the ground.

**There is no warning color, and there will not be one.** Anything that is not fine or broken is prose, or low-emphasis danger. Do not introduce amber.

**An ink token is never shown at reduced opacity.** Text that needs to recede uses `--ds-concrete` instead. When an ink sits on a tinted fill it must clear 4.5:1 against the *composited* fill in both themes — measured, not assumed. Every pair in `tokens/colors.css` has been measured; the tightest is brand-text on brand-muted at 4.6:1.

#### Category — six axes

`push · pull · legs · core · condition · general`. Desaturated, each its own ink on its own 10% tint. A chip already says "chest" — color is only grouping, so it stays quiet. **Never one hue per label.**

| axis | chalk ink | graphite ink |
|---|---|---|
| push | `#7A5140` | `#C09480` |
| pull | `#3F5F6B` | `#8FB3C0` |
| legs | `#5A4A6B` | `#A899BF` |
| core | `#6B5A2E` | `#BFAC7A` |
| condition | `#3F6350` | `#8FBFA3` |
| general | `#5E5E58` | `#ABABA3` |

All clear 5.4:1 on chalk and 6.2:1 on graphite, measured on their own tints. These hues were derived, not given — flagged for review.

### Typography

**Space Grotesk** (300–700) for display and body. **Geist Mono** (Space Mono fallback) for data. Nothing else, ever. Tabular numerals always, so digits never shift between renders.

Four roles:

| Role | Spec | Used for |
|---|---|---|
| `stat-num` | Geist Mono 600 · 72 / 44 / 30px · `-0.045em` · `0.92` · tabular | The hero numeral. Numerals are heroes — the load, the week, the streak lead every card. |
| `display` | Space Grotesk 700/600 · 76 / 40 / 26px · `-0.045em` → `-0.02em` | Headings, all lowercase. |
| `eyebrow-mono` | Geist Mono 400 · 10–11px · `0.16em` · concrete | Quiet lowercase micro-labels: `wk 3 · day 2`, section eyebrows. |
| `data-mono` | Geist Mono 500 · 12–15px · tabular | `%`, `rpe`, `wk`, plate math (`45·10·10·2.5 /side`). |

Body copy is **weight 300** at `1.65` leading. The lightness is deliberate — it keeps prose subordinate to numerals.

### Backgrounds

Flat ground, nothing on it. No patterns, no textures, no grain, no illustration, no photography, no mesh. The only depth in the system is tile shadow. This is the single biggest departure from the retired HUD era and it is not negotiable.

### Gradients

**None.** There is no gradient anywhere in this system — not in a button, not behind a hero, not as an atmospheric glow. If something needs emphasis it gets a volt fill or it gets a larger numeral.

### Elevation and borders

**Tiles float on shadow, not borders.** Borders are used sparingly — a hairline under a header, a specimen swatch outline. Depth within a tile comes from `--ds-recessed`: rows sit *below* the surface in fill rather than being divided by lines.

```
--ds-shadow-tile: 0 1px 2px rgba(20,20,18,0.04), 0 8px 24px -12px rgba(20,20,18,0.12)
```

Two-part: a 1px contact shadow plus a long, negative-spread lift. Graphite swaps to black at higher alpha. There is no colored shadow and no volt glow — **nothing glows.**

### Corner radii

| Token | Value | Applies to |
|---|---|---|
| `--ds-radius-tile` | 20px | Tiles |
| `--ds-radius-tile-lg` | 24px | Primary surfaces — sign-in, active session |
| `--ds-radius-row` | 14px | Recessed rows |
| `--ds-radius-control` | 999px | Every control, without exception |
| `--ds-radius-slab` | **6px** | The highlighter, and only the highlighter |
| `--ds-radius-cell` | 2px | Led / ammo cells |

**The highlighter's low radius is the point.** Every control is a pill, so a squared slab is the one shape that cannot read as a button. An 8px padding on the sides, 2px top and bottom, tight to the numeral.

### Cards

```
┌─ background: --ds-tile · radius 20 · padding 22 · shadow-tile · NO border ─┐
│  eyebrow-mono (metadata)                            ChipLive (if live)      │
│                                                                             │
│  exercise name (Space Grotesk 600, 24px)              VoltSlab (the load)   │
│  eyebrow-mono (lb @ 65% · 4×5 · tgt rpe 7)                                  │
│                                                                             │
│  RecessedRow · set 1 ················· 5 reps · rpe 6                       │
│  RecessedRow · set 2 ················· 5 reps · rpe 7                       │
│  RecessedRow · set 3 ················· —          (muted, never faded)      │
│                                                                             │
│  LedBar ▮▮▯▯  2 of 4 spent                                                  │
│  Pill (volt, full width) — finish session                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Animation

Springy and brief. A card mounts with a short rise; a stamp lands with a slight rotation and settles. **Nothing loops, nothing glows.**

| Curve / duration | Use |
|---|---|
| `--ds-ease-spring` `cubic-bezier(0.2, 0.9, 0.25, 1.06)` | Card mount, stamp settle |
| `--ds-dur-mount` 240ms | Card mount (10px rise + fade) |
| `--ds-dur-stamp` 420ms | Stamp landing: 4deg → 0, slight overshoot |
| `--ds-dur-press` 90ms | Pill press |

No page transitions, no parallax, no scroll-linked motion, no skeleton shimmer, no pulsing dots. `prefers-reduced-motion` collapses everything to 1ms.

### Hover and press states

Hover is barely there — this is a phone-first system used with one hand at 5 AM. Press is the real state.

- **Volt pill:** press fills with `--ds-volt-fill-pressed` (`volt-deep`) over 90ms. No lift, no scale, no glow.
- **Quiet pill:** press fills with `--ds-line`.
- **Recessed row (interactive):** press fills with `--ds-line`.
- **Tiles do not respond to hover.** They are surfaces, not targets.
- Disabled controls desaturate the fill; they never drop opacity, because inks never fade.

### Transparency and blur

**No blur anywhere.** No frosted nav, no scrim. The only transparency in the system is `--ds-brand-muted` — volt at 16% on chalk, 12% on graphite — and it exists solely so the live chip can tint without becoming a fill. Both composites are documented as flat hexes in `tokens/colors.css` so their contrast can be measured.

### Layout

Phone-first, single column, 390px design width. 16px screen gutter, 12px between tiles, 20–28px inside them. Content is a vertical stack of tiles — no grids, no sidebars, no two-column anything. The bottom tab bar is the only fixed chrome; the active tab is the one volt fill in the chrome, which is why no screen puts a second volt pill beside it.

### Imagery

There is none, and that is the intent. No photography, no illustration, no exercise diagrams in this system. If exercise imagery is added later it should arrive as line diagrams in ink on recessed fill — never photographic, never volt. **This is an open question for the product owner.**

---

## Brand marks

**No logo was provided with the brief.** The marks in `assets/` are new proposals authored inside chalk / volt, offered for review — they are not recovered brand files, and nothing here reconstructs a pre-existing mark.

The geometry is the system's own: a **plate stack** — three bars of decreasing width, in `--ds-on-volt`, on a volt field. It reads as plates on a bar, as a log, and as progress, it is pure geometry with no letterforms, and it survives at 20px.

| File | Use |
|---|---|
| `ds-mark-volt.svg` | Primary, 20px tile radius. Chalk and graphite both. |
| `ds-mark-volt-graphite.svg` | Same at the graphite volt value (`#CDFF4D`). |
| `ds-mark-slab.svg` | The mark drawn on the 6px slab — ties the identity to the highlighter. |
| `ds-mark-ink.svg` | One-color, ink field. Print and monochrome. |
| `ds-mark-bare.svg` | The glyph alone, no field. For use inside an existing volt fill. |

Horizontal lockup: mark + `dad strength` in Space Grotesk 600 at `-0.03em`, gap 12px, mark at 34px. **Minimum mark size 20px.** Do not outline it, rotate it, gradient it, or place it on a category tint.

---

## Iconography

**This system is close to icon-free, by design.** The brief specifies no icon library, and nothing in it needs one: metadata is carried by mono eyebrows, state by fills, progress by cells, and taxonomy by word chips. A training log reads better with words than with pictograms.

The markers that do the work of icons:

| Marker | What it is | Where |
|---|---|---|
| Status dot | A 6px volt or danger circle | `StatusMessage`, `ChipLive` |
| Led cell | 20×7px, 2px radius, volt when lit | `LedBar` |
| Ammo cell | 10×18px, volt when spent | `AmmoCells` |
| Day pill | 36px circle, volt when done | `DayPills` |
| Category chip | A word on a 10% tint | `CategoryChip` |

**No emoji.** None appear anywhere in the system, and none should be added — a gym emoji would puncture the whole tone.

**No unicode glyphs as icons.** The middle dot `·` and the em dash are punctuation in metadata strings, not iconography. An em dash `—` standing in for an empty value (an unlogged set) is a *value*, not an icon.

**If icons become necessary** — a settings gear, a back chevron, a share affordance — the recommendation is a single low-weight line set at 1.5px stroke in `currentColor`, sized 16–18px, never filled and never volt. **No set has been adopted and none is bundled here.** This is an open question for the product owner rather than a substitution made on their behalf.

---

## Font substitution note

Space Grotesk and Geist Mono are pulled from the **Google Fonts CDN** in `tokens/fonts.css`; no font binaries were supplied with the brief. Space Mono is declared as the fallback for Geist Mono, per the brief.

**To ship offline:** download the WOFF2 files, place them in a `fonts/` directory, and replace the `@import` in `tokens/fonts.css` with `@font-face` blocks pointing at them.

---

## The rules sheet

1. **volt is a fill** — never an ink on a light ground.
2. **one accent, earned** — live, earned, and the number you lift. Nothing else.
3. **numerals are heroes** — the load, the week, the streak lead every card.
4. **shadows, not borders** — tiles float; rows recede by fill.
5. **lowercase voice** — direct, second person, no exclamation marks.
6. **inks never fade** — text that recedes uses concrete, not opacity.
7. **no warning color** — prose or low-emphasis danger. Never amber.
8. **six category axes** — desaturated, never one hue per label.

## Prohibited

- Volt as text on chalk (1.18:1 — invisible).
- An ink at reduced opacity.
- A rainbow of category colors, one hue per muscle.
- A new hue, a new typeface, a gradient, or an outline-heavy style.
- Mech, cockpit, or HUD styling. That era is retired.
