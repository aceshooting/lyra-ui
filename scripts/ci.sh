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
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_PLATFORM=0
for arg in "$@"; do
  case "$arg" in
    --platform) RUN_PLATFORM=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

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

step "lyra-ui test:coverage"
pnpm --filter @aceshooting/lyra-ui test:coverage

step "manifest freshness"
pnpm manifest
git diff --exit-code -- packages/lyra-ui/custom-elements.json

step "readme:check"
pnpm readme:check

step "plugin reference sync"
./package.sh
git diff --exit-code -- plugins/lyra-ui/skills/lyra-ui/references/ skills/lyra-ui.skill

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
for f in custom-elements.json llms.txt llms-full.txt; do
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

printf '\n\033[32mCI gate complete.\033[0m\n'
