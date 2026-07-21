#!/usr/bin/env bash
# Run the CI gate locally, mirroring .github/workflows/ci.yml's build-test job
# step-for-step (same commands, same order). The workflow file remains the
# authoritative gate list -- when it changes, change this script to match.
#
# Usage:
#   ./scripts/ci.sh                 # full build-test gate
#   CI_SH_SKIP_INSTALL=1 ./scripts/ci.sh   # skip install + browser download (deps already present)
#   ./scripts/ci.sh --platform      # ALSO run the platform-contracts suite locally
#                                   # (firefox + webkit; browsers are downloaded on demand)
#   ./scripts/ci.sh --platform-matrix # run the CI platform matrix (Node 20/22 x Firefox/WebKit)
#                                   # requires Node 20/22 and pnpm 10/11 locally
#   ./scripts/ci.sh --all           # full build-test gate plus the platform matrix
#
# The platform matrix can use non-default executable names/paths when needed:
#   CI_SH_NODE20_BIN=/path/to/node20 CI_SH_PNPM20_BIN=/path/to/pnpm10 \
#   CI_SH_NODE22_BIN=/path/to/node22 CI_SH_PNPM22_BIN=/path/to/pnpm \
#   ./scripts/ci.sh --platform-matrix
set -euo pipefail
cd "$(dirname "$0")/.."

# GitHub Actions sets this for every job. Several tools change their behavior
# when running in CI, so make the local run use the same setting.
export CI=true

RUN_PLATFORM=0
RUN_PLATFORM_MATRIX=0
for arg in "$@"; do
  case "$arg" in
    --platform) RUN_PLATFORM=1 ;;
    --platform-matrix|--all) RUN_PLATFORM_MATRIX=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$RUN_PLATFORM" == "1" && "$RUN_PLATFORM_MATRIX" == "1" ]]; then
  echo "use either --platform or --platform-matrix, not both" >&2
  exit 2
fi

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

