#!/usr/bin/env bash
# Interactive release script for the @aceshooting/lyra-* workspace packages.
# This is the canonical release entry point; there is intentionally no root-level
# ./publish.sh wrapper. Run .claude/commands/publish.md first, including the
# docs:build and docs:check-show-code gates.
#
# Packages under packages/* are versioned and released independently, driven
# entirely by pending changesets in .changeset/. Steps: ensure main is clean
# and up to date (offering to commit+push pending work instead of failing)
# -> (optionally) upgrade all workspace deps to latest -> ask which of the
# packages with pending changesets to release this run -> consume changesets
# for just those packages -> per-package lint/test/build/manifest -> print a
# full review (versions, bump kind, tags, artifacts) and confirm -> pack ->
# commit -> tag each as "<name>@<version>" -> push -> GitHub Release per
# package with its artifacts. Creating that GitHub Release is what triggers
# the actual `npm publish` -- it runs in .github/workflows/publish.yml, not
# in this script, so it gets npm provenance (only possible from CI).
#
# Flags:
#   --upgrade-deps   Run `pnpm -r up --latest` before the version bump (off by
#                     default). Shows a `git diff` of every affected
#                     package.json/lockfile and requires a separate typed
#                     confirmation before lint/test/build proceed, since this
#                     can silently pull in unrelated major-version bumps.
#
# The sibling website is deployed separately after the release. Its build runs
# ../lyra-ui.com/scripts/build-docs.mjs, which regenerates this Storybook and
# mounts it at https://www.lyra-ui.com/docs/ without a second docs source tree.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# ---------------------------------------------------------------------------
# Discover publishable workspace packages (packages/*/package.json without
# "private": true).
# ---------------------------------------------------------------------------
PKG_DIRS=()
declare -A PKG_NAME
declare -A NAME_TO_DIR
for d in packages/*/; do
  [[ -f "${d}package.json" ]] || continue
  is_private="$(node -p "!!require('./${d}package.json').private")"
  [[ "$is_private" == "true" ]] && continue
  dir="${d%/}"
  name="$(node -p "require('./${d}package.json').name")"
  PKG_DIRS+=("$dir")
  PKG_NAME["$dir"]="$name"
  NAME_TO_DIR["$name"]="$dir"
done

if [[ "${#PKG_DIRS[@]}" -eq 0 ]]; then
  echo "Error: no publishable packages found under packages/*." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  echo "Error: releases must be cut from 'main' (currently on '$current_branch')." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# The working tree must be clean before we start bumping versions. Rather
# than just failing, offer to commit + push whatever is pending.
# ---------------------------------------------------------------------------
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean:"
  git status --short
  echo
  read -rp "Commit and push all of the above to '$current_branch' now, so the release can proceed? Type 'yes' to continue, anything else to abort: " dirty_confirm
  if [[ "$dirty_confirm" != "yes" ]]; then
    echo "Aborted. Commit or stash changes before publishing." >&2
    exit 1
  fi
  read -rp "Commit message [chore: commit pending changes before release]: " dirty_message
  dirty_message="${dirty_message:-chore: commit pending changes before release}"
  git add -A
  git commit -m "$dirty_message"
  git push origin "$current_branch"
fi

echo "==> Checking that local main is up to date with origin/main"
git fetch origin main --quiet
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "Error: local 'main' is behind (or has diverged from) 'origin/main'. Pull/rebase first." >&2
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

echo "Releasing as gh account: $(gh api user --jq .login)"

CHANGESET_FILES=()
while IFS= read -r -d '' f; do
  CHANGESET_FILES+=("$f")
done < <(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' -print0)

if [[ "${#CHANGESET_FILES[@]}" -eq 0 ]]; then
  echo "Error: no pending changesets found in .changeset/. Run 'pnpm changeset' first to describe this release's changes." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Parse each pending changeset's frontmatter to find which package(s) it
# targets, so we can ask which of them to release this run.
# ---------------------------------------------------------------------------
changeset_packages() {
  node -e '
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) process.exit(0);
    const pkgs = [...m[1].matchAll(/^"([^"]+)":\s*(major|minor|patch)\s*$/gm)].map((x) => x[1]);
    console.log(pkgs.join(" "));
  ' "$1"
}

declare -A FILE_PKGS
CANDIDATE_NAMES=()
for f in "${CHANGESET_FILES[@]}"; do
  pkgs="$(changeset_packages "$f")"
  FILE_PKGS["$f"]="$pkgs"
  for p in $pkgs; do
    [[ -n "${NAME_TO_DIR[$p]:-}" ]] || continue
    if [[ ! " ${CANDIDATE_NAMES[*]:-} " == *" $p "* ]]; then
      CANDIDATE_NAMES+=("$p")
    fi
  done
done

if [[ "${#CANDIDATE_NAMES[@]}" -eq 0 ]]; then
  echo "Error: pending changesets don't target any publishable package under packages/*." >&2
  exit 1
fi

echo
echo "==> Packages with pending changesets:"
for i in "${!CANDIDATE_NAMES[@]}"; do
  echo "  $((i + 1))) ${CANDIDATE_NAMES[$i]}"
done
read -rp "Which package(s) do you want to release now? (comma-separated numbers, or 'all') [all]: " selection
selection="${selection:-all}"

SELECTED_NAMES=()
if [[ "$selection" == "all" ]]; then
  SELECTED_NAMES=("${CANDIDATE_NAMES[@]}")
else
  IFS=',' read -ra picks <<< "$selection"
  for pick in "${picks[@]}"; do
    pick="$(echo "$pick" | tr -d '[:space:]')"
    if ! [[ "$pick" =~ ^[0-9]+$ ]] || (( pick < 1 || pick > ${#CANDIDATE_NAMES[@]} )); then
      echo "Error: '$pick' is not a valid choice (1-${#CANDIDATE_NAMES[@]})." >&2
      exit 1
    fi
    SELECTED_NAMES+=("${CANDIDATE_NAMES[$((pick - 1))]}")
  done
fi

# A changeset can't be split package-by-package: if a selected package shares
# a changeset with a package that wasn't picked, that package is pulled in
# too — surface this clearly instead of silently expanding the release.
EFFECTIVE_NAMES=("${SELECTED_NAMES[@]}")
for f in "${CHANGESET_FILES[@]}"; do
  pkgs="${FILE_PKGS[$f]}"
  overlaps=0
  for p in $pkgs; do
    [[ " ${SELECTED_NAMES[*]:-} " == *" $p "* ]] && overlaps=1
  done
  if [[ "$overlaps" -eq 1 ]]; then
    for p in $pkgs; do
      [[ -n "${NAME_TO_DIR[$p]:-}" ]] || continue
      if [[ ! " ${EFFECTIVE_NAMES[*]:-} " == *" $p "* ]]; then
        echo "Note: '$f' also targets '$p', which wasn't selected — including it too (changesets can't be split)." >&2
        EFFECTIVE_NAMES+=("$p")
      fi
    done
  fi
done

DEFER_DIR=""
restore_deferred_changesets() {
  if [[ -n "$DEFER_DIR" && -d "$DEFER_DIR" ]]; then
    shopt -s nullglob
    for f in "$DEFER_DIR"/*.md; do
      mv "$f" .changeset/
    done
    shopt -u nullglob
    rmdir "$DEFER_DIR" 2>/dev/null || true
    DEFER_DIR=""
  fi
}
trap restore_deferred_changesets EXIT

DEFER_DIR="$(mktemp -d)"
for f in "${CHANGESET_FILES[@]}"; do
  pkgs="${FILE_PKGS[$f]}"
  keep=0
  for p in $pkgs; do
    [[ " ${EFFECTIVE_NAMES[*]:-} " == *" $p "* ]] && keep=1
  done
  [[ "$keep" -eq 0 ]] && mv "$f" "$DEFER_DIR/"
done

declare -A OLD_VERSION
for dir in "${PKG_DIRS[@]}"; do
  OLD_VERSION["$dir"]="$(node -p "require('./$dir/package.json').version")"
done

if [[ "$UPGRADE_DEPS" -eq 1 ]]; then
  echo
  echo "==> Upgrading all workspace dependencies to latest (--upgrade-deps)"
  pnpm -r up --latest

  echo
  echo "==> Dependency upgrade diff"
  git --no-pager diff -- pnpm-lock.yaml packages/*/package.json
  echo
  read -rp "Type 'yes' to continue the release with the dependency upgrade shown above: " upgrade_confirm
  if [[ "$upgrade_confirm" != "yes" ]]; then
    echo "Aborted. Dependency upgrade left in the working tree; revert with 'git checkout -- pnpm-lock.yaml packages/*/package.json' if unwanted." >&2
    exit 1
  fi
