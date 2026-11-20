---
'@aceshooting/lyra-ui': major
---

- `accessibleLabel` on `lr-breadcrumb`, `lr-navigation-menu`, `lr-navigation-menu-item`, `lr-command-palette` and `lr-timeline` is now typed `string | null` with a `null` default, matching every other component that mirrors `aria-label`. Migration: assign `null` (not `undefined`) to clear it; code comparing the property against `undefined` must compare against `null`.
- Optional-peer and plugin diagnostics from `lr-chart`, `lr-box-plot`, `lr-map` controls, `lr-flag`, `lr-emoji-picker` and a rejecting `lr-combobox` `source()` are development-only and warn once per cause instead of once per instance or retry; their message text no longer ships in production bundles. `devWarnOnce()` accepts trailing detail arguments.
- Removed pass-through lifecycle and search overrides from several components and dropped `export` from helpers only tests used; the shared anchor, file-intake and toolbar-action modules moved into `src/internal`, with the published `toolbar-actions.js` subpath kept as a re-export.