resolve_command() {
  local requested="$1"
  if [[ "$requested" == */* ]]; then
    [[ -x "$requested" ]] && printf '%s\n' "$requested"
    return
  fi
  command -v "$requested" 2>/dev/null || true
}

resolve_node_for_version() {
  local version="$1"
  local override=""
  case "$version" in
    20) override="${CI_SH_NODE20_BIN:-}" ;;
    22) override="${CI_SH_NODE22_BIN:-}" ;;
  esac

  if [[ -n "$override" ]]; then
    resolve_command "$override"
    return
  fi

  local resolved
  resolved="$(resolve_command "node$version")"
  [[ -n "$resolved" ]] && { printf '%s\n' "$resolved"; return; }
  resolved="$(resolve_command "node-$version")"
  [[ -n "$resolved" ]] && { printf '%s\n' "$resolved"; return; }

  # NVM installations commonly expose versioned node binaries without a
  # node20/node22 shim. Pick the newest installed patch release for the major.
  if [[ -n "${NVM_DIR:-}" ]]; then
    local candidates=("$NVM_DIR"/versions/node/v"$version".*/bin/node)
    if ((${#candidates[@]} > 0)) && [[ -x "${candidates[${#candidates[@]}-1]}" ]]; then
      printf '%s\n' "${candidates[${#candidates[@]}-1]}"
      return
    fi
  fi
}

run_with_toolchain() {
  local node_bin="$1"
  local pnpm_bin="$2"
  shift 2
  # pnpm's shebang resolves `node` through PATH. Put the selected Node first,
  # and disable pnpm's packageManager self-reexec just like the platform job.
  PATH="$(dirname "$node_bin"):$PATH" \
    CI=true npm_config_manage_package_manager_versions=false \
    "$pnpm_bin" "$@"
}

run_platform_matrix_leg() {
  local node_version="$1"
  local node_bin="$2"
  local pnpm_bin="$3"
  local browser="$4"
  step "platform contracts: Node $node_version / $browser"
  run_with_toolchain "$node_bin" "$pnpm_bin" install --frozen-lockfile || return
  run_with_toolchain "$node_bin" "$pnpm_bin" --filter @aceshooting/lyra-ui exec playwright install --with-deps "$browser" || return
  WTR_BROWSER="$browser" WTR_STRICT_CONSOLE=1 \
    run_with_toolchain "$node_bin" "$pnpm_bin" --filter @aceshooting/lyra-ui test:platform || return
}

if [[ "${CI_SH_SKIP_INSTALL:-0}" != "1" ]]; then
  step "pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  step "playwright install chromium"
  pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps chromium
fi

step "pnpm lint"
pnpm lint

# Build before test: src/package-entrypoints.test.ts dynamically imports the
# package's published entry points (./dist/lyra.js etc.), which only exist
# after a build.
step "pnpm build"
pnpm build

step "bundle-size budgets"
pnpm --filter @aceshooting/lyra-ui check:bundle-size

# lyra-ui's own Chromium suite runs once, below, via test:coverage (identical
# file set with coverage instrumentation on) -- this step only covers the
# other workspace package(s), e.g. lyra-flags.
step "workspace tests (non-lyra-ui)"
pnpm --filter '!@aceshooting/lyra-ui' -r test

step "check:dead-code"
pnpm run check:dead-code

step "check:secrets"
pnpm run check:secrets

step "lyra-ui test:coverage"
pnpm --filter @aceshooting/lyra-ui test:coverage

step "manifest freshness"
pnpm manifest
git diff --exit-code -- packages/lyra-ui/custom-elements.json
step "editor data freshness"
pnpm --filter @aceshooting/lyra-ui run generate-editor-data
git diff --exit-code -- packages/lyra-ui/vscode-html-data.json packages/lyra-ui/vscode-css-data.json packages/lyra-ui/web-types.json

step "readme:check"
pnpm readme:check

step "plugin reference sync"
./package.sh
git diff --exit-code -- plugins/lyra-ui/skills/lyra-ui/references/

step "skill:check"
pnpm skill:check

step "docs:build"
pnpm docs:build

step "docs:check"
git diff --exit-code -- .storybook/sitemap.xml
pnpm docs:check

step "storybook:check"
pnpm storybook:check

step "storybook:check-theme"
pnpm storybook:check-theme

# Informational/non-blocking, mirroring CI: the visual baselines have not yet
# been human-confirmed (see packages/lyra-ui/visual-baselines/README). A
# mismatch prints a warning but does not fail the gate until the baselines are
# promoted deliberately.
step "visual regression (informational, non-blocking)"
if ! pnpm --filter @aceshooting/lyra-ui test:visual; then
  printf '\033[33mWARNING: visual regression reported differences (non-blocking; diffs in packages/lyra-ui/.visual-diff-output)\033[0m\n'
fi

step "verify published tarball contents"
out="$(pnpm --filter @aceshooting/lyra-ui pack --dry-run 2>&1)"
echo "$out"
missing=0
for f in custom-elements.json llms.txt llms-full.txt llms/index.md llms/shared.md llms/tokens.md llms/peers.md llms/migration.md llms/components/lr-table.md; do
  if ! grep -qF "$f" <<< "$out"; then
    echo "ERROR: tarball is missing expected file: $f" >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "ERROR: expected files missing from the published tarball -- check files/exports/sideEffects in packages/lyra-ui/package.json" >&2
  exit 1
fi

step "check:packed-consumer"
pnpm check:packed-consumer

if [[ "$RUN_PLATFORM" == "1" ]]; then
  for browser in firefox webkit; do
    step "platform contracts: $browser"
    pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps "$browser"
    WTR_BROWSER="$browser" WTR_STRICT_CONSOLE=1 pnpm --filter @aceshooting/lyra-ui test:platform
  done
fi

if [[ "$RUN_PLATFORM_MATRIX" == "1" ]]; then
  platform_failures=0
  for node_version in 20 22; do
    node_bin="$(resolve_node_for_version "$node_version")"
    if [[ -z "$node_bin" ]]; then
      echo "could not find Node $node_version; install it or set CI_SH_NODE${node_version}_BIN" >&2
      exit 1
    fi

    if [[ "$node_version" == "20" ]]; then
      pnpm_request="${CI_SH_PNPM20_BIN:-pnpm10}"
    else
      pnpm_request="${CI_SH_PNPM22_BIN:-pnpm}"
    fi
    pnpm_bin="$(resolve_command "$pnpm_request")"
    if [[ -z "$pnpm_bin" ]]; then
      echo "could not find $pnpm_request for Node $node_version; install it or set CI_SH_PNPM${node_version}_BIN" >&2
      exit 1
    fi

    for browser in firefox webkit; do
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" "$browser"; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s\033[0m\n' "$node_version" "$browser" >&2
      fi
    done
  done
  if ((platform_failures > 0)); then
    echo "$platform_failures platform-contract leg(s) failed" >&2
    exit 1
  fi
fi

printf '\n\033[32mCI gate complete.\033[0m\n'
