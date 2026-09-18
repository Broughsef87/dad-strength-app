#!/usr/bin/env bash
# SessionStart hook: stdout is injected into CC's context as a system reminder.
#
# ── IT LOGS EVERY START (FOR-246) ────────────────────────────────────────────
# This used to print only when a queue existed or HALT was set, and wrote to
# bus.log never. So a session that started with an empty queue left no trace,
# and a session where the hooks were DEAD left the same trace: none.
#
# The boot line is what makes the freshness check possible. It is the heartbeat:
# if the hooks are alive, every session start puts one line in bus.log. If
# bus.log has nothing at or after the moment work was queued, the hooks are not
# running — which is the one state that used to look exactly like "it drained".
set -uo pipefail
BUS="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/bus"
stamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }
mkdir -p "$BUS" 2>/dev/null || true
echo 0 > "$BUS/chain.count" 2>/dev/null || true   # fresh session, fresh chain

HALTED=no
[ -f "$BUS/HALT" ] && HALTED=yes
QUEUED=0
if [ -d "$BUS/queue" ]; then
  QUEUED=$(ls -1 "$BUS/queue" 2>/dev/null | grep -cE '^[0-9]{3}-FOR-[0-9]+\.json$' || true)
fi
QUEUED=${QUEUED:-0}

# Unconditional, before any early return. A boot that says nothing is a boot
# nobody can tell apart from a hook that never ran.
echo "[$(stamp)] hook=boot outcome=started queued=$QUEUED halt=$HALTED" >> "$BUS/bus.log" 2>/dev/null || true

if [ "$HALTED" = yes ]; then
  echo "BUS HALTED - .claude/bus/HALT exists. No work will be auto-dispatched until it is removed."
  exit 0
fi
[ "$QUEUED" -eq 0 ] && exit 0
echo "Bus: $QUEUED ticket(s) queued by Blaine - $(ls -1 "$BUS/queue" | grep -oE 'FOR-[0-9]+' | tr '\n' ' ')"
echo "Each is specced in Linear. Finish the current turn and the Stop hook will hand you the first one."
