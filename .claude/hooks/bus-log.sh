#!/usr/bin/env bash
# bus-log.sh — the only way a hand-written line reaches bus.log.
#
#   .claude/hooks/bus-log.sh cc "ticket=FOR-231 outcome=merged pr=34 ..."
#
# WHY THIS EXISTS. Every line the hooks write is stamped from the clock, and
# every line a human or CC typed was stamped from memory. On 2026-10-03 mine
# read 00:00-01:38Z sitting between hook stamps of 17:25 and 17:51Z — nine
# entries, all wrong, in the one file used to decide whether the dispatcher is
# alive. A log whose timestamps are a guess cannot answer that question.
#
# So the stamp is not an argument. It comes from `date -u` here, in the same
# form the hooks use, and there is no flag to override it.
#
# It takes an AGENT and a MESSAGE and writes exactly:
#
#   [2026-10-04T12:34:56Z] agent=cc <message>
#
# It writes nothing else: no interpretation, no newlines inside the message, and
# it never reads bus.log back. A message spanning lines is collapsed, because a
# multi-line entry breaks every reader that treats bus.log as one line per event
# — scripts/checks/bus-observability.mjs among them.
set -uo pipefail

BUS="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/bus"

if [ "$#" -lt 2 ]; then
  echo "usage: bus-log.sh <agent> <message>" >&2
  exit 2
fi

AGENT="$1"
shift
MESSAGE="$*"

# THE AGENT IS ONE WHOLE VALUE (Codex r7). `grep` matches per LINE, so an agent
# of $'cc\n[2099-01-01T00:00:00Z] hook=stop outcome=claimed' satisfied it on its
# first line, and the append below then wrote TWO lines - the second a
# caller-supplied stamp shaped exactly like a hook entry, in the one file
# bus-observability.mjs reads to decide whether the dispatcher is still alive.
# Only MESSAGE was being collapsed. So: control characters are refused
# outright, and the remaining match is anchored against the WHOLE string by the
# shell rather than line by line by grep.
#
# The value is never echoed back. An agent holding a forged line would have put
# that line on stderr, and stderr is a channel that reaches a prompt.
case "$AGENT" in
  *[[:cntrl:]]*)
    echo "bus-log.sh: the agent holds a control character or a newline" >&2
    exit 2 ;;
esac
if [[ ! "$AGENT" =~ ^[a-z][a-z0-9-]{0,31}$ ]]; then
  echo "bus-log.sh: the agent must be a short lowercase token" >&2
  exit 2
fi

if [ -z "${MESSAGE//[[:space:]]/}" ]; then
  echo "bus-log.sh: refusing to write an empty message" >&2
  exit 2
fi

# One line per event. Collapse any newline or tab the caller passed in.
MESSAGE=$(printf '%s' "$MESSAGE" | tr '\n\r\t' '   ')

mkdir -p "$BUS" 2>/dev/null || true
printf '[%s] agent=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$AGENT" "$MESSAGE" >> "$BUS/bus.log" || {
  echo "bus-log.sh: could not append to $BUS/bus.log" >&2
  exit 1
}
exit 0
