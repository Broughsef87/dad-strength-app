# ui kit — dad strength app

A click-through recreation of the training app on the chalk / volt system. Open `index.html`.

## flow

`sign in` → `today` → `week` → `log`. The header pill switches theme between chalk and graphite live; every screen is built from the component library, not from local styling.

## screens

| file | what it is |
|---|---|
| `AppShell.jsx` | Phone frame, header lockup, theme switch, bottom tab pills. The active tab is the one volt fill in the chrome. |
| `SignInScreen.jsx` | "pilot authentication" — composes `SignInCard`. |
| `TodayScreen.jsx` | The live session: working-max numeral, live chip, `SessionCard`, and the good-tone status line once finished. |
| `WeekScreen.jsx` | `WeekList` with an "anytime" session, plus block progress on a `LedBar`. |
| `HistoryScreen.jsx` | The log — recessed rows with load in data-mono and a category chip per entry. |

## notes

- Screens read components off `window.__DS`, resolved from the generated bundle in `index.html`.
- No screen introduces a color. Everything comes from `styles.css`.
- Content is representative sample data, not real user data.
