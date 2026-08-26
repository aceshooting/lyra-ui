#!/usr/bin/env bash
# Interactive release script for the @aceshooting/lyra-* workspace packages.
# This is the canonical release entry point; there is intentionally no root-level
# ./publish.sh wrapper. Follow the release checklist below, including the docs:build and
# docs:check-show-code gates.
#
# Packages under packages/* are versioned and released independently, driven
# entirely by pending changesets in .changeset/. Steps: ensure main is clean
# and up to date (failing closed when unrelated work is present)
# -> (optionally) run scripts/upgrade.sh for all workspace deps -> ask which of the
# packages with pending changesets to release this run -> consume changesets
# for just those packages -> regenerate version-derived metadata, then per-package
# lint/build/test -> print a
# full review (versions, bump kind, tags, artifacts) and confirm -> pack ->
# commit and push main -> qualify the exact commit in CI, the five-browser sweep, and the
# complete Firefox/WebKit suite -> tag each as "<name>@<version>" -> GitHub Release per
# package with its artifacts. Creating that GitHub Release is what triggers
# the actual `npm publish` -- it runs in .github/workflows/publish.yml, not
# in this script, so it gets npm provenance (only possible from CI).
#
# Flags:
#   --upgrade-deps   Run scripts/upgrade.sh before the version bump (off by
#                     default). Shows a `git diff` of every affected
#                     package.json/lockfile and requires a separate typed
#                     confirmation before the release proceeds, since this can
#                     silently pull in unrelated major-version bumps.
#
# The sibling website is deployed separately after the release. Its build runs
# ../lyra-ui.com/scripts/build-docs.mjs, which regenerates this Storybook and
# mounts it at https://www.lyra-ui.com/docs/ without a second docs source tree.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GH_HOSTNAME="github.com"
GH_ACCOUNT="aceshooting"
GH_REPOSITORY="$GH_ACCOUNT/lyra-ui"

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

# Resolve the destructive push target before offering to commit or push a dirty tree. A checkout
# can retain a valid maintainer gh login while `origin` points at a fork or an unrelated repository;
# publishing must never infer the release destination from that mutable local configuration.
ORIGIN_PUSH_URLS=()
while IFS= read -r url; do
  [[ -n "$url" ]] && ORIGIN_PUSH_URLS+=("$url")
done < <(git remote get-url --push --all origin 2>/dev/null || true)
if [[ "${#ORIGIN_PUSH_URLS[@]}" -ne 1 ]]; then
  echo "Error: origin must have exactly one push URL for $GH_REPOSITORY." >&2
  exit 1
fi
case "${ORIGIN_PUSH_URLS[0]}" in
  "git@$GH_HOSTNAME:$GH_REPOSITORY.git"|"ssh://git@$GH_HOSTNAME/$GH_REPOSITORY.git"|"https://$GH_HOSTNAME/$GH_REPOSITORY"|"https://$GH_HOSTNAME/$GH_REPOSITORY.git") ;;
  *)
    echo "Error: origin push URL '${ORIGIN_PUSH_URLS[0]}' is not the canonical $GH_REPOSITORY repository." >&2
    exit 1
    ;;
esac
ORIGIN_FETCH_URLS=()
while IFS= read -r url; do
  [[ -n "$url" ]] && ORIGIN_FETCH_URLS+=("$url")
done < <(git remote get-url --all origin 2>/dev/null || true)
if [[ "${#ORIGIN_FETCH_URLS[@]}" -ne 1 ]]; then
  echo "Error: origin must have exactly one fetch URL for $GH_REPOSITORY." >&2
  exit 1
