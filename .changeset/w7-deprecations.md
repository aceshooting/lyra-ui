---
'@aceshooting/lyra-ui': major
---

Remove the remaining deprecated component events, detail fields and implicit defaults.

## Migration

Run `npx lyra-ui-migrate --origin=lyra-v31 --check src` after upgrading. It reports every listener
or binding below with its replacement and never rewrites them, because a listener may also hear the
old name from other components.

- `lr-calendar` no longer dispatches `lr-view-change`; listen for `lr-month-change`, which carries
  the same `{ viewDate }` detail.
- `lr-map-anchor` no longer dispatches `lr-close-request` and `lr-close`; listen for
  `lr-map-anchor-dismiss-request` (cancelable) and `lr-map-anchor-dismiss`, which carry the same
  frozen `{ reason }` detail.
- `lr-entity-dossier`, `lr-memory-panel`, `lr-provenance-panel` and `lr-retrieval-trace` no longer
  dispatch `lr-toggle`; listen for `lr-retrieval-disclosure-change` and narrow on `detail.kind`.
  Its detail names the disclosed item (`chunkId`, `stageId`, `memoryId`, `section`) instead of
  `itemId`; the dossier adds `origin`.
- `lr-flow-canvas`'s `lr-edge-activate` detail no longer carries `source` and `target`; read
  `sourceNodeId` and `targetNodeId`.
- `lr-data-grid`'s event map no longer declares the never-dispatched `lr-retry`; listen for
  `lr-retry-request`.
- `lr-token-input` now mounts a 200-token window when `max-tokens-visible` is omitted or not
  finite. Set `max-tokens-visible="0"` to keep mounting every token; the value and form submission
  still include every token.
- Each component now has exactly one registration module, its tag-shaped entry
  `@aceshooting/lyra-ui/components/lr-<tag>.js`. The per-directory registration files behind it
  (`components/<family>/<dir>/<name>.js`, not importable since 24.0.0) are gone, so the entry's
  types now ship at `dist/components/lr-<tag>.d.ts`. Imports through `lr-<tag>.js`, the family
  barrels, the `.class.js` modules and `all.js` are unchanged. A project still naming an old
  per-directory path gets the replacement from `npx lyra-ui-migrate --origin=lyra-v22`.
