#!/usr/bin/env bash
# Runs lyra-ui's complete browser-driven test surface locally: the full
# src/**/*.test.ts suite discovered from the live source tree under Chromium (coverage-instrumented,
# matching the CI build-and-coverage job), Firefox, and WebKit (uninstrumented,
# matching the weekly full-engine.yml sweep) -- plus SSR/hydration, visual
# regression, and the other workspace package(s)' own tests.
#
# scripts/ci.sh already reproduces the six primary lint/build/docs CI jobs on
# Chromium, plus (with --platform/--platform-matrix) the curated ~40-file
# test:platform subset on Firefox/WebKit. This script is narrower in scope
# (tests only, no lint/docs-freshness/packed-consumer gates) but wider in
# coverage: every engine runs the COMPLETE suite, the same one full-engine.yml
# runs weekly in CI, on demand and locally. It is heavy -- three real browser
# engines each running the full component suite -- so it's meant to run
# before publishing a release, not on every commit; scripts/ci.sh (plus
# pnpm lint/test) remains the per-commit gate.
#
# Independent lanes (chromium/firefox/webkit/visual/workspace) run in
# parallel by default since each is a separate browser/process; each lane's
# own steps still run in order within that lane. Output is captured per-lane
# so concurrent runs don't interleave on the terminal; a failed lane's log is
# printed in full at the end.
#
# Usage:
#   ./scripts/test.sh                # run every lane in parallel (default)
#   ./scripts/test.sh --serial       # run lanes one at a time (lower-core machines)
#   TEST_SH_SKIP_INSTALL=1 ./scripts/test.sh   # skip install + browser download
#   TEST_SH_ENGINE_SHARDS=4 ./scripts/test.sh  # split each engine lane into exactly 4 parallel shards
#                                              # (clamped to the host's page budget)
#
# Unset, the engine shard count and concurrent coverage shards are sized to the host: every core
# but two at two cores per browser page (--serial keeps one shard). Set TEST_SH_ENGINE_SHARDS to
# match a CI shard's numbering. Sharding is the ONLY safe way to spend
# spare cores here. Raising a lane's own WTR_CONCURRENCY instead was measured to break
# native pointer capture isolation in Firefox and pointer/paint timing in WebKit. Firefox requires
# one page per process; WebKit retains its bounded four-page allocation.
# Sharding adds processes that each behave exactly like CI's, rather than fatter processes that
# change timing. It mirrors full-engine.yml's own shard matrix, so a shard that fails locally is
# reproducible as the identically-numbered CI shard.
set -euo pipefail
cd "$(dirname "$0")/.."

export CI=true

# WTR's automatic port probe is not atomic with its later server bind. Concurrent lanes can both
# select the same apparently-free port, then one fails with EADDRINUSE. Keep the three WTR lanes
# on deterministic, distinct ports below the platform's ephemeral range; the other lanes use
# server-assigned ephemeral ports and do not share this runner configuration.
declare -Ar WTR_LANE_PORTS=(
  [chromium]=18080
  [firefox]=18081
  [webkit]=18082
)

# An ordinary WTR process opens half the host's reported CPU count in browser pages. Running two
# full-engine processes with that default alongside coverage overcommits the machine (8 + 8 + 1
# pages on a 16-core host), producing unrelated timer and paint failures. Bound this aggregate to
# six browser pages explicitly. Firefox uses one page per process because native pointer capture
# crosses contexts; standalone WebKit retains the smaller of four pages or its low-core default.
declare -Ar WTR_LANE_CONCURRENCY=(
  [chromium]=1
  [firefox]=1
  [webkit]=4
)

SERIAL=0
for arg in "$@"; do
  case "$arg" in
    --serial) SERIAL=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

require_primary_toolchain() {
  local actual_node_major
  actual_node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$actual_node_major" != "22" ]]; then
    echo "scripts/test.sh requires Node 22 (active: $(node --version)); activate Node 22 first" >&2
    exit 1
  fi

  local expected_pnpm actual_pnpm
  expected_pnpm="$(node -p 'require("./package.json").packageManager.replace(/^pnpm@/, "")')"
  actual_pnpm="$(pnpm --version)"
  if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
    echo "scripts/test.sh requires pnpm $expected_pnpm (active: $actual_pnpm)" >&2
    exit 1
  fi
}

require_primary_toolchain

if [[ "${TEST_SH_SKIP_INSTALL:-0}" != "1" ]]; then
  step "pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  step "playwright install chromium firefox webkit"
  pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps chromium firefox webkit
fi

# package-entrypoints.test.ts (part of every lane below, on every engine)
# imports the package's built dist/ targets -- full-engine.yml builds once
# per shard for the same reason. Build once here, up front, and share it.
step "pnpm build"
pnpm build

LOG_DIR="$(mktemp -d)"

