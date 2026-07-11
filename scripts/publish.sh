#!/usr/bin/env bash
# Interactive release script for @aceshooting/lyra-ui.
#
# Steps: prompt for new version -> (optionally) upgrade all workspace deps to
# latest -> lint -> test -> build -> manifest -> confirm -> pack -> npm publish
# -> commit + tag -> push -> GitHub Release with artifacts.
#
# Flags:
#   --upgrade-deps   Run `pnpm -r up --latest` before releasing (opt-in; shows
#                     the resulting package.json/lockfile diff and asks for a
#                     separate confirmation). Without this flag, the release
#                     uses whatever dependency versions are already committed
#                     in package.json/pnpm-lock.yaml.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packages/lyra-ui"
PKG_JSON="$PKG_DIR/package.json"
PKG_NAME="@aceshooting/lyra-ui"
TARBALL_STEM="$(node -p "'$PKG_NAME'.replace(/^@/, '').replace('/', '-')")"
GH_HOSTNAME="github.com"
GH_ACCOUNT="aceshooting"

UPGRADE_DEPS=0
for arg in "$@"; do
  case "$arg" in
    --upgrade-deps)
      UPGRADE_DEPS=1
      ;;
    *)
      echo "Error: unrecognized argument '$arg'." >&2
      echo "Usage: $(basename "${BASH_SOURCE[0]}") [--upgrade-deps]" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes before publishing." >&2
  git status --short >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Install it to create the GitHub Release." >&2
  exit 1
fi

# Pin gh to the $GH_ACCOUNT account for this script only, regardless of
# whichever account is globally active via `gh auth switch` on this machine.
GH_TOKEN="$(gh auth token --hostname "$GH_HOSTNAME" --user "$GH_ACCOUNT" 2>/dev/null)" || {
  echo "Error: no stored gh credentials for '$GH_ACCOUNT' on $GH_HOSTNAME. Run 'gh auth login' to add it." >&2
  exit 1
}
export GH_TOKEN

if ! npm whoami >/dev/null 2>&1; then
  echo "Error: not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi

current_version="$(node -p "require('$PKG_JSON').version")"
echo "Current $PKG_NAME version: $current_version"
echo "Releasing as gh account: $(gh api user --jq .login)"
read -rp "New version to publish: " new_version

if [[ -z "$new_version" ]]; then
  echo "Error: version cannot be empty." >&2
  exit 1
fi

if ! [[ "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: '$new_version' does not look like a valid semver version." >&2
  exit 1
fi

if git rev-parse "$new_version" >/dev/null 2>&1; then
  echo "Error: git tag '$new_version' already exists." >&2
  exit 1
fi

if [[ "$UPGRADE_DEPS" -eq 1 ]]; then
  echo
  echo "==> Upgrading all workspace dependencies to latest (--upgrade-deps)"
  pnpm -r up --latest

  echo
  echo "==> Dependency diff from the upgrade:"
  git --no-pager diff -- pnpm-lock.yaml "$ROOT_DIR"/packages/*/package.json || true
  echo
  read -rp "Continue releasing with these upgraded dependencies? [y/N] " upgrade_confirm
  if [[ "$upgrade_confirm" != "y" && "$upgrade_confirm" != "Y" ]]; then
    echo "Aborted after dependency upgrade. Working tree left as-is; revert manually if unwanted (e.g. 'git checkout -- pnpm-lock.yaml packages/*/package.json')." >&2
    exit 1
  fi
else
  echo
  echo "==> Skipping dependency upgrade (pass --upgrade-deps to opt in)"
fi

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
echo "==> Ready to release"
echo "Package:  $PKG_NAME"
echo "Version:  $current_version -> $new_version"
git --no-pager diff --stat -- pnpm-lock.yaml "$PKG_DIR/package.json" "$ROOT_DIR"/packages/*/package.json || true
echo
read -rp "Type 'yes' to publish $PKG_NAME@$new_version to npm, tag $new_version, and create a GitHub Release with artifacts: " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted. No changes were published (local files were still modified by the upgrade/version bump)."
  exit 1
fi

echo
echo "==> Packing tarball"
rm -f "$PKG_DIR/$TARBALL_STEM"-*.tgz
(cd "$PKG_DIR" && pnpm pack)
tarball_path="$PKG_DIR/$TARBALL_STEM-$new_version.tgz"
if [[ ! -f "$tarball_path" ]]; then
  echo "Error: expected tarball not found at $tarball_path" >&2
  exit 1
fi

echo
echo "==> Publishing $tarball_path to npm"
npm publish "$tarball_path" --access public

echo
echo "==> Committing version bump"
git add pnpm-lock.yaml "$PKG_DIR/package.json" "$ROOT_DIR"/packages/*/package.json
if git diff --cached --quiet; then
  echo "No local changes to commit (version/lockfile already up to date on this branch)."
else
  git commit -m "chore(release): $PKG_NAME@$new_version"
fi

echo
echo "==> Tagging $new_version"
git tag -a "$new_version" -m "Release $new_version"

echo
echo "==> Pushing commit and tag"
git push origin HEAD "$new_version"

echo
echo "==> Creating GitHub Release"
release_files=("$tarball_path" "$PKG_DIR/custom-elements.json" "$PKG_DIR/llms.txt" "$PKG_DIR/llms-full.txt")
for f in "${release_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: release artifact missing: $f" >&2
    exit 1
  fi
done
gh release create "$new_version" "${release_files[@]}" \
  --title "$PKG_NAME@$new_version" \
  --generate-notes

echo
echo "Published, tagged, and released $PKG_NAME@$new_version."