fi
case "${ORIGIN_FETCH_URLS[0]}" in
  "git@$GH_HOSTNAME:$GH_REPOSITORY.git"|"ssh://git@$GH_HOSTNAME/$GH_REPOSITORY.git"|"https://$GH_HOSTNAME/$GH_REPOSITORY"|"https://$GH_HOSTNAME/$GH_REPOSITORY.git") ;;
  *)
    echo "Error: origin fetch URL '${ORIGIN_FETCH_URLS[0]}' is not the canonical $GH_REPOSITORY repository." >&2
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# The working tree must be clean before we start bumping versions. Never sweep unrelated
# maintainer work into a release commit: the caller must review and commit it separately.
# ---------------------------------------------------------------------------
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is not clean; refusing to include unrelated changes in a release:" >&2
  git status --short >&2
  echo "Commit or stash all changes, review the resulting clean tree, and run this script again." >&2
  exit 1
fi

echo "==> Checking that local main is up to date with origin/main"
git fetch origin main --quiet
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "Error: local 'main' is behind (or has diverged from) 'origin/main'. Pull/rebase first." >&2
  exit 1
fi

# The exact commit this release is built from -- captured now, before the version bump below
# rewrites package.json/CHANGELOG.md/package-metadata.ts, so it always names a real pushed commit
# GitHub actually ran CI against. Used below to skip the redundant local `test` re-run per package
# once that CI run is confirmed green for this exact SHA.
PRE_BUMP_SHA="$(git rev-parse HEAD)"

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

releasing_login="$(GH_TOKEN="$GH_TOKEN" gh api user --jq .login)"
echo "Releasing as gh account: $releasing_login"
resolved_repository="$(GH_TOKEN="$GH_TOKEN" gh api "repos/$GH_REPOSITORY" --jq .full_name)"
if [[ "$resolved_repository" != "$GH_REPOSITORY" ]]; then
  echo "Error: GitHub resolved '$GH_REPOSITORY' as '$resolved_repository'." >&2
  exit 1
fi

# True only if every check-run GitHub has recorded for $1 (a commit SHA) is both completed and
# non-failing (success/neutral/skipped). Fails closed -- any API error, zero check-runs (CI hasn't
# started, or hasn't been reported yet), or a still-running/failed/cancelled check-run all count as
# "not confirmed passing" -- so a transient network hiccup or an in-flight run never gets read as a
# green light to skip real local verification.
ci_confirmed_green_for_sha() {
  local sha="$1" check_runs status conclusion
  check_runs="$(GH_TOKEN="$GH_TOKEN" gh api "repos/$GH_REPOSITORY/commits/$sha/check-runs" --paginate \
    --jq '.check_runs[] | "\(.status)\t\(.conclusion // "pending")"' 2>/dev/null)" || return 1
  [[ -z "$check_runs" ]] && return 1
  while IFS=$'\t' read -r status conclusion; do
    [[ "$status" == "completed" ]] || return 1
    case "$conclusion" in
      success|neutral|skipped) ;;
      *) return 1 ;;
    esac
  done <<< "$check_runs"
  return 0
}

CHANGESET_FILES=()
while IFS= read -r -d '' f; do
  CHANGESET_FILES+=("$f")
