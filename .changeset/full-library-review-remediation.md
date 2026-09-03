---
"@aceshooting/lyra-ui": major
---

A library-wide correctness and accessibility pass across all component families. Message-feedback
settlement gains a stable transaction id (one narrow, opt-in breaking change for consumers who
relied on repeated no-argument settlement), `lr-details`'s internal DOM structure changes so
header actions no longer nest inside the native `<summary>` (all documented parts/slots are
preserved, just relocated), and dozens of components gain new events, CSS custom properties,
exported types, and hardening around malformed input, prototype getters, and browser-capability
failures. No default values changed and no public part, slot, or event name was removed.

### Breaking changes

**1. Feedback settlement now requires a `submissionId` for anything beyond the first transaction.**
`lr-feedback-submit`'s frozen detail gained `submissionId: string`. `lr-message-feedback`'s
`finalizePendingSubmit()`/`revertPendingSubmit()` changed from `(): void` to
`(submissionId?: string): boolean`. The no-argument form still works, but **only** while the
component is on its first-ever submission and that submission was never invalidated or
superseded (by an external `rating`/`detail`/`detailFor` change, disconnect, adoption, or
ownership change); after a second submission starts or any pending one is invalidated, the
no-argument form fails closed and returns `false` forever after.

Migration: read `event.detail.submissionId` in your `lr-feedback-submit` listener, pass it to the
settle call explicitly, and check the boolean result instead of assuming success:
`panel.finalizePendingSubmit(event.detail.submissionId)`. `lr-message-actions` (which embeds a
thumbs-only `lr-message-feedback`) also gained its own id-scoped, read-only `feedbackPending`
getter plus `finalizePendingSubmit(submissionId: string): boolean` /
`revertPendingSubmit(submissionId: string): boolean` for the request it currently owns.

**2. `lr-details`'s internal structure changed — `base`/`details`/`header`/`content` moved to
different elements.** No part or slot was removed; only their owning node changed:

| Part | Before | After |
| --- | --- | --- |
| `base`, `details` | both on the native `<details>` | both on a new outer wrapper; native `<details>` is now private (no exposed part) |
| `header` | the flex wrapper *inside* `<summary>` | the complete summary + actions row |
| `header-actions` | rendered inside the `<summary>`/`<details>` content box | a following sibling of the now-private native `<details>`; stays enabled and non-toggling even while `disabled` |
| `content` | inside the native `<details>` | outside it, behind a private `hidden="until-found"` gate (adds in-page-find support) |

This was necessary because interactive `header-actions` content (e.g. a trailing "add" button)
cannot legally nest inside a native `<summary>`. Plain color/spacing/border rules against
`::part(base|details|header|summary|header-actions|icon|content)` keep working unchanged. Update a
rule only if it depends on the old DOM relationship: anything selecting through `::part(details)`
as if it were the real `<details>` (e.g. `:open`, or assuming it parents `<summary>`) should
target the host's `[open]`/`aria-expanded` instead; anything assuming `::part(header-actions)` is
a descendant of `::part(details)` should treat it as a sibling within `part="header"` instead;
never set `hidden` on `::part(content)` yourself — the component now manages it.

### Changes

#### Agent tools
- `lr-approval-close.detail.reason` can now be `'request-invalidated'` when a selected pending
  request disappears or resolves elsewhere.
- `lr-thinking-panel` gained `--lr-thinking-panel-compact-header-font-size`.
- `lr-terminal` gained `--lr-terminal-surface-color`, `--lr-terminal-toolbar-button-hover-bg`,
  `--lr-terminal-toolbar-button-active-bg`, `--lr-terminal-line-hover-bg`, and
  `--lr-terminal-line-active-bg`.
- `lr-activity-feed` now lets a host `aria-labelledby`/`aria-describedby` reach the owned entry
  list in both plain and virtualized rendering; `renderText` now replaces text inside the
  persistent `entry-text` part rather than removing that part.
- `lr-tool-select-dialog` and `lr-json-schema-viewer` now cap traversal at 10,000 supplied
  positions and safely skip malformed/accessor-backed rows. `lr-tool-param-form` now recurses only
  into safe own-data fields, omitting unsafe branches while valid siblings still render/submit.

