---
"@aceshooting/lyra-ui": major
---

Align the public surface with Web Awesome and Shoelace, and remove accumulated Lyra-only debt.

**Migration coverage improves measurably**: `warning-required` mappings drop from 13 to 9, `exact`
rises 54 → 56 and `rewritten` 78 → 80. `<wa-button>`, `<sl-button>`, `<wa-breadcrumb-item>` and
`<sl-breadcrumb-item>` now migrate mechanically — previously the codemod refused *every* one of them,
including buttons with no `href` at all, because the warning is emitted per tag rather than per
member.

### `rel` is now settable on `lr-button` and `lr-breadcrumb-item`

Both mirror upstream's `rel`, so `nofollow`, `me`, `license` and `external` survive a `wa-`/`sl-` →
`lr-` rename instead of being silently dropped. The security guarantee is unchanged and not
removable: `opener` is always stripped, and `noopener noreferrer` is force-added whenever `target` is
set. A same-tab link (no `target`) renders the author's tokens verbatim, because it opens no new
browsing context. `lr-breadcrumb-item` defaults to `'noreferrer noopener'`, matching both upstreams;
`lr-button` keeps no default, matching `wa-button` — defaulting it would start suppressing the
`Referer` header on every same-tab link.

### Removed — deprecations whose recorded removal window opened in 9.0.0

- `lr-tool-call-chip` / `lr-message-parts`: `lr-tool-chip-select` → `lr-tool-call-chip-select`
  (identical detail). `lr-tool-timeline` bound both, so a host listener fired **twice** per click;
  it now fires once.
- `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` →
  `--lr-flow-canvas-node-selected-outline-color`

### Removed — renamed without a deprecation cycle

These shipped in 8.x and were removed outright rather than deprecated first, a deliberate one-time
exception to the M+2 policy published in the 8.0.0 notes. Each migration is one token; the exception
is recorded in `llms/shared.md` and does not set a precedent.

- `lr-usage-badge`: `compact` → `abbreviate`. It selected `Intl` compact *notation* while 20 other
  components use `compact` for visual density.
- `lr-chart` (and every typed subclass): `horizontal` → `index-axis="y"`
- `lr-rag-answer`, `lr-retrieval-results`: `error` → `errorText` / `error-text`
- `lr-document-preview`: `errorMessage` → `errorText` / `error-text`
- `lr-ingestion-queue`, `lr-activity-feed`: `virtualizeThreshold` → `virtualizeAt`, and the bound is
  now exclusive to match the other four components — `virtualize-threshold="N"` becomes
  `virtualize-at="N-1"` for an identical switchover point.
- `lr-knowledge-base`: `lr-kb-create`/`-sync`/`-pause`/`-delete` → `lr-source-*` (identical details;
  hosts listening on `lr-knowledge-base-admin` are unaffected).
- `lr-data-grid`: option fields `columns` → `columnIds`, `filename` → `fileName` (upstream's own
  spellings — this moves *toward* the mirror).
- `lr-test-results`: legacy `detail-{suiteId}-{testId}` and `detail-{testId}` slots → the canonical
  `testResultDetailSlotName(suiteId, testId)`.
- `lr-confirm-bar`: `compact` is density only; use `compact frame="plain"` for the old flat
  presentation. `--lr-confirm-bar-compact-{border,background,radius}` removed.
- `lr-accordion`: direct `<lr-details>` children are no longer coordinated — use
  `<lr-accordion-item>` (which still accepts `summary`/`open`/`show()`/`hide()`).
- `lr-ebook-viewer`: `accessibleLabel` is private (the property never had any effect; set the
  `aria-label` attribute), and the permanently-empty `announcer` part is gone.
- `lr-sequence-strip`: `orientation` removed — a single-member union that nothing read or styled.
- `lr-split-panel`: `SplitPanelSnapFunctionOptions` / `SplitPanelSnapFunctionParams` removed; both
  aliased `SnapFunctionParams`.
- Ten orphaned localization keys removed — they shipped translated into all ten locales while no
  component rendered them: `trendIncreased`/`trendDecreased`/`trendGoodSuffix`/`trendBadSuffix` (use
  `statTrend*`), `subagentPanelCancel` (use `subagentPanelCancelRun`), plus
  `contactViewerOrganizationLabel`, `evaluationDashboardMetricLabel`, `heatmapCellSelectedSuffix`,
  `liteChartMarkPosition`, `spanTokens`. A generator gate now fails on any future orphan.

### Behavior fixes

- `setLyraLocale()` was **inert on any page with `<html lang>`** — i.e. essentially every
  well-formed page — because the document element won the precedence walk. An explicit call now
  wins; element and ancestor `lang`/`locale` still override it, per a documented order.
- Nine form-associated components silently never published their validity custom states in
  environments without `ElementInternals`; their fallback lacked a `states` set.
- `lr-combobox.validators` and `lr-file-input.validators` type-checked and assigned but **never
  ran**. Both are now wired to the same contract `lr-date-input` uses.
- `lr-flow-node.nodeId` now reflects, so a JS property write is visible to `lr-flow-canvas`, which
  adopts children by attribute.
- `lr-spreadsheet-viewer.jumpToCell()` no longer reports a phantom `found: true` when nothing loaded.
- `lr-xml-viewer` search now scrolls the active match into view, honoring reduced motion.
- `lr-breadcrumb.accessibleLabel` is consumed instead of ignored.

### Additive

- New `bridgeLyraLocale()` and `subscribeLyraLocale` (`@aceshooting/lyra-ui/utilities/localization.js`)
  mirror the active locale onto a host element's `lang`/`dir` and re-render non-`LyraElement` hosts on
  locale change.
- `lr-combobox` exposes `part="group-label"`, matching `lr-select`.
- `lr-stack-trace` gains `compact`; `lr-confirm-bar` gains `frame`.
- `srOnly` now hides via `clip-path: inset(50%)` instead of the deprecated `clip: rect(0 0 0 0)`. If
  you reveal an `.sr-only` element on focus, replace `clip: auto` with `clip-path: none`. Note
  `clip-path` establishes a containing block for absolutely-positioned descendants.