done < <(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' -print0)

if [[ "${#CHANGESET_FILES[@]}" -eq 0 ]]; then
  echo "Error: no pending changesets found in .changeset/. Run 'pnpm changeset' first to describe this release's changes." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Ask Changesets itself to parse the pending YAML, then consume its JSON plan. This accepts every
# frontmatter spelling the CLI accepts (including single-quoted package names) and fails closed if
# the status schema or a per-file mapping is missing.
# ---------------------------------------------------------------------------
changeset_plan="$(node scripts/changeset-release-plan.mjs)"
declare -A CHANGESET_PLAN_PACKAGES
declare -A CHANGESET_PLAN_IDS
while IFS=$'\t' read -r changeset_id packages; do
  [[ -n "$changeset_id" ]] || continue
  CHANGESET_PLAN_IDS["$changeset_id"]=1
  CHANGESET_PLAN_PACKAGES["$changeset_id"]="$packages"
done <<< "$changeset_plan"

declare -A FILE_PKGS
CANDIDATE_NAMES=()
for f in "${CHANGESET_FILES[@]}"; do
  changeset_id="${f##*/}"
  changeset_id="${changeset_id%.md}"
  if [[ "${CHANGESET_PLAN_IDS[$changeset_id]:-0}" -ne 1 ]]; then
    echo "Error: Changesets status did not return a release plan for '$f'." >&2
    exit 1
  fi
  pkgs="${CHANGESET_PLAN_PACKAGES[$changeset_id]:-}"
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
# too. Compute the transitive closure: A+B and B+C means selecting A must also
# include C, otherwise the second changeset would remain pending against a B
# version that this run had already released.
EFFECTIVE_NAMES=("${SELECTED_NAMES[@]}")
closure_changed=1
while [[ "$closure_changed" -eq 1 ]]; do
  closure_changed=0
  for f in "${CHANGESET_FILES[@]}"; do
    pkgs="${FILE_PKGS[$f]}"
    overlaps=0
    for p in $pkgs; do
      [[ " ${EFFECTIVE_NAMES[*]:-} " == *" $p "* ]] && overlaps=1
    done
    if [[ "$overlaps" -eq 1 ]]; then
      for p in $pkgs; do
        [[ -n "${NAME_TO_DIR[$p]:-}" ]] || continue
        if [[ ! " ${EFFECTIVE_NAMES[*]:-} " == *" $p "* ]]; then
          echo "Note: '$f' also targets '$p', which wasn't selected — including it too (changesets can't be split)." >&2
          EFFECTIVE_NAMES+=("$p")
          closure_changed=1
        fi
      done
    fi
  done
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
  WORKSPACE_UPGRADE_SCRIPT="$ROOT_DIR/scripts/upgrade.sh"
  if [[ ! -f "$WORKSPACE_UPGRADE_SCRIPT" ]]; then
    echo "Error: workspace upgrade script not found at $WORKSPACE_UPGRADE_SCRIPT." >&2
    exit 1
  fi
  echo
  echo "==> Upgrading all workspace dependencies to latest (--upgrade-deps)"
  bash "$WORKSPACE_UPGRADE_SCRIPT"

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
  echo "==> Skipping dependency upgrade (pass --upgrade-deps to run scripts/upgrade.sh)"
fi

echo
echo "==> Consuming changesets: bumping version(s) and generating CHANGELOG.md"
pnpm changeset version

restore_deferred_changesets

RELEASE_DIRS=()
AUTO_EXPANDED_RELEASE_DIRS=()
LYRA_UI_RELEASED=0
# Changesets can bump a publishable dependent even when no selected changeset names it (for
# example, a peer-range change can require a major dependent bump). The filesystem version delta,
# not the pre-version plan, is therefore the authoritative release set.
for dir in "${PKG_DIRS[@]}"; do
  new_version="$(node -p "require('./$dir/package.json').version")"
  if [[ "$new_version" != "${OLD_VERSION[$dir]}" ]]; then
    RELEASE_DIRS+=("$dir")
    [[ "$dir" == "packages/lyra-ui" ]] && LYRA_UI_RELEASED=1
    name="${PKG_NAME[$dir]}"
    if [[ ! " ${EFFECTIVE_NAMES[*]:-} " == *" $name "* ]]; then
      AUTO_EXPANDED_RELEASE_DIRS+=("$dir")
    fi
  fi
done

if [[ "${#RELEASE_DIRS[@]}" -eq 0 ]]; then
  echo "Error: 'pnpm changeset version' did not change any selected package's version." >&2
  exit 1
fi

if [[ "${#AUTO_EXPANDED_RELEASE_DIRS[@]}" -gt 0 ]]; then
  echo
  echo "==> Changesets expanded the release to publishable dependents"
  for dir in "${AUTO_EXPANDED_RELEASE_DIRS[@]}"; do
    echo "  - ${PKG_NAME[$dir]}: ${OLD_VERSION[$dir]} -> $(node -p "require('./$dir/package.json').version")"
  done
  echo "These packages must be generated, tested, packed, tagged, and published with this release."
  echo "Review them explicitly below; answer anything other than 'yes' at the final gate to abort."
fi

declare -A NEW_VERSION TAG TARBALL_STEM TARBALL_PATH HAS_MANIFEST_SCRIPT
for dir in "${RELEASE_DIRS[@]}"; do
  NEW_VERSION["$dir"]="$(node -p "require('./$dir/package.json').version")"
  if [[ ! "${NEW_VERSION[$dir]}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "Error: ${PKG_NAME[$dir]} version '${NEW_VERSION[$dir]}' is not a stable core semver." >&2
    echo "Prereleases and build-metadata versions require an explicit npm dist-tag policy and are not supported by this release flow." >&2
    exit 1
  fi
  TAG["$dir"]="$(basename "$dir")@${NEW_VERSION[$dir]}"
  if git show-ref --verify --quiet "refs/tags/${TAG[$dir]}"; then
    echo "Error: git tag '${TAG[$dir]}' already exists." >&2
    exit 1
  fi
  remote_tag="$(git ls-remote --tags origin "refs/tags/${TAG[$dir]}")"
  if [[ -n "$remote_tag" ]]; then
    echo "Error: git tag '${TAG[$dir]}' already exists on origin." >&2
    exit 1
  fi
  TARBALL_STEM["$dir"]="$(node -p "'${PKG_NAME[$dir]}'.replace(/^@/, '').replace('/', '-')")"
  HAS_MANIFEST_SCRIPT["$dir"]="$(node -p "!!(require('./$dir/package.json').scripts || {}).manifest")"
done

echo
echo "==> Installing to refresh lockfile"
pnpm install

for dir in "${RELEASE_DIRS[@]}"; do
  name="${PKG_NAME[$dir]}"
  echo
  echo "==> [$name] Generate package metadata"
  pnpm --filter "$name" --if-present run package-metadata
  echo
  echo "==> [$name] Generate initial manifest"
  pnpm --filter "$name" --if-present run manifest
  echo
  echo "==> [$name] Generate component metadata"
  pnpm --filter "$name" --if-present run component-metadata
  echo
  echo "==> [$name] Regenerate manifest with current component metadata"
  pnpm --filter "$name" --if-present run manifest
  echo
  echo "==> [$name] Generate default-string slices"
  pnpm --filter "$name" --if-present run default-string-slices
  echo
  echo "==> [$name] Generate framework types"
  pnpm --filter "$name" --if-present run framework-types
  echo
  echo "==> [$name] Generate design-token artifacts"
  pnpm --filter "$name" --if-present run design-tokens
  echo
  echo "==> [$name] Generate editor data"
  pnpm --filter "$name" --if-present run generate-editor-data
  echo
  echo "==> [$name] Generate LLM reference artifacts"
  # Must run before Lint: lint's own check-llms-freshness.mjs/check-llms-artifacts.mjs verify
  # llms/ against the just-regenerated manifest and the package-metadata-embedded version, both
  # of which this loop already updated above -- running llms generation after lint (as this loop
  # used to) meant every release that changed manifest content or bumped the version failed
  # lint on stale llms/ output, since nothing had regenerated it yet.
  pnpm --filter "$name" --if-present run llms
  echo
  echo "==> [$name] Lint"
  pnpm --filter "$name" --if-present run lint
  echo
  echo "==> [$name] Build"
  pnpm --filter "$name" --if-present run build
  echo
  echo "==> [$name] Check public API release bump"
  pnpm --filter "$name" --if-present run check:public-api
  echo
  echo "==> [$name] Generate built component-quality evidence"
  pnpm --filter "$name" --if-present run component-quality
  echo
  echo "==> [$name] Test"
  if ci_confirmed_green_for_sha "$PRE_BUMP_SHA"; then
    echo "Skipping local re-run: GitHub CI already ran and passed in full for $PRE_BUMP_SHA" \
      "(the exact commit this release is built from, before this script's own version bump)."
  else
    pnpm --filter "$name" --if-present run test
  fi
done

if [[ "$LYRA_UI_RELEASED" -eq 1 ]]; then
  echo
  echo "==> [@aceshooting/lyra-ui] Synchronize Claude/Codex plugin versions"
  node scripts/sync-plugin-version.mjs
  echo
  echo "==> [@aceshooting/lyra-ui] Regenerate plugin references and standalone skill archives"
  ./package.sh
  echo
  echo "==> [@aceshooting/lyra-ui] Verify plugin and marketplace contracts"
  pnpm skill:check
fi

echo
echo "==> Updating and checking README release status"
node scripts/update-readme-status.mjs
pnpm readme:check

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
  release_reason="per pending changeset"
  if [[ " ${AUTO_EXPANDED_RELEASE_DIRS[*]:-} " == *" $dir "* ]]; then
    release_reason="Changesets auto-expanded dependent"
  fi
  echo "Version:     $old -> $new   (${kind} bump, $release_reason)"
  echo "  if patch:  $(next_version "$old" patch)"
  echo "  if minor:  $(next_version "$old" minor)"
  echo "  if major:  $(next_version "$old" major)"
  echo "Git tag:     ${TAG[$dir]}"
  echo "npm publish: ${PKG_NAME[$dir]}@${new} (--access public, via CI once released)"
done
echo
echo "Complete release worktree (the script started clean, so every entry must be intended):"
git status --short
echo
git --no-pager diff --stat || true
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
RELEASE_COMMIT_PUSHED=0
QUALIFICATION_PASSED=0
TAGS_PUSHED=0
print_release_recovery_command() {
  local dir="$1"
  local tarball="${TARBALL_PATH[$dir]:-<tarball>}"
  local -a command=(gh release create "${TAG[$dir]}" "$tarball" "$dir/CHANGELOG.md")
  if [[ "${HAS_MANIFEST_SCRIPT[$dir]}" == "true" ]]; then
    command+=("$dir/custom-elements.json" "$dir/llms.txt" "$dir/llms-full.txt")
  fi
  command+=(--repo "$GH_REPOSITORY" --title "${PKG_NAME[$dir]}@${NEW_VERSION[$dir]}" --generate-notes)
  printf '      -' >&2
  printf ' %q' "${command[@]}" >&2
  printf '\n' >&2
}
publish_recovery_trap() {
  local exit_code=$?
  echo >&2
  echo "==> FAILED during release." >&2
  if [[ "$RELEASE_COMMIT_PUSHED" -eq 0 ]]; then
    echo "    No release commit, tag, or GitHub Release was pushed." >&2
    echo "    Local release edits, consumed changesets, tarballs, or a local commit may remain." >&2
    echo "    Inspect git status and git log before either restoring that local state or resuming manually; do not blindly re-run the script." >&2
  elif [[ "$QUALIFICATION_PASSED" -eq 0 ]]; then
    echo "    The release commit is already on origin/main, but exact-commit qualification did not pass." >&2
    echo "    No release tag or GitHub Release was created. Do NOT tag or release this commit unless its push CI, all five Test All Browsers jobs, and every dispatched full-engine shard succeed." >&2
    echo "    Fix the failing qualification on main and rebuild/revalidate release artifacts from the eventual exact green commit." >&2
  elif [[ "$TAGS_PUSHED" -eq 0 ]]; then
    echo "    The release commit passed exact-commit qualification, but the atomic tag push did not complete." >&2
    echo "    No GitHub Release was created. Inspect local refs with 'git show-ref --tags' and origin refs with 'git ls-remote --tags origin' before retrying only the atomic tag push." >&2
  else
    echo "    Release commit and tags are already pushed to origin — do NOT re-run this script from the top." >&2
    if [[ "${#RELEASED_DIRS[@]}" -gt 0 ]]; then
      echo "    Already has a GitHub Release (npm publish is running/queued in CI — do NOT recreate these):" >&2
      for dir in "${RELEASED_DIRS[@]}"; do
        echo "      - ${PKG_NAME[$dir]}@${NEW_VERSION[$dir]} (tag ${TAG[$dir]})" >&2
      done
    fi
    echo "    Still needs a GitHub Release (the complete qualified artifact set is included below):" >&2
    for dir in "${RELEASE_DIRS[@]}"; do
      released=0
      for done_dir in "${RELEASED_DIRS[@]}"; do
        [[ "$dir" == "$done_dir" ]] && released=1
      done
      [[ "$released" -eq 1 ]] && continue
      print_release_recovery_command "$dir"
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
  release_files=("$tarball_path" "$dir/CHANGELOG.md")
  if [[ "${HAS_MANIFEST_SCRIPT[$dir]}" == "true" ]]; then
    release_files+=("$dir/custom-elements.json" "$dir/llms.txt" "$dir/llms-full.txt")
  fi
  for release_file in "${release_files[@]}"; do
    if [[ ! -f "$release_file" ]]; then
      echo "Error: release artifact missing before commit: $release_file" >&2
      false
    fi
  done
done

echo
echo "==> Committing version bump"
git add README.md pnpm-lock.yaml packages/*/package.json packages/*/CHANGELOG.md .changeset
for dir in "${PKG_DIRS[@]}"; do
  [[ -f "$dir/custom-elements.json" ]] && git add "$dir/custom-elements.json"
  # The explicit preflight generators and `pnpm pack`'s prepack lifecycle re-stamp the new
  # version into these files. Stage the complete version-derived set so the release commit and
  # packed bytes describe the same package version.
  [[ -f "$dir/src/internal/package-metadata.ts" ]] && git add "$dir/src/internal/package-metadata.ts"
  [[ -f "$dir/scripts/fixtures/component-metadata.json" ]] && git add "$dir/scripts/fixtures/component-metadata.json"
  [[ -f "$dir/scripts/fixtures/component-inventory.json" ]] && git add "$dir/scripts/fixtures/component-inventory.json"
  [[ -f "$dir/scripts/fixtures/component-qualification.json" ]] && git add "$dir/scripts/fixtures/component-qualification.json"
  [[ -f "$dir/scripts/fixtures/component-integration.json" ]] && git add "$dir/scripts/fixtures/component-integration.json"
  [[ -f "$dir/vscode-html-data.json" ]] && git add "$dir/vscode-html-data.json"
  [[ -f "$dir/vscode-css-data.json" ]] && git add "$dir/vscode-css-data.json"
  [[ -f "$dir/web-types.json" ]] && git add "$dir/web-types.json"
  [[ -f "$dir/llms.txt" ]] && git add "$dir/llms.txt"
  [[ -f "$dir/llms-full.txt" ]] && git add "$dir/llms-full.txt"
  [[ -d "$dir/llms" ]] && git add "$dir/llms"
  [[ -f "$dir/src/custom-elements-jsx.ts" ]] && git add "$dir/src/custom-elements-jsx.ts"
  [[ -f "$dir/src/svelte.ts" ]] && git add "$dir/src/svelte.ts"
  [[ -f "$dir/src/vue.ts" ]] && git add "$dir/src/vue.ts"
  [[ -f "$dir/design-tokens.json" ]] && git add "$dir/design-tokens.json"
  [[ -f "$dir/src/styles/design-tokens.css" ]] && git add "$dir/src/styles/design-tokens.css"
  [[ -f "$dir/scripts/fixtures/token-docs.generated.json" ]] && git add "$dir/scripts/fixtures/token-docs.generated.json"
  [[ -f "$dir/scripts/fixtures/token-editor.generated.json" ]] && git add "$dir/scripts/fixtures/token-editor.generated.json"
  # generate-component-metadata.mjs --write re-annotates a component's own @status/@since JSDoc
  # (writeSourceAnnotations()) whenever the version bump moves it across a maturity threshold --
  # which specific component files that touches is dynamic, not a fixed list this script can
  # enumerate above. The preflight guarantees a clean tree at script start, so any diff still
  # remaining under src/ at this point is, by construction, generated by this loop's own steps,
  # not pre-existing work -- safe to stage in full rather than silently leaving it unstaged.
  [[ -d "$dir/src" ]] && git add "$dir/src"
done
if [[ "$LYRA_UI_RELEASED" -eq 1 ]]; then
  git add \
    .claude-plugin/marketplace.json \
    docs/component-integration.md \
    docs/component-quality.md \
    plugins/lyra-ui/.claude-plugin/plugin.json \
    plugins/lyra-ui/.codex-plugin/plugin.json \
    plugins/lyra-ui/skills/lyra-ui/CHANGELOG.md \
    plugins/lyra-ui/skills/lyra-ui/references/ \
    skills/lyra-ui.skill \
    skills/compose-lyra-interfaces.skill
fi
[[ -f .storybook/token-preview.generated.js ]] && git add .storybook/token-preview.generated.js
unexpected_tracked_changes="$(git diff --name-only)"
if [[ -n "$unexpected_tracked_changes" ]]; then
  echo "Error: release generation left unexpected unstaged tracked changes:" >&2
  while IFS= read -r changed_file; do
    [[ -n "$changed_file" ]] && echo "  $changed_file" >&2
  done <<< "$unexpected_tracked_changes"
  echo "Review and enroll or revert those files before attempting the release again." >&2
  exit 1
fi
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

release_sha="$(git rev-parse HEAD^{commit})"
echo
echo "==> Pushing release commit $release_sha to origin/main"
git push origin "$release_sha:refs/heads/main"
RELEASE_COMMIT_PUSHED=1
remote_main_sha="$(git ls-remote origin refs/heads/main | cut -f1)"
if [[ "$remote_main_sha" != "$release_sha" ]]; then
  echo "Error: origin/main resolved to '$remote_main_sha' after push, expected '$release_sha'." >&2
  false
fi

# Qualify the exact release commit before creating any release ref. The push above starts CI;
# dispatch both manually-triggered suites from main while it still resolves to the same SHA, then
# require exact push/main CI and workflow_dispatch/main runs for all three workflows to pass.
echo
echo "==> Dispatching full browser-engine suite for $release_sha from main"
GH_TOKEN="$GH_TOKEN" gh workflow run full-engine.yml --repo "$GH_REPOSITORY" --ref main
echo "==> Dispatching Test All Browsers for $release_sha from main"
GH_TOKEN="$GH_TOKEN" gh workflow run test-all-browsers.yml \
  --repo "$GH_REPOSITORY" \
  --ref main \
  -f browsers=chromium,firefox,chrome,edge,safari
GH_TOKEN="$GH_TOKEN" node scripts/release-integrity.mjs wait-ci \
  --repository "$GH_REPOSITORY" \
  --sha "$release_sha" \
  --workflow ci.yml \
  --timeout-seconds 3600 \
  --poll-seconds 20
GH_TOKEN="$GH_TOKEN" node scripts/release-integrity.mjs wait-test-all-browsers \
  --repository "$GH_REPOSITORY" \
  --sha "$release_sha" \
  --workflow test-all-browsers.yml \
  --timeout-seconds 7200 \
  --poll-seconds 20
GH_TOKEN="$GH_TOKEN" node scripts/release-integrity.mjs wait-full-engine \
  --repository "$GH_REPOSITORY" \
  --sha "$release_sha" \
  --workflow full-engine.yml \
  --timeout-seconds 7200 \
  --poll-seconds 20

# The exact qualified commit remains the only valid release target even if another local process
# moves HEAD or edits the checkout during the potentially long CI wait. Fail closed on either kind
# of drift, and pass the captured SHA explicitly to every tag command below.
current_head="$(git rev-parse HEAD^{commit})"
if [[ "$current_head" != "$release_sha" ]]; then
  echo "Error: local HEAD moved during exact-commit qualification: expected '$release_sha', found '$current_head'." >&2
  false
fi
qualification_status="$(git status --porcelain)"
if [[ -n "$qualification_status" ]]; then
  echo "Error: working tree changed during exact-commit qualification; refusing to create release tags:" >&2
  printf '%s\n' "$qualification_status" >&2
  false
fi
QUALIFICATION_PASSED=1

echo
echo "==> Creating annotated release tags after qualification"
tag_args=()
for dir in "${RELEASE_DIRS[@]}"; do
  git tag -a "${TAG[$dir]}" -m "Release ${TAG[$dir]}" "$release_sha"
  tag_args+=("${TAG[$dir]}")
done

echo
echo "==> Pushing release tags atomically"
# A multi-package release is one unit. Without an atomic push, a remote tag collision or hook
# rejection can leave only a subset of its tags on origin. GitHub supports atomic ref updates, so
# require it; the already-qualified main commit does not need to be pushed a second time.
git push --atomic origin "${tag_args[@]}"
TAGS_PUSHED=1

for dir in "${RELEASE_DIRS[@]}"; do
  name="${PKG_NAME[$dir]}"
  release_files=("${TARBALL_PATH[$dir]}" "$dir/CHANGELOG.md")
  if [[ "${HAS_MANIFEST_SCRIPT[$dir]}" == "true" ]]; then
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
  GH_TOKEN="$GH_TOKEN" gh release create "${TAG[$dir]}" "${release_files[@]}" \
    --repo "$GH_REPOSITORY" \
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

# ---------------------------------------------------------------------------
# A release is not finished when npm has the tarball. The documented upgrade workflow tells every
# consumer -- and every upgrading agent -- to fetch https://www.lyra-ui.com/changelog.json and read
# the releases between their installed version and its "latest". That feed is built by the sibling
# lyra-ui.com repository and deployed separately, so between this point and that deploy it still
# advertises the PREVIOUS release as current.
#
# Consumers reported that window twice, from two different projects, on two consecutive releases
# (site 11.0.0 vs npm 11.1.0, then site 11.1.0 vs npm 11.2.0). It fails silently and it inverts the
# workflow's own advice: a reader who trusts the feed concludes they are already current and never
# reads the new release. One of those skipped releases contained a bug fix they were waiting for.
#
# So the release does not end quietly here any more. This waits for npm, then for the feed, and
# says exactly what to do while it waits. It runs after the tags and GitHub Releases already exist,
# which is deliberate: it can no longer undo anything, and its whole job is to stop the maintainer
# walking away believing the release is complete when the half consumers actually read is stale.
# ---------------------------------------------------------------------------
primary_dir=""
for dir in "${RELEASE_DIRS[@]}"; do
  if [[ "${PKG_NAME[$dir]}" == "@aceshooting/lyra-ui" ]]; then primary_dir="$dir"; fi
done

if [[ -n "$primary_dir" ]]; then
  echo
  echo "==> Verifying the published upgrade feed catches up (npm + changelog.json)"
  echo "    If this waits, deploy the sibling site now: cd ../lyra-ui.com and sync + deploy it."
  if node scripts/release-integrity.mjs verify-site-freshness \
    --package "${PKG_NAME[$primary_dir]}" \
    --version "${NEW_VERSION[$primary_dir]}" \
    --timeout-seconds 3600 \
    --poll-seconds 30; then
    echo "Release complete: npm and the published upgrade feed agree."
  else
    echo
    echo "!! RELEASE INCOMPLETE — npm has the release but the published feed does not." >&2
    echo "!! Consumers following the documented upgrade workflow will not see this version." >&2
    echo "!! Deploy ../lyra-ui.com, then re-run:" >&2
    echo "!!   node scripts/release-integrity.mjs verify-site-freshness \\" >&2
    echo "!!     --package ${PKG_NAME[$primary_dir]} --version ${NEW_VERSION[$primary_dir]}" >&2
    exit 1
  fi
fi
