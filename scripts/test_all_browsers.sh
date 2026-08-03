#!/usr/bin/env bash
# Runs the complete browser-driven test surface on every browser engine currently
# used in CI/platform coverage: Chromium, Firefox, Chrome, Edge, Safari (mapped
# to webkit here). Uses the same shardless full-engine test runner and keeps all
# browser lanes parallel unless requested otherwise.
#
# Usage:
#   ./scripts/test_all_browsers.sh                     # all browsers in parallel
#   ./scripts/test_all_browsers.sh --serial             # run lanes one by one
#   ./scripts/test_all_browsers.sh --browser chrome      # run only Chrome
#   ./scripts/test_all_browsers.sh --browsers chromium,firefox,edge,safari
#   TEST_ALL_BROWSERS_SKIP_INSTALL=1 ./scripts/test_all_browsers.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export CI=true

DEFAULT_BROWSERS=(chromium firefox chrome edge safari)
SERIAL=0
declare -a REQUESTED_BROWSERS=()
declare -A BROWSER_SEEN=()

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/test_all_browsers.sh [options]

Options:
  --serial                  Run browser lanes one at a time
  --browser <name>          Add a browser to the run (can be repeated)
  --browsers <name,name>    Comma-separated browser list to run
  -h, --help               Show this help text

Supported browsers:
  chromium, firefox, chrome, edge, safari, webkit
USAGE
  exit 0
}

normalize_browser() {
  local browser="$1"
  browser="${browser,,}"
  browser="$(printf '%s' "$browser" | xargs)"
  case "$browser" in
    webkit) echo safari ;;
    *) echo "$browser" ;;
  esac
}

add_browser() {
  local browser
  local normalized
  IFS=',' read -r -a browser <<< "$1"
  for browser in "${browser[@]}"; do
    normalized="$(normalize_browser "$browser")"
    case "$normalized" in
      chromium|firefox|chrome|edge|safari)
        if [[ -z "${BROWSER_SEEN[$normalized]:-}" ]]; then
          BROWSER_SEEN[$normalized]=1
          REQUESTED_BROWSERS+=("$normalized")
        fi
        ;;
      *)
        echo "Unsupported browser '$browser'. Use chromium, firefox, chrome, edge, safari, or webkit."
        exit 1
        ;;
    esac
  done
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --serial|-s)
      SERIAL=1
      shift
      ;;
    --browser)
      if [[ $# -lt 2 ]]; then
        echo "--browser requires a browser name argument."
        exit 2
      fi
      add_browser "$2"
      shift 2
      ;;
    --browser=*)
      add_browser "${1#*=}"
      shift
      ;;
    --browsers)
      if [[ $# -lt 2 ]]; then
        echo "--browsers requires a comma-separated browser list argument."
        exit 2
      fi
      add_browser "$2"
      shift 2
      ;;
    --browsers=*)
      add_browser "${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if (( ${#REQUESTED_BROWSERS[@]} == 0 )); then
  REQUESTED_BROWSERS=("${DEFAULT_BROWSERS[@]}")
fi

require_primary_toolchain() {
  local actual_node_major
  actual_node_major="$(node -p 'process.versions.node.split(\".\")[0]')"
  if [[ "$actual_node_major" != "22" ]]; then
    echo "scripts/test_all_browsers.sh requires Node 22 (active: $(node --version)); activate Node 22 first" >&2
    exit 1
  fi

  local expected_pnpm actual_pnpm
  expected_pnpm="$(node -p 'require(\"./package.json\").packageManager.replace(/^pnpm@/, \"\")')"
  actual_pnpm="$(pnpm --version)"
  if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
    echo "scripts/test_all_browsers.sh requires pnpm $expected_pnpm (active: $actual_pnpm)" >&2
    exit 1
  fi
}

map_install_browser() {
  case "$1" in
    edge) echo msedge ;;
    safari) echo webkit ;;
    *) echo "$1" ;;
  esac
}

run_browser_lane() {
  local browser="$1"
  WTR_BROWSER="$browser" WTR_SHARD_INDEX=1 WTR_SHARD_TOTAL=1 WTR_STRICT_CONSOLE=1 \
    pnpm --filter @aceshooting/lyra-ui test:full-engine-shard
}

require_primary_toolchain

if [[ "${TEST_ALL_BROWSERS_SKIP_INSTALL:-0}" != "1" ]]; then
  step "pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
  declare -a install_browsers=()
  declare -A install_seen=()
  for browser in "${REQUESTED_BROWSERS[@]}"; do
    install_browser="$(map_install_browser "$browser")"
    if [[ -z "${install_seen[$install_browser]:-}" ]]; then
      install_seen[$install_browser]=1
      install_browsers+=("$install_browser")
    fi
  done
  step "playwright install ${install_browsers[*]}"
  pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps "${install_browsers[@]}"
fi

step "pnpm build"
pnpm build

LOG_DIR="$(mktemp -d)"
echo "lane logs: $LOG_DIR"

declare -A LANE_PIDS=()
declare -A LANE_STATUS=()

if [[ "$SERIAL" == "1" ]]; then
  for browser in "${REQUESTED_BROWSERS[@]}"; do
    step "lane: $browser (serial)"
    if ( set -euo pipefail; run_browser_lane "$browser" ) 2>&1 | tee "$LOG_DIR/$browser.log"; then
      LANE_STATUS[$browser]=0
    else
      LANE_STATUS[$browser]=1
    fi
  done
else
  for browser in "${REQUESTED_BROWSERS[@]}"; do
    step "starting lane: $browser"
    ( set -euo pipefail; run_browser_lane "$browser" ) >"$LOG_DIR/$browser.log" 2>&1 &
    LANE_PIDS[$browser]=$!
  done

  for browser in "${REQUESTED_BROWSERS[@]}"; do
    if wait "${LANE_PIDS[$browser]}"; then
      LANE_STATUS[$browser]=0
    else
      LANE_STATUS[$browser]=1
    fi
  done
fi

overall=0
printf '\n\033[1m== summary ==\033[0m\n'
for browser in "${REQUESTED_BROWSERS[@]}"; do
  if [[ "${LANE_STATUS[$browser]}" == "0" ]]; then
    printf '  \033[32mPASS\033[0m  %s\n' "$browser"
  else
    printf '  \033[31mFAIL\033[0m  %s   (log: %s/%s.log)\n' "$browser" "$LOG_DIR" "$browser"
    overall=1
  fi
done

if [[ "$overall" != "0" ]]; then
  for browser in "${REQUESTED_BROWSERS[@]}"; do
    if [[ "${LANE_STATUS[$browser]}" == "1" ]]; then
      printf '\n\033[1;31m-- tail of %s log (%s/%s.log) --\033[0m\n' "$browser" "$LOG_DIR" "$browser"
      tail -n 80 "$LOG_DIR/$browser.log"
    fi
  done
  exit 1
fi

printf '\n\033[32mBrowser sweep complete: %s.\033[0m\n' "${REQUESTED_BROWSERS[*]}"
