# Exercise library sources

## exrx-raw-2026-11-15.tsv

The raw index of ExRx.net's weight-training exercise lists, pulled 2026-11-15 from the ten muscle-group pages linked off https://exrx.net/Lists/Directory (Neck, Shoulders, Upper Arms, Forearms, Back, Chest, Waist, Hips, Thighs, Calves). It has 719 rows, one per unique exercise page. Tab-separated, with a header row.

| column | meaning |
| -- | -- |
| `region` | which list page the row came from (`Should` = shoulders, `Arm` = upper arms, `ForeArm`, `Thigh`, `Calf`, and so on) |
| `target_muscle` | the list section the exercise sits under. This is ExRx's target muscle. |
| `equipment` | the equipment group (Barbell, Dumbbell, Cable, Lever (plate loaded), Lever (selectorized), Sled, Smith, Weighted, Body Weight, Suspended, Band/Self/Partner-assisted, ...) |
| `exercise` | the exercise name as listed, with nested variants joined by commas (e.g. `Military Press, Seated`) |
| `exrx_path` | the page path under `https://exrx.net/WeightExercises/` |

The rows hold names and links only. ExRx's descriptions, instructions and animations stay on their site, and the app's cues are written in our own words. A page reached from two muscle sections appears once, under the first section that links it. A handful of rows have an empty or odd `exercise` cell where ExRx links an exercise from another muscle's folder (e.g. `Obliques/BWAngledSideBridge` under Lateral Deltoid). The `exrx_path` identifies them.

Not included: ExRx's Olympic-lift, plyometric, cardio, kettlebell and stretch lists. The weightlifting variations come from the Catalyst Athletics and Training Weightlifting (Leo Isaac) indexes instead.