cleanup_logs() {
  local exit_status=$?
  trap - EXIT
  # Keep the lane logs when anything failed. A failing lane prints only `tail -n 60`, and the
  # interesting part of a browser-engine failure is routinely further up than that -- deleting the
  # directory on the way out left the operator with a path that no longer exists and no way back to
  # the full output short of re-running the entire sweep.
  if [[ "$exit_status" != "0" ]]; then
    echo "lane logs preserved for inspection: $LOG_DIR" >&2
    exit "$exit_status"
  fi
  if ! rm -rf -- "$LOG_DIR"; then
    echo "failed to remove temporary lane logs: $LOG_DIR" >&2
    exit_status=1
  fi
  exit "$exit_status"
}

trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP
trap cleanup_logs EXIT
echo "lane logs: $LOG_DIR"

# Coverage shards are independent wtr sessions merged afterwards, exactly as CI's matrix does;
# up to COVERAGE_PARALLEL run at once, each on its own deterministic port.
coverage_lane() {
  if [[ "$COVERAGE_PARALLEL" == "1" ]]; then
    WTR_PORT="${WTR_LANE_PORTS[chromium]}" \
      WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[chromium]}" \
      pnpm --filter @aceshooting/lyra-ui test:coverage
    return
  fi
  local failed=0 index pids=()
  rm -rf packages/lyra-ui/coverage
  for index in $(seq 1 "$COVERAGE_SHARDS"); do
    while (( $(jobs -rp | wc -l) >= COVERAGE_PARALLEL )); do wait -n || failed=1; done
    WTR_PORT="$((18090 + index))" \
      WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[chromium]}" \
      pnpm --filter @aceshooting/lyra-ui test:coverage --shard "$index" &
    pids+=("$!")
  done
  for index in "${pids[@]}"; do wait "$index" || failed=1; done
  # Merge even after a failing shard so the complete numbers stay diagnosable.
  pnpm --filter @aceshooting/lyra-ui test:coverage --merge
  return "$failed"
}

lane_chromium() {
  pnpm --filter @aceshooting/lyra-ui check:component-quality:built
  pnpm --filter @aceshooting/lyra-ui test:ssr
  pnpm --filter @aceshooting/lyra-ui test:hydration
  coverage_lane
  pnpm --filter @aceshooting/lyra-ui check:coverage-floors
  WTR_PORT="${WTR_LANE_PORTS[chromium]}" \
    WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[chromium]}" \
    WTR_BROWSER=chromium WTR_STRICT_CONSOLE=1 \
    pnpm --filter @aceshooting/lyra-ui test:scale
  pnpm --filter @aceshooting/lyra-ui check:scale-budgets
}

lane_firefox() {
  WTR_PORT="${WTR_LANE_PORTS[firefox]}" \
    WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[firefox]}" \
    WTR_BROWSER=firefox WTR_STRICT_CONSOLE=1 \
    WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1 \
    pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
}

lane_webkit() {
  WTR_PORT="${WTR_LANE_PORTS[webkit]}" \
    WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[webkit]}" \
    WTR_BROWSER=webkit WTR_STRICT_CONSOLE=1 \
    WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1 \
    pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
}

lane_visual() {
  pnpm docs:build
  for builder_browser in chromium firefox webkit; do
    pnpm check:theme-builder --browser "$builder_browser"
  done
  pnpm --filter @aceshooting/lyra-ui test:visual
}

lane_workspace() {
  pnpm --filter '!@aceshooting/lyra-ui' -r test
}

# Browser pages this host affords: every core but two (scripts/local-parallelism.mjs), at two
# cores and 1 GiB of available memory per page, since each page drives its own browser threads.
# Spending more on the same host is the overcommit that once put a 60-core box at load 71 with 64
# pages, where lr-span-waterfall's and lr-test-results' hover assertions failed spuriously.
PAGE_BUDGET="$(node packages/lyra-ui/scripts/local-parallelism.mjs --cores-per-worker 2 --memory-per-worker-mb 1024)"
PER_SHARD_PAGES="$(( WTR_LANE_CONCURRENCY[firefox] + WTR_LANE_CONCURRENCY[webkit] ))"
# Coverage runs its fixed shards (one page each) concurrently out of the same budget; this is
# coverage-shard-runner.mjs's COVERAGE_SHARD_TOTAL (a tooling test keeps them equal).
COVERAGE_SHARDS=4

# Shards MULTIPLY, they do not divide. In CI each shard owns its own runner, so its
# WTR_CONCURRENCY is all that machine runs; here every shard is another process on the SAME host,
# so the page count is shards x the sum of both engine allocations. Unset, the shard count is
# whatever the page budget leaves after coverage; an explicit request is clamped to the budget
# rather than failing, so it still runs at a size the machine can actually honor.
if [[ -n "${TEST_SH_ENGINE_SHARDS:-}" ]]; then
  ENGINE_SHARDS="$TEST_SH_ENGINE_SHARDS"
  if [[ ! "$ENGINE_SHARDS" =~ ^[1-9][0-9]*$ ]]; then
    echo "TEST_SH_ENGINE_SHARDS must be a positive integer; received: $ENGINE_SHARDS" >&2
    exit 2
  fi
  max_shards="$(( PAGE_BUDGET / PER_SHARD_PAGES ))"
  (( max_shards < 1 )) && max_shards=1
  if (( ENGINE_SHARDS > max_shards )); then
    echo "TEST_SH_ENGINE_SHARDS=$ENGINE_SHARDS would run $((ENGINE_SHARDS * PER_SHARD_PAGES)) concurrent browser pages within a ${PAGE_BUDGET}-page budget; clamping to $max_shards to avoid timing-sensitive failures." >&2
    ENGINE_SHARDS="$max_shards"
  fi
