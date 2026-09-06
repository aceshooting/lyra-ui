#!/usr/bin/env bash
# Upgrade dependency ranges in the root package and every pnpm workspace package, install the
# resulting dependency graph, then build every workspace package. Peer dependencies are upgraded
# separately because npm-check-updates does not include them by default. The curated
# libphonenumber-js and MapLibre peer ranges keep their tested compatibility bounds; their dev
# dependencies are still upgraded by the first pass.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The repository pins ONE exact Node patch in .nvmrc, and every generator this script runs below is
# only reviewed against it. Previously a shell with any other runtime active stopped here with
# "Exact Node check failed: ... active Node is <x>" and left the caller to run `nvm use` by hand --
# pure friction, because the pinned patch is almost always already installed and this script knows
# exactly which one it needs. Select that interpreter into PATH first; scripts/check-node-version.mjs
# immediately after remains the single fail-closed authority on whatever is finally active, so a
# host with no matching install still fails with the canonical message rather than a second one.
read_exact_node_patch() {
  local version
  version="$(<"$ROOT_DIR/.nvmrc")"
  version="${version%$'\r'}"
  if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "$ROOT_DIR/.nvmrc does not contain one canonical exact Node patch" >&2
    return 1
  fi
  printf '%s\n' "$version"
}

node_patch_for_binary() {
  "$1" -p 'process.versions.node' 2>/dev/null || true
}

# Print the absolute path of an installed Node interpreter whose patch is exactly "$1", or nothing.
# Candidate layouts cover the version managers that read .nvmrc; each candidate is confirmed by
# asking the binary itself, so a same-named directory holding a different patch is never selected.
find_exact_node_bin() {
  local want="$1"
  local candidate
  local -a candidates=()

  # An explicit override first, for a host whose layout none of the defaults describe.
  [[ -n "${UPGRADE_SH_NODE_BIN:-}" ]] && candidates+=("$UPGRADE_SH_NODE_BIN")
  local data_home="${XDG_DATA_HOME:-${HOME:-}/.local/share}"
  candidates+=("${NVM_DIR:-${HOME:-}/.nvm}/versions/node/v$want/bin/node")
  candidates+=("${FNM_DIR:-$data_home/fnm}/node-versions/v$want/installation/bin/node")
  candidates+=("${VOLTA_HOME:-${HOME:-}/.volta}/tools/image/node/$want/bin/node")
  candidates+=("${ASDF_DATA_DIR:-${HOME:-}/.asdf}/installs/nodejs/$want/bin/node")
  candidates+=("${MISE_DATA_DIR:-$data_home/mise}/installs/node/$want/bin/node")

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" && -f "$candidate" && -x "$candidate" ]] || continue
    [[ "$(node_patch_for_binary "$candidate")" == "$want" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done
  return 0
}

activate_exact_node() {
  local want active selected selected_dir
  want="$(read_exact_node_patch)"
  active="$(node -p 'process.versions.node' 2>/dev/null || true)"
  [[ "$active" == "$want" ]] && return 0

  selected="$(find_exact_node_bin "$want")"
  if [[ -z "$selected" ]]; then
    echo "No installed Node $want found to activate (active: ${active:-none})." >&2
    echo "Install it (for example: nvm install $want) or set UPGRADE_SH_NODE_BIN=/path/to/node." >&2
    return 0
  fi

  if ! selected_dir="$(cd -P -- "$(dirname -- "$selected")" 2>/dev/null && pwd)"; then
    echo "Could not resolve the directory of $selected" >&2
    return 0
  fi
  # Prepending is enough for every child process here: pnpm, npx and each `pnpm dlx` helper start
  # through a `#!/usr/bin/env node` shebang or inherit process.execPath, so they all follow PATH.
  PATH="$selected_dir:$PATH"
  export PATH
  hash -r
  echo "==> Activated exact Node $want from $selected_dir (was ${active:-none})"
}

activate_exact_node

node scripts/check-node-version.mjs

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required to upgrade workspace dependencies." >&2
  exit 1
fi

# Keep the reviewed consumer peer floors independent from the development ranges that this script
# updates. The private snapshot is removed on every exit path and is checked after the peer pass.
peer_manifest_before="$(mktemp "${TMPDIR:-/tmp}/lyra-ui-peer-manifest.XXXXXX")"
trap 'rm -f "$peer_manifest_before"' EXIT
cp packages/lyra-ui/package.json "$peer_manifest_before"

echo "==> Upgrading dependencies in the workspace root and all workspace packages"
# Storybook stays pinned at 10.5.10: 10.6.0 leaves several stories unmounted past the docs
# harnesses' readiness wait (storybook:check, visual regression, show-code all fail). Lift the
# reject once the harness or the stories are adapted to the newer preview.
pnpm dlx npm-check-updates@latest \
  --packageManager pnpm \
  --workspaces \
  --root \
  --dep prod,dev,optional,packageManager \
  --target latest \
  --install never \
  --reject storybook,@storybook/addon-a11y,@storybook/addon-docs,@storybook/web-components,@storybook/web-components-vite \
  --upgrade

pnpm dlx npm-check-updates@latest \
  --packageManager pnpm \
  --workspaces \
  --root \
  --dep peer \
  --reject @sgratzl/chartjs-chart-boxplot,chart.js,chartjs-plugin-annotation,chartjs-plugin-datalabels,chartjs-plugin-zoom,dompurify,katex,mammoth,marked,pdfjs-dist,libphonenumber-js,maplibre-gl \
  --target latest \
  --install never \
  --upgrade

echo
echo "==> Verifying authority-managed peer floors"
node scripts/check-peer-compatibility.mjs --check-managed-peer-rewrites "$peer_manifest_before"

echo
echo "==> Synchronizing package-manager documentation"
node scripts/sync-package-manager-docs.mjs --write

echo
echo "==> Installing workspace dependencies and refreshing pnpm-lock.yaml"
# npm-check-updates has just changed the workspace manifests, so override pnpm's CI default of a
# frozen lockfile and persist the upgraded dependency graph before building generated artifacts.
# Use the negated flag to include development dependencies; pnpm 12 rejects --prod=false.
pnpm install --no-prod --no-frozen-lockfile

echo
echo "==> Synchronizing peer-compatibility current versions"
node scripts/check-peer-compatibility.mjs --write-current-versions

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