#### Charts
- `formatter`'s context object documents its full `statistic` vocabulary: `x`, `y`, `r`, `min`,
  `q1`, `median`, `q3`, `max`, `total`.
- `dataTableToggle` now keeps a supplied `slot="data-table"` synchronized with the built-in
  table's open/closed state, and a reader's own toggle choice stays authoritative afterward.
- `lr-chart`, all eight chart variants, and `lr-box-plot` gained
  `--lr-chart-canvas-hover-outline-color` (default `var(--lr-chart-grid-color)`).
- `preloadCharts()` gained an `annotations` option/result field.
- `lr-lite-chart`'s `selectedIndices` is now documented and enforced as **source category
  indices**, not positions in the (possibly sampled) rendered output.

#### Conversation
- `lr-markdown`: GFM task-list checkboxes get an accessible name from their primary inline text;
  `lr-highlight-activate` now fires before `lr-link-click` when an intercepted link overlaps a
  painted highlight.
- `lr-model-select` and `lr-voice-picker` gained a reflected `readonly: boolean = false` property
  (blocks typing/catalog commits; preserves focus, popup navigation, selection/copy,
  submission/reset, and programmatic writes).
- `lr-audio-visualizer`: `barCount` normalizes to an integer in `[1, 64]`; `gain` treats a
  non-finite value as `1`; values clamp to `[0, 1]`/`[-1, 1]` as appropriate. The host now supplies
  `role="img"` only when the author hasn't set one, and rendering now pauses off-screen and
  resumes on re-entry via `IntersectionObserver` where available.
- New exported type `MessagePartsContentMode = 'plain' | 'markdown'`; an unsupported
  `content-mode` value now normalizes/reflects to `'markdown'`.
- `lr-chat-composer`, `lr-prompt-input`, and `lr-agent-workspace` now normalize an invalid
  status value to `'idle'` instead of leaving it unrecognized.
- Toolbar actions (e.g. on `lr-message-actions`) may now expose `releaseTabIndex()` so a parent
  can stop managing tab index and restore an untouched author-supplied `tabindex`.
- `lr-thread-list` gained eight custom properties theming group-toggle and row-action
  hover/pressed states independently.
- `lr-prompt-input`/`lr-prompt-queue`: an open mention/command popup now reliably closes once
  focus leaves the textarea or popup; Enter/Tab-accept is now handled before textarea submission.
- `lr-widget-renderer`'s `syncActiveDescendant()` now returns `false` for a `<textarea>` anchor
  without touching `aria-activedescendant` (focus moves via `focusActiveOption()` instead); a
  single-line `<input>` anchor is unaffected.