else
  echo
  echo "==> Skipping dependency upgrade (pass --upgrade-deps to run 'pnpm -r up --latest')"
fi

echo
echo "==> Consuming changesets: bumping version(s) and generating CHANGELOG.md"
pnpm changeset version

restore_deferred_changesets

RELEASE_DIRS=()
for name in "${EFFECTIVE_NAMES[@]}"; do
  dir="${NAME_TO_DIR[$name]}"
  new_version="$(node -p "require('./$dir/package.json').version")"
  if [[ "$new_version" != "${OLD_VERSION[$dir]}" ]]; then
    RELEASE_DIRS+=("$dir")
  fi
done

if [[ "${#RELEASE_DIRS[@]}" -eq 0 ]]; then
  echo "Error: 'pnpm changeset version' did not change any selected package's version." >&2
  exit 1
fi

declare -A NEW_VERSION TAG TARBALL_STEM TARBALL_PATH
for dir in "${RELEASE_DIRS[@]}"; do
  NEW_VERSION["$dir"]="$(node -p "require('./$dir/package.json').version")"
  TAG["$dir"]="$(basename "$dir")@${NEW_VERSION[$dir]}"
  if git rev-parse "${TAG[$dir]}" >/dev/null 2>&1; then
    echo "Error: git tag '${TAG[$dir]}' already exists." >&2
    exit 1
  fi
  TARBALL_STEM["$dir"]="$(node -p "'${PKG_NAME[$dir]}'.replace(/^@/, '').replace('/', '-')")"
