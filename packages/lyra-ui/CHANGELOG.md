# Changelog

## 1.2.0

### Minor Changes

- 6e832d5: `<lyra-chart>`: added `IntersectionObserver`-gated lazy redraw and content-signature memoization — a
  chart skips calling into Chart.js while scrolled off-screen (redrawing once when it re-enters the
  viewport) or when none of its content-affecting properties (`type`, `labels`, `datasets`, `legend`,
  `area`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`) have actually
  changed since the last draw. `refreshTheme()` is unaffected and always redraws.
- 9d36af5: `<lyra-combobox>`: the input's accessible name now checks a host-level `aria-label` attribute before
  falling back to `label`/`placeholder`/`"Combobox"` — previously a plain `aria-label` on
  `<lyra-combobox>` was silently ignored. Matches the same fix in `<lyra-select>`.
- 0b3ea6c: `<lyra-flag>`: added a `detailed` boolean property that requests the pristine, full-detail source SVG
  for the minority of flags whose default rendering was recently optimized for icon scale (e.g. `es`,
  `pt`, `sv` — see the `@aceshooting/lyra-flags` changeset). A safe no-op for every other flag. Useful
  for a flag rendered larger than icon scale (e.g. a hero display) where the extra illustrative detail
  is actually visible.
- 2027e3f: `<lyra-flag>`: the default accessible name (`alt`, used when `label` is unset) is now a human-readable
  region name via `Intl.DisplayNames` (e.g. `language="en"` → `"United Kingdom"`) instead of the bare
  uppercase country code (`"GB"`, previously read letter-by-letter by most screen readers).
- 49569ed: `<lyra-heatmap>`: fixed `role="img"` conflicting with the canvas's own focusable, keyboard-interactive
  descendant (arrow-key roving focus, Enter/Space activation) — now `role="group"`, matching
  `lyra-lite-chart`/`lyra-word-cloud`'s existing pattern. Added `cellText?: (pos, value) => string`, a
  formatter hook for the per-cell hover tooltip and keyboard live-region announcement (both draw from the
  built-in English template by default; this is additive, not breaking). Also fixed calendar mode's date
  label formatting, which hardcoded the literal `'en'` locale instead of the runtime locale.
- ef74f4a: `<lyra-lite-chart>`: added `tickFormat?: (value: number) => string` to customize y-axis tick label
  formatting (e.g. currency, duration) instead of the built-in nice-number formatter. Also added
  `IntersectionObserver`-gated lazy rendering and content-signature memoization — a chart skips
  recomputing its grid/marks while scrolled off-screen or when none of its content-affecting properties
  (`type`, `labels`, `datasets`, `legend`, `xLabel`, `yLabel`, `beginAtZero`, `stacked`, plot size) have
  actually changed since the last render.
- 22cf001: `<lyra-select>`: added a `size` property (`xs`/`s`/`m`/`l`/`xl`, default `m`, same scale as
  `lyra-toast-item`'s `size`) for compact toolbar placements that don't fit the default trigger height.
  Also, the trigger's accessible name now checks a host-level `aria-label` attribute before falling back
  to `label`/`placeholder`/`"Select"` — previously a plain `aria-label` on `<lyra-select>` was silently
  ignored.
- 4bf80aa: `<lyra-stat>`: added `exact-value` (shown as a hover/focus tooltip on the headline value, e.g.
  `value="$1.2K" exact-value="$1,204.37"`), a `sub` property/slot (a secondary line distinct from
  `caption`, e.g. a comparison-period label), a `prose` boolean (renders `value` as smaller/lighter text
  with `unit` hidden, for a loading/status message in place of a numeric value), and a `compact` boolean
  (tighter padding for constrained spaces — same convention as `lyra-empty`'s and `lyra-widget`'s
  `compact`).
- c8206f8: `<lyra-widget>`: added `fullscreen-inset` (a raw CSS `inset` shorthand, e.g. `"0 0 0 240px"`, applied to
  the fullscreen panel and backdrop instead of the default `var(--lyra-space-l)` on every side — for apps
  with a persistent sidebar/toolbar that should stay visible during fullscreen) and a `compact` boolean
  (tighter header/body padding), matching `lyra-empty`'s existing `compact` convention.
- a768a20: `<lyra-word-cloud>`: fixed the rendered `<svg>` not respecting a host-assigned height —
  `[part='base']` had no `block-size` rule, so the internal `svg { block-size: 100% }` resolved against
  an indefinite containing-block height and fell back to the spiral layout's own intrinsic size instead,
  overflowing past the host's box. `[part='base']` now constrains to `block-size: 100%`, matching the
  component's own documented `<lyra-word-cloud style="height: 20rem">` usage pattern.

### Patch Changes

- Updated dependencies [da766cb]
  - @aceshooting/lyra-flags@1.2.0

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lyra-flag
country=...>`/`<lyra-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lyra-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

- c033ec0: Added `<lyra-lite-chart>` — a dependency-free bar/line chart (plain SVG/DOM rendering, zero peer
  dependencies) for projects whose architecture forbids a charting dependency outright. Covers
  grouped/stacked bars, multi-series lines, per-point click (`lyra-point-click`, same detail shape as
  `lyra-chart`'s), and hover tooltips via native SVG `<title>`. Not a full `lyra-chart` replacement —
  no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
  passthrough. Reuses `lyra-chart`'s `--lyra-chart-*` theme token names for free cross-component
  theming.
- c033ec0: Added `<lyra-word-cloud>` — a dependency-free SVG word/tag cloud, laid out via an outward
  Archimedean-spiral placement search (heaviest word first). Supports `linear`/`sqrt` weight-to-font
  scaling, optional `mixed` (rotated) orientation, per-word or per-`group` coloring with a themeable
  `--lyra-word-cloud-color-1..8` palette, and roving-tabindex keyboard navigation matching
  `lyra-heatmap`'s pattern (a single tab stop, arrow keys, Home/End, a live-region announcement).

  Also a hardening pass across the rest of the library — real bugs fixed, not just polish:

  - `lyra-skeleton`: `width`/`height` properties had zero visual effect (the custom property was set
    on the wrong shadow-DOM node); now actually resizes the placeholder.
  - `lyra-combobox`: setting `open` directly (bypassing `show()`) never wired up click-outside or
    fired `lyra-show`/`lyra-hide`; picking a row or clearing while using `source` left stale async
    results displayed; a `<lyra-option selected>` appended after the first slotchange was ignored;
    two nameless `multiple` comboboxes in the same form merged their submitted values; a pending
    debounced `source` fetch could fire after the element was removed.
  - `lyra-chart`: bubble-chart series got a categorical (not numeric) x-axis, collapsing every point
    onto one tick; `resetZoom()` double-emitted `lyra-zoom`, briefly reporting the stale pre-reset
    `zoomed` state to `{ once: true }` listeners.
  - `lyra-date-picker` / `lyra-date-input`: the already-exported `clampDate()` was never actually
    wired in, so `goToDate()`/`goToToday()` could navigate to (and focus) an out-of-range date;
    locale/weekday-format/first-day-of-week wiring gained test coverage; outside-month placeholder
    cells are now `aria-hidden` only in rows that also have a real visible day.
  - `lyra-tree`: mouse-driven expand/collapse/select could desync the roving-tabindex `activeId` from
    real DOM focus; arrow-key expand/collapse is now RTL-aware, matching `lyra-split`/`lyra-time-range`.
  - `lyra-widget`: the fullscreen focus trap didn't pierce into a slotted custom element's own shadow
    root, letting focus escape to a hidden nested control.
  - `lyra-toast-item`: the close button used the native `disabled` attribute, which force-blurs a
    focused element with nothing to restore it — switched to `aria-disabled`.
  - `lyra-empty`: gained a live-region announcement when entering the empty state, matching
    `lyra-skeleton`'s existing `role="status"` convention.
  - Accessibility, documentation, and test-coverage fixes across most other components; `llms.txt`,
    `llms-full.txt`, and both READMEs corrected for drift against the current API surface.

  No breaking changes.

### Patch Changes

- Updated dependencies [c033ec0]
  - @aceshooting/lyra-flags@1.1.0

## 1.0.1

### Patch Changes

- 436b1ce: Fix `scripts/publish.sh` to commit `CHANGELOG.md` and `custom-elements.json` with each release commit (previously only `package.json`/the lockfile were staged, leaving those generated files uncommitted after every release). Remove the redundant `.github/workflows/publish.yml` CI job, which always failed by re-publishing a version `publish.sh` had already shipped.

## 1.0.0

### Major Changes

- 99fb0e0: Added several new components

### Patch Changes

- Updated dependencies [99fb0e0]
  - @aceshooting/lyra-flags@1.0.0

All notable changes to `@aceshooting/lyra-ui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes on GitHub (`gh release create --generate-notes`) are generated from commit
history and may be more granular than this file; this file is the curated, human-readable
summary.

## [Unreleased]

No unreleased changes yet.

## [0.1.3] baseline

Current published baseline at the time this changelog was introduced. Historical versions
prior to 0.1.3 were not backfilled into this file — see git tags (`git tag -l`) and GitHub
Releases for the full release history.

- Free, clean-room Lit 3 web-component library — an open-source companion to Web Awesome.
- Tiered component set (layout/atoms, forms, overlays, data-viz/dashboard, temporal/graph,
  map/file/flag families) — see `packages/lyra-ui/llms.txt` and `llms-full.txt` for the full
  API reference.
- `@aceshooting/lyra-flags` optional companion package for `<lyra-flag>` artwork.

[Unreleased]: https://github.com/aceshooting/lyra-ui/compare/0.1.3...HEAD
[0.1.3]: https://github.com/aceshooting/lyra-ui/releases/tag/0.1.3
