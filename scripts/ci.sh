#!/usr/bin/env bash
# Run the blocking CI gates locally, following the commands in
# .github/workflows/ci.yml. The workflow file remains the authoritative gate
# list -- when it changes, change this script to match.
#
# Usage:
#   ./scripts/ci.sh                 # aggregate the six primary Node 22/Chromium CI jobs
#   CI_SH_SKIP_INSTALL=1 ./scripts/ci.sh   # skip primary install + Chromium download
#                                          # (platform modes still install their own engines)
#   ./scripts/ci.sh --platform      # ALSO run the platform-contracts subset locally
#                                   # (firefox + chromium + chrome + edge + safari; browsers downloaded on demand)
#   ./scripts/ci.sh --platform-matrix # primary jobs plus CI's Node 20/22 browser matrix
#                                   # requires Node 20/22 and pnpm 10/11 locally
#   ./scripts/ci.sh --all           # alias for --platform-matrix
#   ./scripts/ci.sh --keep-going    # (-k) don't abort at the first STALE GENERATED ARTIFACT;
#                                   # collect every freshness failure and report them together at
#                                   # the end, still exiting non-zero. Useful before a release,
#                                   # where several artifacts are typically stale at once and the
#                                   # default fail-fast costs a full rebuild per staleness.
#                                   # Real test/lint/build failures still abort immediately.
#
# The platform matrix can use non-default executable names/paths when needed:
#   CI_SH_NODE20_BIN=/path/to/node20 CI_SH_PNPM20_BIN=/path/to/pnpm10 \
#   CI_SH_NODE22_BIN=/path/to/node22 CI_SH_PNPM22_BIN=/path/to/pnpm \
#   ./scripts/ci.sh --platform-matrix
set -euo pipefail
cd "$(dirname "$0")/.."
CI_SH_ROOT="$PWD"

# GitHub Actions sets this for every job. Several tools change their behavior
# when running in CI, so make the local run use the same setting.
export CI=true

RUN_PLATFORM=0
RUN_PLATFORM_MATRIX=0
KEEP_GOING=0
for arg in "$@"; do
  case "$arg" in
    --platform) RUN_PLATFORM=1 ;;
    --platform-matrix|--all) RUN_PLATFORM_MATRIX=1 ;;
    --keep-going|-k) KEEP_GOING=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$RUN_PLATFORM" == "1" && "$RUN_PLATFORM_MATRIX" == "1" ]]; then
  echo "use either --platform or --platform-matrix, not both" >&2
  exit 2
fi

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

require_primary_toolchain() {
  local actual_node_major
  actual_node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$actual_node_major" != "22" ]]; then
    echo "primary CI jobs require Node 22 (active: $(node --version)); activate Node 22 before running scripts/ci.sh" >&2
    exit 1
  fi

  local expected_pnpm
  local actual_pnpm
  expected_pnpm="$(node -p 'require("./package.json").packageManager.replace(/^pnpm@/, "")')"
  actual_pnpm="$(pnpm --version)"
  if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
    echo "primary CI jobs require pnpm $expected_pnpm (active: $actual_pnpm); install/activate the packageManager-pinned version" >&2
    exit 1
  fi
}

# Regenerated-artifact freshness checks. Every one of these follows the same shape -- run a
# generator, then `git diff --exit-code` its outputs -- and every one has the same fix: the
# generator has ALREADY rewritten the files by the time the diff fails, so they just need
# committing. A bare `git diff --exit-code` says none of that; it prints a raw diff and exits 1,
# which reads like a content regression rather than "commit this".
#
# These checks are also mutually independent and near-instant, but `set -e` makes the first one
# to fail abort the whole run -- including the multi-minute docs/Storybook/visual stages after
# it. A release that left three separate artifacts stale therefore needed three full rebuilds to
# discover that, one staleness at a time. With --keep-going they are all reported in one pass and
# the script still exits non-zero at the end.
FRESHNESS_FAILURES=()
freshness_diff() {
  local label="$1"; shift
  if git diff --exit-code -- "$@"; then return 0; fi
  printf '\n\033[1;31m!! %s is stale\033[0m\n' "$label"
  printf '   The generator above already rewrote these files -- commit them:\n'
  printf '     git add %s\n\n' "$*"
  FRESHNESS_FAILURES+=("$label")
  [[ "$KEEP_GOING" == "1" ]] || exit 1
}