elif [[ "$SERIAL" == "1" ]]; then
  ENGINE_SHARDS=1
else
  ENGINE_SHARDS="$(( (PAGE_BUDGET - COVERAGE_SHARDS) / PER_SHARD_PAGES ))"
  (( ENGINE_SHARDS < 1 )) && ENGINE_SHARDS=1
fi
COVERAGE_PARALLEL=1
if [[ "$SERIAL" != "1" ]]; then
  COVERAGE_PARALLEL="$(( PAGE_BUDGET - ENGINE_SHARDS * PER_SHARD_PAGES ))"
  (( COVERAGE_PARALLEL > COVERAGE_SHARDS )) && COVERAGE_PARALLEL="$COVERAGE_SHARDS"
  (( COVERAGE_PARALLEL < 1 )) && COVERAGE_PARALLEL=1
fi
echo "page budget $PAGE_BUDGET: $ENGINE_SHARDS engine shard(s) x $PER_SHARD_PAGES pages, $COVERAGE_PARALLEL concurrent coverage shard(s)"

# One wtr process per engine shard. Ports stay deterministic and distinct for the same
# EADDRINUSE reason the three base lanes do.
engine_shard_lane() { # browser index
  local browser=$1 index=$2 base
  case "$browser" in
    firefox) base=18100 ;;
    webkit) base=18140 ;;
    *) echo "unknown engine lane: $browser" >&2; return 2 ;;
  esac
  WTR_PORT="$((base + index))" \
    WTR_CONCURRENCY="${WTR_LANE_CONCURRENCY[$browser]}" \
    WTR_BROWSER="$browser" WTR_STRICT_CONSOLE=1 \
    WTR_SHARD_INDEX="$index" WTR_SHARD_TOTAL="$ENGINE_SHARDS" \
    pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
}

# Lane names are plain strings so they can carry a shard suffix; this resolves one to its work.
run_lane() {
  local lane=$1
  case "$lane" in
    firefox:*) engine_shard_lane firefox "${lane#firefox:}" ;;
    webkit:*) engine_shard_lane webkit "${lane#webkit:}" ;;
    *) "lane_$lane" ;;
  esac
}

# A log filename cannot carry the ':' separator.
lane_log() { echo "$LOG_DIR/${1//:/-}.log"; }

LANE_ORDER=(chromium)
if [[ "$ENGINE_SHARDS" == "1" ]]; then
  LANE_ORDER+=(firefox webkit)
else
  for shard_index in $(seq 1 "$ENGINE_SHARDS"); do
    LANE_ORDER+=("firefox:$shard_index" "webkit:$shard_index")
  done
fi
LANE_ORDER+=(visual workspace)
declare -A LANE_PIDS=()
declare -A LANE_STATUS=()

if [[ "$SERIAL" == "1" ]]; then
  for lane in "${LANE_ORDER[@]}"; do
    step "lane: $lane (serial)"
    # An if-condition disables errexit throughout a called function, even when the subshell
    # sets it again. Capture the pipeline status outside a conditional so a failed step stops
    # its lane before a later command can replace the failure with success.
    set +e
    ( set -euo pipefail; run_lane "$lane" ) 2>&1 | tee "$(lane_log "$lane")"
    LANE_STATUS[$lane]=$?
    set -e
  done
else
  for lane in "${LANE_ORDER[@]}"; do
    step "starting lane: $lane"
    ( set -euo pipefail; run_lane "$lane" ) >"$(lane_log "$lane")" 2>&1 &
    LANE_PIDS[$lane]=$!
  done

  for lane in "${LANE_ORDER[@]}"; do
    if wait "${LANE_PIDS[$lane]}"; then
      LANE_STATUS[$lane]=0
    else
      LANE_STATUS[$lane]=1
    fi
  done
fi

overall=0
printf '\n\033[1m== summary ==\033[0m\n'
for lane in "${LANE_ORDER[@]}"; do
  if [[ "${LANE_STATUS[$lane]}" == "0" ]]; then
    printf '  \033[32mPASS\033[0m  %s\n' "$lane"
  else
    printf '  \033[31mFAIL\033[0m  %s   (log: %s/%s.log)\n' "$lane" "$LOG_DIR" "$lane"
    overall=1
  fi
done

if [[ "$overall" != "0" ]]; then
  for lane in "${LANE_ORDER[@]}"; do
    if [[ "${LANE_STATUS[$lane]}" == "1" ]]; then
      printf '\n\033[1;31m-- tail of %s log (%s/%s.log) --\033[0m\n' "$lane" "$LOG_DIR" "$lane"
      tail -n 60 "$(lane_log "$lane")"
    fi
  done
  exit 1
fi

printf '\n\033[32mFull test suite complete: chromium coverage + full firefox/webkit sweep + ssr/hydration/visual + workspace.\033[0m\n'
