---
'@aceshooting/lyra-ui': major
---

Remove the 36 deprecated public names whose compatibility window has ended. Each has a replacement that already works in 29.x.

- Event aliases (the canonical event already fired first; listen to it instead): `lr-agent-run` and `lr-subagent-panel` `lr-cancel` -> `lr-run-cancel`; `lr-agent-eval-dashboard` and `lr-rag-eval-dashboard` `lr-metric-change` -> `lr-metric-change-request`; `lr-background-runs` `lr-run-open` -> `lr-run-activate`; `lr-change-review` `lr-change-decision` -> `lr-change-decision-request`; `lr-community-card`, `lr-path-strip`, `lr-entity-dossier`, `lr-memory-panel` and `lr-provenance-panel` `lr-entity-activate` -> `lr-entity-select`; `lr-chunk-inspector` `lr-chunk-toggle`, `lr-memory-panel` `lr-memory-toggle`, `lr-source-card` `lr-expand`, `lr-retrieval-trace` `lr-stage-toggle`, `lr-navigation-menu` `lr-expanded-change`, `lr-dock-panel` and `lr-widget` `lr-collapse-change` -> `lr-toggle` (the disclosure events carry `expanded`; the collapse events carried the opposite `collapsed`); `lr-dock-panel` and `lr-widget` `lr-collapse-request` -> `lr-toggle-request`; `lr-rag-eval-dashboard` `lr-run-change` -> `lr-run-activate` and `lr-slice-change` -> `lr-slice-change-request`; `lr-retrieval-results` `lr-select` -> `lr-selection-change`; `lr-source-picker` `lr-sources-change` -> `lr-selection-change`.
- `icon` slot aliases: `lr-app-rail-item`, `lr-flow-node` and `lr-widget` content moves from `slot="icon"` to `slot="start"`, and `lr-tool-call-chip` content to `slot="status-icon"`. Content left in `icon` is no longer projected.
- Parts that Web Awesome itself deprecated: the `base` part of `lr-accordion-item` (use `::part(accordion-item)`), `lr-file-input` (`file-input`), `lr-qr-code` (`qr-code`), `lr-sparkline` (`sparkline`) and `lr-video-playlist` (`video-playlist`); the `label` part of `lr-file-input` and `lr-known-date` (`form-control-label`).
- `lr-icon` `autoWidth` / `auto-width`: use `canvas="auto"`.

Migration: `npx lyra-ui-migrate --origin=lyra-v25` applies safe event renames and reports slot content, changed event details, and listeners whose reach would widen; the `wa-*`/`sl-*` migration maps the removed part names and `auto-width`. `wa-file-input` remains warning-required; apply its part replacements after reviewing the reported component differences. See the v29 to v30 upgrade guide.