# Deliberately an `if`, not `(( ... )) && return 0`: under `set -e` that form exits the whole
# script when the arithmetic is false, which is exactly the case where we still need to print.
report_freshness_failures() {
  if (( ${#FRESHNESS_FAILURES[@]} > 0 )); then
    printf '\n\033[1;31m== %s stale artifact(s), all recorded under --keep-going:\033[0m\n' \
      "${#FRESHNESS_FAILURES[@]}"
    printf '   - %s\n' "${FRESHNESS_FAILURES[@]}"
    printf '\n   Regenerate + commit them, then re-run.\n'
    exit 1
  fi
}

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
  # node20/node22 shim. Pick the newest installed patch release for the major;
  # shell glob order is lexical (v20.9 sorts after v20.19), so sort versions
  # explicitly before selecting the last executable candidate.
  if [[ -n "${NVM_DIR:-}" ]]; then
    local candidate=""
    local newest=""
    while IFS= read -r candidate; do
      [[ -x "$candidate" ]] && newest="$candidate"
    done < <(compgen -G "$NVM_DIR/versions/node/v$version.*/bin/node" | LC_ALL=C sort -V)
    if [[ -n "$newest" ]]; then
      printf '%s\n' "$newest"
      return
    fi
  fi
}

run_with_toolchain() {
  local node_bin="$1"
  local pnpm_bin="$2"
  shift 2
  # Lifecycle scripts can invoke `pnpm` again. The proxy reapplies the selected
  # package manager on every nested invocation; pnpm serializes a false boolean
  # config value as an empty environment variable, which otherwise re-enables
  # packageManager switching in the child process.
  PATH="$CI_SH_ROOT/scripts/ci-bin:$(dirname "$node_bin"):$PATH" \
    CI_SH_SELECTED_PNPM_BIN="$pnpm_bin" \
    CI=true npm_config_manage_package_manager_versions=false \
    npm_config_scripts_prepend_node_path=false \
    "$pnpm_bin" "$@"
}

validate_platform_toolchain() {
  local node_version="$1"
  local node_bin="$2"
  local pnpm_bin="$3"
  local manifest="package.json"
  [[ "$node_version" == "20" ]] && manifest=".github/ci-pnpm10.json"

  local actual_node_major
  actual_node_major="$("$node_bin" -p 'process.versions.node.split(".")[0]')"
  if [[ "$actual_node_major" != "$node_version" ]]; then
    echo "$node_bin is Node $actual_node_major, expected Node $node_version" >&2
    return 1
  fi

  local expected_pnpm
  local actual_pnpm
  expected_pnpm="$("$node_bin" -p "require('./$manifest').packageManager.replace(/^pnpm@/, '')")"
  actual_pnpm="$(run_with_toolchain "$node_bin" "$pnpm_bin" --version)"
  if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
    echo "$pnpm_bin is pnpm $actual_pnpm under Node $node_version, expected pnpm $expected_pnpm" >&2
    return 1
  fi
}

run_platform_matrix_leg() {
  local node_version="$1"
  local node_bin="$2"
  local pnpm_bin="$3"
  local browser="$4"
  local shard_index="$5"
  local shard_total="$6"
  local install_browser="$7"
  step "platform contracts: Node $node_version / $browser / shard $shard_index/$shard_total"
  run_with_toolchain "$node_bin" "$pnpm_bin" install --frozen-lockfile || return
  run_with_toolchain "$node_bin" "$pnpm_bin" \
    --filter @aceshooting/lyra-ui exec playwright install --with-deps "$install_browser" || return
  WTR_BROWSER="$browser" WTR_TEST_SUITE=platform WTR_SHARD_INDEX="$shard_index" WTR_SHARD_TOTAL="$shard_total" \
    WTR_STRICT_CONSOLE=1 \
    run_with_toolchain "$node_bin" "$pnpm_bin" --filter @aceshooting/lyra-ui test:platform-shard || return
  if [[ "$node_version" == "20" && "$browser" == "firefox" && "$shard_index" == "1" && "$shard_total" == "1" ]]; then
    step "packed consumer: Node 20"
    run_with_toolchain "$node_bin" "$pnpm_bin" build || return
    run_with_toolchain "$node_bin" "$pnpm_bin" check:packed-consumer || return
  fi
}

require_primary_toolchain

if [[ "${CI_SH_SKIP_INSTALL:-0}" != "1" ]]; then
  step "pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  step "playwright install chromium"
  pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps chromium
fi

step "pnpm lint"
pnpm lint

step "workflow syntax and policy"
pnpm check:workflows

step "release qualification manifest and workflow contract"
pnpm check:release-qualification

step "release-integrity helper tests"
node scripts/release-integrity.test.mjs

# This mirrors static-checks' networked upstream contract: direct public npm fetches are pinned by
# package identity, exact version, tarball SHA-512 and manifest SHA-256, with no lifecycle process.
step "pinned upstream public manifests"
pnpm --filter @aceshooting/lyra-ui check:pinned-upstream-manifests

# Build before test: src/package-entrypoints.test.ts dynamically imports the
# package's published entry points (./dist/lyra.js etc.), which only exist
# after a build.
step "pnpm build"
pnpm build

step "built component-quality evidence"
pnpm --filter @aceshooting/lyra-ui check:component-quality:built

step "SSR import/render matrix"
pnpm --filter @aceshooting/lyra-ui test:ssr

step "SSR hydration crawl"
pnpm --filter @aceshooting/lyra-ui test:hydration

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

step "registration artifact freshness"
pnpm registrations
freshness_diff "registration artifacts (pnpm registrations)" \
  packages/lyra-ui/src/all.ts \
  packages/lyra-ui/src/ssr/all.ts \
  packages/lyra-ui/src/components/lr-*.ts \
  packages/lyra-ui/src/internal/root-registration-allowlist.ts \
  packages/lyra-ui/package.json

step "lyra-ui test:coverage"
pnpm --filter @aceshooting/lyra-ui test:coverage
# The per-metric floors in packages/lyra-ui/scripts/coverage-floors.json are the blocking gate the
# CI build-and-coverage job runs right after test:coverage; without it this aggregate silently
# accepts a coverage regression that CI rejects.
step "lyra-ui check:coverage-floors"
pnpm --filter @aceshooting/lyra-ui check:coverage-floors

step "manifest freshness"
pnpm manifest
freshness_diff "custom-elements.json (pnpm manifest)" packages/lyra-ui/custom-elements.json
step "editor data freshness"
pnpm --filter @aceshooting/lyra-ui run generate-editor-data
freshness_diff "editor data (pnpm generate-editor-data)" packages/lyra-ui/vscode-html-data.json packages/lyra-ui/vscode-css-data.json packages/lyra-ui/web-types.json

step "readme:check"
pnpm readme:check

step "plugin reference sync"
./package.sh
freshness_diff "plugin skill package (./package.sh)" \
  plugins/lyra-ui/skills/lyra-ui/references/ \
  skills/lyra-ui.skill \
  skills/compose-lyra-interfaces.skill

step "skill:check"
pnpm skill:check

step "docs:build"
pnpm docs:build

step "docs:check"
freshness_diff "Storybook sitemap (pnpm docs:build)" .storybook/sitemap.xml
pnpm docs:check

step "storybook:check"
pnpm storybook:check

step "docs:check-show-code"
pnpm docs:check-show-code

step "storybook:check-theme"
pnpm storybook:check-theme

# This is a blocking CI job. Keep the local aggregate gate equally strict so a
# screenshot mismatch cannot pass here and fail only after the push.
step "visual regression"
pnpm --filter @aceshooting/lyra-ui test:visual

step "verify published tarball contents"
out="$(pnpm --filter @aceshooting/lyra-ui pack --dry-run 2>&1)"
echo "$out"
missing=0
for f in dist/ssr-loader.js custom-elements.json llms.txt llms-full.txt llms/index.md llms/shared.md llms/tokens.md llms/peers.md llms/migration.md llms/components/lr-table.md; do
  if ! grep -qF "$f" <<< "$out"; then
    echo "ERROR: tarball is missing expected file: $f" >&2
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "ERROR: expected files missing from the published tarball -- check files/exports/sideEffects in packages/lyra-ui/package.json" >&2
  exit 1
fi

step "lyra-ui check:package-size"
pnpm --filter @aceshooting/lyra-ui check:package-size

step "check:packed-consumer"
pnpm check:packed-consumer

step "public API semver gate"
pnpm --filter @aceshooting/lyra-ui check:public-api

if [[ "$RUN_PLATFORM" == "1" ]]; then
  for browser in firefox chromium chrome edge safari; do
    install_browser="$browser"
    case "$browser" in
      edge) install_browser=msedge ;;
      safari) install_browser=webkit ;;
    esac
    step "platform contracts: $browser"
    pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps "$install_browser"
    WTR_BROWSER="$browser" WTR_TEST_SUITE=platform WTR_STRICT_CONSOLE=1 pnpm --filter @aceshooting/lyra-ui test:platform
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
    if ! validate_platform_toolchain "$node_version" "$node_bin" "$pnpm_bin"; then
      exit 1
    fi

    if [[ "$node_version" == "20" ]]; then
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" firefox 1 1 firefox; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s / shard 1/1\033[0m\n' "$node_version" "firefox" >&2
      fi
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" safari 1 1 webkit; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s / shard 1/1\033[0m\n' "$node_version" "safari" >&2
      fi
    else
      for shard in 1 2; do
        if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" chromium "$shard" 2 chromium; then
          platform_failures=$((platform_failures + 1))
          printf '\033[31mFAILED: Node %s / %s / shard %s/2\033[0m\n' "$node_version" "chromium" "$shard" >&2
        fi
      done
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" chrome 1 1 chrome; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s / shard 1/1\033[0m\n' "$node_version" "chrome" >&2
      fi
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" edge 1 1 msedge; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s / shard 1/1\033[0m\n' "$node_version" "edge" >&2
      fi
      for shard in 1 2 3 4; do
        if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" firefox "$shard" 4 firefox; then
          platform_failures=$((platform_failures + 1))
          printf '\033[31mFAILED: Node %s / %s / shard %s/4\033[0m\n' "$node_version" "firefox" "$shard" >&2
        fi
      done
      if ! run_platform_matrix_leg "$node_version" "$node_bin" "$pnpm_bin" safari 1 1 webkit; then
        platform_failures=$((platform_failures + 1))
        printf '\033[31mFAILED: Node %s / %s / shard 1/1\033[0m\n' "$node_version" "safari" >&2
      fi
    fi
  done
  if ((platform_failures > 0)); then
    echo "$platform_failures platform-contract leg(s) failed" >&2
    exit 1
  fi
fi

# Only reachable under --keep-going: without it, freshness_diff already exited at the first
# stale artifact. Exits non-zero if any were recorded, so --keep-going changes how much you
# learn per run, never whether a stale artifact fails the gate.
report_freshness_failures

printf '\n\033[32mCI gate complete.\033[0m\n'
