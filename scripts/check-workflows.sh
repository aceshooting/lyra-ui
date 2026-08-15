#!/usr/bin/env bash
set -euo pipefail

ACTIONLINT_VERSION="1.7.12"
ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"

if command -v actionlint >/dev/null 2>&1 && actionlint -version | head -n 1 | grep -qx "$ACTIONLINT_VERSION"; then
  actionlint -color
  exit 0
fi

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "actionlint $ACTIONLINT_VERSION must be installed on non-Linux-x86_64 hosts." >&2
  exit 1
fi

actionlint_tmp_dir="$(mktemp -d)"
trap 'rm -rf "$actionlint_tmp_dir"' EXIT
actionlint_archive="actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
actionlint_url="https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${actionlint_archive}"

curl --fail --location --proto '=https' --tlsv1.2 \
  --output "$actionlint_tmp_dir/$actionlint_archive" \
  "$actionlint_url"
(
  cd "$actionlint_tmp_dir"
  printf '%s  %s\n' "$ACTIONLINT_SHA256" "$actionlint_archive" | sha256sum --check
  tar --extract --gzip --file "$actionlint_archive" actionlint
)
# Run from the original directory (not the extraction tmpdir) so actionlint's project-root
# detection finds .github/workflows/ relative to the repo, not to /tmp.
"$actionlint_tmp_dir/actionlint" -color
