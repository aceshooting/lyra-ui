#!/usr/bin/env bash
# Interactive release script for @aceshooting/lyra-ui.
#
# Steps: prompt for new version -> upgrade all workspace deps to latest ->
# lint -> test -> build -> manifest -> confirm -> npm publish.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packages/lyra-ui"
PKG_JSON="$PKG_DIR/package.json"
PKG_NAME="@aceshooting/lyra-ui"

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes before publishing." >&2
  git status --short >&2
  exit 1
fi

current_version="$(node -p "require('$PKG_JSON').version")"
echo "Current $PKG_NAME version: $current_version"
read -rp "New version to publish: " new_version

if [[ -z "$new_version" ]]; then
  echo "Error: version cannot be empty." >&2
  exit 1
fi

if ! [[ "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: '$new_version' does not look like a valid semver version." >&2
  exit 1
fi

echo
echo "==> Upgrading all workspace dependencies to latest"
pnpm -r up --latest

echo
echo "==> Setting $PKG_NAME version to $new_version"
node -e "
const fs = require('fs');
const path = '$PKG_JSON';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '$new_version';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo
echo "==> Installing to refresh lockfile"
pnpm install

echo
echo "==> Lint"
pnpm --filter "$PKG_NAME" run lint

echo
echo "==> Test"
pnpm --filter "$PKG_NAME" run test

echo
echo "==> Build"
pnpm --filter "$PKG_NAME" run build

echo
echo "==> Generate custom-elements manifest"
pnpm --filter "$PKG_NAME" run manifest

echo
echo "==> Ready to publish"
echo "Package:  $PKG_NAME"
echo "Version:  $current_version -> $new_version"
git --no-pager diff --stat -- pnpm-lock.yaml "$PKG_DIR/package.json" "$ROOT_DIR"/packages/*/package.json || true
echo
read -rp "Type 'yes' to publish $PKG_NAME@$new_version to npm: " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted. No changes were published (local files were still modified by the upgrade/version bump)."
  exit 1
fi

echo
echo "==> Publishing"
(cd "$PKG_DIR" && pnpm publish --no-git-checks)

echo
echo "Published $PKG_NAME@$new_version."
echo "Don't forget to commit the version bump / dependency upgrades and tag the release."
