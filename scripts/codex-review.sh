#!/usr/bin/env bash
# ── Launch a Codex review that cannot silently hang ─────────────────────────
#
#   scripts/codex-review.sh <prompt-file> <log-file>
#
# On 2026-10-06 a Codex review of FOR-262 was launched, reported as running, and
# sat for EIGHT HOURS having produced 39 bytes:
#
#   Reading additional input from stdin...
#
# `codex exec [PROMPT]` reads the prompt from stdin when the argument is absent,
# and a backgrounded shell's stdin never closes — so an empty prompt argument is
# an infinite wait that looks exactly like a long review. Three things made that
# invisible:
#
#   1. the run was piped through `tail`, so nothing reached disk until it exited
#   2. the liveness watch counted every codex.exe on the machine, including
#      stale ones from other sessions, so it never saw zero
#   3. nobody checked that the run had STARTED before calling it running
#
# This script removes all three. It feeds the prompt on stdin deliberately (the
# documented path), writes straight to a file with no pipe, and then REFUSES TO
# REPORT SUCCESS until it has seen the run actually begin. A launch that does
# not start is a non-zero exit with the reason on stderr, not a background
# process somebody has to remember to look at.
#
# Exit codes, so a caller can tell the failures apart:
#   0  the review ran to completion              (log holds the findings)
#   3  bad usage / prompt file missing or empty
#   4  codex never started                       (no session id within START_TIMEOUT)
#   5  codex blocked reading stdin               (the 8-hour failure, by signature)
#   6  codex stalled                             (no output growth for STALL_LIMIT)
#   7  codex exited non-zero                     (its own exit code is in the log)
set -uo pipefail

PROMPT="${1:-}"
LOG="${2:-}"
START_TIMEOUT="${CODEX_START_TIMEOUT:-90}"   # seconds to see a session id
STALL_LIMIT="${CODEX_STALL_LIMIT:-600}"      # seconds of zero growth before giving up
POLL="${CODEX_POLL:-5}"
CODEX_BIN="${CODEX_BIN:-codex}"

die() { echo "codex-review: $2" >&2; exit "$1"; }

[ -n "$PROMPT" ] && [ -n "$LOG" ] || die 3 "usage: codex-review.sh <prompt-file> <log-file>"
[ -f "$PROMPT" ] || die 3 "prompt file does not exist: $PROMPT"
[ -s "$PROMPT" ] || die 3 "prompt file is empty: $PROMPT — an empty prompt is how the 8-hour hang started"

: > "$LOG" || die 3 "cannot write the log: $LOG"

# THE PROMPT GOES IN ON STDIN, and `-` says so explicitly. No command
# substitution to come back empty, and no pipe on the way out.
"$CODEX_BIN" exec --sandbox read-only -c model_reasoning_effort=high - \
  < "$PROMPT" > "$LOG" 2>&1 &
CODEX_PID=$!

# ── it has to prove it started ──────────────────────────────────────────────
# A session id is Codex's own first-output marker, so it is evidence the model
# is engaged rather than evidence a process exists.
waited=0
while [ "$waited" -lt "$START_TIMEOUT" ]; do
  if grep -qi 'reading additional input from stdin' "$LOG" 2>/dev/null; then
    kill "$CODEX_PID" 2>/dev/null
    die 5 "codex is waiting on stdin — the prompt did not reach it. This is the 8-hour hang; it is caught in ${waited}s now."
  fi
  grep -qi 'session id' "$LOG" 2>/dev/null && break
  kill -0 "$CODEX_PID" 2>/dev/null || die 4 "codex exited during startup after ${waited}s — log: $LOG"
  sleep "$POLL"
  waited=$((waited + POLL))
done
grep -qi 'session id' "$LOG" 2>/dev/null \
  || { kill "$CODEX_PID" 2>/dev/null; die 4 "codex printed no session id in ${START_TIMEOUT}s — it never started"; }

echo "codex-review: started in ${waited}s, $(wc -c < "$LOG") bytes, pid $CODEX_PID" >&2

# ── and it has to keep moving ──────────────────────────────────────────────
last=0
stalled=0
while kill -0 "$CODEX_PID" 2>/dev/null; do
  sleep "$POLL"
  now=$(wc -c < "$LOG" 2>/dev/null || echo 0)
  if [ "$now" -eq "$last" ]; then
    stalled=$((stalled + POLL))
    if [ "$stalled" -ge "$STALL_LIMIT" ]; then
      kill "$CODEX_PID" 2>/dev/null
      die 6 "codex produced nothing for ${STALL_LIMIT}s at ${now} bytes — killed. Log: $LOG"
    fi
  else
    stalled=0
  fi
  last=$now
done

wait "$CODEX_PID"
rc=$?
echo "CODEX EXIT $rc" >> "$LOG"
[ "$rc" -eq 0 ] || die 7 "codex exited $rc — log: $LOG"

echo "codex-review: complete, $(wc -c < "$LOG") bytes" >&2
