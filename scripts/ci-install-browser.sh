#!/usr/bin/env bash
# Retry transient failures from Playwright's branded browser installer on hosted Linux runners.
set -euo pipefail

if (( $# != 1 )) || [[ "$1" != chrome && "$1" != msedge ]]; then
  echo 'Usage: ci-install-browser.sh <chrome|msedge>' >&2
  exit 2
fi
channel="$1"

for attempt in 1 2 3; do
  if timeout --signal=TERM --kill-after=10s 180s pnpm --filter @aceshooting/lyra-ui exec playwright install "$channel"; then
    exit 0
  else
    status=$?
  fi

  # A timeout or signal may leave an elevated APT child active. Fail without starting another.
  if (( status >= 124 || attempt == 3 )); then
    printf '::error::Playwright %s install failed on attempt %s (status %s)\n' "$channel" "$attempt" "$status" >&2
    exit "$status"
  fi
  printf '::warning::Playwright %s install failed on attempt %s (status %s), retrying\n' "$channel" "$attempt" "$status" >&2
  sleep 5
done
