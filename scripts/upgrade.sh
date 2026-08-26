#!/usr/bin/env bash
# Upgrade dependency ranges in the root package and every pnpm workspace package, install the
# resulting dependency graph, then build every workspace package. Peer dependencies are upgraded
# separately because npm-check-updates does not include them by default. The curated
# libphonenumber-js and MapLibre peer ranges keep their tested compatibility bounds; their dev
# dependencies are still upgraded by the first pass.
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
  --reject libphonenumber-js,maplibre-gl \
  --target latest \
  --install never \
  --upgrade

echo
echo "==> Installing workspace dependencies and refreshing pnpm-lock.yaml"
# npm-check-updates has just changed the workspace manifests, so override pnpm's CI default of a
# frozen lockfile and persist the upgraded dependency graph before building generated artifacts.
pnpm install --prod=false --no-frozen-lockfile

echo
echo "==> Building all workspace packages"
pnpm build

# A dependency bump (Lit, the CEM analyzer, esbuild/vite, shiki, etc.) can shift the manifest,
# framework type declarations, measured bundle/gzip sizes, or the upstream parity pins even when no
# lyra-ui source changed -- regenerate the full generated-artifact chain now, in the same dependency
# order contract-policy's freshness checks expect, so an upgrade never leaves a stale generator
# output for a later, unrelated commit to trip over. Every step here is idempotent (a no-op diff
# when nothing actually shifted), so this is safe to run unconditionally.
echo
echo "==> Regenerating manifest, framework types, and design tokens"
pnpm manifest
pnpm --filter @aceshooting/lyra-ui run framework-types
pnpm --filter @aceshooting/lyra-ui run design-tokens

echo
echo "==> Regenerating upstream inventory, editor data, component metadata, and component quality"
# The editor files are a published projection of the manifest. Refresh and validate the parity
# inventory first so a parity failure cannot leave newly written editor files beside a stale
# inventory (the next generator/check would otherwise report a misleading half-fresh state).
node packages/lyra-ui/scripts/check-pinned-upstream-manifests.mjs --write-inventory
pnpm --filter @aceshooting/lyra-ui run generate-editor-data
node packages/lyra-ui/scripts/generate-component-metadata.mjs --write
node packages/lyra-ui/scripts/generate-component-quality.mjs --write --measure-gzip

echo
echo "==> Regenerating default-string slices and registration artifacts"
node packages/lyra-ui/scripts/generate-default-string-slices.mjs --write
pnpm registrations

echo
echo "==> Regenerating llms/ reference docs and the packaged plugin/skill archives"
./package.sh

echo
echo "Dependency upgrade, install, workspace build, and full generated-artifact regeneration complete."
echo "Review the changes (git status / git diff), then run ./scripts/ci.sh."
