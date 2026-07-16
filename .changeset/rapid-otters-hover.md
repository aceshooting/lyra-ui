---
"@aceshooting/lyra-ui": minor
---

Broad component hardening pass across ~50 components:

- `lyra-command-palette` now uses the shared overlay infrastructure (`lyra-dialog`'s
  focus-trap/Escape/backdrop/scroll-lock manager) instead of a bespoke implementation, adds
  `aria-activedescendant` tracking, and keeps the highlighted row scrolled into view.
- `lyra-table` forwards `spellcheck`/`autocapitalize`/`autocorrect` to its filter input and inline
  text-cell editor, matching the string-aware `spellcheck` converter already used by
  `lyra-textarea`/`lyra-model-select`.
- `lyra-token-input` and `lyra-code-editor` fix `label`/`hint`/`error` slot-vs-attribute detection
  (a `[part]:empty` selector never matches since the part always contains a `<slot>`), and
  `lyra-token-input` adopts the `effectiveDisabled`/`_fieldsetDisabled` pattern so a `<fieldset
  disabled>` ancestor no longer permanently overwrites its own `disabled` property.
- `lyra-calendar`: month grid gets proper `role="grid"`/`role="row"`/`role="gridcell"` semantics,
  per-day `aria-label`, a sanitized event-color style (rejects `url(...)` and anything else that
  isn't real CSS color syntax), and RTL-aware nav chevrons; `firstDayOfWeek` tolerates out-of-range
  input instead of producing `Invalid Date`.
- `lyra-icon` clones custom slotted SVG content into the component's own `<svg>` so slotted
  path/circle/group children paint reliably in Chromium.
- `lyra-document-preview` simplifies its abortable-fetch generation tracking onto the shared
  `beginAbortableLoad` helper.
- `lyra-app-rail-item`'s tooltip text now ignores text incidentally living in the decorative `icon`
  slot, mirroring `lyra-chip`'s `labelText` getter.
- Smaller accessibility/consistency fixes across app-rail, attachment-chip, breadcrumb, callout,
  chart/histogram, checkbox-group, data-grid, empty, format-*, heatmap, html-viewer,
  image-comparer, intersection/mutation/resize-observer, map, model-select, pdf-viewer,
  phone-input, progress, radio/radio-group, responsive-panel, scroller, segmented, sparkline,
  split, stat, stepper, streaming-text, switch, tool-param-form, tool-select-dialog, widget, and
  zoomable-frame, plus a new standalone `breadcrumb-item.styles.ts` module and expanded test
  coverage throughout.