done

echo
echo "==> Installing to refresh lockfile"
pnpm install

for dir in "${RELEASE_DIRS[@]}"; do
  name="${PKG_NAME[$dir]}"
  echo
  echo "==> [$name] Lint"
  pnpm --filter "$name" --if-present run lint
  echo
  echo "==> [$name] Test"
  pnpm --filter "$name" --if-present run test
  echo
  echo "==> [$name] Build"
  pnpm --filter "$name" --if-present run build
  echo
  echo "==> [$name] Generate manifest"
  pnpm --filter "$name" --if-present run manifest
done

# ---------------------------------------------------------------------------
# Full review before doing anything irreversible.
# ---------------------------------------------------------------------------
bump_kind() {
  local old="$1" new="$2"
  IFS='.' read -r o_major o_minor o_patch <<< "$old"
  IFS='.' read -r n_major n_minor n_patch <<< "$new"
  if [[ "$n_major" != "$o_major" ]]; then echo major
  elif [[ "$n_minor" != "$o_minor" ]]; then echo minor
  else echo patch
  fi
}
next_version() {
  local ver="$1" level="$2"
  IFS='.' read -r major minor patch <<< "$ver"
  case "$level" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
  esac
}

echo
echo "==> Review — verify everything below before executing"
for dir in "${RELEASE_DIRS[@]}"; do
  old="${OLD_VERSION[$dir]}"
  new="${NEW_VERSION[$dir]}"
  kind="$(bump_kind "$old" "$new")"
  echo
  echo "Package:     ${PKG_NAME[$dir]}"
  echo "Version:     $old -> $new   (${kind} bump, per pending changeset)"
  echo "  if patch:  $(next_version "$old" patch)"
  echo "  if minor:  $(next_version "$old" minor)"
  echo "  if major:  $(next_version "$old" major)"
  echo "Git tag:     ${TAG[$dir]}"
  echo "npm publish: ${PKG_NAME[$dir]}@${new} (--access public, via CI once released)"
