#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

pnpm --filter @aceshooting/lyra-ui test:visual -- --update-snapshots
