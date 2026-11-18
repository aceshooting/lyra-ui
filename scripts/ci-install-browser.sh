#!/usr/bin/env bash
# Install current branded browsers on hosted Linux runners.
set -euo pipefail

if (( $# != 1 )) || [[ "$1" != chrome && "$1" != msedge ]]; then
  echo 'Usage: ci-install-browser.sh <chrome|msedge>' >&2
  exit 2
fi
channel="$1"
install_timeout=(timeout --signal=TERM --kill-after=10s 180s)

cleanup_edge_apt() {
  local status=$?
  trap - EXIT
  if ! sudo -- rm -rf -- "$edge_apt"; then
    echo '::error::Could not remove temporary Edge APT files' >&2
    if (( status == 0 )); then status=1; fi
  fi
  exit "$status"
}

if [[ "$channel" == msedge ]]; then
  edge_apt=$(mktemp -d)
  trap cleanup_edge_apt EXIT
  chmod 0755 "$edge_apt"
  mkdir "$edge_apt/lists" "$edge_apt/sourceparts"
  # The runner image removes its Edge source and key. Use Microsoft's published
  # Edge repository signer without depending on a key download on each runner.
  # https://learn.microsoft.com/en-us/linux/packages#microsoftasc
  key_file="$(dirname -- "${BASH_SOURCE[0]}")/fixtures/microsoft-edge-release-signing.asc"
  fingerprint=BC528686B50D79E339D3721CEB3E94ADBE1229CF
  install -m 0644 -- "$key_file" "$edge_apt/microsoft-edge.asc"
  printf 'deb [arch=amd64 signed-by=%s,%s] https://packages.microsoft.com/repos/edge stable main\n' \
    "$edge_apt/microsoft-edge.asc" "$fingerprint" > "$edge_apt/edge.list"

  apt_command=(sudo -- "${install_timeout[@]}" apt-get
    -o "Dir::Etc::sourcelist=$edge_apt/edge.list"
    -o "Dir::Etc::sourceparts=$edge_apt/sourceparts"
    -o "Dir::State::lists=$edge_apt/lists"
    -o 'Dir::Cache::pkgcache='
    -o 'Dir::Cache::srcpkgcache='
    -o 'Acquire::Retries=2'
    -o 'Acquire::https::Timeout=20')
  "${apt_command[@]}" --error-on=any update
  "${apt_command[@]}" --reinstall --no-remove --no-install-recommends -y install microsoft-edge-stable/stable
  microsoft-edge-stable --version
  exit
fi

for attempt in 1 2 3; do
  if "${install_timeout[@]}" pnpm --filter @aceshooting/lyra-ui exec playwright install "$channel"; then
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