- Several "assign to update" collection properties (`lr-widget-renderer` registries,
  `lr-thread-list.threads`, `lr-prompt-queue.items`, `lr-document-compare` versions,
  `lr-document-preview.highlights`, `lr-map`'s `markers`/`dataLayers`/`choropleth`) now
  consistently document that data is snapshotted on assignment — mutating an already-assigned
  array/object in place is not observed; assign a new value to update the view.

#### Data
- `lr-data-grid` gained six custom properties for independent hover/pressed theming of
  controls, the page-size selector, rows, and sortable headers.
- `lr-calendar`'s `events[].date` now accepts an ISO string, finite epoch milliseconds, or a
  `Date`; invalid rows are omitted while `lr-event-select`'s detail keeps the original object.
- `lr-calendar` gained six custom properties for nav/day/agenda-event hover/pressed states.

#### Forms
- `lr-date-picker` gained `--lr-date-picker-preset-selected-border` and
  `--lr-date-picker-preset-selected-color`.
- `lr-input`, `lr-time-input`, and `lr-checkbox-group` now project a host `aria-describedby` onto
  the native control ahead of built-in hint/error/required-description ids.

#### Layout
- `lr-multi-split` gained a new cancelable `lr-toggle` event
  (`detail: LyraMultiSplitToggleDetail = { open: boolean }`) firing before Escape/backdrop closes
  the floating panel; `preventDefault()` or a synchronous reentrant `open` write aborts the close.
  A forced close from a responsive collapse transition fires it noncancelably afterward. Direct
  `open` writes and no-op dismissals stay silent.
- `lr-details`'s structure changed — see Breaking changes above.

#### Media
- `lr-map`: a malformed earlier `markers`/`dataLayers` row no longer reserves its `id`, so a later
  valid row with the same id is now admitted.
- `lr-qr-code` now defers painting until it has a valid intersecting `IntersectionObserver` entry
  where available, pausing off-screen and resuming on re-entry; unresolvable paint colors now fall
  back to documented safe values.

#### Overlays
- `lr-rating`: for its managed slider name only, an empty/whitespace `label` now counts as absent
  and falls through to the localized default; the raw `label` property still reads back exactly as
  assigned, and an authored `aria-label` still wins.

#### Retrieval
- `lr-knowledge-graph-explorer` gained a new cancelable `lr-before-visibility-change` event
  (`detail: { hiddenTypes }`) firing before a node-type visibility toggle changes state or
  announces it; the existing `lr-visibility-change` still fires after an accepted change.
- `lr-knowledge-base` now forwards 13 row-related parts from its internal table via `exportparts`
  (e.g. `lr-knowledge-base::part(actions-trigger)` now works directly). An explicitly empty
  `label` still keeps the visible heading empty, but the nested table now takes the localized
  default as its accessible name instead of rendering an unnamed grid.
- Palette-style catalog inputs cap traversal at 10,000 positions and skip accessor-backed rows; an
  omitted/empty/whitespace `label` now falls back to the localized default without changing the
  raw property readback.

#### Utility
- Toolbar/menu actions (including `lr-copy-button`'s `getToolbarActions()`) gained an optional
  `releaseTabIndex()` method mirroring the conversation-family addition above.
- `lr-intersection-observer` and `lr-mutation-observer` now fail closed instead of throwing when
  the underlying browser API is unavailable or throws, retry construction once with safe defaults,
  and cap `threshold`/`attributeFilter` collections at 10,000 entries.
- `lr-json-tree` now snapshots data from own enumerable data descriptors on assignment — it never
  invokes getters or conversion hooks, and later mutation of the original object no longer affects
  the displayed/copied value.
- `lr-diff-view`'s `languages` map is now read from own enumerable data fields only.
- `lr-format-date`, `lr-relative-time`, and related components now reject non-primitive,
  non-`Date` input without invoking its conversion hooks.
- `lr-export-button`'s multi-format menu now reads descriptor fields from direct data only and
  behaves as a proper nonmodal overlay (only the topmost open menu handles
  Escape/outside-pointer/Tab; rebinds correctly after document adoption).

#### Viewers
- `lr-document-preview` and `lr-document-viewer` gained download-link hover/active background
  custom properties (`--lr-document-preview-download-link-hover-bg`/`-active-bg` and the
  `-viewer-` equivalents).
- `lr-email-viewer` now copies accepted attachment bytes before use and creates a fresh `Blob` on
  every `lr-attachment-open`, so mutating the original source afterward can no longer change a
  previously emitted attachment's bytes.
- `lr-ebook-viewer` now verifies the loaded `epubjs` peer exposes its required capabilities before
  use, caps table-of-contents projection (10,000 positions/nodes, depth 100), and its
  `matchCountExact: false` now also covers malformed/holey spine data.
- `lr-document-compare`'s `oldVersion`/`newVersion` are now captured as a frozen snapshot per
  assignment; a non-string runtime `language` value is now treated as `''`.
- `lr-docx-viewer` (Mammoth-based) now validates the conversion result shape before using it and
  caps diagnostic messages at the first 100.

#### Shared
- New registration-free helper modules, usable without registering their owning component: stack
  trace parsing, span projection, agent-status presentation, approval-state helpers, and the
  default widget-type registry (see `llms/shared.md` for exact import paths).
- `attachInternalsSafely()` now inspects data descriptors without invoking accessors, returning
  safe fallback internals for a missing, accessor-backed, non-callable, or throwing
  `attachInternals` implementation.
