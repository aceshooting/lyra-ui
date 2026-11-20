---
'@aceshooting/lyra-ui': major
---

Report component-owned state changes, and stop re-reporting unchanged ones.

- `lr-thread-list`: provider paging now emits cancelable `lr-source-page-change-request` before a pager
  request and `lr-source-page-change` (`{ page }`) after every component-owned `sourcePage` write (pager,
  query reset, out-of-range correction, active-thread jump). New `ThreadListSourcePageChangeDetail` type.
- `lr-artifact-panel`: when a `versions` reassignment drops the active version, `lr-version-change`
  now fires with the latest version id. Migration: a listener that treated every `lr-version-change`
  as a user navigation should compare `versionId` with its own state.
- `lr-mention-popover`: a popup that cannot be positioned now closes with `lr-mention-close`.
- `lr-select`: a listbox that cannot be positioned now closes with a non-cancelable `lr-hide` and
  `lr-after-hide`.
- `lr-prompt-input`: a pick in the built-in model, voice or source picker now updates `model`, `voice`
  or `selectedSourceIds` before its change event; reassigning the previous value rolls the picker back
  (also in `lr-model-settings-panel`).
- `lr-combobox` and `lr-pptx-viewer`: an `AbortError` from the current `source()` request or slide
  navigation is now a failure (`lr-source-error` / `lr-render-error` and the error state). Migration:
  a source that wants a silent empty answer resolves `[]` instead of rejecting.
- `lr-json-viewer` and `lr-xml-viewer`: the node tree is now one Tab stop with arrow-key navigation
  between toggles and copy buttons. Migration: tests or scripts that tabbed through node buttons use
  the arrow keys instead.
- `lr-eval-dataset`, `lr-compare-panel`, `lr-flow-canvas`: re-activating the already-selected row,
  vote or sole selected item no longer emits `lr-example-select-request`/`lr-example-select`,
  `lr-vote-request`/`lr-vote-change` (or the announcement), or `lr-selection-change`.
- Removing a heading-level attribute, or setting an unknown value, now restores each component's
  documented default level instead of level 3; `lr-multi-split` restores its enum defaults
  (`orientation`, `narrow-orientation`, `collapse` and both breakpoint bases) the same way.
- Direction-sensitive keyboard and pointer math in `lr-slider`, `lr-time-range`, `lr-toggle-group` and
  `lr-dashboard-grid` reads the cached effective direction; `lr-app-rail` peek timers,
  `lr-chat-viewport`, `lr-attachment-chip` object URLs, `lr-document-library` and `lr-include` use the
  owner document's realm.
