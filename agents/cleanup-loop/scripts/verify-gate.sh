#!/usr/bin/env bash
# Cleanup-loop verification gate. The Verifier subagent runs this after every
# atomic change. Exit 0 = green (safe to commit). Non-zero = red (roll back).
#
# Gate (baseline captured 2026-06-15, the day the loop was built; ratchets DOWN
# as the loop removes code):
#   - server: `tsc --noEmit` error count must NOT exceed the baseline (23, was 24
#     at loop start — dedup of populateRepository cleared one).
#     The server runs on tsx (types stripped at runtime), so tsc is a
#     regression tripwire, not a build — we forbid NEW errors, not all errors.
#   - server: full vitest suite must pass (baseline 131 passing).
#   - client: `vite build` must succeed.
#
# Usage:
#   verify-gate.sh            # full gate (server tsc + server tests + client build)
#   verify-gate.sh server     # server only (tsc + vitest) — fast inner loop
#   verify-gate.sh client     # client build only
#
# Override the tsc ceiling if the baseline legitimately drops (it should only
# ever go DOWN as the loop cleans): TSC_BASELINE=22 verify-gate.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"
TSC_BASELINE="${TSC_BASELINE:-23}"
TARGET="${1:-all}"
fail=0

run_server() {
  echo "── server: tsc --noEmit (ceiling: $TSC_BASELINE) ─────────────────"
  local count
  count=$(cd "$SERVER" && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS")
  echo "   tsc errors: $count"
  if [ "$count" -gt "$TSC_BASELINE" ]; then
    echo "   ✗ REGRESSION: $count > $TSC_BASELINE new type errors introduced."
    fail=1
  else
    echo "   ✓ no new type errors."
  fi

  echo "── server: vitest run ───────────────────────────────────────────"
  if (cd "$SERVER" && node_modules/.bin/vitest run >/tmp/cleanup-vitest.log 2>&1); then
    tail -3 /tmp/cleanup-vitest.log | sed 's/^/   /'
    echo "   ✓ tests pass."
  else
    echo "   ✗ TESTS FAILED:"
    tail -25 /tmp/cleanup-vitest.log | sed 's/^/   /'
    fail=1
  fi
}

run_client() {
  echo "── client: vite build ───────────────────────────────────────────"
  if (cd "$CLIENT" && npm run build >/tmp/cleanup-clientbuild.log 2>&1); then
    echo "   ✓ client build OK."
  else
    echo "   ✗ CLIENT BUILD FAILED:"
    tail -25 /tmp/cleanup-clientbuild.log | sed 's/^/   /'
    fail=1
  fi
}

case "$TARGET" in
  server) run_server ;;
  client) run_client ;;
  all)    run_server; run_client ;;
  *) echo "usage: verify-gate.sh [all|server|client]"; exit 64 ;;
esac

echo "──────────────────────────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then
  echo "GATE: ✓ GREEN — safe to commit this atomic change."
else
  echo "GATE: ✗ RED — roll back (git checkout -- <file> / git revert) and try another approach."
fi
exit "$fail"
