#!/usr/bin/env bash
# Stream a CI command while recording its boundary and original exit status.
set -euo pipefail
if (( $# < 2 )); then
  echo 'Usage: ci-phase.sh <phase> <command> [arguments...]' >&2
  exit 2
fi
phase_name="$1"
shift
phase_started=$SECONDS
printf 'phase-start %s phase=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ UTC')" "$phase_name"
phase_finished() {
  local phase_status=$?
  trap - EXIT
  printf 'phase-end %s phase=%s elapsed=%ss status=%s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ UTC')" "$phase_name" "$((SECONDS - phase_started))" "$phase_status"
  exit "$phase_status"
}
trap phase_finished EXIT
"$@"
