#!/usr/bin/env bash
# SessionStart hook: stdout is injected into CC's context as a system reminder.
set -uo pipefail
BUS="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/bus"
echo 0 > "$BUS/chain.count" 2>/dev/null || true   # fresh session, fresh chain

if [ -f "$BUS/HALT" ]; then
  echo "BUS HALTED - .claude/bus/HALT exists. No work will be auto-dispatched until it is removed."
  exit 0
fi
[ -d "$BUS/queue" ] || exit 0
QUEUED=$(ls -1 "$BUS/queue" 2>/dev/null | grep -cE '^[0-9]{3}-FOR-[0-9]+\.json$' || true)
[ "${QUEUED:-0}" -eq 0 ] && exit 0
echo "Bus: $QUEUED ticket(s) queued by Blaine - $(ls -1 "$BUS/queue" | grep -oE 'FOR-[0-9]+' | tr '\n' ' ')"
echo "Each is specced in Linear. Finish the current turn and the Stop hook will hand you the first one."
