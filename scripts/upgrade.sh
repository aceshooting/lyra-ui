#!/usr/bin/env bash
# Upgrade dependency ranges in the root package and every pnpm workspace package, install the
# resulting dependency graph, then build every workspace package. Peer dependencies are upgraded
# separately because npm-check-updates does not include them by default. The curated
# libphonenumber-js peer range keeps its tested lower bound; its dev dependency is still upgraded
# by the first pass.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required to upgrade workspace dependencies." >&2
  exit 1
fi

echo "==> Upgrading dependencies in the workspace root and all workspace packages"
pnpm dlx npm-check-updates@latest \
  --packageManager pnpm \
  --workspaces \
  --root \
  --dep prod,dev,optional,packageManager \
  --target latest \
  --install never \
  --upgrade

pnpm dlx npm-check-updates@latest \
  --packageManager pnpm \
  --workspaces \
  --root \
  --dep peer \
  --reject libphonenumber-js \
  --target latest \
  --install never \
  --upgrade

echo
echo "==> Installing workspace dependencies and refreshing pnpm-lock.yaml"
pnpm install --prod=false

echo
echo "==> Building all workspace packages"
pnpm build

echo
echo "Dependency upgrade, install, and workspace build complete. Review the changes, then run ./scripts/ci.sh."