done
echo
git --no-pager diff --stat -- pnpm-lock.yaml packages/*/package.json || true
echo
read -rp "Type 'yes' to publish the package(s) above to npm, tag each, and create GitHub Releases: " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted. No changes were published (local files were still modified by the version bump)."
  exit 1
fi

# ---------------------------------------------------------------------------
# From here on, each GitHub Release created below immediately triggers a real
# `npm publish` in CI (.github/workflows/publish.yml, on `release: published`)
# that CANNOT be undone after ~72h (and is discouraged even within that
# window). If anything below fails, don't retry this script from the top for
# packages already released.
# ---------------------------------------------------------------------------
RELEASED_DIRS=()
TAGS_PUSHED=0
publish_recovery_trap() {
  local exit_code=$?
  echo >&2
  echo "==> FAILED during release." >&2
  if [[ "$TAGS_PUSHED" -eq 0 ]]; then
    echo "    Nothing was committed/tagged/pushed yet — fix the issue and re-run this script." >&2
  else
    echo "    Commit + tags are already pushed to origin — do NOT re-run this script from the top (the changesets that were consumed are already gone)." >&2
    if [[ "${#RELEASED_DIRS[@]}" -gt 0 ]]; then
      echo "    Already has a GitHub Release (npm publish is running/queued in CI — do NOT recreate these):" >&2
      for dir in "${RELEASED_DIRS[@]}"; do
        echo "      - ${PKG_NAME[$dir]}@${NEW_VERSION[$dir]} (tag ${TAG[$dir]})" >&2
      done
    fi
    echo "    Still needs a GitHub Release (tag is pushed but no Release exists yet, so CI was never triggered for these):" >&2
    for dir in "${RELEASE_DIRS[@]}"; do
      released=0
      for done_dir in "${RELEASED_DIRS[@]}"; do
        [[ "$dir" == "$done_dir" ]] && released=1
      done
      [[ "$released" -eq 1 ]] && continue
      echo "      - gh release create '${TAG[$dir]}' '${TARBALL_PATH[$dir]:-<tarball>}' '$dir/CHANGELOG.md' --title '${PKG_NAME[$dir]}@${NEW_VERSION[$dir]}' --generate-notes" >&2
    done
    echo "    Watch CI with: gh run list --workflow=publish.yml" >&2
  fi
  exit "$exit_code"
}
trap publish_recovery_trap ERR

for dir in "${RELEASE_DIRS[@]}"; do
  name="${PKG_NAME[$dir]}"
  new_version="${NEW_VERSION[$dir]}"
  stem="${TARBALL_STEM[$dir]}"

  echo
  echo "==> [$name] Packing tarball"
  rm -f "$dir/$stem"-*.tgz
  (cd "$dir" && pnpm pack)
  tarball_path="$dir/$stem-$new_version.tgz"
  if [[ ! -f "$tarball_path" ]]; then
    # Use `false` rather than `exit 1`: an explicit `exit` does NOT run the
    # ERR trap in bash, which would silently skip the recovery message once a
    # prior package in this loop already has a GitHub Release.
    echo "Error: expected tarball not found at $tarball_path" >&2
    false
  fi
  TARBALL_PATH["$dir"]="$tarball_path"
done

echo
echo "==> Committing version bump"
git add pnpm-lock.yaml packages/*/package.json packages/*/CHANGELOG.md .changeset
for dir in "${PKG_DIRS[@]}"; do
  [[ -f "$dir/custom-elements.json" ]] && git add "$dir/custom-elements.json"
done
subject_parts=()
for dir in "${RELEASE_DIRS[@]}"; do
  subject_parts+=("${PKG_NAME[$dir]}@${NEW_VERSION[$dir]}")
done
joined_subjects="$(printf '%s, ' "${subject_parts[@]}")"
commit_subject="chore(release): ${joined_subjects%, }"
if git diff --cached --quiet; then
  echo "No local changes to commit (version/lockfile already up to date on this branch)."
else
  git commit -m "$commit_subject"
fi

echo
echo "==> Tagging"
tag_args=()
for dir in "${RELEASE_DIRS[@]}"; do
  git tag -a "${TAG[$dir]}" -m "Release ${TAG[$dir]}"
  tag_args+=("${TAG[$dir]}")
done

echo
echo "==> Pushing commit and tags"
git push origin HEAD "${tag_args[@]}"
TAGS_PUSHED=1

for dir in "${RELEASE_DIRS[@]}"; do
  name="${PKG_NAME[$dir]}"
  has_manifest_script="$(node -p "!!(require('./$dir/package.json').scripts || {}).manifest")"
  release_files=("${TARBALL_PATH[$dir]}" "$dir/CHANGELOG.md")
  if [[ "$has_manifest_script" == "true" ]]; then
    release_files+=("$dir/custom-elements.json" "$dir/llms.txt" "$dir/llms-full.txt")
  fi
  for f in "${release_files[@]}"; do
    if [[ ! -f "$f" ]]; then
      # See the `false` note above: explicit `exit` would skip the ERR trap.
      echo "Error: release artifact missing: $f" >&2
      false
    fi
  done
  echo
  echo "==> [$name] Creating GitHub Release ${TAG[$dir]} (this triggers npm publish in CI)"
  gh release create "${TAG[$dir]}" "${release_files[@]}" \
    --title "${PKG_NAME[$dir]}@${NEW_VERSION[$dir]}" \
    --generate-notes
  RELEASED_DIRS+=("$dir")
done

trap - ERR

echo
echo "Tagged and released — npm publish is now running in CI for:"
for dir in "${RELEASE_DIRS[@]}"; do
  echo "  - ${PKG_NAME[$dir]}@${NEW_VERSION[$dir]} (tag ${TAG[$dir]})"
done
echo
echo "Watch progress with: gh run list --workflow=publish.yml"
