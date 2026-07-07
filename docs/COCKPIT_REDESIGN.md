# COCKPIT REDESIGN — full aesthetic overhaul

Direction locked 2026-07-07: **Ferrari rosso × Gundam cockpit × Eleiko restraint.**
Token swap (rosso brand + HUD kit v1) already shipped in `041bf85`. This doc is
the EXTREME pass — the app becomes a mobile-suit cockpit / pit garage. Every
screen is a systems console.

Reference images (user-provided): Ferrari F80 press red + carbon; Gundam mechs
(angular panels, red glowing eyes, HUD chrome); Eleiko gym (matte grey precision,
thin lines, restraint). Restraint rule: Eleiko discipline keeps the mecha chrome
from becoming a costume. One HUD frame per view. Telemetry on key stats only.

---

## 1. Typography

- **Display** → `Chakra Petch` (600/700) via next/font — squared Thai-tech
  letterforms, the closest Google font to Gundam panel type. Replaces Bebas as
  `--font-display`.
- **Telemetry/numerals** → `Share Tech Mono` as `--font-telemetry`. All HUD
  micro-labels, weights, percentages, timers.
- **Body** stays Space Grotesk.
- Big numerals everywhere weights/percentages appear: the target weight is the
  hero of a lift card (e.g. `225` huge, `LB @ 73.5%` small telemetry under it).

## 2. Global chrome (root layout)

New `CockpitChrome` client component mounted in `layout.tsx`:

- **Viewport brackets**: fixed thin corner brackets at the 4 corners of the
  screen (like looking through cockpit glass). `pointer-events-none`, z-40,
  hidden on print.
- **Scanline overlay**: full-screen repeating-linear-gradient, ~2% opacity,
  fixed. Barely perceptible — texture, not effect.
- **Boot sequence**: on first load per session (sessionStorage flag
  `ds-boot-played`), a 1.2s overlay: black screen, 3-4 lines of telemetry text
  type in (`DS-01 SYSTEMS ONLINE`, `LOAD CELLS: CALIBRATED`, `PILOT: AUTHENTICATED`),
  red ring spins up, overlay lifts. Skippable on tap.
- **Background**: existing carbon cross-hatch stays; add faint blueprint grid
  layer on dark (24px grid at 1.5% white).

## 3. HUD kit v2 (globals.css additions)

- `.panel-cut` — signature Gundam panel: `clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))`
  (opposing chamfered corners). Cards adopt this instead of uniform rounding.
- `.panel-id` — absolute top-left micro label inside panels: `PNL-03 // PULLS`.
- `.led-bar` — segmented progress: 10 cells, filled cells red with glow,
  empty cells border-only. Replaces smooth progress bars.
- `.dial` — SVG cockpit gauge with tick marks for ProgressRing replacement
  (week progress, session completion %). Red needle/arc.
- `.hazard` — diagonal warning stripes strip (red/transparent 45°) used as a
  1-row accent under headers on test week / deload banners.
- `.carbon` — carbon-fiber weave background (double repeating-gradient) for
  header bands and the CTA button fill.
- `.ammo-row` — set-logging cells styled as ammo counter: square cells,
  depleted = filled red, remaining = hollow.
- Ferrari livery slash: `.livery-slash` — a skewed red parallelogram accent
  behind hero headings (one per screen max).

## 4. Screen treatments (priority order — he lives in /train daily)

### 4.1 `/train/[program]/[day]` — THE COCKPIT (highest priority)
- Header → HUD strip: left = back control; center = `WK 03 // DAY 05` telemetry
  + day name in Chakra Petch; right = status dot + session LED bar (items
  logged / total).
- Lift cards → weapon panels: `.panel-cut .hud-frame`, panel-id (`PNL-01 //
  SNATCH`), variation name, then the TARGET WEIGHT as a huge telemetry numeral
  with `@ 73.5% · 4×3` beneath. Set rows use `.ammo-row` cells.
- Outside-day cards → mission briefing panels (`BRIEFING // SPRINT.ACCEL`).
- Metcon card → red-alert styling: hazard strip header, timer central.
- Complete Session → `MISSION COMPLETE` button: carbon fill, red border,
  mecha-glow; Session Done screen gets a stamped `CLEARED` treatment with
  scale/opacity stamp animation and week LED bar.
- Test week days → red-alert theme variant (hazard strips, "TRIAL PROTOCOL").

### 4.2 `/dashboard` — THE BRIDGE
- Active program card → mobile suit status board: program name big, week dial
  gauge, day LED bar (done days), `BEGIN SESSION` carbon+red CTA, panel-id
  chrome.
- Streak → `REACTOR` dial with day count.
- Section headers → `01 // TRAINING`, `02 // MIND` telemetry style with
  readout-rules.
- DadScore/vitals cards → small instrument panels (panel-cut, micro dials).

### 4.3 `/build` — THE HANGAR
- Path cards → mech-select: huge Chakra Petch name, spec readout rows
  (days/week, macro length, focus) as telemetry table, livery slash behind the
  selected card, `DEPLOY` button.
- Maxes step → `CALIBRATION` console: each lift a panel row with big numeral
  input.

### 4.4 Landing `/` — TITLE SCREEN
- Boot-text intro over black, DS wordmark with livery slash, auth card as a
  clean Eleiko-grey panel. `PILOT AUTHENTICATION` label over the form.

### 4.5 Sweep (last)
- BottomNav → switch bank: angular icon frames, active = red glow + bracket
  + telemetry label.
- ForgeLoader → reactor spin-up (already close; recolor + tick ring).
- Error banner → `SYS.FAULT` styling.
- PWA icons/theme-color → rosso.

## 5. Motion
- Panel mount: clip-reveal + 8px slide, staggered 40ms (framer-motion,
  existing dep).
- Number tickers on weights/dials (useCountUp exists).
- `hud-scan` sweep on card hover (shipped v1).
- Red-alert pulse ONLY on: PR logged, test week banner. Never ambient.

## 6. Implementation order (one commit each)
1. Fonts (layout.tsx) + HUD kit v2 css
2. CockpitChrome (brackets, scanlines, boot) in root layout
3. Train page cockpit treatment
4. Dashboard bridge treatment
5. Build hangar + landing title screen
6. Sweep: BottomNav, loaders, Session Done stamp, PWA colors

## Anti-goals
- No yellow (keep the palette red/carbon/steel — Ferrari yellow shield would
  fight the Eleiko restraint).
- No sound effects.
- No parallax/3D tilt.
- Light mode: keep functional but chrome is designed dark-first; light mode
  gets tokens only, no boot sequence.
