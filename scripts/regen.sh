#!/usr/bin/env bash
# Regenerates every derived/generated artifact in this repo that pnpm lint/build/test do NOT
# regenerate on their own -- the exact freshness surface documented as commonly forgotten before a
# push (manifest, editor data, llms docs, the packaged agent skill, bundle-size budgets, Storybook +
# its sitemap, and -- opt-in only -- visual regression baselines). Run this before committing any
# change that adds/removes/renames a component or changes its public properties/attributes/events/
# CSS parts/CSS custom properties; skipping it is exactly what lets CI's static-checks/
# build-and-coverage/docs-and-storybook/visual-regression jobs go red on a locally-green branch.
#
# This script only WRITES files; it does not fail on drift the way scripts/ci.sh's freshness checks
# do. Run scripts/ci.sh afterward (or just `git status --short` + review the diff) to confirm
# everything landed clean before committing.
#
# Usage:
#   ./scripts/regen.sh                 # build, manifest, editor data, llms, skill package,
#                                       # bundle-size budgets, Storybook + sitemap
#   ./scripts/regen.sh --visual        # ALSO update visual regression baselines (see warning below)
#   ./scripts/regen.sh --visual --filter <story-slug>   # scope the baseline update to one story
#   ./scripts/regen.sh --skip-build    # skip the initial `pnpm build` (already fresh / faster reruns)
#
# Visual baselines are NOT updated by default: packages/lyra-ui/visual-baselines/README.md is
# explicit that an agent-authored baseline update is "unreviewed until a human visually confirms
# it" -- blindly re-blessing every story's baseline can silently paper over a real rendering
# regression. Pass --visual only for a change you've already confirmed renders correctly, and scope
# it with --filter whenever you can. Always look at the resulting PNG(s) before committing them.
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_VISUAL=0
SKIP_BUILD=0
VISUAL_FILTER=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --visual) RUN_VISUAL=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --filter)
      [[ $# -ge 2 ]] || { echo "--filter needs a value" >&2; exit 2; }
      VISUAL_FILTER=(--filter "$2")
      shift 2
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

if [[ "$SKIP_BUILD" != "1" ]]; then
  step "pnpm build"
  pnpm build
fi

step "manifest (custom-elements.json)"
pnpm manifest

step "editor data (vscode-html-data.json / vscode-css-data.json / web-types.json)"
pnpm --filter @aceshooting/lyra-ui run generate-editor-data

step "llms docs (llms-full.txt + llms/**)"
pnpm --filter @aceshooting/lyra-ui run llms

step "plugin skill package (plugins/lyra-ui/skills/lyra-ui/references/ + skills/lyra-ui.skill)"
./package.sh

step "bundle-size budgets (scripts/bundle-budgets.json / scripts/bundle-stats.json)"
pnpm --filter @aceshooting/lyra-ui exec node scripts/check-bundle-size.mjs --write-budgets

step "Storybook + sitemap (storybook-static/, .storybook/sitemap.xml)"
pnpm docs:build

if [[ "$RUN_VISUAL" == "1" ]]; then
  step "visual regression baselines (packages/lyra-ui/visual-baselines/**)"
  warn "Updating visual baselines -- these are unreviewed until a human visually confirms the resulting PNG(s). Do not commit blindly."
  pnpm --filter @aceshooting/lyra-ui exec node scripts/visual-regression.mjs --update-snapshots "${VISUAL_FILTER[@]}"
else
  step "visual regression baselines (skipped -- pass --visual to update)"
fi

step "freshness reports for hand-maintained content (not auto-fixable -- read the output)"
if ! pnpm readme:check; then
  warn "README.md's \"## Status\" version/tag-count line or its Web-Awesome-comparison paragraph is stale -- edit README.md by hand, see the message above."
fi
if ! pnpm docs:check; then
  warn "docs/index.md and/or .storybook/Introduction.mdx has a hand-counted custom-element total that no longer matches the manifest -- bump both by hand, see the message above."
fi
if ! pnpm skill:check; then
  warn "plugins/lyra-ui/.claude-plugin/plugin.json's version and its mirrored entry in .claude-plugin/marketplace.json disagree -- sync them by hand, see the message above."
fi

step "summary: what changed"
CHANGED_PATHS=(
  packages/lyra-ui/custom-elements.json
  packages/lyra-ui/vscode-html-data.json
  packages/lyra-ui/vscode-css-data.json
  packages/lyra-ui/web-types.json
  packages/lyra-ui/llms.txt
  packages/lyra-ui/llms-full.txt
  packages/lyra-ui/llms/
  plugins/lyra-ui/skills/lyra-ui/references/
  skills/lyra-ui.skill
  packages/lyra-ui/scripts/bundle-budgets.json
  packages/lyra-ui/scripts/bundle-stats.json
  storybook-static/
  .storybook/sitemap.xml
  packages/lyra-ui/visual-baselines/
)
git status --short -- "${CHANGED_PATHS[@]}"
printf '\n\033[32mRegeneration complete.\033[0m Review the diff above, then run ./scripts/ci.sh (or at least `pnpm lint`) before committing.\n'
