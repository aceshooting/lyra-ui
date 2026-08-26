#!/usr/bin/env bash
# Regenerates the repository's derived artifacts in dependency order: source metadata and
# localization slices, public manifests and inventory metadata, registration/autoloader/event/
# framework/token surfaces, build-derived quality and size statistics, editor/LLM data, packaged
# skills, and Storybook. Visual baselines remain an explicit reviewed opt-in. Run this before
# committing any public-surface change so every downstream artifact is derived from the same source.
#
# This script only WRITES files; it does not fail on drift the way scripts/ci.sh's freshness checks
# do. Run scripts/ci.sh afterward (or just `git status --short` + review the diff) to confirm
# everything landed clean before committing.
#
# Usage:
#   ./scripts/regen.sh                 # regenerate all non-visual derived artifacts
#   ./scripts/regen.sh --visual        # promote an already-reviewed candidate set (guarded)
#   ./scripts/regen.sh --visual --filter <story-slug>   # scope promotion to one reviewed story
#   ./scripts/regen.sh --skip-build    # reuse an already-fresh dist/ for built measurements
#
# Visual baselines are NOT promoted by default. `--visual` copies the exact hash-bound candidates
# from a preceding normal harness run and refuses to act until manifest.json contains a real,
# complete human-review record. See packages/lyra-ui/visual-baselines/README.md; never fabricate the
# reviewer/date fields or use this switch for agent-only inspection.
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

step "package metadata (src/internal/package-metadata.ts)"
pnpm --filter @aceshooting/lyra-ui run package-metadata

step "default-string component slices"
pnpm --filter @aceshooting/lyra-ui run default-string-slices

step "initial manifest (custom-elements.json)"
pnpm manifest

step "component inventory from digest-pinned public upstream manifests"
pnpm --filter @aceshooting/lyra-ui run component-inventory

step "component release metadata and source annotations"
pnpm --filter @aceshooting/lyra-ui run component-metadata

step "final manifest after component metadata annotations"
pnpm manifest

step "final component inventory after the annotated manifest"
pnpm --filter @aceshooting/lyra-ui run component-inventory

step "registration entries, root allowlist, tag aliases, and sideEffects"
pnpm registrations

step "autoloader manifest"
pnpm --filter @aceshooting/lyra-ui run autoloader-manifest

step "typed global event surface"
pnpm --filter @aceshooting/lyra-ui run events

step "framework type surfaces"
pnpm --filter @aceshooting/lyra-ui run framework-types

step "semantic, chart, and terminal palette artifacts"
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-palette.mjs
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-chart-palette.mjs
pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-terminal-palette.mjs

step "design-token artifacts"
pnpm --filter @aceshooting/lyra-ui run design-tokens

if [[ "$SKIP_BUILD" != "1" ]]; then
  step "pnpm build"
  pnpm build
fi

step "component qualification and integration evidence"
pnpm --filter @aceshooting/lyra-ui run component-quality

step "measured bundle-size statistics (reviewed budgets are never generated)"
pnpm --filter @aceshooting/lyra-ui exec node scripts/check-bundle-size.mjs --write-stats

step "editor data (vscode-html-data.json / vscode-css-data.json / web-types.json)"
pnpm --filter @aceshooting/lyra-ui run generate-editor-data

step "llms docs (llms-full.txt + llms/**)"
pnpm --filter @aceshooting/lyra-ui run llms

step "Claude/Codex plugin manifest versions"
pnpm plugin:sync

step "plugin skill packages (generated API references + skills/*.skill)"
./package.sh

step "Storybook + sitemap (storybook-static/, .storybook/sitemap.xml)"
pnpm docs:build

if [[ "$RUN_VISUAL" == "1" ]]; then
  step "promote reviewed visual candidates (packages/lyra-ui/visual-baselines/**)"
  warn "Promotion requires a complete human-review record and copies only the exact hash-bound candidates from the preceding reviewed run."
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
  warn "The Claude/Codex plugin manifests, marketplace entries, or repo-local skill links are invalid -- repair the reported structural mismatch."
fi

step "summary: what changed"
CHANGED_PATHS=(
  packages/lyra-ui/src/internal/package-metadata.ts
  packages/lyra-ui/src/internal/default-strings.generated.ts
  packages/lyra-ui/src/components/
  packages/lyra-ui/src/internal/autoloader-tags.ts
  packages/lyra-ui/src/internal/autoloader-manifest.ts
  packages/lyra-ui/src/internal/tokens/palette.styles.ts
  packages/lyra-ui/src/internal/specialist-tokens.styles.ts
  packages/lyra-ui/src/events.ts
  packages/lyra-ui/src/custom-elements-jsx.ts
  packages/lyra-ui/src/vue.ts
  packages/lyra-ui/src/svelte.ts
  packages/lyra-ui/src/theme.css
  packages/lyra-ui/src/all.ts
  packages/lyra-ui/src/ssr/all.ts
  packages/lyra-ui/src/components/lr-*.ts
  packages/lyra-ui/src/internal/root-registration-allowlist.ts
  packages/lyra-ui/src/styles/design-tokens.css
  packages/lyra-ui/design-tokens.json
  packages/lyra-ui/tokens/
  .storybook/token-preview.generated.js
  packages/lyra-ui/scripts/fixtures/token-docs.generated.json
  packages/lyra-ui/scripts/fixtures/token-editor.generated.json
  packages/lyra-ui/scripts/fixtures/component-inventory.json
  packages/lyra-ui/scripts/fixtures/component-metadata.json
  packages/lyra-ui/scripts/fixtures/component-qualification.json
  packages/lyra-ui/scripts/fixtures/component-integration.json
  docs/component-quality.md
  docs/component-integration.md
  packages/lyra-ui/package.json
  packages/lyra-ui/custom-elements.json
  packages/lyra-ui/vscode-html-data.json
  packages/lyra-ui/vscode-css-data.json
  packages/lyra-ui/web-types.json
  packages/lyra-ui/llms.txt
  packages/lyra-ui/llms-full.txt
  packages/lyra-ui/llms/
  .claude-plugin/marketplace.json
  .agents/plugins/marketplace.json
  .agents/skills/
  plugins/lyra-ui/.claude-plugin/plugin.json
  plugins/lyra-ui/.codex-plugin/plugin.json
  plugins/lyra-ui/skills/lyra-ui/CHANGELOG.md
  plugins/lyra-ui/skills/lyra-ui/references/
  skills/lyra-ui.skill
  skills/compose-lyra-interfaces.skill
  packages/lyra-ui/scripts/bundle-stats.json
  storybook-static/
  .storybook/sitemap.xml
  packages/lyra-ui/visual-baselines/
)
git status --short -- "${CHANGED_PATHS[@]}"
printf '\n\033[32mRegeneration complete.\033[0m Review the diff above, then run ./scripts/ci.sh (or at least `pnpm lint`) before committing.\n'
