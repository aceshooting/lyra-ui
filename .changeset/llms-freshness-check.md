---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-heatmap`'s `llms-full.txt` section, which was missing four real, already-shipped members
(`cellInteractive`, `weekdayLabelText`, `colorSteps`, `refreshTheme`), and add a matching
`focus()`/`blur()` mention to `lyra-button`'s own section. Add a `pnpm run llms-freshness` lint gate
(wired into `contract-policy`, so it runs in `lint`/CI/`publish.sh`) that fails the build if any
custom element's public property isn't mentioned anywhere in its own `llms-full.txt` section, so
this can't silently drift again. A small baseline of ~20 pre-existing drift items on unrelated
components (chart family, dialog, menu, split, tree-node, widget, etc.), discovered while building
this check, is exempted for now via a documented allowlist in the script — out of scope for this
change, left for a follow-up cleanup.
