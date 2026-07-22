# Changelog

## 6.2.0

### Minor Changes

- 7af01bf: Add `href`, `target`, and `download` to `<lr-button>`, giving it a real `<a>` anchor mode instead of
  a `<button>` that a consumer has to wrap or intercept.

  `rel` is derived from `target` rather than being independently settable, so a `target="_blank"`
  button cannot ship without `rel="noopener noreferrer"`. Hrefs are validated through the internal
  link allowlist; a `download` paired with a `mailto:` href falls back to the native `<button>`, since
  `mailto:` names no retrievable bytes.

- 7af01bf: Round out the chart components so app code stops reaching into raw `config` passthrough.

  - `data-labels` and `stack-totals` boolean attributes on `<lr-chart>` and its subclasses render
    value and stacked-total labels using themed tick colors and `--lr-font-*`, replacing hand-rolled
    `afterDatasetsDraw` painters with hardcoded colors. These require the new optional peer
    `chartjs-plugin-datalabels` (see the separate peer-dependency note); the plugin registers
    per chart instance, never globally.
  - `Series.pointRadius` accepts an array for per-point sizing, and `Series.segmentColors` maps to
    Chart.js segment coloring.
  - `seriesPalette()` is now public, so app code can read the resolved, dark-aware chart ramp instead
    of re-resolving `--lr-theme-color-chart-N` through `getComputedStyle` itself.
  - Charts re-theme automatically via a shared `ThemeWatcher` controller when the ambient theme
    changes.
  - `<lr-lite-chart>` renders a real `<table part="data-table">` screen-reader alternative when there
    is more than one series; the previous flat `<ul>` degenerated for multi-series data.

- 7af01bf: Add `chartjs-plugin-datalabels` (`^2.2.0`) as a new **optional** peer dependency, backing the new
  `data-labels`/`stack-totals` chart attributes.

  It is optional in the same sense as the other chart peers: install it only if you use those two
  attributes. Without it, charts render exactly as before and the label layer fails closed rather than
  throwing.

- 8e0540a: Add five agentic AI / RAG roadmap components: `lr-agent-eval-dashboard`, `lr-approval-queue`, `lr-embedding-explorer`, `lr-knowledge-base-admin`, and `lr-rag-answer`.
- 7af01bf: Fill several gaps in the form-control surface that were pushing logic onto consumers.

  - `<lr-input>` and `<lr-textarea>` gain `minlength`/`maxlength` constraints wired into the validity
    bridge, so length violations participate in constraint validation instead of being advisory.
    Length is counted in code points, so astral characters count as one.
  - `<lr-select>` and `<lr-combobox>` now emit value-carrying `lr-change` events, and their `input`/
    `change` events carry a typed detail — no more `as unknown as { value }` at every call site.
  - `<lr-card>` gains `target` for anchor-mode cards, with `rel="noopener noreferrer"` derived from it
    rather than settable on its own.
  - `<lr-combobox>` accepts an `AbortSignal` for `source` and a configurable `source-delay`
    (default 200ms), so a fast typist no longer races stale in-flight results.

- 7af01bf: Assorted layout and accessibility improvements.

  - `<lr-split>`'s `defaultSizes` accepts CSS length strings (`['200px', 50]`) alongside percentages,
    resolved against the measured container and renormalized — a fixed-width sidebar no longer needs a
    `firstUpdated()` measure-and-convert dance.
  - `<lr-table>` gains typed `accessible-label`/`caption` properties and warns in development when a
    grid ships with no accessible name.
  - `<lr-popover>` gains `hide({ focusTrigger })` for explicit focus return on programmatic close.
  - `<lr-segmented>` auto-reveals the selection when `value` is set programmatically, and exposes
    `scrollToValue()`.
  - `<lr-heatmap>` warns when no 2D canvas context is available instead of silently rendering nothing.
  - `<lr-file-input>` shows visible, localized rejection feedback per reason, replacing the sr-only
    count-only message.
  - `<lr-tool-result-view>` renderers can signal failure via a reflected `status`.
  - `gemstoneGlyph()` defaults its fill to `currentColor` and carries an intrinsic `1em` box.

- ad9165a: Add `mode="gemstone"` to `<lr-swatch-picker>`, shared gemstone accent data and glyph helpers, and
  apply the selected shine animation to custom icon swatches as well as plain color fills.
- 7af01bf: Add opt-in `storage-key` persistence to `<lr-table>`, `<lr-widget>`, and `<lr-app-rail>`, so layout
  state survives a reload without every application rebuilding the same `localStorage` plumbing.

  Set `storage-key` to persist `<lr-table>`'s `showAllColumns`, `<lr-widget>`'s `collapsed` state, and
  `<lr-app-rail>`'s open state and width. The attribute is unset by default — behavior without it is
  unchanged. All three share one internal helper with the `try`/`catch` handling needed for
  environments where `localStorage` throws (private mode, disabled storage, cross-origin frames).

- 7af01bf: Add theming tokens for surfaces that previously forced consumers through `::part()` overrides.

  - `<lr-icon-button>`: `--lr-icon-button-background`, `--lr-icon-button-background-hover`, and
    `--lr-icon-button-color`, so a bordered or tinted icon button no longer needs `::part(button)`.
  - `<lr-button>`: `--lr-button-shadow` (default `none`) for themed elevation.
  - `<lr-table>`: sorted-header theming tokens, plus a specificity fix so consumer `::part()` rules can
    actually win against the internal sort-state rule.
  - `<lr-select>` and `<lr-model-select>`: selected-state tokens; `<lr-combobox>` gains the matching
    `option-selected` token indirection.
  - `<lr-empty>`: `--lr-empty-compact-font-size` for compact heading typography.
  - `<lr-typing-indicator>`: `--lr-typing-duration`, so its speed is no longer keyed off the shared
    `--lr-transition-ambient`.
  - `<lr-conversation-item>`: tokenized active-row indicator part.

  Every token's `var()` fallback is the value it replaces, so unset rendering is unchanged.

- 7af01bf: Add `@aceshooting/lyra-ui/theme.js` — a zero-dependency theme runtime and no-flash bootstrap, so
  applications stop rebuilding mode/accent persistence by hand.

  The new subpath exports `setLyraTheme(theme)`, `getLyraTheme()`, the `LyraTheme`/`LyraThemeMode`
  (`'light' | 'dark' | 'auto'`) types, and `lyraThemeBootstrap` — a string of head-script source you
  inline before first paint to apply the persisted theme without a flash of the wrong mode. Theme
  changes persist to `localStorage` and announce themselves with an `lr-theme-change` event.

  The runtime deliberately does not include WCAG contrast math: deriving an accessible palette from a
  single brand color is application product logic, not a library concern.

### Patch Changes

- 7af01bf: Fix several rendering and correctness bugs.

  - `<lr-chart>`: a `valueFormatter` no longer corrupts the **category** axis. Formatted indices
    (`"0"`, `"1"`, `"2"`) were rendering in place of the category labels, because the tick callback was
    wired to every axis rather than only the value axes.
  - `<lr-diff-view>`: normalize CRLF and lone-CR line endings, so a Windows-authored file no longer
    diffs as entirely changed.
  - `<lr-app-rail>`: anchor the resizer to `:host`, pin `overflow-x`, and free fixed-position popups
    that were being clipped by the rail.
  - `<lr-button>`: collapse empty start/end adornment wrappers, which were reserving visible space for
    slots with nothing in them.
  - `<lr-swatch-picker>`: keep the selected glow on gemstone swatches.

- a656a10: Add a tokenized active-row indicator part to `lr-conversation-item` and export it through data-mode `lr-thread-list` rows.
- 203cbce: Forward host `aria-describedby` values to `lr-checkbox`'s internal checkbox role.
- 983dd04: Validate download anchors against a stricter URL allowlist than navigation anchors. A `mailto:` URL
  is a legitimate navigation destination but names no retrievable bytes, so pairing it with a
  `download` attribute produced an affordance that could never download anything.

  `safeDownloadHref()` (internal) is now `safeLinkHref()` minus `mailto:`, and the download sinks use
  it: `<lr-document-viewer>` and `<lr-document-preview>` omit their download link for a `mailto:`
  `src`, `<lr-media-card>` falls back to its inert file chip, and `<lr-button>` falls back to the
  native `<button>` when `download` is set alongside a `mailto:` `href` (a `mailto:` href _without_
  `download` still renders the anchor, unchanged).

  Behavior change: the `safeLinkHref()` re-exported from the package root is `<lr-media-card>`'s
  download-sink wrapper, so it now returns `null` for `mailto:` where it previously returned the URL.
  The general-purpose navigation validator is unchanged.

- 88dfe78: Add `LyraTreeEventMap` so `<lr-tree>`'s `lr-node-toggle`, `lr-node-select`, and `lr-reorder` events are typed on listeners (`addEventListener`), matching every other component with public events.
- a595ec7: Give `<lr-widget>`'s collapse-button `aria-label` its own dedicated locale keys,
  `widgetCollapse`/`widgetExpand`, instead of borrowing `<lr-dock-panel>`'s `dockPanelCollapse`/
  `dockPanelExpand`. Default English strings are unchanged ("Collapse panel"/"Expand panel"). If you
  had registered a locale under the old borrowed `dockPanel*` keys specifically to translate
  `<lr-widget>`'s collapse button, move that override to `widgetCollapse`/`widgetExpand` —
  `<lr-dock-panel>`'s own keys and behavior are unaffected.

## 6.1.0

### Minor Changes

- f9e1e18: Make `lr-app-rail`'s `lr-toggle` event cancelable: a listener calling `preventDefault()` keeps the
  rail open/closed as it was. The one exception is the forced close that fires when `mode` leaves
  `'mobile'` while open, which stays unconditional since it's a consistency fix-up rather than a
  user dismissal.
- f9e1e18: Add themeable `--*-gap`/`--*-radius` CSS custom properties to `lr-input`, `lr-select`, and
  `lr-combobox` (gap + radius), `lr-chip`/`lr-badge`/`lr-tag` (radius), and `lr-icon-button`
  (radius) — extending the pattern `lr-button` already shipped, so these values can be retuned
  without a `::part()` override. Every default is unchanged.
- f6d966e: Add an optional `country` field to `lr-locale-picker`'s `locales` catalog entries, letting a
  consumer override a row's derived flag (e.g. showing Lebanon's flag for an `ar` row instead of
  the library's default Saudi Arabia mapping).
- 3c9f478: Make `lr-reorder-list`'s `lr-reorder` event cancelable: a listener calling `preventDefault()`
  holds the move (reflecting `pending` on the affected `lr-reorder-item`) until the host calls the
  new `finalizePendingMove()`/`revertPendingMove()` methods — mirroring `lr-confirm-bar`'s cancelable
  approve/deny pattern, for hosts that persist the new order asynchronously.
- f9e1e18: Make `lr-token-input`'s `lr-remove` event cancelable: a listener calling `preventDefault()` (for
  example to run async removal validation, or to protect a token) keeps the token in place instead
  of it being removed unconditionally. Scoped to direct removal; multi-candidate paste/edit flows
  are unaffected.

### Patch Changes

- a4c4825: Fix `lr-agent-workspace` never emitting its documented `lr-retrieval-select` event when a row is
  selected in the built-in retrieval results, and leaking the internal `lr-retrieval-results`'s raw
  `lr-select` event through under the wrong name instead.
- f9e1e18: Fix `lr-date-input`'s `selectionDirection` getter returning `undefined` instead of `null` before
  the internal input has rendered, despite its declared `LyraDateInputSelectionDirection | null`
  return type.
- 2dabe8e: Fix `lr-icon-button`'s bare-SVG-geometry fallback rendering slotted stroke-style icon path data
  (no fill/stroke of its own) as a solid black shape instead of an outline, by giving
  `[part="fallback"]` the same `fill`/`stroke`/`stroke-width`/`stroke-linecap`/`stroke-linejoin`
  defaults `lr-icon`'s own wrapper svg already has.
- f9e1e18: Fix `lr-retrieval-results` and `lr-menu` leaking a wrapped child's own event under the wrong
  name alongside the documented, consolidated one: `lr-retrieval-results` leaked `lr-virtual-list`'s
  `lr-load-more` and `lr-chunk-inspector`'s `lr-chunk-open` (the latter also carrying an
  undocumented extra `anchor` field); `lr-menu` leaked `lr-menu-item`'s raw `lr-menu-item-select`
  alongside the documented `lr-menu-select`.
- cc90b3a: Fix two `lr-thread-list` bugs: a row click fired `lr-select` twice (the correct re-emit plus the
  original bare event leaking through unstopped), and content slotted into `slot="empty"` rendered
  unconditionally instead of only when the list has zero visible threads.

## 6.0.0

### Major Changes

- 5c93d1b: Remove `<lr-data-grid>`. It was a strict functional subset of `<lr-table>` (same `role="grid"` +
  roving-tabindex + sort/select/loading pattern, with none of `<lr-table>`'s filtering, pagination,
  inline editing, resize, grouping, expansion, heat-tint, sticky columns, or footers), implemented
  independently with no shared code. Use `<lr-table>` instead:

  - `DataGridColumn<T>`'s optional `value(row)` becomes `TableColumn<T>`'s required `cell(row)`.
  - `<lr-data-grid>`'s `emptyText` string becomes `<lr-table>`'s `emptyHeading`/`emptyDescription`
    pair (rendered via an internal `<lr-empty>`, not a plain text cell).
  - `<lr-data-grid>` always mutated `selectedKey` and emitted `lr-selection-change` on row
    click/activation; `<lr-table>` only does that when `selection-mode` is `"single"` or
    `"multiple"` (default `"none"`, presentational) — listen on `lr-row-click` (`detail: { row }`)
    instead if you don't need `<lr-table>`'s own selection bookkeeping.
  - `accessibleLabel`/`aria-label` — unchanged; `<lr-table>` reads a plain `aria-label` attribute the
    same way.

  `<lr-eval-dataset>` and `<lr-eval-result>` composed `<lr-data-grid>` internally and now compose
  `<lr-table>` instead. `<lr-eval-result>`'s public `columns` property changes type accordingly from
  `DataGridColumn<EvalRunResult>[]` to `TableColumn<EvalRunResult>[]` — update any `value(row)`
  column definitions you pass in to `cell(row)`.

### Minor Changes

- 5c93d1b: Add a `3xs` size tier to `<lr-chip>`, one step below `2xs`, for dense inline count pills.
- 8e6e045: `lr-confirm-bar`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s for
  `<lr-button>`, so `--lr-button-*` theming and a consumer's existing `lr-button` style fragments
  reach them like every other button in an app. Adds a host-writable
  `pending: 'approved' | 'denied' | null` property and makes `lr-approve`/`lr-deny` cancelable: a
  listener calling `preventDefault()` sets `pending` to the decision being made (showing `loading`
  on that button, `disabled` on the other) instead of resolving synchronously, so a host whose
  approval hits a network call can keep the UI honest about being in flight. Finalize by setting
  `.decision`, or bounce back by clearing `.pending` to `null`.

  **Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
  host, not a native `<button>`.

  Before:
  lr-confirm-bar::part(deny-button) { padding: 4px 8px; border: ...; }
  After (use the re-exported sub-parts):
  lr-confirm-bar::part(deny-button-base) { padding: 4px 8px; border: ...; }

  Runtime API (events, `tone`, `compact`, slots, the new `pending` property) is unchanged.

- 050c43c: Fix `<lr-control-group>` collapsing to 0 inline size when placed as an ordinary flex-basis:auto
  child of a shrink-to-fit flex row (its own stated primary use case). The `@container`
  narrow-allocation breakpoint is now opt-in via a new `responsive` property instead of always-on.
- 18e7b10: Add `--lr-dashboard-grid-cell-hover-outline-color` to `<lr-dashboard-grid>`, theming the mouse-hover preview outline on `[part="cell"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.
- bd2e594: Add `--lr-flow-canvas-node-hover-outline-color` to `<lr-flow-canvas>`, theming the mouse-hover preview outline on `[part="node"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.
- 76690c7: Add `--lr-button-gap` and `--lr-button-radius` custom properties to `<lr-button>`, so the
  icon/label gap and corner radius are retunable without a `::part(base)` rule — matching the
  retunable-without-`::part()` treatment `--lr-button-padding-block/-inline` and
  `--lr-button-font-size` already have.
- f8810d7: Add `<lr-locale-picker>`: a closed-list locale switcher over the locale registry
  (`getRegisteredLyraLocales()`) or an explicit `locales` catalog, form-associated and mirroring
  `<lr-select>`'s hand-rolled listbox. Selecting a row emits a cancelable `lr-change` and, unless
  vetoed, applies the pick via `setLyraLocale()`.
- 77377ed: Add `getRegisteredLyraLocales()` and `subscribeLyraLocaleRegistry()` so a consumer can enumerate
  and live-track every locale registered via `registerLyraLocale()` (plus `'en'`) — the piece that
  unblocks a locale-picker component built on top of the existing locale runtime.
- 0771a83: Add a `renderExcerpt` hook to `<lr-thread-list>`, rendering rich per-row excerpt content into the
  row `<lr-conversation-item>`'s own `excerpt` slot — where it wins over the plain-string `excerpt`
  property — for cases like a server-highlighted search-match snippet, without giving up the built-in
  title layout and inline-rename affordance the way `renderRowContent` requires.
- 02cd69d: Add `<lr-reorder-item>`, one row of the new `<lr-reorder-list>` flat-list reorder primitive.
- 2cf4206: Add `<lr-reorder-list>`, a generic flat-list reorder primitive with move-up/move-down buttons and
  a Ctrl/Cmd+ArrowUp/ArrowDown keyboard shortcut, emitting the full new order on every move.
- c6af1b7: `lr-tool-approval-dialog`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s
  for `<lr-button>` (`variant="neutral"`/`"brand"`), so `--lr-button-*` theming and a consumer's
  existing `lr-button` style fragments reach them like every other button in an app. Adds a
  host-writable `pending: 'approve' | 'deny' | null` property and makes `lr-approve`/`lr-deny`
  cancelable: a listener calling `preventDefault()` sets `pending` to the decision being made
  (showing `loading` on that button, `disabled` on the other) instead of closing immediately, so a
  host whose approval hits a network call can keep the dialog honest about being in flight.
  Finalize by calling `close('approve'|'deny')`, or bounce back by clearing `.pending` to `null`.
  While `pending` is set, Escape and backdrop dismissal are suppressed; `pending` itself resets to
  `null` every time the dialog re-opens. The `edit-button` is unaffected.

  **Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
  host, not a native `<button>`.

  Before:
  lr-tool-approval-dialog::part(deny-button) { padding: 4px 8px; border: ...; }
  After (use the re-exported sub-parts):
  lr-tool-approval-dialog::part(deny-button-base) { padding: 4px 8px; border: ...; }

  Runtime API (events, `editable` and its editing behavior, slots, the new `pending` property) is
  unchanged.

- 65d6a2b: Add `--lr-virtual-list-hover-outline-color` to `<lr-virtual-list>`, theming the mouse-hover preview outline on `[part="base"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.

### Patch Changes

- 3fd9bbd: Regenerate the agent-tools reference docs and custom-elements manifest for the `lr-confirm-bar`/
  `lr-tool-approval-dialog` `lr-button` swap and their new `pending` properties (see the sibling
  changesets for the runtime changes themselves).
- 9ebb38c: `lr-icon-button`: restore rendering for slotted bare SVG geometry (`<path>`, `<circle>`, etc. with
  no enclosing `<svg>`) when `icon` is unset. 5.2.0's natural-aspect-ratio change made the default
  slot a sibling of the internal glyph instead of nesting it inside an SVG, which silently stopped
  this narrow case from painting (no console error, no type error). A small whitelist of raw SVG
  geometry tag names is now cloned into a real SVG-namespaced element the same way `<lr-icon>`'s own
  custom-content slot already does — every other case (complete `<svg>`, `<img>`, custom elements) is
  untouched, so the `createElementNS`-on-custom-elements bug 5.2.0 fixed for `<lr-flag>` cannot
  regress.

## 5.2.0

### Minor Changes

- 602177a: `lr-button`: expose its per-size geometry and its outlined fill as custom properties, so a consumer
  no longer needs a `::part(base)` rule to fit a button into a dense toolbar or to tint an outline.

  - `--lr-button-padding-block`, `--lr-button-padding-inline` and `--lr-button-font-size` now carry
    each `size` tier's padding/font-size (the `:host` defaults are the `m` tier). Every tier is now
    pure custom-property re-assignment — matching `lr-input`, `lr-select`, `lr-combobox`,
    `lr-segmented` and `lr-date-input` — so overriding one knob retunes the tier instead of fighting
    the stylesheet.
  - `--lr-button-min-height` carries the active tier's `min-block-size` floor (it resolves to that
    tier's existing `--lr-button-size-*` token), and the new `--lr-button-height` pins an exact
    height — flooring _and_ capping the button, e.g. to match a fixed toolbar row. It is deliberately
    left undeclared by default so each tier's floor still applies when it is unset.
  - `--lr-button-outlined-fill` (default `transparent`) tints `appearance="outlined"`. Like
    `--lr-button-quiet-*` it is not swapped per `variant`. Note that the existing hover
    `filter: brightness()` visibly brightens a tinted fill, where a transparent one showed no change.

  `appearance="link"` continues to ignore all of these and render as zero-chrome inline text. With
  every property unset, all six tiers render byte-identical to before.

- fe06b7d: `lr-card`: `interactive` now grants real activation semantics when `href` is not also set.
  `[part='base']` becomes focusable (`tabindex="0"`), responds to Enter and Space (Space calls
  `preventDefault()` so the page does not scroll under the focused card), and emits a new
  `lr-card-activate` event (no detail) — so a clickable tile no longer needs a consumer-supplied
  wrapper or a `::part(base)` hack to be keyboard-operable.

  - The card deliberately carries **no** `role="button"`. A card is a container that routinely holds
    slotted buttons and links, and `role="button"` around focusable descendants is the axe-core
    `nested-interactive` violation this library's own a11y gate enforces (unlike `lr-chip`'s
    `toggleable` mode, which can forbid focusable children and therefore can carry the role).
  - Because of that, "did the user aim at the card or at a control inside it?" is answered at event
    time: the handler walks `composedPath()` from the original target up to `[part='base']` and bails
    out if anything on the way is itself a control (a link, button, form control, `[tabindex]`, or an
    interactive `role`). A click on a slotted `lr-button` or `<a>` therefore never activates the card.
  - With `href` set, the root is still a real `<a>`: native navigation remains the activation, no
    extra `tabindex` is added, and `lr-card-activate` is never fired.
  - Without `interactive`, the rendered output is unchanged — no `tabindex`, no listeners, no events.

- 76b4ef7: `lr-chat-composer` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), so a
  composer docked inside a chat panel, dialog footer or toolbar that already draws its own border
  doesn't double the frame. `plain` drops `[part="base"]`'s border, background, padding and corner
  radius; the row layout, disabled treatment and the send/stop button's own chrome are unaffected.

  Focus stays visible either way. The card's only focus affordance is a border-color shift, and there
  is no border left to recolor under `plain` (the internal textarea sets `outline: none`), so `plain`
  swaps in an underline across the input row instead — drawn as an inset box-shadow from
  `--lr-focus-ring-width`/`--lr-focus-ring-color`, so it costs no layout.

  An unset composer renders byte-identically to before.

- 89dc89a: Add density and chrome-less escape hatches to six card-chrome components so an embedded card no
  longer forces its own frame on a host that already draws one:

  - `lr-agent-run`, `lr-entity-card`, `lr-source-card` each gain both a reflected `compact` boolean
    (tighter padding/gap, tunable via `--lr-<component>-compact-padding` / `-gap`) and
    `appearance="plain"` (drops border, background, padding and radius). `plain` wins over `compact`
    when both are set.
  - `lr-stack-trace` and `lr-flow-run-overlay` gain `appearance="plain"` — for nesting inside an
    `lr-result-card` / `lr-agent-run` or a host toolbar that already draws a border, without doubling
    the frame. `lr-flow-run-overlay`'s `plain` also drops its floating-surface shadow.
  - `lr-file-input` gains a reflected `compact` boolean (tighter dropzone padding, gap and label
    font, tunable via `--lr-file-input-compact-padding` / `-gap` / `-font-size`) so the dropzone fits
    a toolbar or table cell.

  All escapes default off; an unset component renders byte-identically to before. Interactive
  affordances that live on child controls (agent-run's Cancel/Retry, stack-trace's copy/frame
  buttons, source-card's title/toggle) keep their own chrome under `plain`.

- bca1353: `lr-flow-controls` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), for
  clusters placed in a host toolbar or panel that already draws its own surface. `plain` drops
  `[part="base"]`'s border, background, padding, corner radius **and** its floating-surface
  `box-shadow` — a lift shadow with no surface under it reads as a stray smudge — matching what
  `lr-flow-run-overlay`'s `plain` already does.

  The cluster keeps its layout, its `orientation` axis, every button's shared minimum hit area
  (`--lr-icon-button-size`) and their hover/focus rings. No `compact` is offered: the padding is
  already the smallest spacing step, and the only remaining room is that hit-area floor.

  The existing `for`, `orientation` and `hideLock` properties are now documented too. An unset cluster
  renders byte-identically to before.

- ddf52ba: `lr-flow-node` now exposes its card as a CSS part and gains a density escape:

  - The bordered, filled card is reachable as `::part(card)` (it keeps its `.card` class, so nothing
    that already targeted it changes).
  - New reflected `compact` boolean tightens the card padding for dense canvases and palette previews,
    tunable via `--lr-flow-node-compact-padding` (default `var(--lr-space-xs)`) and
    `--lr-flow-node-compact-gap` (default `var(--lr-space-2xs)`). The border, background, shadow and
    the `selected`/`status="running"` treatments all stay.

  Two documentation/CSS bugs are fixed in passing: the `base` part is documented as what it actually
  is (the row wrapping the handles and the card, carrying no chrome of its own), and a duplicated
  `min-inline-size: 0` that overrode the card's own minimum width is removed — the documented
  `--lr-flow-node-min-inline-size` custom property was dead until now and once again sets the card's
  minimum inline size (default `11rem`).

  An unset node renders as before apart from that restored minimum width.

- 81f615b: `lr-checkbox` / `lr-radio`: publish the label indent, and stop hard-sizing the radio's circle.

  - **New `--lr-checkbox-label-indent` and `--lr-radio-label-indent`** carry the distance from the
    control's start edge to the start of the label — the box/circle's own floor
    (`min(--lr-icon-button-size, 1.75rem)`) plus the label gap (`--lr-space-s`), i.e. `2.25rem` at the
    default tokens. Consumers composing per-option hint text under a checkbox previously had to
    hardcode that `2.25rem` after reading it out of the shadow styles, where neither term was a public
    contract, so the hint silently de-aligned on any retheme. `[part='base']`'s `gap` is now _derived
    from_ the published property rather than repeating `--lr-space-s`, so the advertised value and the
    rendered geometry cannot drift: setting the property moves the label. Rendering is byte-identical
    when it is left unset.

    **Read this before assuming it closes the filed case.** The property is declared on the
    component's `:host`, so it is readable by the element itself and overridable from your own
    stylesheet (`lr-checkbox { --lr-checkbox-label-indent: … }` beats a `:host` rule), but custom
    properties inherit _down_, not sideways — a **sibling** `<p>` in your own tree can never read it
    off the checkbox. What actually solves that case is the `--lr-theme-icon-button-size` bridge that
    landed alongside this release: compute `calc(min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem)

    - var(--lr-theme-space-s, 0.5rem))` on your own wrapper from tokens you control, and both the
      control and your hint text stay aligned through a retheme. The new "Aligning per-option hint text"
      stories show both halves. This is not an unfixed gap; please do not re-file it as one.

  - **Bug fix — `lr-radio`'s `[part='circle']` was hard-sized**, with `inline-size`/`block-size` where
    `lr-checkbox`'s `[part='box']` correctly uses `min-inline-size`/`min-block-size`. Since
    `[part='base']` carries no box of its own, that circle _is_ the entire tap target for a label-less
    radio, and a hard size can be smaller than its own content — an enlarged indicator overflowed it
    instead of growing it. It is now a floor, matching `lr-checkbox` exactly. Default rendering is
    unchanged (28×28 at the default tokens, above the WCAG 2.2 SC 2.5.8 24×24 minimum).

    Note the residual, unchanged in this release: neither control guarantees the 24×24 minimum once
    `--lr-icon-button-size` is themed below it — `min()` still tracks the token down 1:1. Both
    controls behave identically here; a hard floor would need its own decision, since it would also
    block a deliberately dense checkbox.

  `lr-checkbox` deliberately still has no `hint`/`errorText` chrome of its own (see its class docs);
  that omission is intentional and adding it would require a `form-control` wrapper that changes the
  part structure for existing consumers.

- 6bf969f: Themeable code tab width, chat bubble geometry, and the code-block active-line outline color.

  - `--lr-code-block-tab-size` (default `2`) sets the tab width of rendered code. It is honoured by
    `lr-code-block`, `lr-code-block-core`, `lr-markdown`, and `lr-markdown-core`, and shares the
    default of the existing `--lr-code-editor-tab-size`, so the editable and read-only code surfaces
    agree. The markdown viewers declare it themselves because they are sibling elements of
    `lr-code-block`, not descendants — one declaration could not have reached them. `lr-code-block`
    reads the token rather than writing `tab-size` inline, so the override survives shiki's own
    inline `style` on the highlighted `<pre>`. Note that a markdown code block wraps
    (`white-space: pre-wrap`) while `lr-code-block` does not, so the same value can render
    differently on a wrapped line, where tab stops restart.
  - `--lr-chat-message-bubble-padding` (default `var(--lr-space-m)`) and
    `--lr-chat-message-bubble-radius` (default `var(--lr-radius)`) reshape `lr-chat-message`'s
    bubble. Use these instead of a `::part(bubble)` padding/radius override: an outer-tree `::part`
    declaration outranks every rule inside the component's shadow tree, which silently suppressed
    the per-`status` (`failed`, `streaming`) and per-role bubble treatments. The radius prop is
    bubble-only — `collapse-button` and `retry-button` keep reading the shared `--lr-radius`.
  - `--lr-code-block-active-line-outline-color` (default `var(--lr-color-brand)`) retints only the
    outline of the line marked active by `active-highlight-id`, leaving the language pill, hover,
    and focus surfaces on `--lr-color-brand`.

  All three default to exactly today's rendering, so a consumer who overrides none of them sees no
  visual change.

- fe06b7d: `lr-confirm-bar`: new reflected `compact` property that collapses the bar from a full card
  (bordered, padded, `display: block` surface) into a chrome-less inline row, for a confirmation that
  has to live inside an existing container — a table cell, a card's action row, a toolbar.

  - The **host** flips to `inline-flex` under `[compact]`, not just `[part='base']`: restyling the
    part alone still leaves a `display: block` host that breaks the row it was dropped into.
  - The narrow-allocation container query is switched off with it (`container-type: normal`). A
    compact bar is _expected_ to be narrow, so leaving the query live would fire it essentially
    always and stretch the Deny/Approve buttons to fill — the opposite of the intent.
  - Re-chrome it through `--lr-confirm-bar-compact-padding` (default `0`),
    `--lr-confirm-bar-compact-gap` (default `var(--lr-space-s)`), `--lr-confirm-bar-compact-border`
    (default `none`), `--lr-confirm-bar-compact-radius` (default `0`) and
    `--lr-confirm-bar-compact-background` (default `transparent`).
  - Everything else is unchanged: `lr-approve`/`lr-deny` shapes, `role="group"` and its heading
    label, and the contract that focus moves synchronously to `[part='status']` _before_ the
    Deny/Approve buttons unmount. Leaving `compact` unset renders exactly as before.

- 49e0738: `lr-conversation-item` gains a `compact` density flag

  A reflected boolean `compact` (default `false`, matching `lr-empty`'s convention) tightens
  `[part='base']`'s padding from `var(--lr-space-s) var(--lr-space-m)` to
  `var(--lr-space-xs) var(--lr-space-s)`, its gap from `var(--lr-space-xs)` to `var(--lr-space-2xs)`,
  and collapses `[part='content']`'s inter-line gap to `0`. Both tuned values sit behind the new
  `--lr-conversation-item-compact-padding` / `--lr-conversation-item-compact-gap` custom properties —
  declared as inline `var()` fallbacks at the point of use, never on `:host`, so a surrounding list can
  retune every row at once from an ancestor. Unset, a row renders exactly as before.

  Nothing else changes. In particular `[part='rename-button']` keeps its
  `min-inline-size`/`min-block-size: var(--lr-icon-button-size)` floor under `compact`, so a density
  flag can never silently drop a row's icon target below the shared minimum; the excerpt stays visible
  (it is already single-line ellipsised and `hidden`-bindable per row) and the excerpt/timestamp font
  sizes stay at their existing steps. `:host([compact]) [part='base']` is ordered before
  `:host([active]) [part='base']`, which is equal specificity, so an active row keeps its background
  and its promoted excerpt/timestamp contrast when both are set.

- 3737d4c: Add consumer-settable CSS custom properties for state-styled surfaces in the data and agent-tools
  families that previously took their color straight from a library-wide `--lr-color-*` token with no
  component-scoped indirection. Because CSS Shadow Parts forbids an attribute selector after `::part()`
  (`::part(row)[aria-selected]` is invalid), these states could only be restyled by hijacking the
  shared token, which repaints everything else that reads it. Each new property uses an inline
  `var()` fallback to its old token value, so an unset consumer renders byte-identically to before:

  - `lr-data-grid`: `--lr-data-grid-row-selected-bg` (selected row background).
  - `lr-env-list`: `--lr-env-list-reveal-active-bg`, `--lr-env-list-reveal-active-border` (pressed
    reveal toggle background/border).
  - `lr-flow-node`: `--lr-flow-node-selected-border` (selected card border color).
  - `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` (current node outline color).
  - `lr-artifact-panel`: `--lr-artifact-panel-view-active-bg`, `--lr-artifact-panel-view-active-color`
    (pressed preview/code toggle background/text).
  - `lr-test-results`: `--lr-test-results-filter-active-bg`, `--lr-test-results-filter-active-border`,
    `--lr-test-results-filter-active-color` (pressed status filter toggle).
  - `lr-span-waterfall`: `--lr-span-waterfall-row-active-bg` (active row background).
  - `lr-trace-tree`: `--lr-trace-tree-row-active-bg` (active row background).
  - `lr-agent-trace`: `--lr-agent-trace-handoff-active-bg` (active handoff quick-jump entry background).
  - `lr-policy-summary`: `--lr-policy-summary-count-allow-color`,
    `--lr-policy-summary-count-deny-color`, `--lr-policy-summary-count-needs-review-color` (per-state
    count text colors).

- 8e4e5cc: `<lr-filter-bar>` gains a `'text'` filter type, composing `<lr-input>` for an open-ended query, plus
  an optional per-filter `debounce` (ms). A dashboard whose toolbar is a search box next to a few
  dropdowns can now be a single filter bar — the search box participates in the same `value` object,
  the same removable active-filter chips (shown verbatim, so a query containing a slash is no longer
  mangled), the same reset button and `loading` state — and can delete its own hand-rolled debounce
  timer. A pending debounce is flushed by the field's own change/blur and cancelled by `reset()`, a
  chip removal, and disconnection, and the text field stays uncontrolled-with-sync so a re-render
  mid-typing never disturbs the caret.
- f8bc916: Form controls: exact-height escape hatches and `start`/`end` adornment slots.

  - `--lr-combobox-trigger-height` and `--lr-input-control-height` are new custom properties that pin
    an exact control height — flooring _and_ capping the row — so `lr-select`, `lr-combobox` and
    `lr-input` can be pixel-matched in one toolbar without a `::part()` rule. Both are deliberately
    left undeclared by default, so each tier's existing `*-min-height` floor still applies when they
    are unset. Because the component never declares them, they can also be set from an ancestor or an
    outer-tree rule, not only inline on the element. On `lr-combobox` the hatch is a single-row
    affordance: in `multiple` mode a tag row long enough to wrap overflows the pinned box visibly
    (nothing is clipped), so leave it unset there.
  - **Behaviour change:** `lr-select` declared `--lr-select-trigger-height: auto` on `:host`, which
    made the `var()` fallback to `--lr-select-trigger-min-height` unreachable and left that property
    dead at the default `m` tier (four extra specificity rules patched the floor back for
    `xs`/`s`/`l`/`xl` only). The sentinel is now genuinely undeclared and the patch rules are gone, so
    `--lr-select-trigger-min-height` is live at every tier. The visible consequence is that a
    default-size `lr-select` trigger now honours the `2.5rem` floor it already declared — byte
    identical to `lr-input`'s and `lr-combobox`'s own `m` floor, so the three controls line up.
    `getComputedStyle(el).getPropertyValue('--lr-select-trigger-height')` now returns `''` rather than
    `'auto'`; assert the rendered `min-block-size`/`block-size` instead.
  - `lr-combobox` and `lr-date-input` gain `start`/`end` adornment slots with matching `start`/`end`
    CSS parts, mirroring `lr-input`'s existing implementation: the wrappers are `hidden` while nothing
    is slotted, and they inherit the control's own padding so no consumer spacing is needed. `end`
    renders before the dropdown chevron (`lr-combobox`) and before the calendar toggle
    (`lr-date-input`), so consumer content never sits outboard of the built-in trigger. Slotted
    adornments are never collected as `lr-combobox` options.
  - `lr-select` is deliberately excluded from `start`/`end`: its `[part='trigger']` is a native
    `<button>`, whose content model forbids interactive descendants, and its `justify-content:
space-between` would push the label to the middle. `lr-date-input` is deliberately excluded from
    the exact-height hatch: its row has no `min-block-size`, and its height is pinned transitively by
    `--lr-icon-button-size` on the calendar button — capping it would crush the 24x24 target.

- 4a43cc0: `<lr-heatmap>`: `CalendarCellPos` now carries the resolved ISO `yyyy-mm-dd` `date` alongside
  `week`/`weekday`. Every calendar-mode position handed to `cellText`, `cellColor` and
  `cellInteractive` is populated — **including grid positions with no matching entry in `days`**
  (a gap in a sparse calendar still sits on a real calendar day) — so a callback can key off the date
  directly instead of re-deriving the grid's `firstWeekStart + week * 7 + weekday` anchor arithmetic,
  which was the only way to answer "is this cell in the future?" before.

  The date comes from a per-grid cache built once whenever the calendar grid is rebuilt, so it costs
  an array read rather than a `Date` allocation per cell per repaint, and it is deliberately excluded
  from the internal hover/focus position-equality check so repaint diffs are unchanged. Matrix mode's
  `MatrixCellPos` is untouched, and `lr-cell-click`'s detail shape is unchanged.

  `date` is a **required** field of `CalendarCellPos`. No API on this component accepts a
  `CalendarCellPos` as input — it is purely a callback parameter type — so this is additive for every
  supported use; the only way to notice it is hand-constructing a `CalendarCellPos` literal in
  TypeScript, which now needs a `date`.

- 4a43cc0: `<lr-heatmap>`: `HeatmapLegendStop.color` is now optional, so a `legendStops` entry can be a
  **caption-only** stop. A stop with no `color` (or an empty-string `color`) renders its
  `[part="legend-stop-label"]` with **no `[part="legend-swatch"]` element in the DOM at all**, rather
  than an empty 0.6rem swatch box — the shape a GitHub-style "Less ▢▢▢▢ More" key needs for the bare
  captions bracketing its colored ramp. Colored stops are unchanged, and an all-colored `legendStops`
  array renders exactly as before.

  The trailing `valueLabel` caption that closes the legend row also gained
  `part="legend-value-label"` (it was the one unaddressable node in `[part='legend']`), in both the
  gradient and the `legendStops` branch. Nothing else in the legend markup changed.

- 4a43cc0: `<lr-heatmap>` gained `maxCellSize` (`max-cell-size`) and `minCellSize` (`min-cell-size`), bounding
  the cell size `fit-to-width` derives from the host's measured width in **both** calendar and matrix
  mode. Without a ceiling, a 5-week calendar or a 3-column matrix in a wide pane inflates into a few
  giant blocks; without a raisable floor, a year-long calendar in a narrow pane collapses onto the
  built-in 4px minimum.

  Both are ignored while `fit-to-width` is unset — an explicit `cell-size` is an exact request and is
  never clamped — and both default to unset, so an untouched consumer's geometry is byte-identical.
  `min-cell-size` can only raise the built-in 4px floor, never lower it; when both are set and
  `max-cell-size < min-cell-size` the ceiling wins. A non-finite or empty attribute means unset rather
  than `0`.

  Note that the canvas is sized from the _clamped_ cell size, so a capped grid leaves the host's
  remaining width unfilled instead of stretching to it — align it with normal CSS on the host.

- 068cb85: `lr-icon-button` hosts natural-aspect-ratio content

  The default slot is now rendered as a **sibling** of the built-in glyph instead of being piped
  through `<lr-icon>`, and `<lr-icon>` is mounted only when `icon` is set. The button box is also
  floored with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)` instead of being pinned
  to it, matching that token's documented contract (a minimum tappable box, not a fixed size).

  Slotted content previously went through `lr-icon`'s node-cloning path, which rebuilds every
  assigned node with `document.createElementNS('http://www.w3.org/2000/svg', localName)` — a slotted
  custom element such as `<lr-flag>` became an SVG-namespaced element that never upgraded and never
  painted. It now renders normally, at its own aspect ratio.

  **Migration.** Slotted **bare SVG geometry** (`<path>`, `<circle>`, …) with no `icon` attribute
  relied on the removed `<lr-icon>` wrapper to supply an SVG parent, and must now be wrapped
  explicitly:

  ```html
  <!-- before -->
  <lr-icon-button aria-label="Star"><path d="…"></path></lr-icon-button>
  <!-- after -->
  <lr-icon-button aria-label="Star"
    ><lr-icon path="…"></lr-icon
  ></lr-icon-button>
  ```

  A complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — keeps working, renders more reliably,
  and is no longer constrained to a 1:1 box: content larger than `--lr-icon-button-size` now grows the
  button and keeps its own aspect ratio, while a small glyph still pads out to the full tappable
  target on both axes.

- 9ed6aa8: Add component-scoped state-styling cssprops to eight layout/forms components, so a selected/active/current state can be restyled from outside without hijacking a library-wide `--lr-color-*` token (which repaints everything else reading it). `::part(x)[state]` is invalid CSS — an attribute selector cannot follow `::part()` — so hijacking the shared token used to be the only lever. Each new prop is an inline `var()` fallback (never declared on `:host`, which would re-stamp per instance and shadow any ancestor value), and every default is the exact token the rule used before, so an unset consumer renders byte-identically.

  - `lr-app-rail-item`: `--lr-app-rail-item-current-bg`, `--lr-app-rail-item-current-color` for the `active`/`aria-current="page"` item.
  - `lr-stepper`: `--lr-stepper-current-color`, `--lr-stepper-error-color`, `--lr-stepper-current-index-bg`, `--lr-stepper-current-index-color`.
  - `lr-widget`: `--lr-widget-view-toggle-active-bg`, `--lr-widget-view-toggle-active-color` for the pressed view toggle.
  - `lr-carousel`: `--lr-carousel-indicator-current-bg`, `--lr-carousel-indicator-current-border-color` for the current slide's indicator dot.
  - `lr-breadcrumb-item`: `--lr-breadcrumb-current-color` for the current-page item.
  - `lr-command-palette`: `--lr-command-palette-active-bg` for the active command row.
  - `lr-time-range`: `--lr-time-range-preset-active-bg`, `--lr-time-range-preset-active-border-color`, `--lr-time-range-preset-active-color` for the active preset button.
  - `lr-emoji-picker`: `--lr-emoji-picker-active-bg` for the keyboard-active and hovered emoji (both share one rule, so one hook retints both).

- cea6d8e: New `localeNativeName(tag)` helper next to `languageToCountry()` / `LANGUAGE_TO_COUNTRY`: it returns
  a locale's endonym — its name written in that locale itself (`'fr'` → `français`, `'pt-BR'` →
  `português (Brasil)`) — which is what a language switcher should list. It reads through the shared
  memoized `Intl.DisplayNames` cache, so no name table ships and repeat lookups are free, and it
  degrades to the tag itself for an unknown or structurally invalid tag instead of throwing. Paired
  with `languageToCountry()` and `lr-popover`, it composes the locale-picker recipe shown in the new
  Flag story.
- 184bfff: `lr-menu`: Escape from `header`/`footer` content closes the menu and refocuses the trigger
  unconditionally, with no opt-in required.

  That matches `<lr-popover>`, which already dismisses on Escape from arbitrary popup content, and it
  is the only sensible contract for a region the component now positively invites you to fill: a
  filter field you can Tab into but not Escape out of is a trap.

  - `closeOnEscapeAnywhere` is **unchanged** — not deprecated, still `false` by default, and still
    governing exactly one thing: Escape from non-item content slotted into the **default** slot.
    Escape bubbling up from inside `[part='list']` is left entirely to the list's own handler.
  - Arrow/ArrowUp/Home/End/Enter/Space from header/footer content keep their full native behavior;
    the item-target gate that guarantees that is untouched, and nothing in the new region handler
    calls `preventDefault()` for those keys.

- 184bfff: `lr-menu`: new `header` and `footer` slots for composed, non-menu-item content, rendered inside
  `[part='popup']` but **outside** the `role="menu"` list — with matching `header`/`footer` CSS parts.

  A filter field, a section title, an "Apply"/"Done" button and friends have always been a real use
  case for this component (`closeOnEscapeAnywhere` exists for exactly that), but the only place to put
  them was the default slot — i.e. inside `role="menu"`, where ARIA permits only
  `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator` children. Anything else there is an
  `aria-required-children` violation. The new slots give that content a valid home.

  - Nothing about the default slot changes: item discovery, roving tabindex, type-ahead,
    `closeOnEscapeAnywhere` and its `false` default all behave exactly as before, and `items` still
    only ever contains `<lr-menu-item>`s no matter what the new slots hold.
  - With neither slot filled the rendered result is unchanged — both wrappers collapse to no box at
    all, `[part='list']` keeps its exact position and size inside the popup, and the host gains no
    attribute of any kind.
  - Emptiness is tracked from each slot's own `slotchange` (reflected as `data-has-header` /
    `data-has-footer` / `data-list-empty` on the host) rather than with `:empty`, which can never match
    a part that contains a slot: Chromium counts the whitespace-only text nodes Lit leaves there.
  - Non-item content in the **default** slot keeps working exactly as it did, with no runtime warning,
    but the new slots are now the supported place for it.

- 184bfff: `lr-menu`: Tab now moves focus into the `header`/`footer` regions instead of closing the menu, and
  tabbing out of the popup's last focusable finally closes it.

  Two halves of the same defect. `onListKeyDown` gated every key except Escape behind "is the event
  target a real `<lr-menu-item>`?", so (a) Tab from an item always closed the menu — you could never
  Tab _into_ composed content, in either direction, since Shift+Tab is `key === 'Tab'` too — and
  (b) Tab from composed content did nothing at all: focus walked out of the popup while the menu
  stayed open, an untested dismissal hole.

  Tab handling therefore moves from `[part='list']` to `[part='popup']`, which also sees keydowns from
  the new regions, and the menu now closes only when Tab would leave the popup entirely:

  - Tab from an item with a focusable `footer` (or Shift+Tab with a focusable `header`) keeps the menu
    open and lets the browser's own Tab advance carry focus into the region.
  - Tab out of the last focusable in the popup — in either direction, from an item or from composed
    content — closes the menu.
  - **With no header/footer content, Tab closes exactly as before**, and non-item content in the
    default slot stays deliberately Tab-unreachable from an item.
  - `preventDefault()` is still never called for Tab, in any branch: native focus navigation proceeds
    untouched, only the now-stale open state is cleared.

- fe06b7d: `lr-menu`: `show(focus?)` and `hide(options?)` are now public.

  - `hide({ focusTrigger: true })` closes the menu **and** returns DOM focus to the `trigger`-slotted
    element — the case the trigger alone cannot express, e.g. a slotted "Apply"/"Done" button inside
    the menu, or a consumer-owned keyboard shortcut. `hide()` on its own closes without moving focus,
    for dismissals where the interaction has already put focus somewhere the user chose.
  - `show()` is promoted alongside it (rather than shipping an asymmetric API) and still accepts the
    `'first' | 'last'` initial focus target.
  - The roving-tabindex reset moved from `hide()` into `updated()`, so a bare `el.open = false` from
    outside now resets `activeIndex` too. Previously that path left a stale `tabindex="0"` tab stop on
    whichever item was last active, so Tab could land inside a closed menu. `hide()` stays thin and
    `updated()` remains the single owner of positioning, listeners and the `lr-show`/`lr-hide` events;
    focus restoration deliberately stays in `hide()` so `disconnectedCallback()`'s own `open = false`
    teardown reset can never steal focus.

- 09bdfde: `lr-activity-feed`: make the virtualized entry rows actually styleable, by this component and by a
  consumer.

  At/above `virtualizeThreshold` the entries are produced by this component's `renderItem` but
  committed into the embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a
  `[part='entry']` selector can reach — so every entry, icon, text and timestamp rule was silently
  inert and a long feed rendered as unstyled rows. Each rule now pairs its plain selector (still
  correct below the threshold, where the same template renders into this component's own shadow root)
  with an `lr-virtual-list::part(…)` twin, and an `exportparts` forwarding declaration makes the same
  parts reachable as `lr-activity-feed::part(entry)` etc. from a consuming stylesheet.

  The tone dot is promoted from an internal class to a named `tone-dot` part, since a class selector
  cannot cross a shadow boundary either. `::part()` cannot be followed by an attribute selector, so
  the tone carries a second name in the dot's part list rather than being matched through
  `[data-tone]` (`::part()` matches with `part~=` semantics, so both names select the same element).
  New parts: `tone-dot`, plus `tone-dot-neutral`/`tone-dot-brand`/`tone-dot-success`/
  `tone-dot-warning`/`tone-dot-danger`. The `data-tone` attributes are unchanged, and a consumer can
  now retint a single tone instead of overriding a library-wide color token.

- 9150bb1: `lr-archive-viewer`: make the virtualized entry rows actually styleable, by this component and by a
  consumer.

  Entry rows are produced by this component's `renderItem` but committed into the embedded
  `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='entry']` selector can
  reach — so all five row-level rules were silently inert and the listing rendered as unstyled stacked
  text with no row layout, no icon sizing, no truncation and no size column treatment. They now reach
  through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same parts
  reachable as `lr-archive-viewer::part(entry)` etc. from a consuming stylesheet.

  New part `entry-name-dir`: `::part()` cannot be followed by a descendant combinator, so the
  directory-row emphasis that used to be written as a descendant selector now targets a second part
  name on the name element itself. A directory row's name is `part="entry-name entry-name-dir"`, and
  `::part()` matches with `part~=` semantics, so both names select it.

- 3e171e6: Fix `lr-av-player`'s transcript cue styling never applying, and make every cue-level part reachable
  from a consumer stylesheet.

  Cues are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the player's. A bare `[part='cue']` selector in
  the player's stylesheet cannot cross that boundary, so every cue rule was silently inert and each
  transcript row fell back to the raw browser button appearance: a grey background, a visible border,
  `1px 6px` padding and centered text, with no timestamp or speaker treatment and no visual state for
  the playing cue or the search matches. Every one of those rules now goes through
  `lr-virtual-list::part(…)`.

  `::part()` cannot be followed by an attribute selector, so the three cue states get their own part
  names, added alongside `cue` as a part list (`::part()` carries `part~=` semantics, so both names
  match the same element):

  - **New:** `cue-current` — the row the playhead is inside.
  - **New:** `cue-match` — a row matching the current search query.
  - **New:** `cue-active-match` — the row holding the current search match.

  The `aria-current`, `data-match` and `data-active-match` attributes are unchanged and still describe
  each row's state.

  This also makes two documented custom properties live for the first time:
  `--lr-av-player-cue-current-bg` now retints the playing cue, and
  `--lr-av-player-cue-active-match-color` now recolors the active search match's outline. Both
  previously resolved against a rule that never matched anything.

  The player forwards `cue`, `cue-current`, `cue-match`, `cue-active-match`, `cue-time`, `cue-speaker`
  and `cue-text` through `exportparts`, so `lr-av-player::part(cue)` and friends work from a consumer
  stylesheet for the first time.

- c0f00ac: `lr-csv-viewer` and `lr-spreadsheet-viewer`: make the documented `cell-highlight` part actually
  visible, and reachable from a consumer stylesheet.

  Both viewers already emitted `part="cell cell-highlight"` for a cell covered by a `highlights`
  entry, but neither had a single CSS rule for it anywhere — a highlighted cell rendered
  indistinguishably from a plain one. Highlighted cells render inside the internal
  `<lr-virtual-list>`'s own shadow root (they are `renderItem`'s output), so the styling is applied
  through `lr-virtual-list::part(cell-highlight)`, using the same outline tokens `lr-dataset-viewer`
  gives its own `cell-highlight` so a highlight reads identically across the table viewers.

  - New `--lr-csv-viewer-highlight-color` / `--lr-spreadsheet-viewer-highlight-color` custom
    properties (default `var(--lr-color-brand)`) set the outline color; the active highlight sets it
    inline to `var(--lr-color-warning, var(--lr-color-brand))`, so the active match is now
    distinguishable from the other highlighted cells.
  - A paired `:focus-visible` rule restores the shared focus ring, which the unconditional highlight
    outline would otherwise swallow on this focusable cell.
  - Both viewers now forward `exportparts` for `data-row`, `cell` and `cell-highlight` from the
    internal `<lr-virtual-list>`, so `lr-csv-viewer::part(cell)` and friends reach the real rendered
    rows instead of matching nothing.

- 99d5500: Fix `lr-chunk-inspector`'s entire chunk-row styling never applying above `virtualize-at`, and make
  every row-level part reachable from a consumer stylesheet.

  Past the threshold the row template becomes `lr-virtual-list`'s `renderItem`, whose result is
  committed inside that element's **own** shadow root — one boundary below this component's. A bare
  `[part='chunk']` selector cannot cross that boundary, so a long chunk list lost its row layout and
  separators, the score line's size/color/tabular figures, the score bar and its tone-mapped fill, the
  line clamp on the collapsed text preview, and the borderless brand styling on the open and
  show-more buttons, which fell back to the raw browser button appearance. Both documented custom
  properties (`--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`) were dead
  there too. Every rule now pairs its original selector with an `lr-virtual-list::part(…)` arm, so
  both rendering paths present identically — below the threshold the rows are still rendered into this
  component's own shadow root, where the bare selector is the one that matches.

  `::part()` cannot be followed by an attribute selector, and it cannot be followed into the matched
  element's subtree either, so row state is now carried by an additional part name (added alongside
  the base name as a part list — `::part()` carries `part~=` semantics, so both names match the same
  element):

  - **New:** `chunk-current` — the row matching `activeId`.
  - **New:** `score-current` — that row's score line, previously reached through a descendant
    selector no `::part()` can express.
  - **New:** `score-fill-success`, `score-fill-warning`, `score-fill-danger` — the score bar fill in
    each scoring tier.
  - **New:** `text-clamped` — the text preview while still collapsed.

  The `aria-current`, `data-tone` and `data-clamped` attributes are unchanged and still describe each
  element's state.

  While virtualized, the chunk row no longer carries its own `role="listitem"`: `lr-virtual-list`
  already wraps every row it renders in one, and the nested duplicate left the inner list item with a
  list-item rather than list parent — an invalid ARIA containment that axe flags.

  The internal `lr-virtual-list` now forwards every row part through `exportparts`, so
  `lr-chunk-inspector::part(chunk)` and friends work from a consumer stylesheet in both paths.

- 5bdb6d7: Fix `lr-notebook-viewer`'s cell and output styling never applying, and make every cell-level part
  reachable from a consumer stylesheet.

  Cells are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the viewer's. A bare `[part='cell']` selector in
  the viewer's stylesheet cannot cross that boundary, so the rules for `cell`, `cell-gutter`,
  `outputs`, `output` and `output-toggle` were all silently inert: cells rendered without their
  two-column grid, padding and separator, the execution-count gutter without its monospace/quiet
  treatment, stderr and error outputs untinted, and the show-all-output control as a raw browser
  button. Every one of those rules now goes through `lr-virtual-list::part(…)`, including the
  narrow-allocation `@container` block — container queries resolve through the flat tree, so they
  still evaluate against the viewer's own `:host` container across the shadow boundary.

  `::part()` cannot be followed by an attribute selector or a descendant combinator, so three states
  and one descendant get their own part names, added alongside the existing ones as a part list
  (`::part()` carries `part~=` semantics, so both names match the same element):

  - **New:** `cell-active` — the cell an anchor currently targets. This is what
    `--lr-notebook-viewer-active-bg` retints; that custom property had no effect until now.
  - **New:** `output-error` — a stderr stream or an error output, carrying the danger tint.
  - **New:** `error-output-label` — the label introducing an error output's traceback.

  The `data-active`, `data-stream` and `data-output-type` attributes are unchanged and still describe
  each element for scripting.

  The viewer forwards `cell`, `cell-active`, `cell-gutter`, `cell-source`, `outputs`, `output`,
  `output-error`, `error-output-label` and `output-toggle` through `exportparts`, so
  `lr-notebook-viewer::part(cell)` and friends work from a consumer stylesheet for the first time.

- 2e3be2e: `lr-page-rail`: make the virtualized page rows actually styleable, by this component and by a
  consumer.

  Page rows are produced by this component's `renderItem` but committed into the embedded
  `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='page']` selector can
  reach — so all 13 row-level rules were silently inert and every page button rendered as a raw
  browser `<button>` (UA background, UA border, UA padding) instead of the intended rail row. They now
  reach through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same
  parts reachable as `lr-page-rail::part(page)` etc. from a consuming stylesheet.

  `--lr-page-rail-current-bg` becomes live with this fix: it previously documented a background that
  nothing applied. It now tints the current page row, and keeps it tinted while the row is hovered so
  the current page stays identifiable under the pointer.

  `::part()` cannot be followed by an attribute selector, so state variants carry a second part name
  in the element's part list instead (`::part()` matches with `part~=` semantics, so both names select
  the same element). New parts: `page-current` on the current page button (alongside `page`), and
  `heat-dot-accent`/`heat-dot-success`/`heat-dot-warning`/`heat-dot-danger`/`heat-dot-neutral`/
  `heat-dot-overflow` on the heat markers (alongside `heat-dot`). The `data-tone`/`data-overflow`
  attributes are unchanged.

- 3217988: Fix `lr-pdf-viewer`'s page styling never applying, and make every page-level part reachable from a
  consumer stylesheet.

  Pages are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the viewer's. A bare `[part='page']` selector in
  the viewer's stylesheet cannot cross that boundary, so the rules for `page`, `text-layer`, the page
  canvas, the generated text runs, the selection tint, and both search-match states were all silently
  inert: pages rendered without their centering/padding wrapper, the canvas without its border,
  the text layer unpositioned, and search matches unhighlighted. Every one of those rules now goes
  through `lr-virtual-list::part(…)`, including the RTL text-layer mirror.

  Because `::part()` cannot be followed by a descendant combinator, two elements that were previously
  addressed as descendants get their own names:

  - **New:** `page-canvas` — the canvas a page's content is painted onto.
  - **New:** `text-span` — one generated text run inside a page's text layer. The selection tint hangs
    off this part (`::part(text-span)::selection`), since a highlight pseudo is matched against the
    element the selected text originates in.

  `search-match` / `search-match-active` are now matched directly by name (`::part()` already carries
  `part~=` semantics), and the viewer forwards `page`, `page-canvas`, `text-layer`, `text-span`,
  `search-match` and `search-match-active` through `exportparts`, so `lr-pdf-viewer::part(page)` and
  friends work from a consumer stylesheet for the first time.

- 6f3db46: Fix `lr-retrieval-results`' row, selection and metadata styling never applying while virtualized,
  and make every row-level part reachable from a consumer stylesheet.

  Rows are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below this component's. A bare `[part='row-body']`
  selector in this component's stylesheet cannot cross that boundary, so the checkbox offset, the
  row-body layout, the selected-row indicator and the whole metadata list were silently inert
  whenever the list virtualized. `grouping="source"` always virtualizes, so every grouped consumer
  saw an unstyled result set, and the documented `--lr-retrieval-results-selected-border` custom
  property had nothing to recolor there. Each of those rules now pairs its original selector with an
  `lr-virtual-list::part(…)` arm, so both rendering paths present identically — the flat path below
  `virtualize-at` still renders these parts into this component's own shadow root, where the bare
  selector is the one that matches.

  `::part()` cannot be followed by an attribute selector, nor by a descendant combinator, so two
  kinds of rule needed new part names:

  - **New:** `row-body-selected` — added alongside `row-body` as a part list (`::part()` carries
    `part~=` semantics, so both names match the same element) on the selected row. The `data-selected`
    attribute is unchanged and still describes the row's state.
  - **New:** `metadata-term` and `metadata-value` — the `<dt>`/`<dd>` inside a `metadata-entry`,
    previously styled through a descendant selector that `::part()` cannot express. The trailing colon
    after a metadata key is now `::part(metadata-term)::after`.

  The group header in grouped mode also gains a separator matching the one this component's rows use;
  `lr-virtual-list` supplies the rest of its appearance.

  `exportparts` now forwards `select`, `row-body`, `row-body-selected`, `metadata`, `metadata-entry`,
  `metadata-term` and `metadata-value` alongside the existing `row`/`group-header`, and forwards each
  per-row `lr-chunk-inspector`'s own parts onward under a `chunk-` prefix (`chunk`, `chunk-current`,
  `chunk-score`, `chunk-score-current`, `chunk-score-bar`, `chunk-score-fill`,
  `chunk-score-fill-success`/`-warning`/`-danger`, `chunk-open-button`, `chunk-title`, `chunk-text`,
  `chunk-text-clamped`, `chunk-toggle`) — those live two shadow hops deep and were unreachable from
  outside the component entirely.

- 583f359: `lr-phone-input`: rebuild the country selector's closed state and add an opt-in `flags` API.

  The old closed control was the bare native `<select>` showing each option's full
  `"Country name (+code)"` text: long localized names clipped under the UA chevron (the trigger was
  capped at 45% of the field), the calling code appeared twice (inside the option text and again in
  `calling-code`), and the popup fell back to UA colors (a white panel in dark themes). The native
  `<select>` is kept — its popup, localized full country names, keyboard type-ahead, and native
  mobile pickers are irreplaceable and fully accessible — but it is now stretched invisibly over a
  compact decorative trigger:

  - New closed state: selected alpha-2 code (localized "Select" placeholder when no countries exist)
    plus the shared design-system chevron, with a pointer cursor, a hover tint, and an inner
    focus-visible ring so keyboard focus on the selector is distinguishable from focus on the
    telephone input. No more clipping and no duplicated calling code.
  - Popup options now pin `--lr-color-surface`/`--lr-color-text` so the open list follows the theme
    in dark mode.
  - New `flags` boolean attribute renders the selected country's flag in the trigger as
    `<lr-flag variant="compact" aria-label="">` (decorative — the select already announces the
    country). The `<lr-flag>` definition is registered lazily on first use, so nothing flag-related
    is bundled while `flags` stays off; flag artwork keeps the standalone `<lr-flag>` contract
    (install optional `@aceshooting/lyra-flags` + import
    `components/media/flag/flag-peer.js` once). Without it the trigger simply omits the image.
  - New CSS parts: `country` (selector region), `country-trigger`, `flag`, `country-code`
    (`data-placeholder` when empty), `expand-icon`. Existing parts are unchanged in name, but
    `country-select` is now the invisible overlay — a consumer rule that painted its text/background
    should target `country-trigger`/`country-code` instead.

- e83deb1: Selected-state styling hooks for `lr-segmented` and `lr-tabs`, an exact-height hatch for the
  `lr-segmented` track, and a marker legend row for `lr-sequence-strip`.

  - `lr-segmented` gains `--lr-segmented-selected-bg`, `--lr-segmented-selected-color`,
    `--lr-segmented-selected-font-weight`, `--lr-segmented-selected-shadow` and
    `--lr-segmented-hover-color`. Recoloring the checked pill previously required hijacking
    library-wide `--lr-color-surface`/`--lr-color-text`, which necessarily repainted hovered
    _unselected_ segments too (they read the same tokens); `::part(segment)[aria-checked='true']` is
    not valid CSS, so there was no other route. The hover color is now its own hook, so the two states
    are independent.
  - `lr-segmented` also gains `--lr-segmented-track-height`, pinning the track to an exact height at
    every `size` tier for a row that must line up with a hard-sized toolbar control. It is genuinely
    unset by default, so each tier keeps its `--lr-segmented-track-min-height` floor until you set it.
  - `lr-tabs` gains `--lr-tabs-selected-color`, `--lr-tabs-indicator-color` and
    `--lr-tabs-hover-color` for the same reason: the selected tab's text/underline and the hovered
    tab's text no longer share `--lr-color-brand`/`--lr-color-text` with the rest of the library.
  - `lr-sequence-strip` gains `markerLabel` (`marker-label`). When set alongside `show-legend` it adds
    one trailing legend row — `[part="legend-marker-swatch"]`, a neutral chip (themeable via the new
    `--lr-sequence-strip-legend-marker-bg`) carrying the cell's own bottom bar in
    `--lr-sequence-strip-marker-color` — and the marker's count joins the strip's auto-generated
    `aria-label` summary, so the visual legend keeps no entry without a spoken counterpart.

  Every new custom property is an inline `var()` fallback resolving to the token the rule already
  used, so an unset consumer renders exactly as before.

- 36dce60: Fill the sized-control cssprop gaps for `lr-date-input`, `lr-pagination`, `lr-known-date`,
  `lr-chip`, `lr-avatar`, and `lr-avatar-group`, matching the per-tier theming surface
  `lr-input`/`lr-select`/`lr-combobox` already expose.

  - **`lr-avatar` / `lr-avatar-group` (visible bug fix):** the initials fallback and the "+N"
    overflow badge were painted at a fixed `--lr-font-size-sm` at every `size`, so initials did not
    scale with the avatar circle. They now scale via new per-tier `--lr-avatar-font-size` and
    `--lr-avatar-group-badge-font-size` knobs (`sm`/`md`/`lg`). The `md` default is unchanged, so
    existing avatars render identically.
  - **`lr-date-input`:** adds a per-tier `--lr-date-input-control-min-height` floor and an exact-height
    `--lr-date-input-control-height` hatch on the input row (it previously had neither). The calendar
    toggle keeps its own 24x24 touch target even when the height hatch pins a shorter row.
  - **`lr-known-date`:** adds a per-tier `--lr-known-date-field-min-height` floor and an exact-height
    `--lr-known-date-field-height` hatch on each field input.
  - **`lr-chip`:** the interactive tap-target floor is now the per-tier `--lr-chip-min-height` (was a
    single hardcoded `1.5rem` shared by every tier), and a new `--lr-chip-height` hatch pins an exact
    height. Interactive chips keep the 24px WCAG 2.2 SC 2.5.8 minimum at every tier; a `--lr-chip-height`
    below that is for non-interactive chips only.
  - **`lr-pagination`:** the nav buttons' and page input's inner padding is now the
    `--lr-pagination-control-padding` knob (was a hardcoded `var(--lr-space-xs)`), kept uniform across
    tiers so current rendering is unchanged.

  All new knobs default to today's exact values, so unset consumers render byte-identical at every
  tier (the `lr-avatar` `sm`/`lg` font-size fix is the sole deliberate exception).

- 6ab596d: `<lr-split>`: `rail-breakpoint` and `float-breakpoint` now accept a CSS length (`'640px'`,
  `'68.75rem'`, `'3em'`) as well as the original bare pixel number, and a new
  `collapse-breakpoint-basis="viewport"` measures both against the viewport via `matchMedia` instead
  of the split's own `[part="base"]` allocation — for collapsing in step with a page-level `@media`
  layout. Both thresholds are classified together on every change, so a fast resize crossing both at
  once still lands on one correct state and fires `lr-split-collapse-change` once; under viewport
  basis the first paint already carries the right `data-collapse-state` with no `ResizeObserver`
  round-trip, and that initial state is not announced as a transition. Note `(max-width:)` is
  inclusive while container basis compares strictly `<`, so switching basis shifts each crossing
  point by 1px. An unparseable length (`'80vw'`, `'calc(…)'`, garbage) falls back to the documented
  `640`/`400` defaults rather than switching collapse off, and the "rail must sit above float"
  invariant is still enforced, in pixel space, under both bases.

  Because both properties now accept a string, they use Lit's default string converter: reading
  `el.railBreakpoint` after `rail-breakpoint="640"` returns `'640'` rather than `640` (matching how
  `orientationBreakpoint` already behaves). Authored values and crossing behavior are unchanged.

- e1d4af8: `lr-stat` gains two layout axes and stops reserving space for an absent label.

  - `appearance="card" | "plain"` (default `card`, reflected). `plain` removes the border,
    background, padding, corner radius and the `block-size: 100%` stretch, so a stat can sit inline
    in prose, a toolbar or a table cell instead of only as a card. A `plain` stat with a safe `href`
    underlines its `[part="value"]` on hover/focus, since the card's border-color-shift affordance is
    invisible with no border; the focus ring is unchanged. `plain` also wins over `compact` when both
    are set, and drops `emphasis`'s accent edge (card chrome) while keeping its brand value tint.
  - `orientation="vertical" | "horizontal"` (default `vertical`, reflected). `horizontal` lays label,
    value + unit, trend, sub and caption out on a single wrapping baseline row; `[part="spark"]` and
    `[part="rows"]` stay stacked on their own full-width line beneath it.
  - `[part="label"]` is now `hidden` whenever `label` is empty, so a label-less stat no longer leaves
    a blank gap above its value. A non-empty label is never hidden and its `aria-labelledby` pairing
    with `[part="value"]` is unchanged.

- 3312708: Add component-scoped CSS custom properties for state styling across thirteen conversation, retrieval, viewer and media components. Each of these components previously painted a selected/active/current state straight from a library-wide `--lr-color-*` token, which left the state unrestylable from outside: `::part(x)[data-active]` is invalid CSS, so the only lever was hijacking the shared token — repainting every other surface on the page that read it.

  Every new property uses the inline `var()` fallback form and is deliberately **not** declared on `:host`, so a value set on the element or any ancestor is honoured rather than shadowed. With none of them set, rendering is byte-identical to before.

  - `lr-conversation-item` — `--lr-conversation-item-active-bg`, `--lr-conversation-item-active-color`
  - `lr-push-to-talk` — `--lr-push-to-talk-recording-color`
  - `lr-chunk-inspector` — `--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`
  - `lr-retrieval-results` — `--lr-retrieval-results-selected-border`
  - `lr-retrieval-trace` — `--lr-retrieval-trace-active-border`
  - `lr-source-picker` — `--lr-source-picker-checked-bg`, `--lr-source-picker-checked-border`, `--lr-source-picker-mixed-bg`
  - `lr-page-rail` — `--lr-page-rail-current-bg`
  - `lr-notebook-viewer` — `--lr-notebook-viewer-active-bg`
  - `lr-svg-viewer` — `--lr-svg-viewer-active-border`
  - `lr-document-preview` — `--lr-document-preview-active-border`
  - `lr-xml-viewer` — `--lr-xml-viewer-active-match-color`
  - `lr-av-player` — `--lr-av-player-marker-active-color`, `--lr-av-player-cue-current-bg`, `--lr-av-player-cue-active-match-color`
  - `lr-image-viewer` — `--lr-image-viewer-annotate-active-bg`, `--lr-image-viewer-annotate-active-border`, `--lr-image-viewer-highlight-active-color`

  `--lr-conversation-item-active-*` and `--lr-chunk-inspector-current-*` are documented as contrast-sensitive pairs: each background is half of a WCAG-AA dependency with the text color rendered on it.

  Also fixes a WCAG-AA contrast failure in `lr-chunk-inspector`: the current (`active-id`) chunk's score line rendered in `--lr-color-text-quiet`, which reaches only ~4.24:1 against the `--lr-color-brand-quiet` current-row background — under the 4.5:1 floor for normal-size text. It now uses full-strength text while current, matching the identical fix already carried by `lr-attachment-chip`, `lr-chat-message` and `lr-conversation-item`. Non-current rows keep the quiet treatment.

- 5e9a18e: `lr-table`: keep focus inside a persistent (`editable: 'always'`) cell editor when the rows are
  re-sorted underneath it. Row rendering is keyed by row key, so a re-sort _moves_ the editor's
  `<input>` node — the typed value rides along, but a DOM move drops focus on its own — so the table
  now records the focused editor's cell and restores focus to it after the move. A row that has left
  the rendered set entirely (paginated away, filtered out) only clears the record: focus is not yanked
  to whichever unrelated row now occupies that position.
- 5e9a18e: `lr-table`: give a persistent (`editable: 'always'`) cell editor its own Enter/Escape semantics.
  Enter commits and keeps focus in the field rather than closing an editor that has no closed state,
  and Escape — which has nothing to cancel back to — is no longer cancelled, so an ancestor
  dialog/popover still acts on it. A double-click editor's Enter-commits-and-closes and
  Escape-cancels behavior is unchanged. Adds the accompanying `AlwaysOnEditors` story.
- 5e9a18e: `lr-table`: widen `TableColumn.editable` to `boolean | 'always'`. `true` keeps today's
  double-click-to-open editor unchanged; the new `'always'` renders a persistent editor in every body
  cell of that column from first paint, for settings/rate-style grids where double-clicking each cell
  to change a value is the wrong interaction. Persistent editors are plain tab stops (no `tabindex` of
  their own), exactly like the existing row-expand toggle, so the roving header/row tabindex model is
  untouched; each one keeps its individually interpolated `tableEditCell` accessible name, and
  double-clicking an `'always'` cell no longer opens a second, competing editor inside it.
- 5e9a18e: `lr-table`: a persistent (`editable: 'always'`) cell editor binds its `value` as a content attribute
  rather than as the `.value` property, so native dirty-value-flag semantics apply — an out-of-band
  `rows` update to a cell the user has already typed into no longer replaces the draft they are still
  editing, while an untouched editor still picks up a new `rows` value normally. Double-click editors
  (`editable: true`) keep the property binding and its deliberate re-assert, unchanged. `lr-cell-edit`
  remains the only mutation channel; the table still never mutates `row`.
- 43ee7d0: `lr-table`: the empty state is now addressable, cells can carry a native tooltip, `table-layout` is
  settable, and the selected row has its own background custom property.

  - Every built-in `<lr-empty>` the table renders carries `part="empty"` and re-exports its own inner
    parts as `empty-base`/`empty-icon`/`empty-heading`/`empty-description`/`empty-actions`, so the
    empty state can be restyled from outside without replacing it. Note that the no-columns and
    no-rows states return the empty element as the shadow root's own root, so `::part(base)` does not
    apply in those two states — only in the filtered-to-zero one.
  - A new `empty` slot replaces the built-in empty state wholesale on the two _data_-empty branches
    (no rows at all, and filtered/paginated down to zero). The no-columns branch keeps its own
    `noColumnsHeading` copy and is deliberately not slot-replaceable — it reports a configuration
    problem, not an empty result set.
  - New `emptyCompact` property (`empty-compact` attribute) overrides the built-in empty state's
    `compact` density. Left unset it preserves today's per-branch behaviour exactly: spacious for the
    whole-table states, compact for the in-table filtered-to-zero one.
  - New `columns[].cellTitle(row)` renders the generated `<td>`'s native `title`, symmetrical with
    `cellStyle`. Returning `undefined` or an empty string omits the attribute entirely rather than
    rendering `title=""`, which would suppress an ancestor's own tooltip, and the attribute is
    suppressed while that cell is in inline-edit mode so the tooltip cannot shadow the editor. Some
    screen readers announce a `<td title>` as the cell's accessible name, so use it only for a longer
    form of what the cell already shows.
  - New `layout: 'auto' | 'fixed' = 'auto'` property (reflected) sets a floor for the table's
    `table-layout`. `fixed` applies the fixed algorithm even with no column widths declared; the
    default `auto` still resolves to fixed whenever a column declares a `width` or a drag-resize is in
    flight, since resizing does not work under `table-layout: auto`. Under `fixed` with no declared
    widths the first row determines every column's width — so revealing a `priority`-hidden column
    re-measures all of them — and `columns[].minWidth`/`maxWidth` are ignored by the fixed algorithm.
  - New `--lr-table-row-selected-bg` custom property (default `var(--lr-color-brand-quiet)`) recolors
    the `aria-selected` row. Shadow Parts forbids an attribute selector after `::part()`, so
    `::part(row)[aria-selected]` is invalid CSS and the selected row could previously only be
    restyled by overriding the library-wide brand-quiet token. Unset, rendering is unchanged.

- 437bef5: `lr-table`: add a skeleton loading mode. A new `loadingAppearance: 'spinner' | 'skeleton'`
  property (attribute `loading-appearance`, default `'spinner'` — unchanged output) controls how
  `loading` renders. `'skeleton'` keeps the real `<colgroup>`, `<thead>`, filter field and
  pagination footer in place and fills the table body with placeholder `<lr-skeleton>` rows, so a
  cold load sketches the grid's shape and holds its column geometry instead of collapsing to a
  spinner and reflowing when the rows arrive. The placeholder row count comes from the new
  `skeletonRows` property (attribute `skeleton-rows`, default `0` = derive from the normalized
  `pageSize`, capped at 20, else 3). Exactly one `role="status"` live region announces the load —
  each placeholder opts out of its own announcement, so there is no per-cell live-region storm. A
  `priority`-hidden column is given no visible placeholder cell. New `skeleton` CSS part targets the
  placeholders.
- bc8cb8b: Make the focus-ring and icon-button-size tokens themeable from an ancestor, and fill out
  `theme.css` with the inputs it was missing.

  `--lr-focus-ring-width`, `--lr-focus-ring-offset` and `--lr-icon-button-size` were the only
  three tokens declared as bare literals instead of chaining through a `--lr-theme-*` input.
  That made them the only tokens genuinely unreachable for subtree theming: a `--lr-*` token is
  re-declared on **every** `LyraElement`'s `:host`, so a value set on an ancestor is shadowed at
  the first intervening lyra host and never reaches anything nested inside it. `--lr-theme-*`
  inputs are declared only at `:root` (in `theme.css`) and never in component shadow styles, so
  they _do_ inherit through nested shadow roots — which is why the bridge is the supported route.
  The three tokens now read `--lr-theme-focus-ring-width`, `--lr-theme-focus-ring-offset` and
  `--lr-theme-icon-button-size`, with their existing values as fallbacks, so nothing renders
  differently by default.

  Keep a resolved `--lr-theme-icon-button-size` at or above 24px: it backs the hit area of
  `lr-date-input`, `lr-combobox`, `lr-input` and `lr-select`, and anything smaller fails
  WCAG 2.2 SC 2.5.8 (Target Size (Minimum)).

  `src/theme.css` also gains the type scale, spacing scale, stacking layers, chart palette,
  the 16 ANSI terminal slots, the raised surface and both overlay scrims as real inputs — every
  one set to the exact value it already fell back to, so importing the sheet changes no computed
  value. Two fixes came with that:

  - `.lr-dark` never set `--lr-theme-color-surface-raised`, so a `.lr-dark` page rendered raised
    surfaces at the light `#f6f8fa` while `prefers-color-scheme: dark` rendered them at `#22272e`.
    The dark block now mirrors the raised surface and the eight chart colors.
  - `--lr-color-overlay` and `--lr-color-overlay-strong` both read a single
    `--lr-theme-color-overlay` input, so defining that input flattened the strong scrim's `0.92`
    onto the plain scrim's value. `--lr-color-overlay-strong` now has its own
    `--lr-theme-color-overlay-strong` input, chained through the old one so a theme that sets only
    `--lr-theme-color-overlay` still tints both exactly as before.

- e9c4f22: `lr-thread-list` forwards a `compact` row density

  A reflected boolean `compact` (default `false`) that sets `compact` on every data-mode row
  `<lr-conversation-item>`, mirroring how `editable` is already forwarded — the one-attribute way to
  tighten a whole sidebar, where previously the only lever was styling `::part(row-item-base)` and
  `::part(row-item-title)` by hand. The density itself lives on the row item; this property only
  forwards it, so both components stay in sync from one implementation.

  Slotted mode (empty `threads` _with_ real slotted content) is a documented no-op: that mode renders
  host-supplied `<lr-conversation-item>`s as-is, so the host sets `compact` on its own items there —
  the same division of responsibility slotted mode already has for every other row property.

- b9d78b7: `lr-thread-list` now forwards the row `<lr-conversation-item>`'s own CSS parts out of data mode under
  a `row-item-*` namespace: `row-item-base`, `row-item-option`, `row-item-leading`, `row-item-content`,
  `row-item-title`, `row-item-title-input`, `row-item-rename-button`, `row-item-excerpt`,
  `row-item-meta`, `row-item-timestamp` and `row-item-actions`.

  Data mode builds each row itself, two shadow roots down, so until now none of those eleven parts were
  reachable from outside — including the two declarations that set row height. Row density could only
  be changed with `lr-thread-list::part(row) { --lr-theme-space-s: … }`, a whole-subtree retheme that
  also shrank everything nested in the row (a `renderActions` menu's items dropped below the
  touch-target floor and had to be un-retheme'd inline). `lr-thread-list::part(row-item-base)
{ padding-block: … }` now sets row density with no token override and no collateral damage.

  The existing `row-leading`/`row-content`/`row-meta`/`row-actions`/`row-wrapper` parts are unchanged;
  they wrap this component's render-callback output, which is a different surface from the item's own
  internals. Purely additive: an unstyled thread list renders identically.

- 9010a89: `lr-thread-list` exposes a `row-wrapper` CSS part around `wrapRow` output.

  `wrapRow` was the one row hook with no library-added part -- `renderLeading`, `renderRowContent`,
  `renderMeta` and `renderActions` each get a `row-*` wrapper, so a host wrapping a whole row had to
  thread its own class through the callback to lay it out. Its return value is now placed inside a
  `part="row-wrapper"` block `<div>`, reachable from outside as `lr-thread-list::part(row-wrapper)`.

  The wrapper is deliberately unstyled and block-level, and is added only when `wrapRow` is set: the
  box the internal `lr-virtual-list` measures for windowing is its own `[part="row"]` one level up,
  and an unstyled block box contributes exactly its child's height to it, so measured row heights are
  unchanged. The part is row-only -- group headers never pass through `wrapRow` and never carry it.

- 81af4b0: Add `sticky-groups` to `lr-thread-list`: the current date/custom group's header stays pinned to the
  top of the scroll viewport while its rows are in view, and is pushed off as the next group's header
  arrives. Group headers are ordinary virtualized rows, so this renders an `aria-hidden` copy into
  `lr-virtual-list`'s sticky layer — the real row keeps the `role="heading"` semantics and the tab
  order, while the pinned copy stays clickable and requests the same `lr-group-toggle` collapse. The
  band is exported as `::part(group-sticky)`, and the copy renders the same
  `group-header`/`group-toggle`/`group-label`/`group-icon` parts as the real header, so existing
  header styling applies to both. Default `false` renders exactly as before.
- 81af4b0: Remove `lr-thread-list`'s reach into the internal `lr-virtual-list`'s shadow root. Arrowing past the
  rendered window now scrolls through the child's public `scrollContainer` and waits for its
  `lr-scroll` notification before moving focus, instead of mutating the scroll position of an element
  found by querying the child's render root and then dispatching a fabricated `scroll` event at it —
  which also raced the child's re-render rather than following it. Row lookup goes through a new
  `lr-virtual-list.renderedRows` accessor (the currently-windowed `[part="row"]` wrappers, in item
  order), added because a windowed list gives a host no other way to reach a row that may not have
  existed a frame earlier; `exportparts` forwards styling, not element references.
- cea6d8e: `lr-token-input` can now edit a token in place. Set `editable` and each token becomes a roving tab
  stop that opens an inline editor on click, Enter, or F2: Enter commits and emits
  `lr-token-edit` with `{ value, previousValue, index }`, Escape reverts silently, and a blur commits
  without stealing focus back. New `token-label` and `token-editor` CSS parts (rendered only while
  `editable` is set) and a `--lr-token-input-editor-inline-size` custom property style the two states;
  with `editable` unset the token row renders exactly as before and stays non-focusable.

  `delimiter` now accepts `null` — as a property, or via `delimiter="none"` / `delimiter=""` — so a
  token may contain commas verbatim (`Bash(git status:*)`): nothing is split and no keystroke is
  treated as a commit key. Removing the attribute restores the `,` default, and an empty delimiter no
  longer explodes a draft into one token per character.

- 0a5666d: `<lr-tree>` gains a `reorderable` opt-in for keyboard reordering. With it set, Ctrl/Cmd+ArrowUp /
  Ctrl/Cmd+ArrowDown on the focused row emits `lr-reorder` with
  `detail: { id, parentId, fromIndex, toIndex }` — sibling-scoped indices within the node's own
  parent's child list (`parentId` is `null` for a top-level item), so a reorder can never turn into
  a reparent at a subtree boundary. The keybinding matches `<lr-dashboard-grid>`'s existing
  `cells-draggable` keyboard move; Alt+Arrow was avoided because it is browser back/forward on
  Windows and Linux. `data` stays host-owned — the event is a request, and the move is announced
  through an internal `<lr-live-region>` (new `treeNodeMoved` message key).

  Also fixes a pre-existing focus bug this surfaced: reassigning `data` in a way that merely
  _re-indexes_ the focused node (rather than removing it) dropped real DOM focus to `<body>`.
  Focus now follows the node, including for nested rows several shadow roots down.

  `reorderable` is `false` by default — unset, markup and keyboard behaviour are unchanged and no
  `lr-reorder` is ever emitted. `<lr-file-tree>` deliberately does not forward it: its tree items are
  derived from `nodes` and keyed by filesystem path, an order it does not own.

- 8774f0d: Add `lr-virtual-list` position queries: `offsetForIndex(index)` returns the pixel top row `index`
  renders at (clamped to `0…items.length`, so `offsetForIndex(items.length)` is the total content
  height), and `indexAtOffset(px)` returns the row whose box contains that offset (`-1` for an empty
  list). Both work in the same coordinate space as the scroll container's `scrollTop`, so a host can
  do scroll-linked layout without duplicating the windowing math; in `row-height="auto"` mode an
  unmeasured row's offset stays estimate-based until its `ResizeObserver` measurement lands.
- 8774f0d: Add `lr-virtual-list`'s sticky group header layer. Setting `renderStickyGroup` renders a
  `[part="sticky-group"]` overlay pinned to the top of the scroll viewport showing whichever `groups`
  entry the viewport is currently inside, pushed out by the overlap as the next group's header arrives
  rather than swapped abruptly. Native `position: sticky` on the rows themselves is structurally inert
  here, since every row is absolutely positioned and transform-offset by the windowing math.

  The overlay is a visual copy of content that already exists in the list, so it is `aria-hidden`, its
  ordinary focusable content is forced to `tabindex="-1"` (the real row keeps sole ownership of the
  heading semantics and of the tab order), and it is `pointer-events: none` until a consumer opts in
  with `lr-virtual-list::part(sticky-group) { pointer-events: auto; }`. It is measured by its own
  `ResizeObserver` and never by the row observer, so a group header that is also a real row is not
  double-counted in `row-height="auto"` mode. A `groups` entry whose `label` is the empty string now
  renders no `[part="group"]` marker — it is a pure position anchor, for a host that renders its own
  group headers as rows. With `renderStickyGroup` unset, nothing about the rendered output changes.

- 8774f0d: Add `lr-virtual-list`'s public `scrollContainer` getter (the `[part="base"]` scroll box, `undefined`
  before the first render) and an `lr-scroll` event (`detail: { scrollTop, viewportHeight }`). The
  event is emitted from the animation frame that already coalesces native `scroll` events, so a burst
  of them produces at most one `lr-scroll` per frame and none at all when the position did not change.
  Together they let a host follow _sub-row_ scroll movement — which `lr-visible-range-changed`, firing
  only on index-range changes, cannot report — without reaching into the component's shadow root or
  dispatching synthetic `scroll` events at it.

### Patch Changes

- 2e16fad: Fix `lr-artifact-panel`'s restore/copy/download header buttons rendering fully raw browser chrome
  (zero CSS at all) while the adjacent header buttons in the same row are fully themed, and give
  view-button its own hover/focus-visible to match its version-previous/version-next siblings.
- c2ddee5: Fix `lr-av-player`'s playback-rate `<select>` rendering raw browser chrome with an unthemed
  (typically white) option popup regardless of theme -- it now resets native appearance, themes its
  option list, and gains hover/focus-visible states and a decorative chevron in place of the removed
  native one.
- db4e0a5: Fix `lr-calendar`'s previous-month nav button never matching its own styling rule (it rendered with
  raw browser button chrome next to a fully themed next button) and add missing `:hover`/`:focus-visible`
  treatment to the nav buttons, day-grid cells, and agenda-event buttons.
- bfaf7f9: `lr-checkbox-group`: document `value` as a read-out of child state, and warn on the two ways it is
  misused.

  `value` shipped with no documentation at all while the generated docs listed it among settable
  properties, so it read as an input. It never was one: `sync()` recomputes it from the
  `<lr-checkbox>` children and assigns it on every child toggle, `slotchange`, `name`/`required`
  change, blur and `form.reset()` — and `connectedCallback()` syncs _before the first render_, so even
  a constructor-time or template-time `.value=` binding is discarded before it is ever observed. It
  now carries that contract in its JSDoc, and:

  - assigning `value` from outside logs a `console.warn` naming the property and pointing at `checked`
    on the children (once per element — a repeat assignment is the same mistake, not new information);
  - a group with two or more children sharing a `value` logs a `console.warn` too. This is the _easy_
    mistake, not an exotic one: `<lr-checkbox>`'s `value` defaults to `'on'`, so five undifferentiated
    children yield `['on','on','on','on','on']` and a `FormData` that cannot say which was checked.

  Both warnings follow the same plain-`console.warn` shape as the library's other authoring-mistake
  warnings (`lr-task-list` over-nesting, `lr-dashboard-grid` unmatched `cell-id`, `lr-flow-canvas`
  unrecognized child). No behavior changed for the normal children-drive-value flow, which warns not
  at all.

  `value` was deliberately **not** made authoritative. Push-down is unimplementable without surprise
  while children default to `value = 'on'` (a host assigning `['on']` would check every
  undifferentiated child), and it would additionally need a re-entrancy guard and a pending-value
  retention path for children that have not upgraded yet. Recorded here so a later release can add a
  distinct `defaultValue` API without reversing anything documented now.

- 2a45da4: Fix four components (`lr-chunk-inspector`, `lr-community-card`, `lr-provenance-panel`,
  `lr-notebook-viewer`) whose real `<button>`s get UA-chrome reset (`border:none; background:
transparent; cursor:pointer;`) but no hover or focus-visible of their own -- `lr-provenance-panel`'s
  disclosure header (`aria-expanded`/`aria-controls`) had zero visible keyboard focus indicator at all.
- 1d121a9: Fix `lr-code-block`/`lr-code-block-core`'s shiki dark-theme override only activating on the OS-level
  `prefers-color-scheme` media query -- a consumer who sets `--lr-theme-color-*` explicitly, without the
  OS itself being in dark mode, now correctly gets the dark shiki syntax theme too, matching every other
  `--lr-color-*` token's consumer-overrides-first resolution.
- 1372546: Fix `lr-color-picker`'s native color swatch -- the directly visible, directly focusable control --
  having no hover or focus-visible treatment, so tabbing to it fell through to the browser's raw
  default color-input focus ring.
- f8bc916: `lr-combobox`: the `clearable` button now covers the filter axis as well as the selection.

  Typing a query that matches nothing left the user with no affordance to clear it — the button was
  gated on a committed selection alone, and `clear()` early-returned on an empty selection. It now
  renders whenever there is something to clear on either axis, and each axis announces only its own
  change: clearing a selection still emits `input`/`change`/`lr-clear`, while clearing filter text
  emits `lr-filter` with an empty `value` and no spurious selection events.

  The query half of the gate is scoped to states where the query is actually visible — the open
  listbox in single-select, or any time in `multiple` mode. A closed single-select shows the selected
  label rather than the query, so a stale query alone never surfaces a button offering to clear text
  the user cannot see.

- 77bfb28: Fix `lr-data-grid`'s sort-header focus ring targeting `<th>`, which can never itself receive
  keyboard focus (only its nested sort button can) -- tabbing to a sortable column header now shows
  the library's focus ring instead of the browser's raw default, and the sort button gains a
  matching hover state.
- dfd6199: Fix `lr-date-picker`'s previous/next month-nav buttons having a hover state but no focus-visible ring
  -- the file's only focus-visible coverage was on day cells, leaving keyboard users with no visible
  indicator on the nav buttons.
- 7c99e80: Route several stray hardcoded style values through design tokens so visually-identical states stay
  in sync across components:

  - **Disabled controls** in `lr-node-palette`, `lr-flow-controls`, `lr-compare-panel`,
    `lr-graph-query-builder`, and `lr-rubric-form` now dim through the shared `--lr-opacity-disabled`
    token instead of one-off `0.4`/`0.5`/`0.6` literals, so every disabled control fades by the same
    amount (and rethemes with one property).
  - **Anchored popovers/menus/tooltips** (`lr-menu`, `lr-select`, `lr-combobox`, `lr-date-input`,
    `lr-model-select`, `lr-voice-picker`, `lr-mention-popover`, `lr-export-button`, `lr-tour`,
    `lr-tool-call-chip`, `lr-usage-badge`, `lr-citation-badge`, `lr-entity-chip`,
    `lr-knowledge-graph-explorer`) share a new `--lr-popover-viewport-clamp` token (default `92vw`,
    themeable via `--lr-theme-popover-viewport-clamp`). Previously these split between `92vw` and
    `90vw`, so two popovers side by side could clamp to different widths; they now clamp consistently.
  - **Solid-fill hover lift** on `lr-chat-composer`, `lr-tool-approval-dialog`, `lr-message-feedback`,
    `lr-tour`, and `lr-retrieval-search` now shares a new `--lr-hover-brightness` token (default
    `1.08`, themeable via `--lr-theme-hover-brightness`), replacing per-component `filter: brightness()`
    magic numbers. Note `lr-retrieval-search`'s submit button now _brightens_ on hover like every other
    brand button, where it previously darkened (`0.92`).
  - `lr-calendar`'s narrow-container day-cell floor now references the existing `--lr-size-4rem` token
    instead of a raw `4rem`, matching its wide-container sibling.

  Also adds a new consumer override hook: `--lr-responsive-panel-sheet-max-block-size` (default `85dvh`,
  falling back to `85vh` where `dvh` is unsupported) lets you set the maximum height of an
  `lr-responsive-panel` `variant="bottom-sheet"` overlay, which previously had no override at all.

- ac5936a: Fix `lr-details`' summary -- the component's real, natively-focusable/clickable surface -- having no
  hover or focus-visible treatment at all. `lr-accordion-item` (which extends `lr-details` with no
  style override) is fixed by the same change.
- 188335c: Sync the consumer-facing agent reference (`llms/`) with the part-reachability, density and composed
  -content work that just landed across the viewers, media, retrieval, agent-tools, layout,
  conversation and data families.

  - Document the newly forwarded and newly named CSS parts on `lr-pdf-viewer`, `lr-archive-viewer`,
    `lr-page-rail`, `lr-notebook-viewer`, `lr-csv-viewer`, `lr-spreadsheet-viewer`,
    `lr-dataset-viewer`, `lr-av-player`, `lr-terminal`, `lr-ingestion-queue`, `lr-neighbor-list`,
    `lr-chunk-inspector`, `lr-retrieval-results` and `lr-activity-feed`, including why row state is
    published as an extra part name rather than an attribute on the part.
  - Replace the paragraphs that described `--lr-page-rail-current-bg`,
    `--lr-notebook-viewer-active-bg`, `--lr-av-player-cue-current-bg` and
    `--lr-av-player-cue-active-match-color` as declared-but-inert; all four now take effect.
  - Document `--lr-csv-viewer-highlight-color` and `--lr-spreadsheet-viewer-highlight-color`, and
    `--lr-trace-tree-row-active-color` (plus the pairing rule it forms with
    `--lr-trace-tree-row-active-bg`, and the knock-on note under `lr-agent-trace`).
  - Document `lr-menu`'s `header`/`footer` slots and parts, the revised Escape/Tab keyboard contract,
    and the narrowed scope of `closeOnEscapeAnywhere`.
  - Document `lr-table`'s `columns[].editable: 'always'` persistent editors, `lr-flow-node`'s
    `compact` and `card` part, `lr-flow-controls`' and `lr-chat-composer`'s `appearance`, and
    `lr-conversation-item`/`lr-thread-list`'s `compact`.

- 2be1ad5: Sync the consumer-facing agent reference (`llms/`) with the sticky group-header work on
  `lr-virtual-list` and `lr-thread-list`.

  - Document `lr-virtual-list`'s `renderStickyGroup`, the `sticky-group` CSS part, and the four
    behaviors a consumer would otherwise get wrong: the band is `aria-hidden` with its focusable
    descendants forced to `tabindex="-1"` (so it is never a second tab stop or a second heading, and a
    focus-delegating custom element inside it must set its own), it is `pointer-events: none` until
    opted back in through `lr-virtual-list::part(sticky-group)`, it is never measured as a row, and it
    stays mounted but hidden above the first group so its scroll inset is measurable before the first
    jump.
  - Document that a `groups` entry with an **empty** `label` renders no marker and acts as a pure
    position anchor, and drop the stale claim that `groups` had no visible effect and that its marker
    carried `role="heading"`.
  - Document `offsetForIndex()`/`indexAtOffset()`, the `scrollContainer`/`renderedRows` getters, the
    `lr-scroll` event and its `VirtualListScroll` detail type, and add a sticky-group usage example.
  - Document `lr-thread-list`'s `stickyGroups` property (attribute `sticky-groups`) and the
    `group-sticky` exported part, including that the real header row keeps the
    `role="heading"`/`aria-level` semantics and the tab order while the pinned copy stays clickable.

- ed762ff: `lr-xml-viewer` treats `--lr-icon-button-size` as a floor

  `lr-xml-viewer`'s node `[part='toggle']` is an interactive button that pinned the shared
  minimum-target token as a fixed `inline-size`/`block-size` with `padding: 0` and no floor — the
  opposite of what the token's own definition documents ("components pad out to this via
  `min-inline-size`/`min-block-size`, not by growing the glyph itself"). It now sizes its glyph box at
  `--lr-size-1-25rem` with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)`, mirroring
  `lr-code-block`'s equivalent toggle, so lowering the token shrinks the hit area but never squashes
  the chevron.

- 4c59cc2: Fix `lr-image-viewer`'s fit-mode `<select>` rendering raw browser chrome with an unthemed option
  popup, and add missing hover/focus-visible to all three toolbar controls (fit-control, rotate-button,
  annotate-toggle) -- previously none of the three had either state.
- 10c8b91: Fix `lr-input` (and `lr-time-input`, which renders through the same template/stylesheet) keeping
  native browser chrome in three cases: the search-cancel glyph only reset while `clearable` was set
  (the common non-clearable case kept it), `type="number"` never resetting the spin-button, and
  `type="time"` never touching its calendar-picker-indicator at all -- now restyled, not suppressed,
  since it's the only mouse/touch affordance to open the native time picker.
- 0410eb7: Fix two factual errors in the shipped agent-facing reference (`llms/shared.md`, and the
  `llms.txt`/`llms-full.txt`/`llms/` artifacts generated from it): the internals section stated
  `LYRA_PREFIX = 'lyra'` when the constant is `'lr'` — on the same line that correctly showed
  `tag(name)` producing `` `lr-${name}` `` — and claimed a hardcoded count of 127 `Lyra*EventMap`
  types when there are now 181. The count is no longer stated as a number, so it cannot drift again.
- 184bfff: `lr-menu`: axe coverage for a composed popup, stories moved onto the new `header`/`footer` slots,
  and the three shipped descriptions of what this component accepts finally agree.

  - New axe assertion for a menu with a `header` `<input>` and a `footer` `<button>` — the exact shape
    that was an `aria-required-children` violation while the only place for it was inside
    `role="menu"`, and which no test covered.
  - `show() / hide({ focusTrigger: true })`'s Apply button moves to `slot="footer"`, and the filter
    field gets a new `header`-slot story. The old default-slot filter story stays, relabelled as the
    legacy shape it now is, so its `closeOnEscapeAnywhere` behavior remains covered.
  - The class doc's `@slot` tag said "menu items and `<hr>` only" while the interaction contract two
    paragraphs above it promised slotted controls "keep their own full default keyboard behavior" and
    `show()`/`hide()` named a slotted Apply button as a supported case. All three now describe the
    same component.

- 3c8a299: Add missing `:hover` to six agent-tools components (`lr-browser-frame`, `lr-commit-card`,
  `lr-terminal`, `lr-test-results`, `lr-compare-panel`, `lr-confirm-bar`) whose interactive buttons
  already had `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse
  users.
- 4ac6c31: Add missing `:hover` to six components (`lr-stack-trace`, `lr-span-waterfall`, `lr-chat-viewport`,
  `lr-checkpoint`, `lr-push-to-talk`, `lr-transcript-feed`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
- 696cc7f: Add missing `:hover` to six components (`lr-env-list`, `lr-graph-query-builder`, `lr-rubric-form`,
  `lr-chart`, `lr-scroller`, `lr-widget`) whose interactive controls already had `cursor: pointer` and a
  correct focus-visible ring but no hover affordance for mouse users; `lr-chart`'s reset-zoom-button also
  gains `font: inherit`, which it was missing entirely.
- e1b9c22: Add missing `:hover` to six components (`lr-carousel`, `lr-dashboard-grid`, `lr-callout`,
  `lr-memory-panel`, `lr-neighbor-list`, `lr-path-strip`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring (where applicable) but no hover affordance for
  mouse users.
- e73a243: Add missing `:hover` to six components (`lr-retrieval-results`, `lr-pdf-viewer`, `lr-ebook-viewer`,
  `lr-pptx-viewer`, `lr-email-viewer`, `lr-dataset-viewer`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
- ae8e04e: Fix nine components (`lr-combobox`, `lr-eval-dataset`, `lr-command-palette`, `lr-table`,
  `lr-tool-select-dialog`, `lr-code-editor`, `lr-message-feedback`, `lr-model-select`, `lr-voice-picker`)
  whose native `<input>`/`<textarea>` themed background/color/border correctly but left `::placeholder`
  at the browser's fixed light-tuned default -- each field's placeholder text now uses
  `--lr-color-text-quiet`, with Firefox's reduced default `::placeholder` opacity undone on the
  `type="search"` fields.
- e649e77: Fix `lr-node-palette`'s search field being the only `type="search"` field in its family with zero
  focus-ring styling (its siblings `lr-thread-list`/`lr-emoji-picker` already wire this), and reset the
  native search-cancel glyph to match.
- e879ff6: Fix `<lr-split>` and `<lr-stepper>` reporting a stale `effectiveOrientation` (and
  `data-effective-orientation`) when `orientation-breakpoint-basis="viewport"` and the viewport
  crossed the breakpoint while the element was detached from the DOM. The media-query listener is
  torn down on disconnect and a plain reconnect schedules no Lit update, so the missed crossing was
  never noticed; reconnecting now re-reads the query and announces the crossing (including
  `lr-split-orientation-change` / `lr-stepper-orientation-change`) only when the matched state
  actually differs. A plain mount, and a reconnect that crossed nothing, stay silent as before.
- c2ea153: Fix `lr-pagination`'s page-input and `lr-tool-param-form`'s numeric JSON-schema fields rendering the
  native spin-button inside a fixed-size control box -- the adjacent prev/next buttons (pagination) and
  form validation (tool-param-form) already provide stepping, so removing the spinner loses no
  functionality.
- 94fa823: `lr-terminal`, `lr-ingestion-queue` and `lr-dataset-viewer`: forward the CSS parts rendered through
  their internal `<lr-virtual-list>` so a consumer can actually reach them.

  All three already styled those parts correctly from their own stylesheets, but none forwarded
  `exportparts` from the `<lr-virtual-list>` element. Because the rows are `renderItem`'s output and
  therefore live inside that element's own shadow root, a consumer rule like
  `lr-terminal::part(line)` matched nothing at all — the documented parts were unreachable from
  outside the component.

  - `lr-terminal` now exports `line`.
  - `lr-ingestion-queue` now exports `item`, `item-header`, `item-name`, `item-progress`,
    `item-meta`, `item-error`, `item-actions`, `retry-button` and `cancel-button`.
  - `lr-dataset-viewer` now exports `data-row`, `cell`, `cell-highlight` and `cell-highlight-action`.

  No styling changed and no new parts were added.

- 56f7b65: Add a build-time guard against `::part()` CSS that parses but never matches.

  Two classes of silently-inert rule are now caught by `pnpm lint` (a new
  `scripts/check-part-reachability.mjs` in the contract-policy chain), neither of which any existing
  check — TypeScript, the style policy, or a test that inspects stylesheet text — could see:

  - **`cross-root-part`** — a component that mounts `<lr-virtual-list>` and hands it a
    `renderItem`/`renderGroup` callback renders those rows into _that element's_ shadow root, so a
    bare `[part='x']` selector in the composing component's own stylesheet can never match them. The
    checker cross-references the literal part names emitted from the callback (following the class
    members it reaches) against the bare `[part]` selectors in the sibling `*.styles.ts`, and reports
    any name that has no `lr-virtual-list::part(x)` rule anywhere in that file. Components that
    legitimately render the same part into both roots — below/above a virtualization threshold, or a
    directly-rendered header row — carry both selectors and are not flagged; a
    `policy-allow(cross-root-part):` comment covers anything else.
  - **`part-compound`** — per Selectors L4 a pseudo-element may only be followed by pseudo-classes, so
    `::part(a)[attr]`, `::part(a).cls`, `::part(a) .descendant` and `::part(a) > .child` parse and
    then match nothing. Every `*.styles.ts` is scanned for those shapes; `::part(a):hover`,
    `::part(a)::selection` and the part-list form `::part(a b)` remain valid and pass.

  No component behavior changes; the library is clean under both rules today.

- cce32a2: `lr-neighbor-list`: make the virtualized relationship rows and group headers actually styleable, by
  this component and by a consumer.

  Above `virtualizeAt` the rows are produced by this component's `renderItem` but committed into the
  embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='row']` selector
  can reach — so every row, node-label, direction, relation, meta and expand-button rule was silently
  inert and a large neighborhood rendered as raw browser `<button>`s with no dividers. Each rule now
  pairs its plain selector (still correct at/below the threshold) with an `lr-virtual-list::part(…)`
  twin, and an `exportparts` forwarding declaration makes the same parts reachable as
  `lr-neighbor-list::part(node-label)` etc. from a consuming stylesheet.

  Group headers were unstyled whenever the list virtualized: in that path the header is the internal
  virtual-list's own `group` part, which this component neither styled nor exported. It is now styled
  to match `group-header` and exported under that same name, so grouped rows present identically
  either side of the threshold.

  The virtualized rows no longer nest a second `role="listitem"`/`part="row"` element inside the
  virtual-list's own row wrapper. `renderItem` returns just the row's content, exactly as the
  non-virtualized path's own wrapper receives it: the duplicate nesting both reported a `listitem`
  inside a `listitem` and made the row's padding and divider border apply twice, since `::part()`
  matches at any depth of the target shadow tree.

- 1e518e6: Fix `lr-playback`'s range slider only getting a pointer cursor in its disabled state, unlike the
  adjacent play button, and add a matching hover affordance.
- 5e9a18e: `lr-table`: focus the cell editor that was actually just opened by a double-click. The autofocus
  looked up `[part="cell-editor"]` across the whole grid and focused whichever one came first in the
  DOM — indistinguishable from correct while only one editor could ever exist at a time, but wrong as
  soon as a column renders persistent (`editable: 'always'`) editors of its own. It is now scoped to
  the opening cell's own row and column.
- 326973c: Fix `lr-thread-list` and `lr-emoji-picker`'s otherwise fully-themed search fields showing a raw
  gray browser "x" glyph (with its own hit target and hover behavior, ignoring every token applied to
  the field) once non-empty.
- 9010a89: `lr-thread-list` and `lr-chat-viewport` now size their virtual list to their own height.

  Both composed an `lr-virtual-list` without ever setting `--lr-virtual-list-height`, so the list
  scrolled inside that token's 24rem default no matter how tall the surrounding pane was -- a
  `<lr-thread-list>` in a 700px sidebar showed a 384px scroller with dead space underneath, and every
  consumer had to hand-set `--lr-virtual-list-height` to work around it. Both now fill the height they
  are given with no consumer CSS. `lr-thread-list` degrades safely: in a container with no resolvable
  height the internal viewport still renders at exactly the 24rem it does today (the shipped default
  becomes the list's flex-basis rather than a percentage that would collapse to zero or grow to the
  full un-virtualized content height). `lr-chat-viewport`'s virtual mode uses a percentage -- the
  slotted list lives in the consumer's light DOM, out of reach of `::part()` -- so it, like slotted
  mode's own scroll container, needs a height-bounded parent. A consumer rule or inline style setting
  `--lr-virtual-list-height` on the list still wins in both components.

  Also fixes `lr-chat-viewport`'s virtual-mode layout rules, which were written as
  `:host(:has(> lr-virtual-list))`. `:has()` is invalid inside `:host()`, so those rules were silently
  dropped: in virtual mode `[part="scroll"]` kept the padding and `overflow-y: auto` it is documented
  to give up, and `[part="content"]` never got the height the slotted list sizes against.

- 3e1d4f8: Fix `lr-token-input`'s draft-input and inline token-editor leaving `::placeholder` at the browser's
  default color, and add missing `:hover`/`:focus-visible` to the per-token remove button.
- 67a7881: Cover `lr-trace-tree`'s active row with an axe assertion. The active-row test group previously
  carried a comment explaining why no accessibility assertion could be made there — the default tint
  put the row's own secondary text below the WCAG AA contrast floor, so any axe run against a
  populated active row would have failed. With that fixed, the assertion now runs for real: a
  populated tree is asserted accessible with each status tone in turn made active, after first
  proving the fixture actually reached the `[data-active]` state so the check cannot pass vacuously.
  It was verified to bite by reverting the fix and confirming axe reports the exact contrast
  violations it is meant to catch. The active-row Storybook story now sets
  `--lr-trace-tree-row-active-bg` and `--lr-trace-tree-row-active-color` together and documents why
  they are a pair.
- 67a7881: Fix `lr-trace-tree`'s active-row secondary text falling below the WCAG AA 4.5:1 contrast floor. The
  active (`activeSpanId`) row paints `--lr-color-brand-quiet`, against which `--lr-color-text-quiet`
  lands at ~4.25:1 — so `detail`, `duration`, `tokens-in`, `tokens-out`, `cost` and the `pending`
  status label were all failing while the row was active, even though every one of them passes
  comfortably against the plain row background. Those parts now render at full-strength
  `--lr-color-text` once the row is active (15.3:1 in light mode, 11.2:1 in dark), the same fix
  `lr-conversation-item` already carries for the identical bug. Darkening the active tint instead
  would have made it worse: every failing foreground is dark text.

  This changes default rendering on the active row, which is intended — the previous default was a
  real accessibility failure. The new `--lr-trace-tree-row-active-color` custom property retunes it;
  it pairs with `--lr-trace-tree-row-active-bg`, and a consumer setting that to a dark tint in light
  mode should set both, because the defaults assume the active background stays on the same side of
  the lightness midpoint as the ambient surface.

- 67a7881: Raise `lr-trace-tree`'s active-row status labels to clear WCAG AA without flattening their hue.
  `[part='status-text']` on the active row now renders
  `color-mix(in srgb, var(--lr-color-<tone>) 75%, var(--lr-color-text))` for each semantic tone —
  success moves from 4.46:1 to 6.18:1 and `denied` from 4.28:1 to 5.96:1 against the default active
  tint, while `error` and `running` (which only barely cleared the floor) gain headroom too. Keeping
  the hue matters: an error row that stops being red once selected loses the fastest scan signal in a
  trace list.

  The mix is applied to every semantic tone rather than only the two that fail at the shipped
  defaults, because a per-status carve-out is theme-fragile — a consumer retheming one `--lr-color-*`
  moves that ratio and would silently re-break. It is also theme-symmetric by construction:
  `--lr-color-text` flips with the color scheme, so the same declaration darkens the label in light
  mode and lightens it in dark mode. `[part='bar']` is deliberately untouched — it is a non-text
  graphic on a 3:1 floor it already passes, and scoping the mix to `[part='status-text']` avoids
  re-pointing a consumer's own `--lr-color-*` override inside one row.

- 4df6ca1: `lr-virtual-list` no longer traps a popup opened from inside a row underneath the rows that follow
  it. `[part="row"]` sets `will-change: transform`, which makes every row its own stacking context, and
  rows carried no `z-index` — so they painted in DOM order and each row painted over the previous one.
  A `lr-menu` dropdown rendered in a row (for example through `lr-thread-list`'s `renderActions`) was
  positioned, visible and hit-testable, yet painted _under_ the next rows: its own `z-index: 900` only
  orders siblings inside its row's context. The last row always looked correct, so small fixtures never
  caught it.

  `[part="row"]:focus-within` now lifts the row to `var(--lr-layer-content)` — the same layer
  `[part="group"]` already uses — for exactly as long as something inside it holds focus. This also
  stops outward focus rings on a row being clipped by later rows. Nothing changes when no row holds
  focus.

- 8774f0d: Keep `lr-virtual-list`'s scroll-into-view clear of the sticky group band. With `renderStickyGroup`
  set, the band's measured height is applied as `scroll-padding-block-start` on the scroll container —
  so native keyboard and anchor scrolling get the same treatment — and subtracted from the
  top-aligned targets `active-id` and `scrollToIndex({ align: 'start' })` compute, which otherwise
  parked the target row underneath the band. `align: 'end'` is unaffected, since the band never
  covers the viewport's bottom edge. With `renderStickyGroup` unset the inset is zero and both scroll
  paths behave exactly as before, with no inline style on the container at all.

## 5.1.0

### Minor Changes

- 5f82bf7: Add role-scoped bubble cssprops to `lr-chat-message` — `--lr-chat-message-bubble-bg`,
  `--lr-chat-message-bubble-color`, `--lr-chat-message-user-bubble-bg`, and
  `--lr-chat-message-user-bubble-color` — so a consumer can retint one role's bubble fill/text
  without overriding the shared `--lr-color-brand-quiet`/`--lr-color-surface`/`--lr-color-text`
  tokens, which also drive unrelated parts of the component (e.g. `[part="collapse-button"]:hover`).
  All four default to exactly the values the bubble already used, so nothing changes for existing
  consumers who set none of them.
- abd60dd: `lr-stepper`'s `orientation-breakpoint` now accepts a CSS length, not only a bare pixel number:
  `500`, `'500'`, `'500px'`, `'31.25rem'` and `'3em'` are all valid, and equal computed values behave
  identically.

  `rem` resolves against the **document root**'s computed font size — exactly as a `rem` in a CSS
  `@media` query does, and deliberately _not_ against the stepper itself — so a breakpoint authored in
  `rem` stays numerically in step with the sibling `@media (max-width: …rem)` rule it has to agree
  with, instead of silently drifting from it when the root font size changes (browser zoom, a user
  font-size preference, an app base-size token). `em` resolves against the stepper's own computed font
  size. The length is re-resolved on every measurement and never cached, so those changes are picked
  up without any invalidation step on the consumer's side.

  A value that isn't a usable length — `%`, `vw`, `calc()`, `'auto'`, an unparseable string — now
  behaves exactly as unset: no `ResizeObserver` is armed and no `data-effective-orientation` attribute
  appears, rather than arming a breakpoint that can never be crossed. For a viewport-relative
  breakpoint, leave `orientationBreakpoint` unset and drive `orientation` from your own `matchMedia()`
  controller; `orientationBreakpoint` measures the stepper's own allocated inline size, not the
  viewport.

  The property's TypeScript type widens from `number | undefined` to `number | string | undefined`,
  and the `orientation-breakpoint` attribute is no longer coerced through Lit's `Number` converter.
  Every existing numeric usage — attribute or property — is unaffected. This mirrors the identical
  change to `lr-split`, whose `orientationBreakpoint`/`narrowOrientation` contract `lr-stepper`
  deliberately shares.

- 22cb935: `lr-heatmap` gains a `legendStops` property so the built-in legend can describe a custom
  `cellColor` domain. Because `cellColor` overrides a cell's color entirely, the legend's
  `--lr-heatmap-scale-lo`/`-hi` gradient bar could describe a ramp the grid no longer used, leaving a
  consumer to hide `::part(legend)` and hand-roll swatches.

  `legendStops: HeatmapLegendStop[]` (`{ value, color, label? }`, `attribute: false`) renders a
  discrete key **instead of** that gradient bar — one `[part="legend-stop"]` per entry in array order,
  each a `[part="legend-swatch"]` in the entry's color plus a `[part="legend-stop-label"]`. Labels
  default to the component's own locale-aware numeric formatting of `value`, so an explicit `label` is
  only needed when the number isn't the right caption. `[part="legend-lo"]`/`[part="legend-hi"]` and
  the bar are omitted while stops are supplied; labeled `annotations` still render their
  `[part="legend-annotation"]` entries alongside them.

  The stops are presentation only — they never feed back into the color ramp, the bucket math, the
  tooltip or the accessible name. Left unset (or empty), the legend renders exactly as before.

- ce2a423: `lr-combobox` now emits `lr-filter` (`detail: { value: string }`) on every user-driven change to its
  in-progress filter text, so consumers that need the live as-you-typed string — a "no matches for
  “x”" empty state, a debounced side effect — no longer have to reach into the component's shadow DOM
  for `[part="combobox-input"]`.

  The name is deliberately not `lr-input`: on `lr-combobox` the host's `value` is the _committed
  selection_, so reusing `lr-input`'s event name would make one event name carry a different string on
  different components. `lr-filter` fires for user input only — picking a row, the clear button,
  `form.reset()`, dismissing the listbox, a programmatic `value` write and `setRangeText()` all blank
  the filter silently, mirroring how `<lr-input>`'s `lr-input` only reports user edits.

  The `ComboboxFilterDetail` detail type is exported and `LyraComboboxEventMap` carries the new entry,
  so `addEventListener('lr-filter', …)` is typed.

- 7c46ced: `<lr-split>`'s `orientationBreakpoint` now accepts a CSS length string as well as a bare pixel
  number, so it can be authored in the same unit as the sibling CSS `@media` rule it has to agree
  with.

  Accepted forms: `900` / `orientation-breakpoint="900"` (unchanged), `'900px'`, `'56.25rem'`, and
  `'3em'`. `rem` resolves against the **document root**'s font size — exactly as a `rem` in a CSS
  `@media` query does, not against the element — so a breakpoint written to match
  `@media (max-width: 56.25rem)` stays in sync with it across browser zoom, a user font-size
  preference, or an app-level base-size change. `em` resolves against the split's own computed font
  size. The length is re-resolved on **every** measurement rather than cached at first render, so a
  root font-size change moves the crossing width with no invalidation step.

  Anything that isn't a resolvable length now behaves exactly as unset — no `ResizeObserver`, no
  `data-effective-orientation` marker — where before, a non-numeric attribute became `NaN` and armed
  observation for a threshold that could never be crossed. That deliberately includes `%`, `vw`/`vh`
  and `calc()`, which would mix a viewport-relative threshold into a measurement of the element's own
  allocation; drive `orientation` from your own `matchMedia()` controller for a viewport-relative
  breakpoint instead.

  One visible consequence of dropping the `Number` attribute converter: reading `.orientationBreakpoint`
  back after setting the attribute now returns the authored string (`'900'`), not the number `900`.
  The resulting layout behavior is identical, and the property type is now `number | string`.

- 2be0a50: `<lr-split>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
  opt-in), selecting whether `orientationBreakpoint` is compared against the component's own
  measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis lets sibling
  components in one row flip orientation together at a single shared breakpoint — impossible
  to express with a self-measured threshold when the row stacks via a CSS `@media` rule — and
  lets the browser resolve a `rem` breakpoint with real media-query semantics. Left unset,
  behavior is unchanged.
- 96ea325: `<lr-stepper>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
  opt-in), selecting whether `orientationBreakpoint` is compared against the stepper's own
  measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis is the only
  way a stepper with a fixed width in a row layout can react to that row stacking at a shared
  breakpoint. Left unset, behavior is unchanged.
- b1ce3f6: `lr-sequence-strip`: add `showLegend` for a persistent category key.

  The strip colors each cell by category, but the only way to read that mapping was to hover every
  cell one at a time — consumers were hand-rolling a swatch key underneath instead. `showLegend`
  (attribute `show-legend`, reflected, default `false`) now renders that key from the `categories`
  array the component already receives, as `legend` / `legend-item` / `legend-swatch` /
  `legend-label` CSS parts, with `--lr-sequence-strip-legend-swatch-size` to resize the chips.

  The legend is deliberately static — it lists every `categories` entry whether or not any item uses
  it, and toggles nothing (`lr-graph-legend` remains the interactive, filtering legend). Because it
  only repeats the category names the strip already announces through `[part="base"]`'s `role="img"`
  summary, the whole legend is `aria-hidden`: visible on screen, announced exactly once. Left unset,
  rendering is unchanged.

- 3127d5e: Restructure the AI-agent-facing reference so a component lookup costs a few hundred tokens instead
  of the whole catalog, and close the gaps that made it unreliable.

  **New published layout.** `llms/index.md` maps every tag to its import path and one-line purpose;
  `llms/components/<tag>.md` is a self-contained per-component reference addressed directly from the
  tag name; `llms/shared.md`, `llms/tokens.md`, `llms/peers.md` and `llms/migration.md` carry the
  library-wide contracts. `llms.txt` is now the entry index over all of it, and `llms-full.txt` keeps
  its role as the single-file concatenation. Everything is generated from per-family authored sources
  by `pnpm run llms` and diffed in CI, so the docs cannot drift from `custom-elements.json`.

  **Corrected documentation that was wrong, not merely missing:**

  - Import paths in the docs had not been updated for the family directory layout —
    `components/combobox/combobox.js` does not resolve; it is
    `components/forms/combobox/combobox.js`. CI now fails on any documented path that has no source
    module.
  - 26 components were documented twice with divergent content; the freshness check validated the
    weaker copy.
  - `lr-include` was documented with the wrong purpose, property semantics, event name and CSS parts.
  - Wrong or non-existent CSS parts on `lr-timeline`/`lr-timeline-item`, `lr-tour`, `lr-known-date`,
    `lr-random-content`, `lr-avatar-group`, `lr-breadcrumb`, `lr-swatch-picker`.
  - `lr-button` was missing the `quiet` appearance and the `2xs` size; `lr-attachment-trigger` was
    missing the `audio` capability; `lr-avatar` was documented as having no slots.
  - `lr-widget` event details are objects, not scalars; three overlay-color tokens do resolve to
    `var(--lr-color-overlay)`; `lr-histogram`'s `label` default is localized, not `'Frequency'`.
  - The root barrel skips 15 peer-gated tags, not 13 — `lr-knowledge-graph-explorer` and
    `lr-geojson-view` were undocumented omissions.

  **Newly documented:** the `@aceshooting/lyra-ui/ai` provider-neutral data types, the `locale` and
  `strings` properties present on every element, the localization API surface
  (`setLyraLocale`/`getLyraLocale`/`resolveLyraString`/`LYRA_DEFAULT_STRINGS` and its 996 message
  keys), the full design-token catalog, framework integration (React/Vue/Angular/Svelte property and
  event binding), TypeScript usage (the 127 `Lyra*EventMap` types, the typed `addEventListener`,
  `HTMLElementTagNameMap`), SSR/declarative-shadow-DOM status, the component-to-peer-dependency table,
  editor tooling metadata, and `<lr-map>`'s OpenStreetMap demo-tile-server production hazard.

  The freshness check now covers events, slots, CSS parts and themeable custom properties in addition
  to properties — it previously only checked properties, which is how 87 public names came to be
  documented nowhere.

### Patch Changes

- 7bdefd2: `lr-time-input` now accepts `min`/`max` as attributes. It inherits both from `lr-input`, where they
  are declared `type: Number` for the `type="number"` contract, so a `min="09:00"` attribute parsed to
  `NaN` and reached the native `<input type="time">` as the literal string `"NaN"` — which the browser
  discards, silently dropping the bound. Only a direct property assignment worked, and it needed a
  TypeScript widening cast to do so.

  `LyraTimeInput` now redeclares `min`/`max` with a converter that forwards the attribute verbatim, so
  `<lr-time-input min="09:00" max="17:00">` reaches the native input intact and its own constraint
  validation reports `rangeUnderflow`/`rangeOverflow` as it should. Seconds-precision bounds
  (`min="09:00:30"` alongside `step="1"`) work the same way, removing the attribute clears the bound,
  and both are typed `string | number | undefined` so an assignment no longer needs a cast.

  `<lr-input type="number">` is unchanged: its `min`/`max` attributes still parse to numbers.

- 2724dec: Add an internal `resolveCssLength()` helper that resolves a CSS length (a bare/`px` number, `rem`,
  or `em`) to pixels, reading the document root font size at call time so a `rem`-authored threshold
  tracks browser zoom, a user font-size preference, or an app changing its base size. Units that only
  make sense against a different reference box (`%`, `vw`/`vh`, `ch`), absolute units, and
  `calc()`/`var()` expressions resolve to `undefined`, which callers treat as "unset".

  No public API change yet — this is the shared groundwork for letting `lr-split` and `lr-stepper`
  accept `orientation-breakpoint` as a CSS length.

- 356f5fb: `lr-emoji-picker` now resolves its three geometry custom properties to real pixels before using
  them for the windowed layout. `--lr-emoji-picker-item-size`, `--lr-emoji-picker-gap`, and
  `--lr-emoji-picker-row-height` were read with `parseFloat(getComputedStyle(host).getPropertyValue(
token))`, which hands back the property's computed _token stream_ rather than a length: the shipped
  `2.5rem` item size was used as `2.5px`, the `0.125rem` gap as `0.125px`, and the `calc()`-based
  default row height was unparseable and always fell back to a hardcoded `64`. The windowed grid
  therefore packed its column cap of 20 emoji into a row that could only paint five, and scrolled at a
  row pitch that did not match the painted rows.

  Each token is now assigned to an off-flow probe box in the shadow root and read back as that box's
  used inline size, so the browser performs the unit math — `rem`, `em`, `ch`, `%`, `calc()`, any CSS
  length resolves correctly, and the item-size probe carries the same `--lr-icon-button-size` minimum
  the emoji buttons do, so the measured item size is the painted one. The result is cached and
  re-derived only when it can actually change: the probe boxes are themselves observed, so a token
  override applied after the first render, a theme swap, or a root/host font-size change updates the
  geometry without any per-frame measurement. Numeric fallbacks still cover the case where no box has
  been laid out yet.

  Consumers no longer have to express these tokens in `px` for the windowed geometry to line up with
  what is painted.

- 4ddf1fb: Document `orientationBreakpointBasis` on `<lr-split>` and `<lr-stepper>`, and the four
  role-scoped bubble custom properties on `<lr-chat-message>`. Also corrects a claim that
  a `rem` inside a CSS `@media` query resolves against the document root's computed font
  size — it resolves against the browser's _initial_ font size, which is exactly why the
  `'viewport'` basis, and not `'container'`, is the one that matches a CSS `@media` rule.
- 2a0cb74: Add an internal `OrientationBreakpointController` that owns orientation-breakpoint
  resolution, basis selection, and media-query lifecycle for the layout components. No
  consumer-visible change on its own.
- 8057596: Fix `<lr-pdf-viewer>`'s `search()` throwing an uncaught `IndexSizeError` when a search term occurs
  more than once inside a single PDF.js text-layer node (e.g. a repeated substring within one text
  item's `<span>`). `paintSearchMatches()` computed every match's DOM range against a pristine,
  pre-painting snapshot of each text node, but wrapping the first match with `Range.surroundContents()`
  splits/shrinks that node out from under the second match's precomputed offset, so `setStart()`/
  `setEnd()` threw before the existing `surroundContents()` try/catch ever ran. Offsets for a node are
  now tracked against the node as it actually stands after each prior match is painted, so every
  repeated occurrence within one text-layer node is now correctly highlighted instead of crashing
  `search()`.
- 415e61f: `<lr-code-editor>`: make `--lr-code-editor-tab-size` actually themeable.

  The stylesheet read the token on the `textarea` part, but `render()` also wrote an inline
  `tab-size:${tabSize}` on that same element on every update, and an inline declaration always beats a
  rule — so the documented token was inert and a host-level override was silently ignored.

  `render()` now writes the token itself, and only when `tabSize` was explicitly assigned. The
  resulting precedence, highest first: an explicitly set `tabSize` (property or `tab-size` attribute)

  > a host-level `--lr-code-editor-tab-size` > the `:host` default of `2`. `tabSize` therefore remains
  > the primary knob and still wins wherever it is used; it just stops shadowing the token while it sits
  > at its default. The Tab key follows the same order, so the indent unit and the rendered tab stops
  > cannot disagree — except for a length-valued token (`40px`, `2ch`, …), which stays a purely visual
  > tab-stop metric and leaves the inserted-space count at `tabSize`.

## 5.0.0

### Major Changes

- 3abb16e: Reorganized `packages/lyra-ui/src/components/` into 11 named family subfolders (Conversation &
  Chat, Agent Tools & Observability, Retrieval & Knowledge Graphs, Forms & Inputs, Data Display,
  Charts, Layout & Navigation, Overlays & Feedback, Document & File Viewers, Media & Files, Utility)
  instead of a flat 212-directory list.

  **Breaking:** any consumer importing an individual component's granular subpath (e.g.
  `@aceshooting/lyra-ui/components/combobox/combobox.js`) must add that component's family segment
  (`@aceshooting/lyra-ui/components/forms/combobox/combobox.js`). The root entry
  (`@aceshooting/lyra-ui`) and the `@aceshooting/lyra-ui/components/*` wildcard export are
  unaffected for consumers who only import the root barrel. See
  `packages/lyra-ui/scripts/component-families.json` for the full directory-to-family mapping.

### Minor Changes

- 0ed6e71: Added a frame-coalesced `lr-viewport-change` event to `lr-graph`, firing at most once per
  animation frame for every source that can move a rendered node's screen position (pan/zoom, a
  `focusNode()`/`fit()` tween, or a simulation tick) so a consumer anchoring its own UI to a node's
  `getBoundingClientRect()` no longer needs to poll its own `requestAnimationFrame` loop.
  `--lr-graph-dimmed-opacity` now defaults to `0.35` (previously the inert `1`), so `dimmedNodeIds`/
  `dimmedLinkIds` are visible out of the box with no host styling required.

  `lr-knowledge-graph-explorer` now computes and forwards `dimmedLinkIds` alongside
  `dimmedNodeIds`, switched its details-popover pan/zoom tracking from RAF polling to the new
  `lr-viewport-change` event, and added a `highlight: 'selection' | 'hover' | 'none' = 'selection'`
  property: `'hover'` also dims by the currently pointer-hovered node's neighborhood, `'none'` opts
  a host out of this component's own dimming entirely.

- bd501b7: Added `defaultSizes` to `lr-split` for an initialization-only fallback (a valid restored
  `storageKey` layout still wins, then `defaultSizes`, then equal distribution) that's never
  overwritten by a later reactive parent render. Added an opt-in `orientationBreakpoint`/
  `narrowOrientation` responsive-axis contract (mirrored below by `lr-stepper`): below the
  component's own measured inline size, `narrowOrientation` becomes the effective resize axis
  instead of the authored `orientation`, exposed via `effectiveOrientation`, a
  `data-effective-orientation` attribute, and `lr-split-orientation-change`. Extended
  `panelConstraints` with `minPercent`/`maxPercent`, combining with `minPx`/`maxPx` on the same side
  via the stricter bound.
- 5319ed6: Added an opt-in `orientationBreakpoint`/`narrowOrientation` responsive-axis contract to
  `lr-stepper`, mirroring `lr-split`'s identically-named properties: below the stepper's own
  measured inline size, `narrowOrientation` becomes the effective layout/navigation axis instead of
  the authored `orientation`, exposed via `effectiveOrientation`, a `data-effective-orientation`
  attribute, and `lr-stepper-orientation-change`. Unset (the default), behavior is unchanged.

## 4.2.0

### Minor Changes

- f3ae130: Adds an `@aceshooting/lyra-ui/ai` entrypoint re-exporting the provider-neutral AI/agent data
  contracts from `src/ai/types.ts` (also re-exported as types from the root `lyra.ts` barrel), so
  consumers importing these shared types don't have to reach into `./ai/types` directly.
- 46eb4d2: `<lr-diff-view>` gains a `contextLines` property: collapses a run of unchanged lines longer than
  `2 * contextLines` behind a single localized fold marker reporting how many lines it hides, keeping
  only `contextLines` lines of context immediately before/after each change (leading/trailing runs
  keep only their nearest `contextLines` lines) — the same context-window convention `git diff -U<n>`
  uses. Default `undefined` renders every line unconditionally, exactly as before this property
  existed. Works identically in both `unified` and `split` layout.

### Patch Changes

- fffd101: `<lr-chart>` no longer tracks its resolved Chart.js draw-time chart-area geometry as a reactive
  `@state()` field — recording it during Chart.js's own draw pass could trigger a second synchronous
  Lit update mid-draw. It's now a plain private field with a microtask-coalesced `requestUpdate()`,
  so repeated geometry updates within the same draw pass collapse into a single re-render.
- 273d5da: Fixed `lr-csv-viewer` and `lr-spreadsheet-viewer`: data rows rendered as unstyled stacked text
  instead of a proper grid, because their styling lived in a `[part='data-row']`/`[part='cell']`
  CSS selector scoped to the wrong shadow root (data rows render inside the nested
  `<lr-virtual-list>`'s own shadow tree via its `renderItem` callback, not the viewer's own). Only
  the header row, rendered directly by the viewer, was ever actually styled. Fixed with
  `lr-virtual-list::part(data-row)`/`::part(cell)` rules that correctly reach across that shadow
  boundary.
- a15cb97: `<lr-notebook-viewer>` now interprets ANSI SGR color/style escape codes embedded in stream and error
  outputs (common in colorized Python tracebacks and console output), rendering them as styled spans
  via the same shared `internal/ansi.ts` parser `<lr-terminal>` uses, instead of showing the raw
  escape sequences as literal text.
- ef988d8: `<lr-trace-tree>` now syncs `focusedId` from `activeSpanId` in `willUpdate()` instead of `updated()`,
  so the roving-tabindex target updates before render rather than one tick after it.

## 4.1.0

### Minor Changes

- b28758d: New `<lr-agent-run>` component: the top-level shell for one `AgentRun` (from `@aceshooting/lyra-ui/ai/types`) -- lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus four named composition slots (`tasks`/`tools`/`reasoning`/`output`) for the run's actual content. Composes `lr-generation-status` for the live elapsed-time ticker while a run is in progress, `lr-usage-badge` for the cost summary, `lr-task-list` for the `tasks` slot's default content (mapped from `run.steps`), and `lr-badge`/`lr-empty` for the status pill and empty state -- no new step-rendering logic. Emits `lr-cancel`/`lr-retry` (`CancelEventDetail`/`RetryEventDetail`) rather than cancelling or retrying anything itself.
- f33364d: New `<lr-agent-trace>` component: a provider-neutral agent/LLM trace view combining a span-kind
  filter row, a handoff quick-jump list, and the full trace hierarchy, all driven by one shared
  `LyraSpan[]` array. All trace rendering -- hierarchy, expand/collapse, keyboard navigation,
  duration bars, empty state -- is entirely `<lr-trace-tree>`'s own; this component only ever hands
  it a (possibly filtered) `spans` array plus pass-through properties, never building its own row
  markup. The filter row composes `<lr-graph-legend>` (the same type/visibility-toggle legend
  pattern already established for `<lr-graph>` node types, reused here for `LyraSpan.kind`
  visibility) and the handoff list composes `<lr-handoff-divider>` for each visible `'agent'`-kind
  span. Selection (`activeSpanId`) is controlled end-to-end for deep-linking: both a tree-row click
  and a handoff quick-jump activation update it and fire the identical `lr-span-select` `{ id }`
  shape.
- eb3e833: New provider-neutral shared type surface at `@aceshooting/lyra-ui/ai/types`: `AgentStatus`,
  `AgentRun`, `AgentStep`, `ChatMessage`, `ToolInvocation`, `RetrievalQuery`, `RetrievalChunk`,
  `Citation`, `DocumentRef`, `GroundingAssessment`, and shared run-lifecycle/retrieval-progress/
  citation-select/tool-approval/cancel/retry/export event-detail types. A foundational types-only
  module (no runtime code, no new custom elements) for the upcoming retrieval, agent-run,
  knowledge-graph, dashboard, and evaluation component families -- structurally compatible with the
  prop shapes `lr-chat-message`, `lr-citation-badge`, `lr-tool-call-chip`, `lr-tool-result-view`,
  `lr-source-card`, `lr-attachment-chip`, and `lr-document-preview` already expose, so these types
  assign directly onto those components' own properties with no adapters. `ToolInvocation.status`
  reuses `lr-tool-call-chip`'s own `ToolCallStatus` union rather than the broader `AgentStatus`
  shape, since a single tool call's terminal state is exactly what that existing vocabulary already
  covers.
- c2d8f05: `lyra-chat-message` gains a `failure` slot, only ever rendered while `status="failed"`. Left empty
  (the default), today's built-in failed-state UI is unchanged: the `[part="status-text"]` message,
  the `[part="retry-button"]`, and the `chatFailedAnnounce` live-region announcement all keep working
  exactly as before. Once the slot has assigned content, that built-in status text and retry button
  are suppressed -- the host is now fully responsible for its own failure presentation (e.g. a
  prominent, translated `role="alert"` banner with its own retry control), and the built-in
  live-region announcement is suppressed too, so a host's own alert content doesn't get double
  announced alongside a generic built-in one. The `failure` slot itself contributes no box
  (`display: contents`), so the host's content lays out exactly as authored without needing any
  `::part(failure)` override. Content assigned to it should carry `role="alert"` itself when it
  represents an actionable send failure -- this component has no way to add that role on the host's
  behalf. Programmatic focus is rescued to `[part="bubble"]` (mirroring the existing built-in retry
  button's own focus rescue) whenever the failure slot's content held focus and `status` changes away
  from `"failed"`, so a host's own retry control clearing the failed state never silently drops focus
  to `document.body`. The existing `lr-retry` event contract is untouched; a host's own retry control
  can dispatch it manually to stay consistent with listeners elsewhere in a conversation surface, but
  nothing requires it to.
- 3f35f20: New `<lr-context-inspector>` component: an inspection view of the exact context assembled for a
  model call. Renders per-segment token estimates through an embedded `<lr-context-meter>`, source
  attribution through `<lr-citation-badge>`, and copy/export affordances through
  `<lr-copy-button>`/`<lr-export-button>` -- composing all four rather than re-implementing any of
  their rendering. Adds two small, purpose-built presentational features no existing primitive
  covers: a truncation-boundary marker for a segment cut short of its original content
  (`ContextInspectorSegment.truncated`/`omittedTokens`), and titled `<mark part="redaction">`
  highlighting for character ranges a segment's `text` already carries a redaction placeholder in
  (`ContextInspectorSegment.redactions`) -- this component never receives or renders unredacted
  content, only marks where a host-side redaction already happened. Pure projection: never fetches,
  estimates tokens, or performs redaction itself.
- 607b832: Add `<lr-dashboard-grid>`, a responsive, keyboard-accessible widget-layout shell: a controlled
  `layout: DashboardCell[]` (grid-unit `x`/`y`/`w`/`h` + a widget descriptor) drives a CSS Grid,
  composing `<lr-widget>`/`<lr-widget-renderer>` for each cell's default content unless a
  light-DOM `[cell-id]` child is authored instead. Pointer drag/resize and Ctrl/Cmd+Arrow (move) /
  Ctrl/Cmd+Shift+Arrow (resize) keyboard equivalents both route through the same `collision`-policy
  resolution (`'reject'` the default, `'push'`, or `'overlap'`), emitting `lr-cell-move`/
  `lr-cell-resize`/`lr-collision`/`lr-layout-change` -- the component never mutates `layout` itself
  nor touches `localStorage`/network; the host applies (or ignores) every event and owns persistence
  entirely, matching `lr-flow-canvas`/`lr-table`'s own controlled-component convention. Below a
  ~40rem container allocation (`@container`, not the viewport), cells stack into a single flowing
  column instead of shrinking columns unreadably.
- 21de4b4: `lyra-date-input` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
  `lyra-input`/`lyra-select`/`lyra-combobox`'s shared control-size scale. `size="s"` now renders the
  field at the same height/density as `lyra-input size="s"`, so a date field can sit flush beside a
  compact input or select in the same form row or toolbar. The calendar-toggle and clear buttons
  keep their existing minimum touch target at every tier instead of shrinking below it. The default
  `m` tier is pixel-identical to this component's previous, only rendering.
- d44e979: New `<lr-document-compare>` component: side-by-side or inline comparison of two document versions,
  composed entirely from existing primitives -- `<lr-diff-view>` (the real two-string line diff,
  `view="diff"`, the default) and `<lr-document-preview>` (each version's own actual rendered
  content, `view="side-by-side"`). The side-by-side panes are independently scrollable, so this
  component adds two minimal, purpose-built coordination mechanisms scoped narrowly to that: a
  proportional scroll-position sync (`syncScroll`, default `true`, mirroring `<lr-compare-panel>`'s
  own proven algorithm) and highlight-anchor sync (activating a region highlight shared by `id`
  across both versions' `highlights` scrolls the other pane to its own matching highlight). A shared
  `anchor` property (matching `<lr-document-viewer>`'s own) drives both panes to the same target at
  once. New `DocumentCompareVersion` type extends the shared `DocumentRef` (from `@aceshooting/lyra-ui/ai/types`)
  with `text` (diffed directly, no fetch) and per-version `highlights`.
- 7dfbed7: New `<lr-document-library>`: a searchable, filterable document inventory with versions, tags,
  owners, freshness, and bulk selection. Consumes the shared `DocumentRef` type from
  `@aceshooting/lyra-ui/ai/types` (`id`/`name`/`mimeType`/`uri`/`version`) as its base row shape,
  extended locally (`LibraryDocument`) with `tags`/`owner`/`updatedAt`/`freshness` -- the fields an
  inventory view needs that a provider-neutral document reference deliberately doesn't carry.
  Composes `<lr-table>` for the grid itself (`<lr-data-grid>` was evaluated and ruled out: it only
  supports a single `selectedKey` and stringifies every cell value, so it cannot host the checkbox/
  chip/icon content bulk selection, tags, and per-row type icons need; `<lr-table>` supports
  arbitrary cell content and `priority`-driven responsive column hiding), `<lr-chip>`/`<lr-chip-
group>` for tags and the freshness badge, `<lr-file-icon>` for per-document type icons, `<lr-
input type="search">` for free-text search, and `<lr-combobox multiple>` for a tag facet filter
  (AND semantics -- a document must carry every selected tag). Bulk selection renders a `<lr-
checkbox>` per row plus a header select-all checkbox (indeterminate when some but not all visible
  rows are selected) independently of `<lr-table>`'s own built-in `selectionMode`, since that mode's
  click-anywhere-on-the-row toggle would conflict with the row's own name button opening the
  document. A controlled data view like this package's other orchestration-level list surfaces: no
  upload/sync/mutation logic of its own, only `lr-filter-change` / `lr-sort` / `lr-selection-change`
  / `lr-open` request-and-notification events. `selectedIds` referencing a document no longer present
  in `documents` is silently pruned (no event fires for that pruning, mirroring `<lr-chip-group>`'s
  identical silent-resync convention) rather than left dangling.
- a012673: New `<lr-drilldown-panel>` component: controlled navigation from a chart/table datum to its related
  evidence, documents, entities, or agent runs. A navigation shell only -- an `lr-breadcrumb` trail
  over a host-owned `path`, plus, for whichever categories the current node actually has content for,
  the one existing primitive that already renders that content type (`lr-source-card` for evidence,
  `lr-document-preview` for documents, `lr-entity-card` for entities), wrapped in an `lr-tabs` strip
  only when more than one category has content. Agent-run content has no dedicated rendering primitive
  yet in this library, so it composes via a `runs` slot instead of inventing bespoke rendering.
  Activating a non-current breadcrumb step fires `lr-drilldown-navigate` (`detail: { id, index }`) --
  the component never mutates `path` itself.
- a0bb717: New `<lr-entity-dossier>` component: a full knowledge-graph entity detail surface combining
  properties, relationships, supporting chunks, confidence, and provenance into one composed
  layout. A persistent header renders `<lr-entity-card>` (the entity's summary/properties) next to
  an optional confidence `<lr-stat>`, above an `<lr-tabs>` strip for Relationships
  (`<lr-neighbor-list>`), Supporting chunks (`<lr-chunk-inspector>`), and Provenance
  (`<lr-provenance-panel>`). Pure layout -- it never fetches, ranks, or mutates graph/document state,
  and never re-renders what any of those five composed components already render themselves; every
  one of their own events bubbles through unmodified rather than being re-declared as this
  component's own. Tab labels reuse the exact `localize()` keys the composed child underneath
  already uses for its own accessible name (`neighborListLabel`, `chunkInspectorLabel`,
  `provenancePanelLabel`), so no new localization keys were needed and a translated locale only has
  to cover each string once.
- 5f2927f: New `<lr-eval-dataset>` component: dataset management for an evaluation suite -- a filterable,
  taggable list of `EvalExample` rows (`id`, `input`, `expectedOutput?`, `tags?`, `metadata?`) with
  add/remove/import/export affordances. Fully controlled, matching this library's established
  convention for the rest of the agentic-AI orchestration layer: `examples` is the host's own data,
  and the component never mutates it or performs any I/O itself -- every action fires an
  `lr-example-select` / `lr-example-add-request` / `lr-example-remove-request` /
  `lr-import-request` / `lr-export-request` event and the host decides how to act on it.

  Composes `<lr-data-grid>` for the row list, `<lr-chip>`/`<lr-chip-group>` as a toggleable,
  OR-matched tag-browse filter, `<lr-file-input>` for the import affordance, and
  `<lr-export-button>` for the export affordance (its own built-in client-side download is
  suppressed so every configured format routes through `lr-export-request` uniformly). Ships with a
  searchable free-text filter, RTL and 320px-allocation coverage, and localized strings with
  `.strings` override support.

- f5870ef: New `<lr-eval-result>`: rubric scoring, human review, and comparison across a single evaluation
  example's runs (one per model or prompt version), LangSmith/Arize-eval-result style. Composes
  three existing primitives directly rather than re-deriving their behavior: `<lr-data-grid>` renders
  the `runs` comparison table (`columns` is a plain pass-through to its own `DataGridColumn[]`
  shape); `<lr-rubric-form>` is the human-review scoring surface for whichever run is selected,
  reading/writing that run's own `review` value and re-emitting its
  `lr-input`/`lr-validity-change`/`lr-submit`/`lr-skip` events as
  `lr-review-input`/`lr-review-validity-change`/`lr-review-submit`/`lr-review-skip` with the run id
  attached; `<lr-diff-view>` compares the selected run's output against `baselineRunId`'s output --
  `layout="split"` once they resolve to two distinct runs, `layout="unified"` (an all-equal diff,
  i.e. a plain read of the one run's output) once they resolve to the same run or no baseline
  resolves at all. `selectedRunId`/`baselineRunId` are both fully controlled (never mutated
  internally) and fall back to `runs[0]?.id` purely for rendering when unset, so the component
  renders something useful with zero configuration beyond `runs`; a `selectedRunId`/`baselineRunId`
  that matches no entry in `runs` degrades gracefully (the comparison grid still renders, the
  review/diff sections simply don't).
- 3827a19: New `<lr-evaluation-run>` component: an evaluation batch's live progress. An overall
  `<lr-progress-bar>` counts terminal (done/error/cancelled) examples against the batch's `total`
  (or `examples.length` when unset), with running/failed count badges alongside it. Each example
  renders as its own `<lr-details>` disclosure showing input/output via `<lr-markdown>` or
  `<lr-code-block>` (per `inputFormat`/`outputFormat`), a composed `<lr-grounding-summary>` when the
  example carries a `GroundingAssessment` (plus optional evidence `citations`), and a composed
  `<lr-tool-timeline>` when it carries `toolTrace` entries -- this component defines no grounding-
  scoring or tool-call rendering of its own. `status` reuses the shared `AgentStatus` contract from
  `@aceshooting/lyra-ui/ai/types`, the same run-lifecycle vocabulary an agent step already uses.
  Nested `<lr-grounding-summary>`/`<lr-tool-timeline>` selection and approval events are intercepted
  and re-emitted as this component's own `lr-example-citation-select`/
  `lr-example-tool-approval-decide`, correlated with the originating example's `id` so a host never
  needs to walk the DOM to find out which example a nested interaction came from. Per-example
  disclosure toggling fires `lr-example-toggle`. A live region announces per-example status
  transitions (started/completed/failed/cancelled/needs input/needs approval), gated so a freshly-
  mounted run never announces its initial statuses.
- 0669f01: New `<lr-filter-bar>` component: a row of composable dashboard filters, each declared by the host
  (`filters: FilterBarFilterDefinition[]`) rather than invented by this component -- every filter
  renders an existing Lyra input (`<lr-select>`/`<lr-combobox>` for closed choice sets,
  `<lr-date-input>` in single or `mode="range"` for dates), plus a `<lr-chip-group>` of removable
  `<lr-chip>`s summarizing the active filters, an `<lr-button>` reset action, and (while `loading`)
  an `<lr-spinner>` status indicator. Controlled, like every other Lyra data component: `value` is a
  plain, JSON-serializable `FilterBarValue` object the host reads/writes directly -- this component
  never touches `location`/`history`/storage itself, so turning `value` into (and back out of) a URL
  querystring or app-state store is entirely the host's own concern. `required`-flagged filters get
  live `invalidFilterIds`/`checkValidity()`/`reportValidity()` and a `lr-validity-change` event, with
  each filter's own inline error rendered by its already-chromed composed control rather than a
  second, duplicate label/hint/error frame. `reset()` restores every filter to its own
  `defaultValue` (or unset) and emits both the standard `lr-input` and a dedicated `lr-reset`,
  mirroring `<lr-combobox>`'s own `clear()`/`lr-clear` pattern.
- c5a4786: New `<lr-graph-query-builder>` component: an editor for a single typed relationship/path filter
  (`GraphQuery`) over a knowledge graph -- start/end entity anchors, relationship-type and
  node-type "add" pickers (`<lr-select>`) with a removable active-filter chip display
  (`<lr-chip>`/`<lr-chip-group>`), a traversal direction, a min/max hop range, validation
  (`value`/`checkValidity()`/`reportValidity()`/`lr-validity-change`, form-associated via
  `ElementInternals` the same way `<lr-rubric-form>`/`<lr-tool-param-form>` are), and a
  host-persisted saved-query list (`savedQueries` + `lr-query-save`/`lr-query-load`/
  `lr-query-delete`). `GraphQuery` is a serializable, provider-neutral query model suitable for
  handing straight to a GraphRAG retrieval/traversal backend via `value` or the `lr-query-run`
  event's payload.
- a5723c3: New `<lr-grounding-summary>` component: the claim-level scorecard for one generated answer,
  consuming `GroundingAssessment` from `@aceshooting/lyra-ui`'s `src/ai/types.ts` directly as its
  `assessment` property. Composes `lr-stat` for the supported/unsupported claim counts, citation
  coverage, and optional confidence numeric displays (tone-mapped via a `thresholds` property), and
  `lr-citation-badge` for an optional `citations` list linking each evidence entry back to its exact
  `span`. Activating a citation badge emits `lr-citation-select` (detail: `{ citation }`, the
  `CitationSelectEventDetail` shape from `src/ai/types.ts`) carrying the full citation record, in
  addition to the badge's own `lr-citation-activate` still bubbling through unmodified. Warnings
  render verbatim as caller-supplied data; every other label is localized via `this.localize()`.
- 497c8d3: New `<lr-ingestion-queue>` component: a controlled list of documents moving through an ingestion
  pipeline (`queued` → `uploading` → `extracting` → `chunking` → `embedding` → `indexing`, plus the
  terminal `done`/`failed`/`cancelled` stages), each row composing `lr-badge` for its stage label,
  `lr-progress-bar` for in-flight progress, and chunk-count/embedding-status/attempt-count text.
  `lr-empty` renders the zero-items state. Presentation only -- this component runs no ingestion
  itself and never mutates `items`; retrying a `failed` row or cancelling any non-terminal row fires
  a controlled `lr-retry`/`lr-cancel` request event (`detail` extends the shared `RetryEventDetail`/
  `CancelEventDetail` from `src/ai/types.ts` with the `itemId` identifying which row) and waits for
  the host to supply an updated `items` array, the same request/response convention
  `<lr-thread-list>`'s row-action events already establish. At or above `virtualizeThreshold` items
  the list renders through an internal `<lr-virtual-list>` instead of a plain keyed list, matching
  `<lr-thread-list>`'s data mode and `<lr-activity-feed>`'s own `virtualizeThreshold` precedent.
- 593e879: New `<lr-knowledge-base>` component: a knowledge-base source list showing sync status, indexing
  health, and permissions per source, plus an aggregate summary row. A controlled data view -- it
  never syncs or indexes anything itself, only presents `sources: KnowledgeSource[]` and emits
  request-only `lr-kb-create`/`lr-kb-sync`/`lr-kb-pause`/`lr-kb-delete` events for the host to act on
  and reflect back into a new `sources` value, mirroring `lr-thread-list`'s `lr-thread-pin`/
  `-archive`/`-delete` convention. Composes `lr-table` for the source list (its own interactive-cell
  click guarding keeps the per-row `lr-menu` from misfiring row activation), `lr-badge` for the
  sync-status/indexing-health/permission indicators, `lr-stat` for the aggregate summary, and
  `lr-menu` for the per-row Sync now/Pause sync/Delete source actions.
- f04b670: Add `<lr-knowledge-graph-explorer>`, an orchestration-level knowledge-graph surface composing the
  existing `lr-graph` canvas with entity search, type filters (via `lr-graph-legend`), neighborhood
  expansion, pinned nodes, path finding between pins (via `lr-path-strip`), node selection, and a
  node-details popover (via `lr-popover.showAt()` and `lr-entity-card`/`lr-neighbor-list`). Composes
  existing primitives rather than re-implementing graph rendering. New events `lr-path-request` and
  `lr-pin-change`; every composed primitive's own event (`lr-node-click`, `lr-node-expand`,
  `lr-selection-change`, `lr-community-click`, `lr-relation-activate`, etc.) bubbles straight through
  unmodified.
- 593e879: New `<lr-memory-panel>` component: an agent's working memory surface -- short-term context and
  long-term memories, each item's confidence and optional grounding provenance, and add/remove/forget
  actions gated behind an explicit confirmation step. Composes `<lr-provenance-panel>` for a per-item
  provenance breakdown (behind a disclosure toggle, only rendered when an item defines one) and
  `<lr-confirm-bar>` for every add/remove/forget confirmation, reusing this repo's existing inline
  confirmation pattern rather than inventing a new one. A memory item's confidence reuses
  `<lr-citation-badge>`'s own confidence vocabulary, tiered against `thresholds` the same way
  `<lr-chunk-inspector>` tiers a chunk's relevance score. `shortTerm`/`longTerm` are controlled and
  never mutated by the component -- approving a pending action only fires the matching `lr-add` /
  `lr-remove` / `lr-forget` event; the host applies the resulting state change.
- ac4857d: Add `showAt(rect, options?)` to `<lr-popover>` and `<lr-tooltip>`, a virtual-anchor API that opens
  the overlay positioned against an arbitrary rectangle (`{ x, y, width?, height? }`, defaulting to a
  zero-size point) instead of the slotted `trigger`. This lets a canvas/SVG surface -- a `<lr-graph>`
  node, a chart datum, a text-selection range -- get flip/shift/RTL-aware positioning, Escape,
  light-dismiss, and (optional, via `options.returnFocusTo`) focus-return for free, without a
  consumer hand-rolling absolute positioning and dismissal logic around it. Both components remain
  fully backward compatible: a component that never calls `showAt()` behaves byte-identical to
  before. `place()` (`src/internal/positioner.ts`) is widened from `HTMLElement` to `Element |
VirtualAnchor` to support this, with no behavior change for existing real-element anchors.
- 823f19b: New `<lr-policy-summary>` component: a read-only list of guardrail, permission, privacy, and
  tool-policy decisions, each carrying an `allow` / `deny` / `needs-review` state and an
  always-visible, accessible explanation of why that decision was made -- never conveyed by color
  alone. Composes `<lr-badge>` for the compact per-decision state indicator and `<lr-callout
inline>` for the explanation text, whose own `role="alert"`/`role="status"` semantics already
  carry the right urgency per state, plus `<lr-details>` for a decision's optional richer `detail`
  (matched rule text, policy id, cited evidence) behind progressive disclosure. `decisions` is
  controlled and never mutated by the component -- this is a summary surface, not an approval gate
  (see `<lr-tool-approval-dialog>`/`<lr-confirm-bar>` for that).
- c6dd883: New `<lr-query-builder>` component: a composable structured-query builder for tabular/dashboard
  data queries -- a flat list of field/operator/value condition rows combined with one AND/OR
  combinator. Distinct from `<lr-graph-query-builder>`, which builds typed relationship/path
  queries over a knowledge graph -- a genuinely different data model that never shares a file or a
  value type with this one.

  Fully controlled: a host supplies `fields` (available columns, each carrying a
  `QueryBuilderFieldType` of `string` / `number` / `boolean` / `date` / `enum` that determines its
  offered operators and value control) and a plain, serializable `value: { combinator, conditions }`
  object, the same controlled-plain-object-`value` convention as `<lr-rubric-form>`. Each row
  composes `<lr-select>` for the field and operator pickers and a value control chosen from the
  selected field's type: `<lr-input type="text">`, `<lr-input type="number">`, `<lr-select>` with
  True/False options, `<lr-date-input>`, or `<lr-select>`/a multi-select `<lr-combobox>` for `enum`
  fields (`eq`/`neq` vs. `in`/`notIn`). A unary operator (`isEmpty`/`isNotEmpty`) renders no value
  control. `<lr-icon-button icon="trash">` removes a row and `<lr-button>` appends one, both
  surfaced through public `addCondition()`/`removeCondition(id)` methods and `lr-add-condition`/
  `lr-remove-condition`/`lr-input` events -- the component never mutates `fields`/`value` in place
  or touches storage/network itself.

- b443be6: New `<lr-retrieval-results>` component: the orchestration-level ranked-chunk-list surface for
  retrieval/grounding workflows, consuming `RetrievalChunk[]` from `@aceshooting/lyra-ui/ai/types`.
  Composes an internal `<lr-chunk-inspector>` per row (reusing its score bar, tier coloring, title/
  page rendering, expandable text, and `compact` mode verbatim -- no hand-rolled chunk-card markup)
  and an internal `<lr-virtual-list>` for windowing once the result count is large or `grouping` is
  active. Adds deduplication by `id` (keeping the higher-scoring duplicate), optional grouping by
  `source.id` (bucketed, best-scoring group first, same convention `<lr-thread-list>`'s date grouping
  already uses), multi-selection via a per-row `<lr-checkbox>` (`selectedIds` controlled, `lr-select`
  emits the updated ids and matching chunks), pagination/infinite loading (`has-more`/`loading`
  forwarded to the internal `<lr-virtual-list>` while virtualized, or a `[part="load-more"]` button
  otherwise -- both paths emit `lr-load-more`), and a `compact`/`expanded` `presentation` switch.
  `metadata` (arbitrary `Record<string, unknown>`, not rendered by any existing primitive) shows as a
  plain key/value list in `expanded` presentation. A row's `lr-chunk-open` is forwarded verbatim for
  routing into `<lr-document-viewer>`.
- 5f2927f: New `<lr-retrieval-search>` component: the query bar for a retrieval/RAG surface, composing
  `lr-input` (query text), `lr-segmented` (vector/keyword/hybrid mode), `lr-chip`/`lr-chip-group`
  (removable active-filter/scope chips), `lr-spinner` (loading), and `lr-empty` (empty results).
  Fully controlled and network-free -- `query`/`mode`/`filters`/`scope` are host-owned properties,
  and the component only emits `lr-search` (detail: a `RetrievalQuery` from `@aceshooting/lyra-ui`'s
  `src/ai/types.ts`) on Enter or the submit button; the host performs the actual retrieval and
  toggles `loading` around it. Because this component has no way to know when a request resolves,
  submitting again while already `loading` is treated as superseding the in-flight request:
  `lr-cancel` fires immediately before the new `lr-search`, and the submit button itself doubles as
  an explicit Cancel affordance while `loading`. Filter/scope chip removal updates this component's
  own copy first, then emits `lr-filters-change` with the complete next `{ filters, scope }` state,
  mirroring `lr-source-picker`'s existing round-trip convention.
- 3d6479f: New `<lr-retrieval-trace>` component: a retrieval pipeline's stage timeline (query rewriting,
  embedding, retrieval, reranking, filtering), rendered through `<lr-span-waterfall>`'s existing
  time-scaled bar rendering rather than a new timeline widget -- each `RetrievalStage` projects to
  one `LyraSpan`, with `kind` mapped onto whichever existing `LyraSpan['kind']` fits best (`embed`
  -> `'embedding'`, `retrieve` -> `'retriever'`, `query-rewrite` -> `'llm'`, `rerank`/`filter` ->
  `'tool'`). Below the timeline, a disclosure list exposes each stage's expandable evidence panel:
  free-form text, retrieved/reranked/filtered chunks via a compact `<lr-chunk-inspector>` (`chunks`
  accepts `RetrievalChunk` from `@aceshooting/lyra-ui/ai/types` directly), and/or arbitrary stage
  metadata as a key/value list. Controlled `stages`/`activeStageId` properties; emits `lr-stage-select`
  and `lr-stage-toggle`. Never fetches, ranks, or computes retrieval results itself.
- 5597050: `lyra-thread-list` gains a `renderActions?: (thread: ChatThread) => TemplateResult` data-mode
  property, an escape hatch for a fully custom per-row action surface (e.g. a `<lr-menu>` with
  Rename/Delete, a rename dialog, delete-confirmation state) that the existing `rowActions`'s closed
  `pin | archive | delete` set can't express. Its content is appended after any built-in `rowActions`
  buttons in the same row's `actions` slot -- additive, not a replacement, the same composition
  direction `wrapRow` already takes elsewhere on the row. Set `rowActions` to `[]` (its default) to
  use only the callback's content. `renderActions` is re-invoked per row on every render with the
  current thread (never memoized/stale) and its content sits as a DOM sibling of the row's own
  selectable region, so activating a custom action never also fires `lr-select` -- the same
  structural mechanism the built-in row-action buttons already rely on. Leaving `renderActions`
  unset leaves `rowActions`' rendered output byte-for-byte unchanged, and `wrapRow` continues to
  compose independently around the result either way.
- c67e88b: New `<lr-tool-timeline>` component: a chronological list of an agent run's tool calls, rendering
  each entry through `<lr-tool-call-chip>` (name/status/duration) and `<lr-tool-result-view>`
  (args/result) -- both already built for exactly this -- plus one shared `<lr-tool-approval-dialog>`
  for entries gated behind a human decision. Its own job is strictly ordering and layout on top of
  those existing primitives: `entries` (a new `ToolTimelineEntry[]`, extending `ToolInvocation` from
  `@aceshooting/lyra-ui/ai/types` with `startedAt`/`endedAt`, `retryCount`, `redactedFields`,
  `needsApproval`, and `approved`) sorts ascending by `startedAt`, with untimed entries trailing in
  their original relative order; duration is derived from `startedAt`/`endedAt` and handed to the
  chip's own `durationMs`; a retry badge renders only while `retryCount > 0`; and per-entry
  `redactedFields` (dotted paths, or a bare `"args"`/`"result"`/`"error"` for a whole branch) mask
  sensitive values in the read-only detail view with a "Value hidden" placeholder -- the copy of
  `args` handed to the approval dialog is always the real, unredacted value, since approving a call
  requires seeing what will actually run. Activating a pending entry's chip opens the shared dialog;
  approving or denying it emits this component's own `lr-tool-approval-decide`
  (`{ invocationId, approved, args? }`, extending the shared `ToolApprovalEventDetail`) and never
  mutates `entries` itself -- a host applies the decision and re-assigns `entries`, and the dialog
  closes on its own if the entry under review disappears or resolves out from under it in the
  meantime.

## 4.0.0

### Major Changes

- cf2cbbb: Release 4.0.0 renames the public custom-element, event, and design-token prefixes from
  `lyra-*`/`--lyra-*` to `lr-*`/`--lr-*`. The package name, JavaScript `Lyra*` class names,
  and `lyra-ui` repository/package paths remain unchanged. This is a breaking migration:
  update element tags, library-specific event names, and CSS custom-property overrides.

### Minor Changes

- cf2cbbb: New `lr-control-group` primitive: a responsive layout wrapper (`role="group"`, `flex-wrap: wrap`,
  `align-items: center`) for a row of mixed form controls and action buttons — a segmented switcher
  beside a select and an export button, for example. Distinct from `lr-button-group` (which
  stretches uniform-height buttons to a shared row height): `lr-control-group` centers children of
  differing intrinsic heights instead, since it makes no assumption about child type. Gap is
  themeable via `--lr-control-group-gap`.
- aa1fb49: `lr-segmented` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
  `lr-select`/`lr-combobox`'s compact-form-control scale (`xs`-`xl`) plus `lr-input`'s `2xs`
  tier. `size="s"` now renders at the same control height as `lr-select size="s"`/
  `lr-combobox size="s"`, so a segmented metric switcher can sit flush beside a compact select or
  combobox in the same toolbar without consumer CSS reaching into `::part(base)`. The default `m`
  tier is pixel-identical to this component's previous, only rendering.

### Patch Changes

- 5266832: Fixed `lr-select`'s `size="xs"`/`"s"`/`"l"`/`"xl"` to actually enforce their documented
  per-size minimum trigger height. A `var()` fallback bug meant `--lr-select-trigger-min-height`
  was silently dead code at every size — only padding and font-size ever varied, height did not.
  The default (`m`) tier's rendering is unchanged; a consumer-set `--lr-select-trigger-height`
  override still wins over the per-size floor, as before.

## 3.9.0

### Minor Changes

- abdd967: `lr-activity-feed` gains `renderText?: (entry: ActivityEntry) => TemplateResult`, overriding the
  default plain-text `[part="entry-text"]` rendering with arbitrary rich content — rendered markdown,
  or markdown plus a trailing tool-call chip list — identically whether or not the feed is currently
  virtualized, since both the plain and virtualized paths render every entry through the same
  internal template. Previously `ActivityEntry.text` could only ever render as plain escaped text,
  with no way to attach richer per-entry content.
- b64d4d2: `lr-graph` gains `dimmedNodeIds`/`dimmedLinkIds` (controlled, mirroring
  `selectedNodeIds`/`selectedLinkIds`): a host can now apply a themeable low-opacity treatment to
  arbitrary nodes/links -- e.g. dimming every non-neighbor of a hovered node -- via a new
  `--lr-graph-dimmed-opacity` custom property, in both the `svg` (default) and `canvas` renderers.
  Previously the only way to express this was reaching into the shadow DOM; `1` (no-op) by default,
  so existing usage is unaffected.
- 1d1935e: `lr-input` gains `'search'` as a documented `LyraInputType` member. It already worked at runtime
  via unchecked passthrough to the internal native `<input type="search">` (`type` has no runtime
  validation), but the exported type union didn't include it, so a consumer setting `type="search"`
  got no compile-time confirmation it was supported and no protection against a future stricter-typed
  release silently dropping it.
- f6b4957: New `<lr-markdown-core>` entry point: a build-lean variant of `<lr-markdown>` for a consumer
  whose `languages` map already covers every language it renders, mirroring the existing
  `<lr-code-block>`/`<lr-code-block-core>` split. Its own module never imports shiki's ~200-
  language default dynamic-import table -- `<lr-markdown>`'s existing `languagesOnly` flag can't
  give a bundler that guarantee, since it's checked at runtime, not statically provable. Every other
  capability (GFM, heading anchors, text-quote highlights, math) is unchanged from `<lr-markdown>`;
  a fenced block whose language isn't in `languages` always renders the plain-text fallback.
- 0a5227e: `lr-thread-list` gains `wrapRow?: (thread: ChatThread, row: TemplateResult) => TemplateResult`
  (data mode only): wraps each row's built-in `lr-conversation-item` with host-supplied content
  that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface — most notably a
  leading purpose icon, since `lr-conversation-item` has no default slot to receive one at all.
  Previously data mode forced an all-or-nothing choice between its built-in grouping/virtualization
  and a host's need for row content outside that surface, which only slotted mode (no grouping, no
  virtualization) could accommodate.
- d3f2e13: `lr-usage-badge` gains `formatLatency?: (ms: number) => string`, overriding the built-in duration
  algorithm (which has no minutes/hours tier — `'{ms}ms'`, or one-decimal seconds above 1000ms) in
  both the visible strip and the tooltip row. Mirrors `lr-activity-feed`'s `formatTimestamp`
  convention. Previously a consumer whose latencies commonly exceed a minute (e.g. a long-running
  agent run) had no way to render its own duration scale instead of a bare seconds count.

## 3.8.0

### Minor Changes

- c4cb188: Adds `<lr-activity-feed>`: an append-only streaming log of granular agent actions, collapsing to
  a localized "Completed N steps" summary once the run is over. Implements the shared follow
  (stick-to-bottom) contract (`follow` property, `lr-follow-change` event) and virtualizes its body
  through an internal `<lr-virtual-list>` at/above `virtualizeThreshold` entries, using that
  component's `scrollToIndex()` method to drive its stick-to-bottom follow. `<lr-virtual-list>`
  also gains `aria-label` forwarding from the host element onto its internal `role="list"`
  container, usable independently of `<lr-activity-feed>`.
- 5a0276e: Adds an internal, dependency-free ANSI/SGR parser (`src/internal/ansi.ts`, not a public export) —
  shared groundwork for `lr-terminal`'s streamed console-output rendering. No public API surface
  change on its own; ships alongside the `lr-terminal` component in the same release.
- b92b5d4: Adds `<lr-artifact-panel>`: a shell around one generated artifact — title/kind header, a
  preview↔code toggle (rendered only once the `code` slot has content), version navigation with a
  "Restore this version" affordance (`lr-version-change`/`lr-restore`, versions are host state),
  `streaming`/`aria-busy` state, and built-in copy/download actions. Renders none of the artifact
  itself — content is slotted.
- cf005b9: `lr-attachment-trigger` gains an `'audio'` capability, following the existing `camera` capability's
  request-only pattern exactly: activating it fires `lr-audio-request` (no embedded recorder), and the
  host opens its own capture UI — typically `<lr-push-to-talk>` in a `<lr-overlay>`/popover — then
  hands the resulting blob to its attachment tray. Purely additive: the default `capabilities` stays
  `['files']`, and every existing `files`/`image`/`camera` behavior is unchanged.
- b85934b: Adds `<lr-audio-visualizer>`: a presentational, canvas-drawn voice-activity visualization (bars or
  waveform), driven by a `MediaStream` (lazily wired to a WebAudio analyser), a numeric `level`, or a
  `state` (`idle`/`listening`/`thinking`/`speaking`) alone for an ambient animation. Pairs with
  `lr-push-to-talk`'s `stream`/`lr-level` output. Zero dependencies — native Web Audio only,
  reduced-motion-aware.
- 3310f16: Adds `<lr-av-player>`: an audio/video player built on a native media element with a cue transcript
  synced to playback, `time-range` anchor/highlight support, an optional dependency-free waveform
  (peaks-in, no in-component decoding), playback-rate control, and imperative transcript search.
  Self-registers into the document-viewer registry for the common audio/video MIME types. Owns
  recorded-media transcript sync — distinct from `lr-transcript-feed` (live voice-session captions)
  and from `lr-playback` (an index stepper, no media).
- 0fe240b: Adds `<lr-branch-picker>`: a controlled "‹ 2 / 5 ›" navigator across regenerated/edited variants of
  one chat message, mirroring `lr-pagination`'s "never mutates its own state" contract. Fires
  `lr-branch-change` with the requested (always in-bounds) index; the host swaps the displayed branch
  content and applies the new index back. Designed to slot into `lr-message-actions`' default slot or
  directly into `lr-chat-message`'s `actions`/`badges` slots.
- bc75a1f: Adds `<lr-browser-frame>`: a presentational "agent computer" viewport — a safe-URL-gated
  screenshot/frame stream `<img>` (or slotted live media), read-only address bar, visible (never
  color-only) connection status, kind-distinct action-ping overlays, and take-over/stop affordances
  (`lr-take-over`, `lr-stop`). No automation transport and no input relay — take-over is an event;
  the host swaps in its own interactive element.
- e29f575: `lr-button` and `lr-input` gain `size="2xs"`, a sub-`xs` tier for dense, toolbar-embedded controls
  (e.g. a search input and text buttons inside a compact dialog header). Composes with `appearance`/
  `variant` the same way the existing five sizes already do.
- e4762fd: `lr-button` gains `appearance="quiet"`: a bordered, transparent-until-hover tier for a toolbar-style
  icon+label action whose border/text read fixed `--lr-color-border`/`--lr-color-text-quiet` tokens
  regardless of `variant`, unlike `appearance="outlined"`'s variant-tinted text — for a call site that
  needs a genuinely muted resting state rather than a bold bordered button. New
  `--lr-button-quiet-border`/`--lr-button-quiet-text` custom properties back the two tokens.
- 4ac983b: `lr-chat-message` gains `actionsOutsideBubble` (reflects to `actions-outside-bubble`): renders the
  `actions` slot's content as a sibling immediately after the message bubble instead of nested inside its
  footer's own padding/background box. Previously a consumer whose action row (e.g. a hover-reveal copy
  button) had to sit visually outside the bubble's chrome could not adopt this component at all, since
  `::part(footer)` styling alone cannot detach it from the bubble's box.
- 65a1f8c: Adds `<lr-chat-viewport>`: the transcript scroll container for a chat/agent conversation surface —
  owns the stick-to-bottom `follow` state machine (`follow` property, `lr-follow-change` event,
  matching the same shared follow contract `<lr-activity-feed>` already implements) while an answer
  streams, a built-in "jump to latest" pill with a pluralized unread count, and an unread divider. Two
  content shapes are auto-detected: ordinary element children (slotted mode) or exactly one
  `lr-virtual-list` (virtual mode, built on that component's `scrollToIndex()` method). Renders no
  messages and computes no unread state itself — the host supplies `unreadStartIndex` and slots its
  own message elements or a virtual list.
- bf601c8: Adds `<lr-checkpoint>`: an inline conversation restore point — a labeled marker between messages
  whose Restore affordance confirms inline (an accessible-name-carrying button swap, focus-managed,
  Escape/focus-out-aware) before firing a `lr-restore { checkpointId, label }` event. Persists and
  restores nothing itself — host state in, events out. `confirmRestore="false"` skips the inline
  confirm step entirely; `restorable="false"` renders a plain, non-interactive marker for read-only
  views or the currently-restored point.
- 22c1006: Adds `<lr-chunk-inspector>`: a ranked retrieved-chunks "why this answer" panel — relevance score
  bars with tier-mapped tones, expandable chunk text (state keyed by chunk id, survives streaming
  reassignment), and `lr-chunk-open` for landing a chunk in `lr-document-viewer` with its anchor.
  Virtualizes automatically above `virtualizeAt` rows via the existing `lr-virtual-list`.
- c274bd6: `lr-code-block` and `lr-code-block-core` gain `highlight-lines` (declarative `"3-5,7"`-style
  line emphasis), `interactive-lines` (turns the line-number gutter into a keyboard-navigable,
  clickable roving-tabindex group emitting `lr-line-click`), and `line-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lr-text-select`) — identical on
  both components since they share the new line-addressing logic. Previously there was no way to
  emphasize or deep-link to a specific line/range of lines in a rendered code block.
- f71fcac: Adds `<lr-commit-card>`: a compact commit summary card — abbreviated/copyable hash, subject/body
  message split, author/time meta, a non-color-only aggregate `+N -M` diffstat, and a collapsible
  per-file change list (`lr-file-select` on activation) reusing `lr-file-tree`'s `GitStatus`
  vocabulary and shared `gitStatus*` labels.
- 22c1006: Adds `<lr-community-card>`: a GraphRAG community-report card — label, summary excerpt, member
  count, member chips with a "+N" overflow chip, and a drill-in action (`lr-drill`) surfaced from
  the header, an explicit drill button, and the overflow chip alike. A `compact` mode renders just
  title + member count + drill button for dense listings (e.g. inside `lr-provenance-panel`).
- 1432601: Add `lr-compare-panel`: side-by-side A/B output comparison with a winner vote (LMSYS-arena /
  LangSmith-pairwise style) — two slotted panes (`a`/`b`), an optional shared `prompt` header, a
  `role="group"` vote bar (better-A / better-B / tie / both-bad, the last two individually
  hideable), and optional proportional `syncScroll` between panes. No hotkeys (slotted content may
  contain inputs); casting a vote announces through an internal live region.
- bc75a1f: Adds `<lr-confirm-bar>`: an inline, non-modal approve/deny block for one proposed action — the
  in-flow sibling of `lr-tool-approval-dialog` for confirmations that belong in the transcript instead
  of an overlay. Same `lr-approve`/`lr-deny` event shapes and the same heading/args-label/deny/approve
  localization keys as the dialog, so the two stay in lockstep. No focus trap, scroll lock, or
  Escape/backdrop handling; on activation, focus moves synchronously to the always-present decided-state
  text before the Deny/Approve buttons unmount, and an internal live region announces the outcome.
- 23bfb7b: `lr-conversation-item` gains a `meta` slot (small, non-focusable structured fields below the
  title/excerpt — e.g. a day label, project name, cost) and an `excerpt` slot that wins over the
  existing `excerpt` property whenever it has assigned content, mirroring `lr-timeline-item`'s own
  `timestamp` slot-wins-over-property pattern. Previously a consumer needing a rich excerpt (e.g. a
  search-hit snippet with `<mark>` highlighting) or a multi-field meta line had to flatten that
  structure into the plain-text `excerpt` property or hand-roll the row entirely.
- 2ad038b: `lr-dataset-viewer` now virtualizes through `lr-virtual-list` (a new `item-role="row"` mode,
  mapping to a proper `role="table"`/`role="row"`/`role="rowgroup"` accessibility tree) instead of a
  single synchronous `<table>`, lifting its row cap from 1,000 to the shared 10,000-row default every
  other tabular viewer already uses. It also gains `cell-range` anchor-target support (`highlights`,
  `activeHighlightId`, `scrollToAnchor()`, event `lr-highlight-activate`) and an imperative
  in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lr-search-change`), sharing the same raw-grid cell addressing as `lr-csv-viewer`, with the
  header row always included since this viewer always parses with PapaParse's `header: true`. The
  `lyra:dataset` document-viewer registration now declares `capabilities: { anchors: ['cell-range'],
search: true, textSelect: false }`. `lr-virtual-list` itself gains the underlying
  `item-role`/`row-index-offset` properties this required, additive and defaulting to today's exact
  `listitem` behavior for every other consumer. Previously a 1,001+ row dataset file failed to load at
  all, and there was no way to highlight or search a cell.
- 2ad038b: `lr-diff-view` gains `layout="split"` (two side-by-side columns derived from the same line-diff
  alignment as the default unified view — unbalanced replace hunks pad the shorter side with empty
  placeholder rows) and optional syntax highlighting via `language`/`languages` (same fine-grained
  shiki-core-only shape as `lr-code-block-core`, so the peer-free default stays truly peer-free).
  Previously diff-view only rendered a single interleaved unified view with no highlighting option.
- dc168c7: `lr-docx-viewer` gains `getHeadingTree()` (a document-ordered heading outline stamped with
  GitHub-slugger-style ids, using the same slugging algorithm as `lr-markdown`), `fragment`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`), and an imperative in-document
  search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lr-search-change`). Previously there was no way to deep-link into a section, highlight a quoted
  passage, or search inside a rendered Word document.
- d3edf31: `lr-ebook-viewer` gains `getToc()` (a flat, nested table of contents from the EPUB's own
  navigation document), a `location` property (get/set the current CFI or spine href, with
  `lr-location-change` on user navigation), an imperative in-book search API (`search()`,
  `searchNext()`, `searchPrevious()`, `clearSearch()`, event `lr-search-change`), and `cfi`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lr-highlight-activate`/`lr-text-select`). Previously there was no way to read an EPUB's table
  of contents, deep-link into a specific location, or search inside a rendered book.
- 2ad038b: `lr-email-viewer` attachments become interactive: each row is now a real button emitting
  `lr-attachment-open { attachment: { filename, mimeType, content } }` with the attachment's decoded
  bytes attached (the component itself never opens/downloads anything — host-owned routing, e.g. into
  `lr-document-viewer`). A new `fold-quotes` property collapses trailing quoted-reply text/HTML
  (`>`-prefixed text runs, `gmail_quote`/`yahoo_quoted`/Outlook-style HTML blocks) behind a localized
  toggle. Previously attachments were inert metadata with no way to retrieve their content, and quoted
  reply chains always rendered in full.
- ba094cb: Adds `<lr-emoji-picker>`: a searchable, keyboard-navigable, form-associated emoji picker
  (`value`/`lr-change`, matching this library's other form-control conventions). `groups` is fully
  consumer-suppliable — this component ships no emoji data of its own — with an optional convenience
  auto-loader for a default set via the `emoji-picker-element-data` peer when `groups` is left unset.
  Lets a consumer currently wrapping the third-party `emoji-picker-element` custom element (plus its
  locale-data package) as a direct dependency replace it with a first-party `lr-*` component instead.
- 22c1006: Adds `<lr-entity-card>`: a dossier card for one knowledge-graph entity (`LyraEntity`) — type
  badge, description, key/value property rows, relationship-degree and community rows, and a
  built-in "focus in graph" action that emits `lr-entity-activate` for a host to route into
  `lr-graph`'s `focusNode()`.
- 22c1006: Adds `<lr-entity-chip>`: an inline `@entity` mention for agent prose with a hover/focus preview
  popover, reusing `lr-citation-badge`'s interaction contract wholesale (200ms hover-leave grace,
  independent hover/focus hold-open state, Escape dismissal, Space opens/Enter activates). The
  knowledge-graph sibling of `lr-citation-badge` — renders its `label` text rather than a `[n]`
  index, and reflects `type` for host-level per-type theming.
- 2ab49e6: Adds `<lr-env-list>`: a masked key/value list for environment variables and secrets
  (`<dl>`/`<dt>`/`<dd>` semantics), defaulting every entry to masked (a fixed eight-bullet run,
  length-independent so value length is never leaked) with per-row reveal (`lr-reveal-change`, state
  keyed by name and position, and reset for a row whose name shifts position) and copy (`lr-copy`,
  always copies the real value). `revealable=false` for screen-share-safe hosts. Masking is
  presentational, not a security boundary.
- 892c9d3: Adds `<lr-file-tree>`: a file-explorer preset over `lr-tree` + `lr-file-icon` with path-keyed
  nodes, per-file git-status badges and `+N -M` diffstat, lazy directory loading (`setChildren()`,
  `lr-load-children`), `revealPath()`, and `lr-file-select`/`lr-file-open` events (matching the
  "Enter/click on an already-selected file opens it" keyboard parity rule).
- 22c1006: Adds `<lr-flow-canvas>`: a dependency-free, pannable/zoomable DAG workflow canvas — HTML card
  nodes with typed connection handles, SVG Bézier edges with arrowheads and labels, a shared layered
  auto-layout for unpositioned nodes, and controlled selection/drag/connect gestures behind three
  independent opt-in flags (`nodes-draggable`, `connectable`, `droppable`). Readonly viewer by default;
  never mutates `nodes`/`edges` itself. Ships a `registerCompanion()` hook so `lr-flow-minimap`,
  `lr-flow-controls`, and `lr-flow-run-overlay` (following in subsequent releases) can attach
  without reaching into its shadow DOM.
- 22c1006: Adds `<lr-flow-controls>`: the zoom in/out, fit, and interaction-lock button cluster for
  `lr-flow-canvas`, so every flow surface ships the same affordances without hosts rebuilding them.
  Zoom buttons disable at the resolved canvas's `minZoom`/`maxZoom` bounds; the lock toggle stays in
  sync with the canvas's `locked` attribute regardless of what changed it.
- 22c1006: Adds `<lr-flow-minimap>`: a corner overview map for `lr-flow-canvas` — scaled node rectangles
  (status-tinted) plus a draggable, keyboard-operable viewport rectangle for orientation and fast
  navigation on canvases larger than the screen. Attaches via `registerCompanion()`, either slotted
  into one of the canvas's corner slots or externally via `for="canvas-id"`.
- 22c1006: Adds `<lr-flow-node>`: the workflow node card — header/body/toolbar chrome, tool-lifecycle status
  tones with a visible (never color-only) status chip, a determinate progress bar, and named
  connection-handle elements. Used automatically by `lr-flow-canvas` as the default card for any
  node without a slotted override, and usable standalone for palette previews or docs.
- 22c1006: Adds `<lr-flow-run-overlay>`: execution-state presentation for `lr-flow-canvas` — mirrors a
  `FlowRunDecorations` map into the resolved canvas (which owns the actual node/edge paint) and
  renders a compact "{done} of {total} steps complete" summary strip with per-status counts.
  Status transitions announce through a throttled live region. Pure pushed state — no execution,
  polling, or internal clock.
- 2ad038b: Adds an internal `application/geo+json` document-viewer registry bridge (`<lr-geojson-view>`,
  `.geojson` filename matching included): fetches and validates a GeoJSON `Feature`/`FeatureCollection`/
  bare-geometry payload, computes a bounding-box fit, and renders it through `lr-map`'s new
  `dataLayers` property with a feature-count status line. Falls back to `lr-json-viewer` with a
  missing-library callout when the optional `maplibre-gl` peer isn't installed. Not a documented public
  tag this round — importing `geojson-view/geojson-view.js` opts a host into the bridge, matching how
  `lr-map`/`lr-graph`/the chart family already stay out of the root barrel import.
- ca9258f: `lr-graph` gains `renderer: 'svg' | 'canvas'` (default `'svg'`, unchanged). `'canvas'` swaps the
  per-node/per-link SVG DOM for a single DPR-aware `<canvas>` (reusing `lr-heatmap`'s proven backing-
  store/resize/DPR-watch machinery), targeting roughly 5,000 nodes / 10,000 links versus SVG's ~500/
  ~1,500 ceiling. Hit-testing uses an offscreen color-picking canvas (exact hits for all three node
  shapes, stroked/dashed links, and hull blobs, one code path, zero new dependencies); pointer drag,
  click, double-click-to-expand, and hover tooltips all work via that same hit-test. Keyboard/screen-
  reader parity is preserved through an offscreen virtual-cursor button list driving the identical
  roving/announcement logic as SVG mode — the honest v1 trade-off is no `::part(node)`/`::part(link)`
  styling (pixels, not elements) and a drawn focus ring instead of a CSS one, both documented. Fully
  additive — the default `renderer: 'svg'` reproduces today's DOM exactly.
- c6ab7c8: `lr-graph` gains `GraphNode.communityId` and a `communities` property, rendering one translucent
  convex-hull blob per entry (membership = union of `memberIds` and matching `communityId`) behind
  links/nodes. Hulls are keyboard/click-activatable (`lr-community-click`), join the roving focus
  ring after nodes and links, and are included in `fit()`'s bounding-box calculation. Fully additive
  — an empty `communities` array (the default) renders no hulls and leaves the roving ring/`fit()`
  behavior unchanged.
- c996af0: `lr-graph` gains `showEdgeLabels` (default `false`) to draw each link's `label` as visible SVG
  text at the segment midpoint, and `edgeLabelMinZoom` (default `0.6`) to hide all edge labels below
  that zoom scale. A per-label length gate also hides a label whose measured text width exceeds 85%
  of its edge's current on-screen length. Labels are `aria-hidden` (the accessible name already
  carries `label` via the existing link announcement) and fully opt-in — a graph that never sets
  `showEdgeLabels` renders no edge-label DOM at all.
- 7f7511a: `lr-graph` gains a double-activate expand gesture: double-clicking a node, or activating the same
  focused node twice via Enter/Space within 500ms, emits `lr-node-expand { id }`. A new
  `GraphNode.expandable` flag renders a "+" badge and adds "expandable" to the node's spoken text. A
  node newly linked to an already-positioned neighbor (e.g. appended after an expand) now spawns near
  that neighbor instead of a random position. Fully additive — no existing click/keyboard behavior
  changes, and a graph that never sets `expandable` never renders the badge (though the
  `lr-node-expand` event itself fires for any double-activated node, matching native
  dblclick semantics).
- 5d77b48: `lr-graph` gains a programmatic camera (`focusNode(id, { zoom? })`, `fit({ padding? })`, both
  reduced-motion-aware rAF tweens that keep d3-zoom's own state consistent), a declarative
  `focusId` twin (centers once, renders a persistent `focus-halo` ring), and a controlled selection
  model (`selectionMode: 'none' | 'single' | 'multiple'`, `selectedNodeIds`/`selectedLinkIds`,
  `lr-selection-change`) mirroring `lr-heatmap.selectedCell`'s controlled contract — the
  component only ever emits intent, never assigns the selection props itself. Fully additive: default
  `selectionMode: 'none'` and unset `focusId` reproduce today's behavior exactly.
- 844fe95: `lr-graph` gains `lr-node-enter`/`lr-node-leave`/`lr-link-enter`/`lr-link-leave` hover
  events (mirroring the existing `lr-node-click`/`lr-link-click` detail shapes) plus a `data-hovered`
  attribute toggled on the hovered node/link element for pure-CSS theming. Both are suppressed while a
  drag or pan gesture is in progress, so a drag crossing over other nodes/links doesn't spam
  enter/leave pairs. Previously a consumer computing an adjacency-based neighbor highlight on hover
  (e.g. dimming every unconnected node/link) had no way to observe which node/link was currently
  hovered from outside the component.
- f8d6b9e: `lr-graph` gains `layout: 'force' | 'layered'` (default `'force'`, unchanged). `'layered'`
  computes a deterministic Sugiyama-lite layout instead of running d3-force — longest-path layering,
  barycenter crossing reduction, cycle-safe (back edges reversed internally, the caller's data is
  never mutated). The algorithm itself lives in a new shared, dependency-free
  `src/internal/layered-layout.ts`, a standalone util suitable for any future layered-diagram
  consumer. Node drag is disabled in layered mode; pan/zoom, keyboard, focus/fit, hulls, edge labels,
  and type filtering all work identically to force mode. Fully additive — the default `layout:
'force'` reproduces today's simulation-driven layout exactly.
- 22c1006: Adds `<lr-graph-legend>`: a node-type legend for a paired `lr-graph`, rendering one swatch +
  label + count row per §3.4 node type and doubling as a visibility filter. Event-decoupled from any
  graph instance — a host forwards `graph.nodeTypes` in as `types` and forwards
  `lr-visibility-change`'s `hiddenTypes` back out to `graph.hiddenTypes`.
- 942798e: `lr-graph` gains `GraphNode.type` and a new `nodeTypes` property declaring each type's legend
  label, fill color, and shape (`circle`/`square`/`diamond`). Fill resolution precedence is
  `node.color` > the type's own color > an ordered categorical fallback palette
  (`--lr-graph-cat-1`…`--lr-graph-cat-8`, new tokens) by the type's index in `nodeTypes` > the
  existing untyped default. Typed nodes also gain richer spoken text ("{label} ({type})"). Fully
  additive — a graph with no `type`/`nodeTypes` set renders identical circles, unchanged.
- 32f7b12: `lr-graph` gains `hiddenTypes: string[]`, hiding every node whose `type` is listed (plus incident
  links) from rendering, the simulation, the keyboard roving ring, and the accessible data list/
  counts. Positions round-trip via a new remembered-position cache, so toggling a type off and back
  on restores each node where it was instead of re-randomizing. Fully additive — an empty
  `hiddenTypes` (the default) renders every node/link exactly as before.
- e022166: Adds `<lr-handoff-divider>`: a labeled semantic separator marking control transfer between agents
  in a transcript (e.g. "Transferred to Research Agent"), with an optional `avatar` slot. Root is
  `role="separator"` named by the computed label; the label is announced once on first connect
  through an internal live region, since a handoff lands mid-stream and later property changes never
  re-announce.
- 4cddc07: Adds `<lr-highlight-layer>`: a presentational overlay that paints highlight rectangles
  (percent-of-box coordinates) over positioned content — a pdf page, an image, any relatively-positioned
  frame. Roving-tabindex keyboard access (ArrowUp/Down/Left/Right honoring RTL, Home/End, Enter/Space),
  `aria-current` on the active rect, a one-shot `flash()` emphasis pulse with a reduced-motion static
  fallback, and token-mapped tones. Zero dependencies. `lr-pdf-viewer` adopts it next for per-page
  highlight painting.
- 4c707de: Adds `<lr-image-viewer>`: a full pan/zoom raster-image viewer with labeled region highlights and
  opt-in region annotation (pointer-drag or keyboard), self-registering into the document-viewer
  registry for `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif`, and `image/bmp`.
  Distinct from `<lr-svg-viewer>` (vector documents) and `<lr-image-comparer>` (before/after
  comparison) — this is the landing surface for `region`-anchored citations (bounding-box grounding).
- 2ad038b: `lr-json-viewer` gains an imperative search API (`runSearch()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lr-search-change`) as a thin layer over its existing
  declarative `search` property -- the property, its highlighting, and its force-expand behavior are
  unchanged; the new methods add match-count resolution and a navigable cursor (`data-active` on the
  current match) on top. The count-resolving entry point is named `runSearch()` rather than `search()`
  (unlike this same quartet on other viewers) because `search` is already this component's own public
  string property -- a method can't share its name. Previously there was no way to count matches or
  step between them programmatically.
- ac19eb0: `lr-lite-chart` gains a `legendText?: (label: string, datasetIndex: number) => string` hook,
  appending formatter-supplied text (e.g. a value or percentage share) after each series' label in the
  built-in legend row — mirrors the existing `pointText`/`tickFormat` opt-in-hook convention. Previously
  a consumer needing per-series legend text beyond the bare label had to hand-roll an entire replacement
  legend instead of using the built-in `legend` prop.
- c721d97: `lr-map` gains a `dataLayers: GeoJsonDataLayer[]` property: each entry adds a GeoJSON source plus
  fill/line/circle layers (colored from `--lr-*` tokens by an optional `tone`), independent of the
  existing `choropleth` prop (which requires `field`/`stops` and can't display plain geometry). Defaults
  to an empty array — zero behavior change for existing `lr-map` users. This is the enabler for the
  upcoming GeoJSON-file document-viewer bridge, and is useful standalone for rendering arbitrary
  GeoJSON shapes (routes, zones, points of interest) without hand-building maplibre-gl layers.
- 92955fc: `lr-markdown` gains `heading-anchors` (stamps computed GitHub-slugger-style ids on headings),
  `getHeadingTree()` (a document-ordered heading outline, computed regardless of `heading-anchors`),
  `fragment`/`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `anchor`,
  `scrollToAnchor()`, events `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`), and
  `math` (renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer, falling back to
  literal source text when the peer isn't installed). Previously there was no way to deep-link into a
  section, highlight a quoted passage, or render math in rendered Markdown content.
- 3492739: `lr-markdown` gains real shiki syntax highlighting for fenced code blocks, reusing
  `<lr-code-block>`'s own optional `shiki` peer and grammar-loading machinery directly (not by
  embedding `<lr-code-block>` itself, which would have hit DOMPurify's default custom-element
  blocklist and re-mounted — losing state and re-triggering async loads — on every streaming chunk).
  On by default whenever the `shiki` peer is installed (set `highlightCode="false"` to opt out); new
  `languages`/`languagesOnly` properties mirror `<lr-code-block>`'s own fine-grained bundle-size
  controls. Highlighting is skipped entirely while `streaming` is `true` and applied once a stream
  settles, so there is no added per-chunk cost while content is still arriving.
- e5df5af: Adds `<lr-message-actions>`: the per-message action toolbar for `lr-chat-message`'s `actions` slot
  — opt-in built-ins (`copy` / `regenerate` / `edit` / `feedback`, in `controls`-array order) that emit
  intent events (`lr-regenerate`, `lr-edit`, plus bubbled `lr-copy`/`lr-change`/`lr-submit`
  from the embedded copy button and thumbs-only feedback), and a default slot for custom controls (e.g.
  a slotted `lr-branch-picker`) that participate in the toolbar's ArrowLeft/ArrowRight/Home/End
  navigation. Optional `reveal-on-hover` hides the bar until the enclosing `lr-chat-message` is
  hovered or a control inside has focus.
- 9544450: Add `lr-message-feedback`: thumbs up/down for one assistant message, with an optional inline
  detail step (multi-select reason chips + a free-text comment) that opens as a disclosure directly
  below the thumbs rather than a floating overlay. Fires `lr-change` on every rating toggle and
  `lr-submit` (`{ value, reasonIds, comment }`) from the panel's submit button; stores nothing
  itself — a host persists the rating and may reflect a previously-recorded one back via `value` +
  `disabled`. Re-activating the pressed thumb clears the rating unless its own detail panel is open,
  in which case that click re-opens the panel with any surviving draft instead.
- 22c1006: Adds `<lr-mind-map>`: a radial expandable topic tree (NotebookLM-style Mind Maps) — zero-dependency
  SVG, closed-form arc-subdivision layout in its own `mind-map-layout.ts` module, single-tab-stop
  keyboard roving (mirroring `lr-word-cloud`), and `lr-topic-select`/`lr-topic-toggle` events.
  Multiple root topics hang off an implicit center hub; expansion state is keyed by topic id and
  survives streaming `topics` reassignment.
- 2ad038b: Recorded decision: `.msg` (Outlook) files are not supported this round. `.msg` is OLE/CFB binary per
  MS-OXMSG; the available npm parser (`@kenjiuno/msgreader` plus its `decompressrtf` companion) is
  below this library's maintenance bar for an optional peer. `.msg` files continue to resolve to
  `<lr-document-preview>`'s generic download fallback, exactly like any other unregistered format —
  convert to `.eml` server-side to use `<lr-email-viewer>` instead. No API change; this changeset
  exists to document the decision, guarded by a permanent regression test.
- 22c1006: Adds `<lr-neighbor-list>`: one entity's relationship rows (relation, direction, neighbor) with
  per-row navigate (`lr-entity-activate`) and expand-in-graph (`lr-node-expand`, matching
  `lr-graph`'s own event name/detail) affordances, optional relation grouping, and automatic
  `lr-virtual-list` virtualization above `virtualizeAt` rows.
- 22c1006: Adds `<lr-node-palette>`: a searchable, categorized node library for workflow editors — drag an
  item onto a `droppable` `lr-flow-canvas`, or place it by keyboard (`lr-palette-place`/
  `lr-select`). Fully decoupled from the canvas itself, agreeing only on the exported
  `FLOW_PALETTE_MIME_TYPE` drag-payload constant.
- a0e579a: Adds `<lr-notebook-viewer>`: a read-only Jupyter notebook (nbformat 4.x) renderer that parses
  `.ipynb` JSON natively and composes `lr-markdown`/`lr-code-block`/`lr-json-viewer` per cell,
  with `node-path`/`fragment` cell anchors and imperative search over cell sources and text outputs.
  Self-registers into the document-viewer registry for `application/x-ipynb+json`. Execution, kernels,
  and ipywidgets are out of scope; stream/error outputs render as plain preformatted text this round.
- 15062d0: Adds `<lr-page-rail>`: a virtualized vertical thumbnail rail for page-addressed documents, with
  per-page highlight heat markers. Wired mode (`viewer`/`for`) tracks page/count from a
  `PageThumbnailSource`-shaped viewer's own `lr-load`/`lr-page-change` events and lazily renders
  thumbnails as rows materialize (`lr-pdf-viewer` satisfies this structurally); mediated mode
  (`page-count`/`page`) works as a fully functional pager without a wired viewer. Roving-tabindex
  keyboard access via `lr-virtual-list`, typed-digit page jump, `lr-page-select` event.
- 22c1006: Adds `<lr-path-strip>`: a compact, horizontally scrollable node -> relation -> node chain
  rendering a GraphRAG reasoning path, with one roving tab stop across every element (nodes and
  relations alike), logical (RTL-mirroring) directed-edge arrows, and `lr-entity-activate`/
  `lr-relation-activate` events.
- 75c17bd: `lr-pdf-viewer` becomes the reference `DocumentAnchorTarget` implementation: resolves `page`,
  `text-quote`, and `region` anchors (`scrollToAnchor()`), paints highlights per page via
  `lr-highlight-layer`, exposes `getPageText(page)` and `renderPageThumbnail(page, canvas, options?)`
  for rail/search/chunking consumers, and emits `lr-load { pageCount }`,
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`. The `application/pdf` document-
  viewer registration now declares its anchor/text-select capabilities and forwards `anchor`/
  `highlights`. All additive — existing `src`/`page`/`zoom`/`nextPage()`/`previousPage()`/`zoomIn()`/
  `zoomOut()` and their events are unchanged.
- 1879c40: `lr-pdf-viewer` gains an imperative in-document search API (`search()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lr-search-change`), a public `goToPage(page):
Promise<boolean>` method, and `getOutline(): Promise<PdfOutlineItem[]>` for reading a PDF's table of
  contents. Search matches paint as `<mark part="search-match">` (`search-match-active` for the
  current one) without touching any highlight state. The `application/pdf` document-viewer
  registration now declares `search: true` in its capabilities. Previously there was no way to search
  inside a rendered PDF, jump to a page programmatically, or read its outline.
- 22c1006: Adds `<lr-provenance-panel>`: the grounding breakdown for one answer — a four-section disclosure
  panel (Entities / Relationships / Communities / Text chunks) composing `lr-entity-chip`,
  `lr-path-strip`, compact `lr-community-card`s, and a compact `lr-chunk-inspector`. Every child
  event bubbles straight through unmodified; its own `lr-toggle` event tracks per-section
  expand/collapse state, which survives streaming `provenance` reassignment.
- 2d15c51: Adds `<lr-push-to-talk>`: a mic capture button owning the full `getUserMedia`/`MediaRecorder`
  lifecycle — permission request, hold or toggle recording, optional chunked streaming
  (`lr-record-chunk`) for streaming STT, an opt-in RMS level meter (`lr-level`), a `max-duration-ms`
  auto-stop guard, and `lr-record-start`/`lr-record-stop`/`lr-record-cancel`/`lr-record-error`
  events. No SDK dependency — native browser APIs only. Previously lyra-ui had no voice-capture
  component at all; every agentic voice UI had to hand-roll this lifecycle from scratch.
- 3a2f6d2: Add `lr-rubric-form`: a configurable annotation rubric (LangSmith annotation-queue style) —
  score, category, and freeform-comment keys with a submit-and-next flow for working through an eval
  queue. Follows `lr-tool-param-form`'s exact `ElementInternals`-attached-directly, JSON-serialized
  form-value pattern; a `score` key renders `lr-segmented` (≤10 integer steps) or `lr-slider`,
  `category` renders `lr-select` or `lr-checkbox-group` (`multiple`), and `comment` renders
  `lr-textarea`.
- c388b94: Add themeable static edge fades and native horizontal scrolling to overflowing `lr-segmented` and
  `lr-tabs` rows.
- de5b8b7: Adds `<lr-sequence-strip>`: a compact, one-thin-cell-per-item strip visualizing a sequence of
  categorical states with an optional secondary per-cell marker (e.g. a CI build-step strip, a
  log-severity strip, or — the motivating case — a per-turn conversation-history strip). Pure CSS/flex,
  zero dependencies, `role="img"` with an auto-generated per-category "label: count" `aria-label`
  summary (matching `lr-sparkline`'s accessibility model), plus a pointer-hover tooltip showing each
  item's own label.
- 22c1006: Adds `<lr-source-picker>`: a checkbox tree/list scoping which sources ground the next answer —
  tri-state folders, select-all, `lr-file-icon` type icons, and built-in search that keeps matching
  descendants' ancestors visible. Deliberately not `FormAssociated` (a scoping panel, not a form
  control, mirroring `lr-tool-select-dialog`'s stance) and renders its own `role="tree"` rather than
  composing `lr-tree`, since `TreeItem` has no tri-state checkbox model.
- 685eb35: Add `lr-span-waterfall`: the horizontal-timeline projection of the same `LyraSpan[]`
  `lr-trace-tree` consumes — a time axis, one row per span in start order, and status-toned,
  keyboard-navigable bars (Langfuse timeline / Temporal event-history style). Declarative
  `viewStartMs`/`viewEndMs` window props (composable with `lr-time-range` as a brush) stand in for
  zoom/pan gestures this round. Both components emit the same `lr-span-select { id }` and accept
  the same `activeSpanId`, so a host syncs selection between them with two listeners and one property
  binding.
- 2ad038b: `lr-spreadsheet-viewer` and `lr-csv-viewer` gain `cell-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lr-highlight-activate`) and an
  imperative in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`,
  event `lr-search-change`) — identical on both viewers, addressing cells by the same 1-based raw
  grid (header row included) an A1 reference already implies. Spreadsheet's search/anchor resolution
  additionally spans every sheet, switching `lr-tabs` as needed. Both registry entries now declare
  `capabilities: { anchors: ['cell-range'], search: true, textSelect: false }`. Previously there was
  no way to highlight or search a specific cell/range in a rendered spreadsheet or CSV file.
- 761ab24: Adds `<lr-stack-trace>`: parses V8/JS-TS, Firefox/Safari, and Python stack traces (including
  chained-error groups) into a message plus collapsible, activatable frames (`lr-frame-select`),
  folding internal frames (`node_modules/`, `node:internal`, `site-packages/`, ...) behind a
  count-labeled toggle. Falls back to verbatim raw text when nothing parses.
- b33bb35: Adds `<lr-suggestion-chips>`: starter prompts (empty thread) and follow-up suggestions (after a
  response) as a horizontally scrollable chip row (or a wrapping grid via `wrap`), each with an optional
  secondary detail line. Fires `lr-suggestion-select` (`{ id, label }`) on activation — never writes
  into a composer or sends anything itself. Keyed `repeat()` on `id` preserves focus across a mid-stream
  suggestions replacement.
- 2ad038b: `lr-svg-viewer` and `lr-document-preview` (its image-format path) gain an opt-in `zoomable`
  property that wraps the rendered content in an internal `lr-zoomable-frame` for pan/zoom
  inspection, plus display-only `region` anchor-target support (`highlights`, `activeHighlightId`,
  `scrollToAnchor()`, event `lr-highlight-activate`) for percent-unit bounding-box highlights that
  scale with the zoom level. `zoomable` defaults to `false` on both, so an inline thumbnail (e.g. in a
  chat stream) doesn't unexpectedly grow a focusable zoom-chrome viewport. Previously neither viewer
  had any pan/zoom or region-highlighting capability.
- 1e051a4: `lr-swatch-picker` options gain an optional `icon` field (`SwatchOption.icon`, mirroring
  `lr-segmented`'s `SegmentedItem.icon`): a consumer-supplied shape (e.g. a brand glyph) rendered in
  place of the plain filled circle, exposed as `::part(swatch-icon)`. A `currentColor`-based SVG picks up
  the option's `color` automatically through the swatch's `color` custom property, so consumers who
  previously hand-rolled a row of colored icon buttons (rather than plain color circles) can now use the
  picker directly.

  The selected swatch also gains two new opt-in, off-by-default custom properties for a more emphatic
  selected state: `--lr-swatch-picker-selected-blur` (0 by default, a crisp ring; set a real length for
  a soft glow tinted by the swatch's own color -- works for both a plain color circle and an icon swatch,
  via a `box-shadow`/`drop-shadow` split so the glow follows the icon's actual silhouette rather than an
  invisible transparent box) and `--lr-swatch-picker-shine-duration` (0s by default, static; set a real
  duration for a rhythmic brighten-and-settle pulse, disabled under `prefers-reduced-motion: reduce`).
  Together they cover a "shining" gemstone-style accent-theme picker without changing the default look
  for any existing consumer.

- 55140c3: `lr-table` gains heat-tint mode: a per-column `heatValue(row)` accessor drives a `color-mix()`-based
  cell background computed from a shared min/max scale across the whole grid (auto-derived from the
  data, or overridden via the new `heatTintScale` property), matching `lr-heatmap`'s own
  `--lr-heatmap-scale-lo`/`-hi` ramp-token convention via new `--lr-table-heat-tint-lo`/`-hi` custom
  properties. Previously a consumer needing a value-driven cell background had to hand-compute a color
  string themselves via the existing `cellStyle` escape hatch.
- 6f7c938: `lr-table` gains `rowTotal`/`grandTotal`: a trailing column showing each row's total (`rowTotal`)
  and, when at least one column also defines `footer`, a grand-total cell at its bottom-right
  intersection (`grandTotal`). Both share the existing `footer(rows)` hook's "consumer computes/renders,
  table only positions" contract rather than assuming addition. Previously a consumer needing row/grand
  totals alongside `lr-table`'s existing per-column `footer` had to render them outside the table
  entirely, breaking column alignment.
- 4cae327: Adds `<lr-task-list>`: a live, collapsible tracker for an agent's plan, embedded in the
  transcript. Renders ordered steps with per-step lifecycle status (`pending`/`running`/`success`/
  `error`) and one level of nested sub-steps; status changes are announced through an internal
  throttled live region. A dynamic `detail-<id>` slot per item accepts rich content such as a
  `<lr-tool-call-chip>`. Unlike `<lr-stepper>` (a single-selection navigation control),
  `<lr-task-list>` is a read-only status report — several steps may be `running` at once, and
  there is no selection.
- bf223ca: Adds `<lr-terminal>`: a read-only, virtualized ANSI console for streamed agent/tool output — SGR
  color rendering (16 named colors, 256-color, truecolor), stick-to-bottom `follow` with a
  `lr-follow-change` event, `write()`/`content` streaming, `\r`/`\b`/`\t` cursor handling so progress
  bars render correctly, in-buffer `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`,
  `line-range` highlight/anchor support (`scrollToAnchor()`, `lr-highlight-activate`), and built-in
  copy/download affordances. Not a PTY — no stdin/keystroke handling or cursor-addressed full-screen
  apps.
- 52a90e5: Adds `<lr-test-results>`: a pass/fail suite summary with visible (never color-only) per-status
  counts, `aria-pressed` status filter toggles, and failure rows that auto-expand by default and can
  host a slotted `detail-{testId}` diff/code block. Row state (expansion, filter) survives a streaming
  `suites` reassignment mid-run, and a run's completion is announced through an internal live region.
- 967e785: Adds `<lr-thread-list>`: the conversation sidebar — a grouped ("Pinned / Today / Yesterday / Previous
  7 days / …"), searchable list of chat sessions built on `lr-conversation-item` and virtualized via
  `lr-virtual-list`. Data mode (`threads` array) renders rows with optional pin/archive/delete row
  actions, all controlled events (`lr-thread-pin`/`-archive`/`-delete`/`-rename`) carrying the
  _requested_ new state — no CRUD or persistence of its own. Slotted mode (host-supplied
  `lr-conversation-item`s) skips grouping/virtualization/row-actions entirely, for a host that wants
  full control over a short, unconstrained list.
- 9448c10: Add `lr-trace-tree`: a collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith
  run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale,
  and optional tokens/cost columns. Consumes a flat `LyraSpan[]` array (hierarchy derived from
  `parentId`); expand state survives a streaming reassignment of `spans`. The shared `LyraSpan` type
  (`components/trace-tree/span.ts`) is also consumed by the upcoming `lr-span-waterfall`, so the
  two components can render the same trace as two synchronized projections.
- bef6b0d: Adds `<lr-transcript-feed>`: a data-driven live-captions surface for an in-progress voice session —
  `entries` in (`{ id, speaker?, text, interim?, timestamp? }[]`), reconciled keyed by `id` so a same-id
  interim-to-final upgrade moves the row into the announcing `role="log"` region without a duplicate
  announcement. Ships the shared stick-to-bottom "follow" contract (`follow`/`lr-follow-change`, the
  same vocabulary `lr-terminal` uses). No dependency, no STT/diarization built in — bring your own
  transcription source and stream entries in.
- ec5fe96: Adds the `DocumentAnchorTarget` mixin (`internal/anchor-target.ts`) and its `LyraAnchorTarget`
  interface: the shared implementation of the anchor-target contract every anchor-capable lyra-ui
  viewer adopts — `highlights`/`activeHighlightId`/`anchor` properties, `scrollToAnchor()` with a
  generation-guarded retry-until-loaded loop and screen-reader announcements, and
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result` event plumbing including
  selection->anchor emission. Internal module; no adopter yet in this release (`lr-pdf-viewer` adopts
  it next). No behavior change for any existing component.
- 44b6de7: Adds the shared `LyraAnchor`/`LyraHighlight` grounding-bridge type module
  (`@aceshooting/lyra-ui/components/document-viewer/anchors.js`): a W3C Web-Annotation-inspired
  discriminated union (`page`, `text-quote`, `fragment`, `line-range`, `cell-range`, `cfi`,
  `time-range`, `region`, `node-path`) that every anchor-capable viewer and every knowledge-grounded
  citation surface will address a passage through. Pure types plus one constant; nothing to register,
  no runtime behavior change for existing components.
- c644abd: Widens `DocumentFile` with optional `anchor`/`highlights`/`alt` fields and
  `DocumentRendererDefinition` with an optional `capabilities` declaration; `lr-document-viewer` gains
  matching `anchor`/`highlights`/`alt` properties, forwards them to the resolved renderer, and emits
  `lr-anchor-result { found }` once per applied anchor. Every addition is optional and every existing
  registration/usage is unaffected — this removes the previous limitation where even a renderer's own
  props (like pdf's `page`) couldn't be reached through the router.
- 5f92994: Adds `internal/text-highlights.ts`: a highlight paint manager for HTML-flow document viewers, using
  the CSS Custom Highlight API when available and falling back to `<mark>`-wrapping otherwise, with a
  uniform `acquireHighlightHandle()` API that never requires callers to branch on browser support
  themselves. Internal module with no public tag and no adopter yet in this release; ships ahead of the
  markdown/html-viewer/docx-viewer highlight support that will consume it. No behavior change for any
  existing component.
- b067b83: Adds `internal/text-quote.ts`: dependency-free `text-quote` anchor resolution (quote/prefix/suffix ->
  DOM `Range`, and the reverse — a selection `Range` -> a `text-quote` anchor with captured context).
  Internal module with no public tag; used by the `DocumentAnchorTarget` mixin's default selection
  handling and by `lr-pdf-viewer`'s anchor/highlight resolution. No behavior change for any existing
  component.
- bc75a1f: Adds `<lr-usage-badge>`: a compact, static resource strip for one message or run — tokens in/out,
  cost, latency — with a hover/focus tooltip breakdown (full grouped figures, plus a computed Total
  tokens row when both counts are set). Purely formatting: it computes no counts, rates, or prices,
  and every segment is independently optional. Reuses `<lr-tool-call-chip>`'s hover/focus/Escape
  tooltip contract. Distinct from `<lr-context-meter>` (occupancy of a fixed capacity) and
  `<lr-generation-status>` (a live ticking readout with a Stop button) — this is the static spend
  record shown after a message or run completes.
- f3c744b: `lr-virtual-list` gains a public `scrollToIndex(index, { align, behavior })` method: scrolls a
  specific row into view (`align: 'start' | 'end' | 'auto'`, reduced-motion-aware `behavior`) without
  the `aria-current`/"active row" side effect of the existing `active-id` property. In
  `row-height="auto"` mode, a far-off target's estimate-based offset is corrected with a single re-scroll
  once the row's real height is measured. Previously there was no way to programmatically scroll to a
  specific row at all except by driving `active-id`, which also marks that row as the current selection —
  a streaming transcript's own stick-to-bottom auto-scroll has nothing to do with "selection."
- e24ae10: Adds `<lr-voice-picker>`: a TTS voice selector mirroring `lr-model-select`'s closed-dropdown/
  free-text-combobox dual mode and form-association, with a `catalog` entry shape carrying
  `language`/`description`/`previewUrl`, and an event-first preview affordance (`lr-preview-request`,
  cancelable) that plays through one internal `<audio>` when a `previewUrl` is present and the host
  doesn't take over. No TTS SDK, no catalog fetching, no selection persistence — those stay host
  concerns.
- 37a89cb: Adds `lr-widget-renderer`'s internal type registry (`registerWidgetType()`,
  `getDefaultWidgetTypeRegistry()`) and its security-critical, DOM-free allowlist resolver
  (`resolveTree()`): unknown widget types and disallowed/mistyped props are skipped, never rendered;
  `forcedProps` always win; a child's `slot` outside its parent's allowlist renders unslotted; depth
  (32) and node-count (5000) caps are enforced. No public API surface change on its own — groundwork
  for the `<lr-widget-renderer>` element, landing in the same release.
- bcd3c2b: Adds `<lr-widget-renderer>`: renders an agent-streamed declarative JSON widget tree through an
  allowlisted `type → lyra tag` registry (`card`/`badge`/`button`/`stat`/`result-card`/`result-field`/
  `markdown`/`image` built in, plus `row`/`col`/`text` structural built-ins) — unknown types and
  disallowed/mistyped props are silently skipped, never rendered, with a deduped dev-mode warning; a
  single bubbling `lr-widget-action` event surfaces actions; streamed updates reconcile keyed by
  `id` (or structural path), so a mapped widget's own internal state survives a re-resolve.
  `registerWidgetType()` extends the default registry app-side; a per-instance `registry` property
  fully overrides it. No `innerHTML`/`unsafeHTML` path exists anywhere in the implementation.
- dc168c7: Adds `<lr-xml-viewer>`: a `DOMParser`-based collapsible XML tree view mirroring
  `lr-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path expand state that
  survives a same-shape `xml` reassignment), with an imperative `search()`/`searchNext()`/
  `searchPrevious()`/`clearSearch()` API and `node-path` anchors (element indices plus an optional
  trailing `'@attrName'` segment for attribute-level targeting). Self-registers into the
  document-viewer registry for `application/xml`/`text/xml` and `.xml`/`.xsd`/`.xsl`/`.xslt`/`.rss`/
  `.atom` files. No XPath/XSLT evaluation, no editing, no schema validation.

### Patch Changes

- 7bbd069: Internal only: adds three new `src/internal/` modules (`slugger.ts`, `cell-range.ts`,
  `viewer-search.ts`) and five new localization keys (`viewerSearchMatchCount(Plural)`,
  `viewerSearchNoMatches`, `viewerSearchActiveMatch`, `viewerHighlightLabel`) used by upcoming
  per-viewer search/anchor/highlight support. No consumer-visible behavior change on its own.
- da8bbf0: Requires `@aceshooting/lyra-flags` `^1.4.0` (up from `^1.3.0`) as the optional flag-asset peer.
  1.4.0 is a docs/metadata-only release of the flags package (no runtime change), so this is a
  range refresh, not a behavioral requirement bump.
- 967e785: Fixes `<lr-virtual-list>`: a `groups`-supplied group marker no longer carries `role="heading"`
  `aria-level="2"`. Those markers render inside the scroll container's `role="list"`, and ARIA's `list`
  role only permits `listitem` as a direct owned child — a `heading` sibling was a critical
  `aria-required-children` violation for any consumer combining `groups` with an accessibility check
  (surfaced by `<lr-thread-list>`'s date-grouped rows). The marker is still rendered as visible,
  non-interactive text; it's just no longer exposed as a heading landmark.

## 3.7.0

### Minor Changes

- 05c9f9c: Add `appearance="link"` to `<lr-button>`: a true inline-link tier that renders as zero-chrome underlined text — no padding, border, border-radius, or `min-block-size` floor — colored from the same `--lr-button-accent` token `appearance="plain"` uses (so `variant` still selects the link color) and inheriting the surrounding font-size/weight so it flows within a sentence rather than as a button-shaped control. Previously the smallest `<lr-button>` was still a padded, rounded, 24px-tall pill with a (transparent-but-present) border and no `text-decoration`, so an inline text link had to be hand-rolled; `appearance="link"` now covers that case directly. The notable design choice: the link rules are declared after the per-`size` rules so `font: inherit` and the zero padding/border/min-height win over whatever `size` is set, and the shared `[part='base']:focus-visible` outline is deliberately left intact.
- 2ed831d: `<lr-file-icon>` gains a `size` property (bytes, formatted via the same convention as `<lr-attachment-chip>`) shown alongside its label, and exposes the raw MIME type as a `title` tooltip.
- a5482d8: Add `<lr-swatch-picker>`, a single-select picker over a small, fixed set of color swatches — the row-of-round-accent-color-buttons pattern apps hand-roll, generalized into a first-party component. It carries the WAI-ARIA APG `radiogroup` contract (`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation on click or arrow-key move, cyclic Arrow/Home/End navigation), takes an `options: { value; color; label }[]` array plus a controlled `value`, and emits `lr-change` (`detail: { value }`) only when the selection actually changes. It is distinct from `<lr-color-picker>`'s freeform native color input: this picks exactly one of N designer-chosen named colors.

  Notable design choice: the selection ring uses a dedicated `--lr-swatch-picker-selected-color` token (defaulting to `--lr-color-brand`) so it retheme independently of the focus ring, mirroring `<lr-heatmap>`'s `--lr-heatmap-selected-color`; each swatch's fill comes from its option's `color`, applied through a per-swatch custom property so a consumer's `::part(swatch)` background rule can still override it.

### Patch Changes

- f3a606f: Fix `<lr-file-icon>`'s format badge overflowing its fixed size for multi-word localized labels (e.g. "Word document") — long badge text now truncates with an ellipsis instead of spilling outside the badge.
- 64e6cb6: Document `<lr-file-icon>`'s new `size` property and `size` csspart in `llms-full.txt`, and add the explicit-MIME-vs-filename-extension precedence test called for by the original feature request's acceptance criteria.
- 0975bcd: Fix `<lr-map>` throwing an unhandled error when the underlying maplibre-gl `Map` emits an `'error'` event (e.g. a tile/style source request failing) with no listener attached — maplibre-gl's `Evented` base rethrows in that case. The error is now caught and logged via `console.error` instead of surfacing as an uncaught exception.

## 3.6.0

### Minor Changes

- 30db265: Nine new components:

  - `lr-animated-image` — a still/animated-GIF-style image that pauses on `prefers-reduced-motion`
    and exposes a play/pause toggle.
  - `lr-animation` — declarative Web Animations API wrapper for a slotted target, with named
    timing presets, `prefers-reduced-motion` handling, and `lr-start`/`lr-finish`/`lr-cancel`
    events.
  - `lr-avatar-group` — a stacked, overlapping set of avatars with a "+N" overflow indicator.
  - `lr-include` — fetches and renders external HTML/Markdown/plain-text content client-side, with
    URL validation and DOMPurify sanitization.
  - `lr-known-date` — a form-associated day/month/year input for approximate or partial dates
    (e.g. a birth date where only the year is known).
  - `lr-lightbox` — a full-screen, modal, click-to-enlarge image viewer with prev/next navigation
    across an ordered set of images, built on the same shared overlay infrastructure as
    `lr-dialog`/`lr-command-palette`.
  - `lr-qr-code` — renders a QR code from text/URL data, via the optional `qrcode` peer dependency
    (same optional-peer pattern as the chart/map bundles).
  - `lr-random-content` — displays a randomly (or sequentially) chosen subset of its slotted
    children, with optional autoplay.
  - `lr-timeline`/`lr-timeline-item` — a vertical event timeline with per-item status/icon
    markers.
  - `lr-tour` — a guided, multi-step product-tour overlay that highlights target elements in
    sequence.

### Patch Changes

- e1aca7e: Shared-infrastructure hardening pass following a full-library audit:

  - `lr-contact-viewer` and `lr-email-viewer` now expose a proper localized `aria-label` on their
    root surface (previously had no naming mechanism at all); `lr-calendar-viewer` gets the same
    fallback chain's final localized tier.
  - `lr-stat`'s trend announcement now interpolates the percentage into one localized template
    instead of concatenating separately-localized fragments (word order safe for non-English locales).
  - Fixed a real bug in `lr-model-settings-panel`'s `decimalPlaces` helper that returned `0` instead
    of the correct precision for exponential-notation step values (e.g. `1e-7`); it now shares the
    same exponential-aware implementation as `lr-slider`/`lr-time-range` via a new
    `src/internal/numbers.ts` export instead of a diverging local copy.
  - Deduplicated five other byte-identical/near-identical helpers that had drifted into 2-5 separate
    component files each (`prefersReducedMotion`, canvas-context memoization, swatch-color
    sanitization, slotted-content detection, and a title-attribute-stripping mixin) into single
    `src/internal/` implementations.
  - Removed an unused, never-adopted RTL helper (`rtlAwareSide`/`PhysicalSide`) from
    `src/internal/rtl.ts`.
  - Added missing accessibility test coverage for `lr-icon-button` and the standalone `lr-option`
    element (previously the only two custom elements in the library with no axe check).

## 3.5.0

### Minor Changes

- 681ed1f: Broad component hardening pass across ~50 components:

  - `lr-command-palette` now uses the shared overlay infrastructure (`lr-dialog`'s
    focus-trap/Escape/backdrop/scroll-lock manager) instead of a bespoke implementation, adds
    `aria-activedescendant` tracking, and keeps the highlighted row scrolled into view.
  - `lr-table` forwards `spellcheck`/`autocapitalize`/`autocorrect` to its filter input and inline
    text-cell editor, matching the string-aware `spellcheck` converter already used by
    `lr-textarea`/`lr-model-select`.
  - `lr-token-input` and `lr-code-editor` fix `label`/`hint`/`error` slot-vs-attribute detection
    (a `[part]:empty` selector never matches since the part always contains a `<slot>`), and
    `lr-token-input` adopts the `effectiveDisabled`/`_fieldsetDisabled` pattern so a `<fieldset
disabled>` ancestor no longer permanently overwrites its own `disabled` property.
  - `lr-calendar`: month grid gets proper `role="grid"`/`role="row"`/`role="gridcell"` semantics,
    per-day `aria-label`, a sanitized event-color style (rejects `url(...)` and anything else that
    isn't real CSS color syntax), and RTL-aware nav chevrons; `firstDayOfWeek` tolerates out-of-range
    input instead of producing `Invalid Date`.
  - `lr-icon` clones custom slotted SVG content into the component's own `<svg>` so slotted
    path/circle/group children paint reliably in Chromium.
  - `lr-document-preview` simplifies its abortable-fetch generation tracking onto the shared
    `beginAbortableLoad` helper.
  - `lr-app-rail-item`'s tooltip text now ignores text incidentally living in the decorative `icon`
    slot, mirroring `lr-chip`'s `labelText` getter.
  - Smaller accessibility/consistency fixes across app-rail, attachment-chip, breadcrumb, callout,
    chart/histogram, checkbox-group, data-grid, empty, format-\*, heatmap, html-viewer,
    image-comparer, intersection/mutation/resize-observer, map, model-select, pdf-viewer,
    phone-input, progress, radio/radio-group, responsive-panel, scroller, segmented, sparkline,
    split, stat, stepper, streaming-text, switch, tool-param-form, tool-select-dialog, widget, and
    zoomable-frame, plus a new standalone `breadcrumb-item.styles.ts` module and expanded test
    coverage throughout.

## 3.4.0

### Minor Changes

- d0ee919: Add command-palette, checkbox-group, token-input, icon/icon-button, code-editor, data-grid, and
  calendar components. Harden file-input with clipboard paste, native directory selection, and
  dropped-folder rejection reporting.
- 1293f48: Hardening pass across ~70 components: document the button/spinner interaction custom-property APIs
  (`--lr-button-width`, hover-brightness, active-scale, spinner-duration) and add missing cssparts;
  `lr-breadcrumb` now reads its accessible-name override from the standard `aria-label` attribute
  (was `accessible-label`); phone-input preserves the caret through adapter reformats and ships a
  libphonenumber-js-backed adapter path with a clearer incomplete-number message; prune unused
  localization keys and size/line-height tokens; broaden test coverage across the library.

## Unreleased

### Minor Changes

- Added `<lr-command-palette>` with searchable command registration, groups, keyboard navigation,
  Escape dismissal, and a configurable `mod+k` shortcut.
- Added `<lr-checkbox-group>` and `<lr-token-input>` as form-associated composite controls with
  array values, native reset/validity behavior, localized chrome, and accessible focus/editing APIs.
- Added `<lr-icon>` and `<lr-icon-button>` as dependency-free SVG and icon-only action primitives.
- Added `<lr-code-editor>` with line numbers, tab insertion, native textarea selection APIs, and
  editing-assistance passthrough.
- Added `<lr-data-grid>` with sortable headers, roving cell focus, row selection events, loading/
  empty states, and responsive overflow.
- Added `<lr-calendar>` with responsive month and agenda views, event markers, date navigation,
  RTL-aware keyboard navigation, and date/event selection events.
- Hardened `<lr-file-input>` with clipboard paste support, optional native directory selection, and
  explicit dropped-folder rejection reporting.
- Updated the component catalog, consumer API reference, custom-elements manifest, stories, and
  accessibility/behavior coverage for the new public surface.

## 3.3.0

### Minor Changes

- 7e7cc44: Harden every remote-resource viewer against oversized, cancelled, and failed loads, and close a set of localization gaps.

  **Resource limits.** A new internal resource loader caps any remote resource a viewer fetches at 25 MB before handing it to a parser, enforced by streaming the response so the cap holds even when the server omits `Content-Length`. Parsed tabular data is additionally capped at 10,000 rows and 1,000 columns before it is retained or rendered. Exceeding either limit now surfaces the localized `documentPreviewResourceTooLarge` message instead of attempting the parse. This is a behavior change for consumers previewing documents above those thresholds — they will now see a size error where the viewer previously tried (and typically hung or crashed) on them.

  **Cancellable loads.** `LyraElement` gained internal `beginAbortableLoad()` and `scheduleAfterUpdate()` helpers. In-flight fetches are now aborted when the element disconnects or its `src` changes again, and loads are coalesced to one per update rather than firing from `willUpdate`. This fixes stale responses racing a newer `src` and work continuing after an element is removed from the DOM. A `src` assigned while an element is detached is held and replayed when it reconnects, rather than being dropped.

  **Error messages no longer leak internals.** Viewers previously rendered raw `error.message` text (fetch/parser internals, URLs) directly into the UI on failure. They now render the localized `documentPreviewFailedToLoad` message, with the underlying error still available to consumers via the `lr-render-error` event.

  Affected viewers: `lr-archive-viewer`, `lr-calendar-viewer`, `lr-contact-viewer`, `lr-csv-viewer`, `lr-dataset-viewer`, `lr-docx-viewer`, `lr-document-preview`, `lr-ebook-viewer`, `lr-email-viewer`, `lr-html-viewer`, `lr-pdf-viewer`, `lr-pptx-viewer`, `lr-spreadsheet-viewer`, `lr-svg-viewer`.

  **Localization fixes.**

  - Form-associated components rendered the required-field validation message as a hardcoded English string (`Please fill out this field.`). It now resolves through the `fieldRequired` message key, so `registerLyraLocale()` and per-element `strings` overrides apply. Note that this also changes the default English text to `This field is required.` — if you assert on `validationMessage`, update the expected string.
  - Removed a duplicate `hidePassword` member from the `LyraMessageKey` union. The key itself is unchanged and still used by `lr-input`; only the redundant second declaration is gone.

  **Component coverage contract.** A new `check-component-coverage.mjs` gate runs as part of `contract-policy` (and therefore `lint`), requiring every public tag in the manifest to be exercised by a story and a behavior test, and every component family to carry an accessibility assertion. Stories and tests were added across the library to satisfy it, and `test:coverage` now runs the full test suite rather than five hardcoded files. No public API change.

## 3.2.0

### Minor Changes

- 62c6b05: `lr-attachment-chip` gains a preview action: a new `previewSrc` property (used when `file` is
  unset; a real `File` takes precedence via a temporary blob URL) and `previewable` boolean (default
  `true`) show a new `preview-button` part whenever a file or preview source is available, emitting
  `lr-preview` (`detail: { id, name, mimeType, src }`) to open `<lr-document-viewer>` with the
  same effective MIME type. `lr-document-viewer` gains a matching `download-link` slot and
  `lr-download` event for a safe native download action. Both properties/events are additive and
  default off/no-op, so existing usages are unaffected.

## 3.1.0

### Minor Changes

- de80dc5: Adds `<lr-archive-viewer>` for listing names and human-readable sizes inside `.zip` archives via
  the optional `jszip` peer. It registers standard ZIP MIME types and a `.zip` filename fallback with
  `<lr-document-viewer>`; other archive formats remain on the generic download fallback.
- de80dc5: Adds the optional `line-numbers` display to `<lr-code-block>` and `<lr-code-block-core>`.
- 53c7c13: Add sanitized SVG and HTML viewers, plus PapaParse-backed dataset and vCard contact viewers to the document renderer registry.
- c6dd26c: Adds `<lr-document-viewer>`, a dialog-hosted, format-dispatching document viewer, plus a
  `registerDocumentRenderer()` registry for plugging in per-format renderers. Files without a
  registered renderer fall back to the existing `<lr-document-preview>` component.
- d992ee7: Adds `<lr-docx-viewer>`, rendering `.docx` Word documents as sanitized semantic HTML through the
  optional `mammoth` and `dompurify` peers. It registers the official WordprocessingML MIME type and
  falls back to matching `.docx` filenames.
- de80dc5: Adds `<lr-ebook-viewer>` using the optional `epubjs` peer and registers EPUB files with the
  document-viewer registry.
- 49f7b87: Adds `<lr-email-viewer>` for sanitized `.eml` messages via the optional `postal-mime` and
  `dompurify` peers, plus `<lr-calendar-viewer>` for `.ics` event lists via optional `ical.js`.
  Both viewers register their standard MIME types and filename-extension fallbacks with
  `<lr-document-viewer>`.
- de80dc5: Adds `getFileTypeMetadata()`, `registerFileTypeMetadata()`, and `<lr-file-icon>` for localized,
  tokenized MIME/filename format presentation.
- 68bb5e3: Adds `<lr-pdf-viewer>`, a PDF renderer built on optional `pdfjs-dist`, with pagination, zoom, selectable text, and virtualized page rendering.
- de80dc5: Adds `<lr-pptx-viewer>` using the optional `@aiden0z/pptx-renderer` peer for best-effort client-side
  PPTX rendering with a persistent fidelity notice.
- 0b6f412: Add SheetJS-backed spreadsheet and PapaParse-backed CSV document viewers with virtualized rows.

## 3.0.0

### Major Changes

- a712749: **Breaking:** the outer, externally-overridable tier of the design-token chain no longer lives in
  the previous external theme-input namespace — it moved to lyra's own `--lr-theme-*` namespace
  (for example, the brand fill input now uses `--lr-theme-color-brand-fill-loud`). Any consumer
  retheming components through the old external custom properties must rename those
  properties to `--lr-theme-*`; the two-tier override mechanism itself (set one property at any
  ancestor to retheme every component) is unchanged. This removes lyra-ui's remaining live runtime
  CSS coupling to Web Awesome.

### Minor Changes

- 66c8819: Adds an independent `--lr-theme-*` shared token layer, aligns `<lr-button>`'s medium size with
  the standard Lyra font scale, exposes its host-width and size contracts, and adds opt-in native
  per-cell semantics to `<lr-heatmap>` through `accessible-cells`.

### Patch Changes

- 11e6a03: `lr-details`/`lr-accordion-item` no longer render the localized "Details" fallback text alongside rich content slotted into `summary` when the plain-string `summary` prop is left unset. The fallback previously always rendered whenever `summary` was empty, regardless of whether a `slot="summary"` child was present — visible only when a consumer needed markup (an icon, multiple spans) in the summary rather than a plain string.
- 581f5f3: `installHappyDomFormAssociatedShims()` no longer throws a `ReferenceError` when `HTMLElement` isn't a global at all — e.g. a plain Node Vitest environment sharing one `setupFiles` entry with happy-dom/jsdom test files. It previously read `HTMLElement.prototype` unconditionally, contradicting its own documented "safe to call unconditionally from a shared setup file used across multiple test environments" contract.
- b5de65c: `lr-popover`/`lr-dropdown`/`lr-tooltip`'s `[part="popup"]` is now `position: fixed` from the start instead of only once the popup is first opened and JS positions it. Previously, while closed, the popup stayed `position: static` sized to its full slotted content, inflating the component's own inline-block host box to match -- an invisible-but-still-hit-testable area that could sit on top of unrelated page content and intercept pointer events until the trigger was first clicked.

## 2.13.0

### Minor Changes

- 80cb577: `lr-table` gains opt-in row selection (`selectionMode: 'single' | 'multiple'`, `selectedKeys`,
  `lr-selection-change`), a built-in filter field (`filterable`, `filterText`, `filter`,
  `lr-filter-change`), controlled pagination through `<lr-pagination>` (`pageSize`, `page`,
  `totalItems`, `paginationMode`, `lr-page-change`), a `loading` state with an indeterminate
  spinner, per-column double-click inline editing (`TableColumn.editable`/`editValue`/`editType`,
  `lr-cell-edit`), and row grouping (`groupBy`, `groupLabel`). All new properties default to
  today's exact behavior when left unset.
- 5628327: `lr-input` and `lr-textarea` now also emit native-style `input`/`change` events (composed,
  matching the native element's own timing) alongside the existing `lr-input`/`lr-change`
  aliases, so consumers migrating from a native `<input>`/`<textarea>` don't need to rename their
  listeners. Both components also forward `spellcheck`, `autocapitalize`, `autocorrect`,
  `inputmode`, and `enterkeyhint` to their internal native control.
- d009cd8: Adds a new "Web Awesome parity primitives" family: `lr-badge`/`lr-tag`, `lr-callout`,
  `lr-divider`, `lr-breadcrumb`/`lr-breadcrumb-item`, `lr-details`/`lr-accordion`/
  `lr-accordion-item`, `lr-button-group`, `lr-carousel`/`lr-carousel-item`,
  `lr-color-picker`, `lr-drawer`, `lr-popover`/`lr-tooltip`/`lr-dropdown`/
  `lr-dropdown-item`, `lr-radio`/`lr-radio-group`, `lr-rating`, `lr-spinner`,
  `lr-progress-bar`/`lr-progress-ring`, `lr-format-number`/`lr-format-date`/
  `lr-format-bytes`/`lr-relative-time`, `lr-image-comparer`, `lr-zoomable-frame`,
  `lr-scroller`, and headless `lr-intersection-observer`/`lr-mutation-observer`/
  `lr-resize-observer` wrappers. `lr-number-input` and `lr-time-input` join `lr-input` as
  sibling native-input-type primitives.

  These close out the remaining free-tier Web Awesome components with no prior lyra-ui equivalent —
  133 tags total, up from 97.

### Patch Changes

- 5766257: `installHappyDomFormAssociatedShims()`'s stub `ElementInternals` now implements `setValidity()` as a no-op. `AnchoredValidityController` (used by every form-associated component) calls `internals.setValidity()` on every update, not just at construction, so a consumer's happy-dom test suite installing the shim would throw the moment any shimmed component's value changed after mount.

## 2.12.0

### Minor Changes

- 42036af: `lr-table` gains expandable rows: a table-level `expandedContent?: (row) => unknown` renders a
  full-width panel beneath any row whose key is in the new consumer-owned `expandedKeys: Set<string |
number>` property, toggled via a built-in leading chevron cell and the new `lr-row-expand-toggle`
  event (`detail: { row, key }`). An optional `canExpand?: (row) => boolean` gates which rows get an
  interactive toggle at all. All three properties are additive and default to a no-op, so existing
  tables are unaffected.

- d612939: Make card headers wrap with their actions in narrow allocations, expose citation previews through
  a stable tooltip relationship, and localize the complete citation status announcement.

  Add reactive `accessibleLabel` overrides to both code-block variants and media cards so host
  `aria-label` values reach the actionable or semantic element inside shadow DOM. Media-card's
  unnamed actions now use complete, per-kind localized messages.

  Keep markdown within logical narrow allocations and make its `streaming` state hold `aria-busy`
  until the final content update.

- 159f3c9: `lr-file-input` now forwards host accessible names to its dropzone and file input, exposes an
  imperative focus target, reports explicit enabled/disabled ARIA state, and announces accepted and
  rejected file counts with correct singular and plural messages.

  `lr-export-button` now forwards host accessible names to its trigger, exposes native focus and
  blur methods, and keeps long format menus within the positioned overlay's available space.

  `lr-document-preview` now supports explicit image alternative text (including `alt=""` for
  decorative previews), aborts superseded text fetches, and documents its sizing, font, and spinner
  motion custom properties.

- 3da4f80: `lr-button` ships a default `:hover`/`:active` pointer-interaction treatment on `[part='base']`
  (`filter: brightness(--lr-button-hover-brightness)` on hover, `transform: scale(--lr-button-active-scale)`
  on active, both disabled under `prefers-reduced-motion`) -- previously it had zero hover/active CSS,
  so a mechanical `wa-button` -> `lr-button` rename silently dropped all pointer-interaction feedback.

  `lr-button` is now form-associated (`static formAssociated = true` + `attachInternals()`), so it
  participates in an ancestor `<form>.elements` the same way `wa-button` does -- a sibling text field's
  own Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) now finds
  it, instead of silently failing to submit the form.

  `lr-button` gains an `appearance="accent"` value -- a loud, high-contrast filled tier equivalent to
  `wa-button`'s own runtime-default appearance, including for `variant="neutral"` (`'filled'` reads the
  ambient surface color there, matching `wa-button`'s `appearance="filled"`; `'accent'` reads a solid
  neutral fill, matching `wa-button`'s own unset-appearance default). New `--lr-button-accent-fill`/
  `-accent-on-fill` custom properties back it.

  `lr-heatmap` gains a `monthLabelText?: (jsMonth: number, year: number) => string | undefined`
  property, the month-axis analogue of the existing `weekdayLabelText` -- lets a consumer's calendar-mode
  month labels track the same locale signal (e.g. an app's own i18n store) as every other localizable
  string on the component, instead of always following `toLocaleString(undefined, ...)`'s browser/OS-
  language default. Unset (the default) reproduces today's exact locale-derived output.

- 8a1777b: `lr-skeleton` adds an `announce` switch so grouped or decorative placeholders can avoid
  duplicating live-region announcements. Pulse and sheen effects now use the shared
  `--lr-transition-ambient` motion token and remain disabled by the reduced-motion branch.
- 8e8a77f: `lr-tool-result-dialog` now forwards host `aria-label` to the internal dialog, exports its
  typed event map, localizes complete duration messages, omits non-finite durations, exposes its
  running-spin timing, and wraps footer actions in narrow layouts.

### Patch Changes

- 6ba4d1f: Localize generation metrics, graph position announcements, attachment upload context, and duration templates. Mirror JSON viewer disclosure chevrons in RTL and give map content a named semantic group with correct host-label precedence.
- b67a25e: Forward host accessible names to the semantic canvas or SVG in the chart, histogram, box-plot,
  and lite-chart families. Localize numeric summaries, mirror chart axes in RTL, refresh derived
  histogram data, improve BoxPlot theming and reduced-motion behavior, and support narrow allocations
  with long content across charts and context meters.
- 5dd8066: `lr-chat-message` now formats its default timestamp with the component's effective locale,
  uses the shared ambient-motion token for streaming feedback, and wraps crowded footer controls
  in narrow allocations.
- e95f942: Adds a complete interpolated localization message for citation status announcements so
  translations can reorder the citation index and status naturally.
- 303e701: `lr-heatmap` now localizes its built-in value label and formats legend, accessible-range, cell,
  and calendar-date values with the component's effective locale. Explicit `value-label` text remains
  verbatim.
- 87eb96a: `lr-heatmap` now mirrors its low-to-high legend ramp in right-to-left layouts, including
  consumer-provided multi-stop palettes.
- 134dba0: Adds a complete interpolated localization message for lite-chart mark announcements so
  translations can reorder series, label, value, and position naturally.
- 0260f9b: Harden `lr-app-rail`, `lr-attachment-chip`, `lr-avatar`, and `lr-chip-group`: respect the
  configured element prefix, preserve localized attachment-message word order, support image `File`
  objects in thumbnail-only mode, make spinner timing themeable, retry replacement avatar images,
  forward avatar accessible-name overrides, and collapse slot-forwarded overflow chips correctly.
- 9033a43: Forward host naming and native textarea editing APIs through `lr-chat-composer`, complete
  `lr-phone-input` selection and range-editing methods, and expose observable focus/blur contracts
  for pagination, playback, and select controls.
- acbbf00: Logical safe-area tokens now mirror the underlying physical browser insets in right-to-left
  layouts, keeping dialogs, toasts, widgets, and tool overlays clear of notches on the correct side.
- 1f93e0c: `lr-sparkline` now applies its generated or consumer-provided accessible name to the internal
  SVG that owns the image role. Generated value summaries also respect the component's effective
  locale and per-instance message overrides.
- 18003e2: `lr-tool-call-chip` now interpolates duration values through localized message templates and
  exposes coherent motion controls for its running spin and pending pulse. Its event map is also
  exported for typed listeners.
- 140f9ea: Align `lr-checkbox` with the native checkbox keyboard, focus, reset, ARIA-state, and `input`/`change` event contracts while retaining `lr-change` as a compatibility alias.
- d099ea7: Complete the combobox's native editing surface and clearable compatibility, align conversation-item event and story semantics, add accessible disabled and timing controls to copy-button, and localize and theme flag presentation.

## 2.11.0

### Minor Changes

- c0648ec: `lr-input` gains a `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property (reflected), the same scale
  `lr-select`/`lr-combobox` already use — `--lr-input-padding-block`/`-padding-inline`/
  `-font-size` swap per size, the same pattern as `lr-select`'s own size tokens. Unset (the default,
  `'m'`) reproduces today's exact sizing.

## 2.10.0

### Minor Changes

- f506542: `lr-heatmap` gains a `selectedCell` property (`{ row, col }` in matrix mode, `{ date }` in
  calendar mode) — a controlled, consumer-owned marker (mirroring `lr-lite-chart`'s
  `selectedIndex`) that draws a persistent canvas ring independent of keyboard focus, appends a
  "Selected: ..." description to the host's own `aria-label` so it stays discoverable after focus
  moves elsewhere, and appends a "(selected)" suffix to the keyboard live-region announcement. Unset
  (the default, `null`) reproduces today's exact output.
- 6f6d758: Add `lr-button`, a generic action-button primitive (`variant`/`appearance`/`size`/`loading`/`disabled`/`type`, default + `start`/`end` slots) -- the `lr-*` equivalent of a plain `wa-button`.
- 5eda04d: Add `lr-input`, a single-line plain-text input primitive (`type="text"`/`"password"`/`"email"`/`"number"`, label/hint/error chrome, form-associated validation, a built-in password-visibility toggle) -- the `lr-*` equivalent of a plain `wa-input`.
- 7c95e95: `lr-tool-result-view` gains a real `fallback="text"` mode (previously accepted as an attribute
  value but silently treated identically to `"json"`): a string `result` renders as preformatted text
  instead of being forced through `<lr-json-viewer>`'s tree view, falling back to the `"json"`
  behavior when `result` isn't a string. A new `copyable` property adds a copy-to-clipboard affordance
  to either fallback kind. Additive — unset, both fallback kinds and every existing consumer render
  byte-identical to before.

### Patch Changes

- 83fe6ba: Fix `lr-heatmap`'s `llms-full.txt` section, which was missing four real, already-shipped members
  (`cellInteractive`, `weekdayLabelText`, `colorSteps`, `refreshTheme`), and add a matching
  `focus()`/`blur()` mention to `lr-button`'s own section. Add a `pnpm run llms-freshness` lint gate
  (wired into `contract-policy`, so it runs in `lint`/CI/`publish.sh`) that fails the build if any
  custom element's public property isn't mentioned anywhere in its own `llms-full.txt` section, so
  this can't silently drift again. A small baseline of ~20 pre-existing drift items on unrelated
  components (chart family, dialog, menu, split, tree-node, widget, etc.), discovered while building
  this check, is exempted for now via a documented allowlist in the script — out of scope for this
  change, left for a follow-up cleanup.

## 2.9.0

### Minor Changes

- b4a6f5b: `lr-heatmap`'s color ramp now preserves a translucent `rgba()`/`hsla()`/hex-with-alpha color instead of silently resolving it to fully opaque. `resolveRgb()`/`hexToRgb()` return an `[r, g, b, a]` quadruple (previously `[r, g, b]`), and the ramp emits `rgba(...)` whenever an endpoint is translucent — unchanged `rgb(...)` output for opaque colors, so an existing consumer using only opaque `--lr-heatmap-scale-lo`/`-hi` values sees no difference. Lets a consumer key a ramp endpoint off a themed semi-transparent surface token (e.g. a "quiet baseline" tint) and get the intended translucent cell color instead of a stark opaque one.

## 2.8.0

### Minor Changes

- 0331bbf: `lr-table` gains a public, reflected `showAllColumns` property/`show-all-columns` attribute for its reveal-hidden-columns state, plus a `lr-columns-revealed` event fired when `[part='reveal-columns-button']` toggles it. Consumers can now read the current reveal state back (to persist it) and set an initial one (to restore a previously-persisted preference), mirroring the read-back/set-forward contract `sortKey`/`sortDir` already support. The button still toggles the state itself by default, so existing usage is unaffected.

## 2.7.0

### Minor Changes

- af61856: `lr-app-rail`'s navigation landmark (and its `role="dialog"` while the mobile overlay is open) now honors a host-level `aria-label` attribute, taking precedence over the `label` property and its localized `"Navigation"` default, mirroring `<lr-date-input>`'s `accessibleLabel` pattern. Previously a host-level `aria-label` on `<lr-app-rail>` had no effect on the accessible name computed inside its shadow DOM.
- 4ee4e76: `lr-chat-composer` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<textarea>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 06e5fda: `lr-chip` gains a `--lr-chip-pressed-bg` custom property (falls back to `--lr-chip-bg`) so the pressed/selected background can be set independent of the resting background. A toggleable-but-unpressed chip now announces `aria-pressed="false"` instead of omitting the attribute entirely, matching the ARIA Authoring Practices convention for toggle buttons.
- a158b6b: `lr-combobox` gains a `size` property (`'xs'|'s'|'m'|'l'|'xl'`, default `'m'`) mirroring `lr-select`'s existing scale, including matched sizing for the "+N" overflow tag so it stays visually consistent with the trigger at every size. Async `ComboboxSourceRow` results can now carry a decorative `icon`, trailing `badge`, richer `accessibleLabel`, and opaque `data`; the read-only `selectedRows` getter retains the structured rows and payloads for the current selection. The new visuals are exposed through `option-icon` and `option-badge` CSS parts.
- 480d9e2: `lr-conversation-item` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its in-place rename `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary while a rename is in progress.
- 74dcaa7: `lr-date-input` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 22f206c: `lr-dialog` now lets a host-level `aria-label` attribute win over its computed accessible name (a slotted heading, `heading`, or `label`), matching `<lr-date-input>`'s `accessibleLabel` pattern. Previously a consumer setting `aria-label` directly on `<lr-dialog>` was silently ignored in favor of the bespoke `label`/`heading` props. Additive — left unset, today's existing three-tier fallback is unchanged.
- 80b22ba: `lr-empty`'s `compact` mode gains a `--lr-empty-compact-align` custom property (defaulting to today's exact `flex-start`/`start` pair) so a consumer can combine `compact`'s denser padding with a centered heading/description layout by setting it to `center`.
- 0f21c57: `lr-export-button` accepts custom format descriptors with consumer-supplied labels, descriptions, and extension metadata. Custom formats emit `lr-export` for application handling without bundling an encoder, while a new controlled `loading` state exposes busy semantics and prevents duplicate activation during async exports.
- 3ac5e4d: `lr-gauge` gains a full-circle `type="ring"` presentation and a `--lr-gauge-fill` custom property for setting the fill stroke per instance across radial, ring, and linear gauges.
- f6b2aa5: `lr-graph` nodes gain independent accessible labels and SVG tooltip descriptions. Links gain stable ids, spoken-name/tooltip relationship-label fallbacks (not visible edge text), tooltip descriptions, directed arrowheads, per-link colors, and dash patterns; `lr-link-click` now includes the optional link id and the marker is exposed through the `arrowhead` CSS part. A host `aria-label` is forwarded to the internal semantic SVG.
- efc1182: `lr-map` now forwards a host-level `aria-label` attribute onto `[part="base"]`'s accessible name as a fallback when `label` is left unset, matching `lr-slider`/`lr-checkbox`/`lr-switch` — previously a host `aria-label` was silently dropped in favor of the localized `'map'` default.
- 085d173: `lr-mention-popover` now honors a host-level `aria-label` attribute as the accessible name for its internal `role="listbox"` popup, taking priority over the `label` property and its localized default. Previously the popup's name came only from `label`/`localize()`, so a plain `aria-label` set on `<lr-mention-popover>` itself was silently ignored — matches the same fallback already used by `lr-combobox`/`lr-table`.
- 3b59e94: `lr-menu`'s `role="menu"` popup now honors a host-level `aria-label` attribute over both the `label` prop and its localized default, matching `lr-select`/`lr-model-select`'s established `this.getAttribute('aria-label') || <computed default>` precedence. Additive — `aria-label` is unset by default, so every existing consumer (whether relying on the default `"Menu"` text or an explicit `label` prop) renders byte-identical to before.
- 653173d: `lr-model-select` gains an opt-in `hint`/`error-text` form-control chrome (matching named slots and `hint`/`error` CSS parts, mirroring `lr-select`, with `aria-describedby` wired to the rendered ids), plus `spellcheck`/`autocapitalize`/`autocorrect` passthrough and bubbling `blur`/`focus` events on the free-text mode's internal `<input>`. All additive — a bare `<lr-model-select>` with none of these set renders byte-identical to before.
- 992b0ba: Add `lr-pagination`, a controlled, localized page-navigation component with previous/next controls, a validated numeric page jump, range summaries, applied-page announcements, loading/empty handling, RTL-aware icons, five sizes, and container-responsive stacking. Enrich `TreeItem` rows with optional `icon`, `description`, and `accessibleLabel` fields plus matching structured CSS parts while preserving the existing tree keyboard model.
- dfb2f5e: Add `lr-phone-input`, a form-associated country/telephone field that keeps canonical form values in E.164 while preserving partial editable input. Numbering metadata stays opt-in through an injected adapter or the consumer-loaded `loadLibphonenumberAdapter()` helper; `libphonenumber-js` is an optional peer and international E.164 input works without a formatter.
- d88377a: `lr-switch` gains an opt-in `hint`/`error-text` form-control chrome (props + matching named `hint`/`error` slots + CSS parts), mirroring `lr-select`'s pattern for those two pieces, with `aria-describedby` wired to whichever are rendered. Left unset, neither renders and the control is unchanged. The default slot stays the control's visible, clickable label (same as `lr-checkbox`) — no separate top-of-field `label` prop was added.
- c8709cd: `lr-textarea` gains optional label/hint/error chrome, accessible-name forwarding, bounded auto-resize, editing-assistance attributes, public native-input and selection/caret APIs, synchronized `setRangeText()`, and bubbling composed focus/blur events. Existing visual and behavioral defaults remain unchanged when the new options are unused.
- fca0ffb: `lr-tool-approval-dialog`'s raw-JSON args `<textarea>` now also hardcodes `autocapitalize="off"` and `autocorrect="off"` alongside its existing `spellcheck="false"`, so a mobile browser (notably iOS Safari, which defaults textarea `autocapitalize` to `'sentences'`) can no longer auto-capitalize or auto-correct JSON key/value text while a user edits tool-call arguments, silently corrupting the JSON.
- 5b9b056: `lr-tree` now forwards a host-level `aria-label` attribute onto the internal `role="tree"` element's accessible name as a fallback when `label` is left unset, matching `lr-slider`/`lr-select` — previously a host `aria-label` was silently dropped since `role="tree"` lives on an internal element, not the host.
- 12595bd: `lr-typing-indicator`'s dots-variant stagger delays are now themeable via `--lr-typing-dot-stagger-1`/`-2` (defaulting to today's exact `600ms`/`1200ms`), so a consumer retiming `--lr-transition-ambient` can keep the stagger proportional.

## 2.6.0

### Minor Changes

- 78d4b58: `lr-chat-message` gains an `attachments-position` prop (`'before' | 'after'`, default `'after'`) so the `attachments` slot can render above the message body instead of below it, keeping DOM/visual/reading order in sync.
- a072af9: `lr-chip` gains a `--lr-chip-pressed-border` custom property so a consumer can set the pressed/selected border color independent of `--lr-chip-accent` (which also drives the label text color). Falls back to `--lr-chip-accent`, so existing consumers are unaffected.
- b56bdb2: `lr-empty` gains a `--lr-empty-compact-padding` custom property to override `compact`'s fixed uniform padding (e.g. with an asymmetric shorthand like `8px 2px`). Falls back to `var(--lr-space-xs)`, today's exact value.
- e029ac2: `lr-heatmap` calendar mode gains a `weekdayLabelText?: (jsWeekday: number) => string | undefined` hook to override the weekday-axis label text (e.g. for a consumer with its own locale/translation state independent of the browser's runtime locale).
- 6d5f9c4: Add `lr-textarea`, a bare multiline plain-text input primitive (value/rows/resize/placeholder, form-associated validation) — the `lr-*` equivalent of a plain `wa-textarea`.
- bbe8007: `lr-segmented`'s `SegmentedItem` gains an optional `icon` field, rendered before the item's label.
- e98013a: `lr-table`'s `TableColumn` gains a `headerCell` render hook (mirroring `cell`/`footer`) and `width`/`minWidth` fields. Any column defining `width` switches the table to `table-layout: fixed` so widths are authoritative.
- 993809a: `lr-widget` gains a `backdrop-inset` prop to decouple the fullscreen backdrop's inset from the panel's own `fullscreen-inset`. Falls back to `fullscreen-inset`, so existing consumers are unaffected.

### Patch Changes

- 1c78bd2: Fix `lr-poll-status`, `lr-typing-indicator`, and `lr-stream-status`'s ambient "still alive" pulse/bounce animations, which reused `--lr-transition-base` (180ms — reserved for discrete UI micro-interactions) and rendered as a fast flicker instead of a calm breathing loop. Adds a dedicated `--lr-transition-ambient` token (1.8s) for infinite looping indicators.
- e029ac2: Fix `lr-heatmap`'s `cellColor` hook silently rendering solid black when it returns a CSS custom property or other non-literal color (e.g. `color-mix(...)`) — the value is now resolved via a cached, hidden probe element before being assigned to the canvas `fillStyle`.
- 600544f: Fix `lr-skeleton` rendering as an invisible 0×0 box everywhere: `[part='base']` was a bare `<span>` (UA default `display: inline`), so its own `inline-size`/`block-size` were CSS no-ops per spec. Adds `display: block`.

## 2.5.0

### Minor Changes

- 84cefde: `lr-attachment-trigger`'s single-capability trigger `aria-label`s ("Attach files"/"Attach an
  image"/"Use camera"), its multi-capability menu's "Add attachment" label/aria-label, and its menu
  item labels ("Upload files"/"Upload a photo"/"Take a photo") now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- 6bf30ea: `lr-avatar` now accepts default-slotted icon/glyph content (e.g. an inline SVG), shown in place of
  the image/initials and taking priority over both `src` and `initials` — useful for a chat UI
  distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set
  `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.
- 87890ea: `lr-checkbox`'s built-in required-field validation message ("Please check this box if you want
  to continue.") now routes through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English output is unchanged when no override is set.
- b720eda: Fixed `lr-chip`'s opt-in `selected` toggle/pressed mode so it stays interactive after the first
  click. `[part='base']`'s `role="button"`, `tabindex`, `aria-pressed`, and click/keydown handlers
  used to be gated on the _current_ value of `selected`, so a chip that started `selected` and was
  clicked (flipping it to `false`) lost its focusable/clickable semantics on the next render — there
  was no way to click it back on. `selected` becoming `true` at any point now latches the chip into
  toggle mode for good, so it stays clickable in both directions. A chip that must be interactive
  from the outset while starting **unselected** (e.g. an initially-inactive filter chip) can opt in
  explicitly with the new `toggleable` property, since `selected`'s own default (`false`) can't be
  told apart from "never opted in" on its own.
- cbfec47: `lr-citation-badge`'s visible status words folded into its computed accessible name ("High
  confidence"/"Medium confidence"/"Low confidence"/"Verified"/"Unverified") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- dba57e9: `lr-context-meter`'s accessible summary ("{used} of {total} used" / "{used} used") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 7379a41: `lr-conversation-item`'s "Untitled conversation" fallback title now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- acdaa37: `lr-dock-panel`'s resize-handle and collapse-toggle `aria-label`s ("Resize panel",
  "Collapse panel"/"Expand panel") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- eca2ea4: `lr-document-preview`'s hardcoded English strings — the image-preview `alt` fallback
  ("Document preview"), the unsafe-URL error ("Document URL is not allowed."), the non-`Error`
  fetch-failure message ("Failed to load document."), and the empty-`error-message` fallback
  ("Something went wrong.") — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Its in-flight text-fetch spinner label ("Loading document…")
  is now also wired through the existing `loadingDocument` message key. Default English output is
  unchanged when no override is set.
- a3c4ebf: `lr-export-button`'s trigger button text (default "Export", also reused for the format menu's
  `aria-label`) now routes through `this.localize()` when `label` is left at its built-in default,
  overridable via `.strings`/`registerLyraLocale()` — matching `lr-attachment-chip`'s
  `removeLabel`/`retryLabel` convention. Setting the `label` attribute/property explicitly still
  overrides it directly. Default English output is unchanged when no override is set.
- df8341b: `lr-generation-status`'s stop-button `aria-label` ("Stop generating") now routes through
  `this.localize()` (sharing the existing `stopGenerating` key used elsewhere in the library), and
  the tokens segment's singular/plural noun ("token"/"tokens") is now localizable too, matching
  `lr-json-viewer`'s/`lr-word-cloud`'s existing count-noun pattern. Overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 20ae3e7: `lr-graph`'s visually-hidden data-list `aria-label` ("Graph data") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 8c29581: `lr-segmented` gains a `label` property giving its `role="radiogroup"` root an accessible name.
  When unset, a plain `aria-label` attribute on the host element is honored as a fallback, matching
  `lr-slider`'s existing `label`/`aria-label` convention. Previously the radiogroup had no way to
  receive an accessible name at all.
- 259c0c6: Completed a full-library i18n/RTL/styling standardization pass across the remaining component
  families not yet covered by earlier rounds — `chart` (and `box-plot`/`histogram`/`lite-chart`),
  `avatar`, `code-block`, `combobox`, `date-picker`, `dialog`, `document-preview`, `export-button`,
  `file-input`, `graph`, `heatmap`, `map`, `time-range`, `tool-call-chip`, `tool-param-form`,
  `tool-result-dialog`, `tree`, `widget`, and several smaller components. Highlights:

  - Routed remaining hardcoded English strings (accessible descriptions, aria-labels, empty-state
    text) through `this.localize()`.
  - Fixed RTL gaps: `date-picker`'s previous/next chevrons now mirror under `dir="rtl"` (rotating
    the wrapping `part`, not the icon), matching the grid's own arrow-key swap.
  - `lr-avatar`: fixed a dangling `--lr-color-surface-alt` token reference, corrected its `size`
    JSDoc, and extended the accessible-name role/`aria-label` to the initials-fallback path (not
    just the icon-slot path) whenever `alt` is set.
  - `lr-export-button` now fires `lr-show`/`lr-hide` on its format menu, matching the same
    convention already used by `lr-menu`/`lr-select`/`lr-combobox`.
  - Fixed a `this.localize(key, literalFallback)` pattern that unconditionally short-circuited
    `registerLyraLocale()` lookups for the affected keys (the fallback is now omitted wherever
    `DEFAULT_STRINGS` already carries the same default).

  AGENTS.md gained a new "Internationalization (i18n), RTL, and theming" section documenting the
  resulting standard, and both READMEs now summarize it for consumers.

- 79e4390: Fixed gaps found during a full re-verification pass over previously-completed work:

  - `lr-menu`'s type-ahead navigation now excludes `hidden`/`aria-hidden` items (it already
    excluded `disabled` ones), matching the Arrow/Home/End roving-focus navigation it sits next to.
  - The root barrel (`src/lyra.ts`) now re-exports 13 component event-map types that were previously
    unreachable from the package root even though their owning classes were exported: `LyraChip`,
    `LyraChipGroup`, `LyraCitationBadge`, `LyraCopyButton`, `LyraDiffView`, `LyraFileInput`,
    `LyraHeatmap`, `LyraLiteChart`, `LyraMediaCard`, `LyraSelect`, `LyraSourceCard`, `LyraSplit`, and
    `LyraTimeRange`'s `*EventMap` types are now all importable from `@aceshooting/lyra-ui`.

- 59d4477: `lr-media-card`'s hardcoded English fallback strings — the file-chip "Untitled file" name, the
  `image`/`video` alt-text fallbacks ("Image attachment"/"Video attachment"), and the accessible
  "Open …" label (both the named and generic-kind forms) — now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- ea774a8: `lr-mention-popover`'s default listbox accessible name ("Suggestions") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()` — matching the already-shared
  `noMatches` key its empty-state row uses. An explicit `label`/`empty-text` value still wins
  verbatim. Default English output is unchanged when no override is set.
- cd10606: `<lr-menu>` gains an opt-in `closeOnEscapeAnywhere` property. Escape has always closed the menu
  and refocused the trigger when it originates from a real `<lr-menu-item>`, but slotted non-item
  content (e.g. a form control slotted alongside the items) previously got full default keyboard
  behavior with no way to close the menu on Escape. Setting `closeOnEscapeAnywhere` extends that
  same Escape-closes-and-refocuses behavior to keydowns from anywhere in the list, including slotted
  non-item content. Defaults to `false`, so existing consumers are unaffected.
- 7d63af9: `lr-menu`'s `role="menu"` popup default accessible name ("Menu") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. An explicit `label` value
  still wins verbatim. Default English output is unchanged when no override is set.
- f232381: `lr-model-settings-panel`'s hardcoded English strings — the visible "Temperature" caption
  (also reused as the nested `lr-slider`'s accessible name) and the internal `lr-model-select`'s
  "Select a model…" placeholder — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 1686322: `lr-playback`'s play/pause button and position-slider `aria-label`s ("Play"/"Pause",
  "Playback position") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 0cacb4d: `lr-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
  three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. It also now shows a distinct
  "Paused" countdown state while `paused`, instead of freezing on whatever value it last displayed.
  Default English output is unchanged when no override is set.
- 870523f: `lr-widget` gains two new named slots, `collapse-icon` and `fullscreen-icon`, overriding the
  built-in chevron/expand-or-close glyphs on the collapse and fullscreen toggle buttons entirely
  (platform slot-fallback-content mechanism: whatever is assigned wins, otherwise the default glyph
  renders unchanged). `WidgetView`'s `label` is now optional and a new `ariaLabel` field lets a view
  toggle be icon-only while still exposing an accessible name — previously a toggle with no `label`
  had no accessible name at all.
- c2bc232: Re-audited every component against the library's i18n/RTL/theming standard and fixed the
  remaining gaps found:

  - Removed several `this.localize(key, literalFallback)` call sites (`toolApprovalHeading`,
    `playback`'s play/pause/position labels, `model-settings-panel`'s temperature/model labels,
    `media-card`'s five accessible-name strings, `kbd`'s shortcut-token labels, `chat-composer`'s
    composer label) where the literal fallback silently defeated `registerLyraLocale()` translation
    for that call site.
  - Routed remaining hardcoded strings through `this.localize()`: `date-picker`'s next-month label
    and `date-input`'s validation messages, `toast-item`'s/`chip`'s/`combobox`'s remove/close
    labels (now interpolated via a `{placeholder}` instead of string concatenation), `heatmap`'s
    matrix/calendar aria-labels and "no data"/row/col fallbacks, `chart`/`box-plot`'s description
    and data-table text, `lite-chart`'s mark-position announcement, `document-preview`'s empty-state
    nouns, `json-viewer`'s copy/expand/collapse/count labels, `stat`'s trend announcement,
    `dialog`'s `confirm()` cancel button, `typing-indicator`'s default label, `tool-param-form`'s
    edge-case validation message, and `tool-result-dialog`/`tool-call-chip`'s duration seconds unit.
  - Fixed RTL gaps: `app-rail-item`'s icon tooltip now flips side under `dir="rtl"` via
    `rtlAwarePlacement()`, `chat-message`'s and `source-list`'s collapse/disclosure chevrons now
    mirror under RTL, and `lite-chart`'s roving-tabindex point navigation now swaps
    ArrowLeft/ArrowRight under RTL.

  Also compressed the shared string registry (`internal/localization.ts`): removed 21 `kbd*` base
  keys (`kbdEnter`, `kbdEscape`, `kbdTab`, etc.) that were fully superseded by their `*Word`/`*Visual`
  counterparts and had no remaining call sites anywhere in the library, reducing the packed consumer
  bundle size.

- aeef118: `lr-select`'s required-field validation message ("Please select an option.") and its
  trigger's fallback accessible name ("Select", used only when no `aria-label`, `label`, or
  `placeholder` is set) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 4fb27a2: `lr-skeleton`'s default accessible name ("Loading…") now routes through `this.localize()`
  (reusing the shared `loading` key), overridable via `.strings`/`registerLyraLocale()`. An
  explicit `label` still wins verbatim. Default English output is unchanged when no override is set.
- f7b9f0e: `lr-source-list`'s fallback header text ("Sources", used only when neither `label` nor
  `label-plural` is set) now routes through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- f2ea145: `lr-stepper`'s `StepItem` gains an optional `title` field, rendered as a native `title` tooltip on
  that step's button — useful for explaining why a `disabled` step is locked (e.g. "Complete Basics
  first"). Steps that omit it render no `title` attribute at all, unchanged from today.
- 9e5864a: `lr-stream-status`'s built-in stalled-message default ("Taking longer than usual…") and its
  three live-region announcements ("Connection stalled."/"Connection restored."/"No longer
  stalled.") now route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`.
  Default English output is unchanged when no override is set.
- 9174500: `lr-switch`'s built-in required-field validation message ("Please turn this on.") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 60084ba: `lr-thinking-panel`'s default header label ("Thinking") and its duration-display text ("Thought
  for …"/"Thinking…") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. An explicit `label` still wins verbatim. Default English
  output is unchanged when no override is set.
- b113bda: `lr-tool-approval-dialog`'s heading text, generic tool-name fallback, args-editor accessible
  name, invalid-JSON fallback error, and its Deny/Edit/Approve button labels now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 3b1f930: `lr-tool-call-chip`'s visible status labels (Pending/Running/Success/Error/Denied, shared with
  `lr-tool-result-dialog`'s identical vocabulary) and its unnamed-tool fallback ("Tool call") now
  route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- bbaea80: `lr-tool-param-form`'s validation messages (required field, wrong type for a string/number/
  integer/boolean, enum mismatch, const mismatch, unsupported field type, malformed schema shape,
  non-serializable value) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- bda19ac: `lr-tool-select-dialog`'s dialog title, search placeholder, "use default tools" switch label
  and hint, category count/"Other" fallback, tools-enabled summary, no-matches message, and the
  no-tools-available empty state now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 220bd73: `lr-widget`'s collapse/expand, exit-fullscreen/expand-to-fullscreen, and view-toggle-group
  aria-labels, plus its fullscreen dialog's fallback accessible name, now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. The collapse/expand labels
  reuse `lr-dock-panel`'s existing `dockPanelCollapse`/`dockPanelExpand` keys. Default English
  output is unchanged when no override is set.

### Patch Changes

- 00ce49f: Fix `lr-date-picker`'s day-grid keyboard navigation to swap ArrowLeft/ArrowRight under `dir="rtl"`, matching the grid's own visual mirroring (the day cells use unset `direction`, so the browser already lays them out right-to-left). ArrowUp/ArrowDown (by week) are unaffected.
- 37e1a2f: `lr-table`'s header-cell ArrowLeft/ArrowRight roving-tabindex navigation now derives its RTL
  check through the shared `isRtl()` helper instead of a duplicated inline `getComputedStyle`
  check, and gains test coverage confirming ArrowRight/ArrowLeft already swap correctly under
  `dir="rtl"` (a native `<table>` mirrors column visual order under RTL on its own) while
  ArrowUp/ArrowDown row navigation is unaffected. No behavior change.
- 2fd3786: Fix calendar-heatmap weekday-axis labels to respect firstDayOfWeek instead of always labeling grid rows 1/3/5.

## 2.4.0

### Minor Changes

- 171bdbd: `lr-attachment-chip`'s file-size unit abbreviations ("B"/"KB"/"MB"/"GB"/"TB") now route through
  `this.localize()` when rendered, overridable via `.strings`/`registerLyraLocale()`. The exported
  `formatFileSize()` pure function gains an optional `unitLabel` resolver parameter, defaulting to the
  plain English abbreviation — every existing single-argument call is unaffected.
- 5f043ba: `lr-chart`'s data-table "Category" column header, per-row "Point N" fallback label, and "Reset
  zoom" button text now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- 5e90140: `lr-chat-composer`'s action button labels ("Send message"/"Stop generating") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Also adds `stoppable: boolean =
true` — when set to `false`, the button never renders as a Stop/cancel control while busy; it stays a
  disabled Send button instead, for backends with no cancellation endpoint. Default behavior is
  unchanged.
- 558e76c: `lr-chat-message`'s visible status text ("Sending…"/"Responding…"/"Failed to send") and its two
  live-region status-change announcements ("Message failed to send."/"Message complete.") now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English text is
  unchanged.
- 238c8d7: `lr-chip-group`'s collapsed overflow-indicator's visible "+N" text now routes through
  `this.localize('showMoreCollapsed', ...)`, matching the aria-label it sits beside, which was already
  localized. Default English output ("+N") is unchanged.
- 0d9018f: `lr-code-block`'s collapse-toggle, copy-button, and code-region aria-labels now route entirely
  through `this.localize()` instead of concatenating a localized verb with a hardcoded English suffix
  ("code"/"to clipboard"/"Code"). Default English output is unchanged.
- a249bd6: `lr-diff-view`'s copy-button aria-label now routes entirely through `this.localize('copyDiff', ...)`
  instead of concatenating the localized "copy" verb with a hardcoded " diff" suffix. Default English
  output ("Copy diff") is unchanged.
- 58c6e59: `lr-file-input`'s drag-preview live-region announcements ("Release to add the file." / "This file
  type is not accepted.") now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged. The post-drop `acceptedMessage`/
  `rejectedMessage` properties and the visible `label` property are unaffected (already
  consumer-overridable).
- b3e3bb6: `lr-json-viewer`'s root-node toggle/copy fallback words ("array"/"object"/"value", used only when a
  node has no key label) now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- b322e75: `lr-model-select`'s synthetic stale-value row badge ("not in catalog") now routes through
  `this.localize('notInCatalog')`, so it can be overridden via `.strings`/`registerLyraLocale()` like
  the component's other built-in message (`noMatches`). Default English text is unchanged.
- e54eeee: `lr-source-card`'s "Untitled source" fallback and its " — p. N" page-suffix format now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- 0576643: `lr-split` now redistributes the track space freed when a `panelConstraints` pixel bound clamps a
  panel's percentage basis down (e.g. a `maxPx` cap on a wide viewport) to sibling panels that have no
  pixel constraint of their own, instead of leaving that space unused. No behavior change for splits
  without `panelConstraints`, or where no panel is actually clamped this render.
- 97756af: `lr-table`'s `columns[].sticky` option now accepts `'start' | 'end'` in addition to the legacy
  `boolean` (`true` continues to mean `'start'`, unchanged). An `'end'`-sticky column pins to the
  inline-end edge instead — useful for a trailing actions column that would otherwise be pushed off
  a narrow viewport — via the same `inset-inline-*` logical-property approach, so RTL is unaffected.
- ffee803: `lr-tool-result-dialog`'s tool-name fallback ("Tool call"), visible status label
  ("Pending"/"Running"/"Success"/"Error"/"Denied"), and maximize/restore button aria-label now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- f9f57f9: `lr-word-cloud`'s default aria-label's pluralized "word"/"words" noun now routes through
  `this.localize()` too, so a registered translation of the `wordCloud` template's `{word}` slot is no
  longer stuck in English. Default output is unchanged.

## 2.3.0

### Minor Changes

- a1b2f8e: `lr-app-rail` gains `dragging` (reflected boolean, true for the duration of a pointer-driven
  resize -- not a keyboard step -- so its own `[part='base']` transition suppresses during the drag
  instead of visibly "chasing" the pointer) and `hideToggle` (suppresses the built-in mobile hamburger
  button for a consumer that owns its own external toggle wired to `open`).
- e9075b8: `lr-app-rail-item` gains an opt-in `tooltip` property: a hover/focus flyout showing the item's
  label text while `icon-only` hides it from view, using the library's existing Floating-UI-backed
  `place()` positioner -- an explicit, documented alternative to hand-rolling a `::part()`+`::after`
  tooltip composition.
- 8160548: `lr-attachment-chip`'s `compact` variant now also shrinks font-size and gap (via new
  `--lr-attachment-chip-compact-font-size`/`-compact-gap` custom properties), not just
  border/radius/padding/thumbnail-size. Also adds `thumbnailOnly`, which -- combined with `compact`
  on an image-mime chip -- hides the filename/size text entirely for a pure thumbnail density with
  no consumer-side CSS.
- 099fa8a: Add `lr-avatar`: a small, fixed-size identity marker (image, or an initials fallback) for a
  user-menu trigger or similar identity affordance -- `size`/`shape`/`tone` variants mirror
  `lr-chip`'s existing tone vocabulary for consistency.
- bf9d442: Add `lr-card`: a generic bordered content container (`appearance` variants mirroring `wa-card`,
  `header`/`media`/`footer`/`actions` slots) for the "small bordered surface with padding" idiom
  common across hero highlights and clickable grid tiles -- a real `lyra-ui` parity counterpart to
  `wa-card`, which this library otherwise mirrors 1:1.
- f9ecffd: `lr-chip` gains an opt-in `selected`/pressed interactive mode: `[part='base']` becomes
  keyboard-activatable and reflects `aria-pressed`, toggling on click/Enter/Space and emitting
  `lr-chip-select`. Not combinable with `removable` (avoids a nested-interactive a11y violation);
  today's passive-label-pill usage is unaffected since `selected` defaults to `false`.
- db24359: Add `lr-code-block-core`: a build-lean variant of `lr-code-block` for a consumer whose
  `languages` map already covers every language it renders. Unlike `languagesOnly` (a runtime flag
  on `lr-code-block` itself, which a bundler can't prove always-true and so can't tree-shake),
  `lr-code-block-core` is a genuinely separate module that never references shiki's full
  ~200-language default entry point at all -- importing it instead of `code-block.js` gives a real
  compile-time exclusion of that table from the build output.
- 83ba36c: `lr-dialog` gains `--lr-dialog-width`, unset by default -- when set, the panel actually
  stretches to that width instead of only shrink-wrapping its content capped at
  `--lr-dialog-max-width`, which was a real gotcha for anyone porting from `wa-dialog`'s
  assertive `--width` token.
- a1d7030: Add `lr-diff-view`: a real two-string line diff (LCS-aligned), rendered as interleaved
  unified-diff output -- unlike diff-flavored syntax highlighting over an already-formatted string,
  this computes the alignment itself, so a one-line change inside a longer block renders as one
  red/green pair near the change instead of every old line then every new line.
- b56abda: `lr-empty`'s `heading`/`description` gain the same slot-override-attribute treatment
  `lr-stat`'s `caption`/`sub` already have -- a consumer can now pass rich mid-sentence content
  (e.g. an inline `<code>` reference) while the plain-string attribute stays the default.
- 4324a73: `lr-graph` now renders a link whose `target` isn't a real node as a short dashed stub off the
  source's position, instead of silently dropping it -- for a wiki-style `[[link]]`/broken-reference
  visualization where "this edge exists but its endpoint doesn't" is a meaningful state, not noise.
  A dangling `source` is still dropped (no position to draw a stub from).
- 1e71d71: Rewrite `lr-heatmap`'s two weekday-axis-label tests to assert against independently fixed dates
  instead of re-deriving the implementation's own formula, which could never fail regardless of
  correctness -- the underlying `weekdayLabels()`/`firstDayOfWeek` anchoring was already correct.
  Also add `cellColor`, an optional per-cell color override function (mirroring the existing
  `cellText`/`cellInteractive` shape) that bypasses the color ramp entirely for an exact value.
- 2e74ea0: Fix `lr-lite-chart`'s `minBarHeight` z-order bug for stacked bars: a floored near-zero segment
  was being overdrawn by the segment stacked on top of it, since each segment's position was derived
  independently from cumulative value rather than from where the previous (possibly-floored) segment
  actually ended on screen. Also add `selectedIndex: number[]`, reflecting `data-selected` onto every
  bar at a given category index across all datasets, for highlighting a whole selected column.
- 00f3b37: `lr-markdown` gains `escapeHtml`, an opt-in property overriding `marked`'s `html` renderer hook
  to emit escaped text instead of parsed/sanitized markup -- for a consumer rendering arbitrary
  already-written content (transcripts, logs) where a stray angle bracket should render as visible
  text rather than a real DOM element, without giving up GFM tables/lists/etc.
- d3fbf36: Add `lr-poll-status`: a "next scheduled refresh" countdown with a built-in pause control -- a
  ticking M:SS display, a "Refreshing…" due state, and an internal live region announcing phase
  transitions, mirroring `lr-stream-status`'s own composition for a different concern (a scheduled
  interval, not transport/connection health).
- b5464bd: Add `lr-segmented`: a single-select button row with the WAI-ARIA APG `radiogroup` contract
  (role="radio", roving tabindex, automatic-activation Arrow/Home/End navigation) built in --
  "choose exactly one of N labeled options" is ubiquitous settings/filter-panel UI that otherwise
  gets hand-rolled without keyboard/ARIA semantics every time.
- 551f272: `lr-select` gains `--lr-select-trigger-height`, unset (auto) by default -- when a consumer sets
  it, the trigger resolves to exactly that height (both floor and cap) instead of only being
  floored by `--lr-select-trigger-min-height`, for pixel-matching a sibling form field in the same
  row without a blunt `::part(trigger){block-size:...}` override.
- 1fddbdc: Add `lr-stepper`: ordered multi-step wizard navigation (label + index, current/completed/
  locked/error state, click-to-jump, horizontal/vertical orientation). Fully data-driven and
  controlled -- like `lr-table`, it never mutates its own `steps` data, firing a cancelable
  `lr-step-select` event and leaving state updates to the host, so gating a jump behind an
  external validity check (e.g. "does the target step's data exist yet") is a normal listener, not a
  workaround.
- 60dbf18: `lr-table` gains two per-column hooks: `footer(rows)`, rendered in a real sticky-bottom
  `<tfoot>` (only when at least one column defines it) -- e.g. a totals row; and `cellStyle(row)`,
  applied via `styleMap` directly to the generated `<td>` -- e.g. a computed heat-tint background --
  which coexists safely with the existing sticky-column offset styling.
- 6ce5b87: Add a new `./testing` subpath exporting `installHappyDomFormAssociatedShims()` -- an opt-in,
  environment-guarded polyfill for `HTMLElement.prototype.attachInternals`, for a downstream
  consumer's own Vitest+happy-dom test suite (happy-dom has no `ElementInternals` implementation,
  and every form-associated `lr-*` component calls `attachInternals()` unconditionally in its
  constructor). Not used by this package's own tests, which already run against real browsers.
- 25254f2: `lr-widget` gains a leading `icon` slot, rich `label`/`sublabel` slot overrides (mirroring
  `lr-stat`'s `caption`/`sub` pattern), and a `views` property driving a built-in header toggle
  group plus one named slot per entry -- for a chart/table (or similar) toggle inside the same card
  chrome, so a consumer no longer has to hand-roll that shell around a bare default slot.

### Patch Changes

- 062f036: Fix `lr-attachment-trigger`'s internal hidden `<input type="file">` actually rendering as a
  visible, focusable-adjacent element in normal document flow — it now has `display: none` by
  default (and a new `hidden-input` CSS part, for the rare integration that needs to override that).
- 9094b39: Fix `lr-chart` losing a user's legend-toggled hidden-dataset state on every data-driven redraw --
  `draw()` now snapshots each dataset's `isDatasetVisible()` state before reassigning `chart.data` and
  restores it via `setDatasetVisibility()` afterward, since Chart.js's own dataset-object identity
  changes on every reactive update from a live-polling consumer.
- a413c8c: Fix `lr-chip-group`'s "+N"/"Show less" overflow toggle hardcoding English strings instead of using
  the library's own existing `localize()`/`strings` override mechanism, which every other component
  with translatable text already uses (including the identical `showMore`/`showLess` keys, already
  consumed by `lr-source-card`).
- 4010bc4: `lr-menu`'s `onListKeyDown` now ignores a keydown whose target isn't a real `<lr-menu-item>`,
  matching the same `instanceof LyraMenuItem` guard `onItemSelect`/`onListFocusIn` already use --
  previously it unconditionally intercepted Arrow/Home/End/Enter/Space/Escape/Tab from any keydown
  bubbling through `[part="list"]`, including from non-item slotted content (e.g. a custom-range
  date input), hijacking keystrokes meant for it. Note: Escape/Tab now also only close the menu when
  the event originates from a real item -- a slotted non-item control gets fully default keyboard
  behavior instead.
- a5a055f: Fix `lr-split`'s fixed-percent panels not reserving space for the auto-inserted divider between
  them, causing a deterministic `(panelCount - 1) * dividerWidth` container overflow in the default
  (uncollapsed) state. Panels now get a nonzero `flex-shrink` so they absorb the dividers' own width
  instead of the row overflowing.
- 18003f0: Fix `lr-stat`'s `[part='base']` not stretching to fill its host in a CSS Grid -- a stat tile with
  a longer `sub`/breakdown-rows line rendered visibly taller than its row-mates. `block-size: 100%` on
  `[part='base']` now matches the convention `lr-word-cloud`/`lr-context-meter` already use.
- 55c384e: Fix `lr-tabs`'s `tablist` part showing a phantom vertical scrollbar on a tablist with no
  vertically-overflowing content — `overflow-x: auto` alone can leave the y axis's computed overflow
  at `auto` too per the CSS overflow spec, which sub-pixel rounding can trip; `overflow-y: hidden` is
  now explicit, since the tablist is never meant to scroll vertically.

## 2.2.0

### Minor Changes

- ff41aba: `lr-app-rail`: add a `resizable` opt-in (drag + keyboard-steppable `[part="resizer"]` handle,
  `railWidthPx`/`minRailWidthPx`/`maxRailWidthPx`, `lr-rail-resize` event) for the `'full'` state's
  width; add `preferredMode` to manually prefer `'full'`/`'icon-only'` while the mobile breakpoint
  keeps tracking automatically; and fix the mobile toggle button's `aria-label` to use a proper
  `openNavigation` message key (consistent with the existing `closeNavigation` key) instead of
  concatenating a hardcoded `" navigation"` suffix onto a partially-localized string.
- 3b1a404: `lr-app-rail-item`: add an `active` property that reflects `aria-current="page"` onto the
  internal link/button, mirroring `lr-conversation-item`'s existing `active` pattern.
- 3b7a98b: `lr-attachment-chip`: fix the uploading progressbar/spinner's `aria-label` to actually use
  `uploadingLabel` (previously hardcoded, unlike the adjacent visible status text); add an
  `untitledLabel` override for the empty-name fallback; add a `compact` density variant.
- 49be9e4: `lr-attachment-trigger`: add a `triggerTitle` property forwarded to the internal trigger
  button(s)' native `title` (a sighted-mouse-user hover tooltip, distinct from `triggerLabel`'s
  `aria-label` role); reduce the internal `.trigger-button:hover` rule's specificity via `:where()`
  so a consumer's `::part(trigger):hover` override wins without needing `!important`.
- 4d04843: `lr-code-block`: add a `languagesOnly` opt-in that skips the default `loadShikiHighlighter()`
  call entirely, so a consumer whose `languages` map already covers every language it renders has no
  bundler-reachable path to shiki's full per-language dynamic-import table.
- 2968d7b: Add `lr-copy-button`: a standalone icon-only copy-to-clipboard button for a plain text `value`,
  with no positioning opinion of its own — for a consumer needing just the copy/checkmark-swap
  affordance without adopting `lr-code-block`'s or `lr-json-viewer`'s full content model.
- 49be9e4: `lr-dialog`: add `noLightDismiss` to opt out of backdrop-click dismissal, and make `close()`
  actually respect a `lr-dialog-close` listener's `preventDefault()` (the event is now genuinely
  `cancelable: true`) for every dismissal path — Escape, backdrop, the built-in close button, and a
  consumer's own `close()` call.
- 6958595: `lr-heatmap`: add a `cellInteractive` predicate to opt individual cells out of hit-testing and
  keyboard roving focus, and a `colorSteps` discrete-array ramp as an alternative to the 2-endpoint
  `--lr-heatmap-scale-lo`/`-hi` linear interpolation (governs both `mode`s and both `scale`
  values). Also adds test coverage confirming `firstDayOfWeek`'s calendar-mode weekday-axis labels
  are correct for a non-Sunday-first week (the underlying computation was already correct; only the
  test combining the two was missing).
- 2c6fc82: `lr-lite-chart`: add a `minBarHeight`/`min-bar-height` pixel floor for near-zero stacked
  segments, fix `scale="sqrt"` proportionality for stacked bars (previously compressed each
  segment's absolute cumulative stack position independently instead of the bar's total height
  split linearly by segment share), and add a `chartLabel`/`chart-label` override for the chart's
  auto-derived `aria-label`.
- e29b2f9: `lr-markdown`: add `part="paragraph"`, `part="list"` (both `<ul>` and `<ol>`), and
  `part="inline-code"` (bare inline codespans only, not a fenced code block's `<code>`, which
  already has its own `part="code-block"` wrapper) so a consumer's `::part()` CSS can reach plain
  text elements that previously had no themeable hook.
- 3b7a98b: `lr-split`: add a `dividerLabel` function property overriding the auto-inserted divider's
  hardcoded English `aria-label` template.

## 2.1.0

### Minor Changes

- 82a3419: `<lr-attachment-chip>`: added four label-override properties for i18n/locale — `removeLabel`/`retryLabel` (`remove-label`/`retry-label` attributes, the verb prefixed to the remove/retry buttons' `aria-label` ahead of the interpolated filename) and `uploadingLabel`/`uploadFailedLabel` (`uploading-label`/`upload-failed-label` attributes, the verb/phrase used in the visible uploading/error status text, keeping the live percentage interpolation intact for `uploadingLabel`). All four default to today's exact hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload failed'`), so leaving them unset changes nothing for existing consumers.
- 82a3419: `<lr-attachment-trigger>`: added a `triggerLabel` property (`trigger-label` attribute) that overrides the single-capability trigger button's `aria-label`, which previously came unconditionally from the built-in `CAPABILITY_META` table (e.g. `'Attach files'`, `'Attach an image'`, `'Use camera'`). Lets a host localize the accessible name without forking the component. Unset (the default) preserves today's exact `CAPABILITY_META`-derived label for every capability.
- 82a3419: Add `<lr-code-block>` `languages`, a map of language id to an already-imported shiki grammar module (e.g. `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key in `languages`, highlighting for it is seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()` highlighter (`code-loader.ts`'s new `loadShikiHighlighterCore()`), bypassing the default `loadShikiHighlighter()` singleton and its dynamic per-language `loadLanguage()` import entirely for that language — no loading skeleton either, since this path never waits on that singleton. shiki's main entry point (what the default path imports) bundles a dynamic `import()` per bundled language (~200 of them), since a bundler can't statically narrow which of those a `loadLanguage(lang: string)` call might request at runtime; `shiki/core`'s fine-grained API has no such table, so a consumer who pins its full, known language set this way gets a build output scoped to just those languages instead of shiki's entire bundled set. A `language` value absent from `languages` (or left unset, or when `languages` itself is unset) still falls back to the ordinary dynamic-import path unchanged — this is a partial, additive opt-in, not a replacement for it.
- 82a3419: Fixed 'confirm()''s own usage example to import from the granular subpath
  ('@aceshooting/lyra-ui/components/dialog/confirm.js') instead of the root barrel
  ('@aceshooting/lyra-ui') — following the root-barrel example as written previously pulled in the
  library's entire ~80-component side-effect-import chain into a consumer's eager bundle
  (confirmed via a real build: +79 KB gzip regression, fixed by switching to the subpath import).
  No code changed, documentation only.
- 82a3419: Add `heading`/`closable` convenience chrome and a `--lr-dialog-max-width` token to `<lr-dialog>`. `<lr-dialog>` previously required a consumer to hand-build any visible title bar (by slotting a real heading element) and any close affordance (via a footer button wired to `close()`) — `heading` now renders a visible header row with that text when no heading element is slotted (still deferring to a slotted heading, unchanged, when present), and `closable` renders a built-in close (X) button in that same header row, wired through the exact same `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`. `[part="panel"]`'s previously-hardcoded `max-inline-size: min(32rem, 100%)` is now `min(var(--lr-dialog-max-width, 32rem), 100%)`, mirroring `<lr-media-card>`'s `--lr-media-card-max-height` — the default stays exactly `32rem` when unset. All three are additive/opt-in; existing consumers see no behavior change.
- 82a3419: `<lr-heatmap>`'s calendar mode gained four additive extensions. `firstDayOfWeek` (0-6, Sunday-first default, same numbering as `CalendarCellPos.weekday`) anchors the week grid at a different weekday instead of always Sunday, threaded into `buildCalendarGrid()`'s new `firstDayOfWeek` parameter; matrix mode ignores it. `rowY` overrides the y-origin computed for each weekday row, the vertical analogue of the existing `columnX`, consulted consistently by drawing, hit-testing, and the keyboard focus ring via a new private `rowYFor()` helper mirroring `columnXFor()`'s exact dispatch-with-computed-fallback shape. The previously matrix-mode-only `cellSize`/`fitToWidth` properties now also size calendar mode's grid, replacing its hardcoded 11px cell constant when explicitly set (unset, calendar mode keeps that original 11px default). The previously matrix-mode-only `scale` property now also governs calendar mode's bucketing: `scale="sqrt"` compresses via the same square-root magnitude compression matrix mode uses instead of always calling `quartileBucket()`, so one heavy day doesn't wash out a skewed dataset; the default `"linear"` preserves today's exact quartile-only calendar behavior. All four are opt-in and no-ops when left unset/default.
- 82a3419: `<lr-lite-chart>` gained seven additive properties. `pointText` overrides the per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors `lr-heatmap`'s `cellText` hook), falling back to today's exact raw-value template when unset. `roundedBars` draws bars as a rounded-top-corner path instead of a square-cornered rect (default `false` keeps the plain rect). `skipZero` omits a bar entirely — no mark, no `tabindex`, no tooltip — for a value that is exactly `0`, instead of today's zero-height-but-focusable bar (default `false` unchanged). `padLeft`/`barGapRatio` override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants (36px / 0.2 respectively) when set. `scale` (`'linear' | 'sqrt'`, `type="bar"` only) switches the bar-height mapping from the default linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)` compression mirroring `lr-heatmap`'s matrix-mode `sqrt` scale, so a skewed dataset's smaller bars aren't washed out by one dominant value; `type="line"` ignores `scale` entirely. `hideAxis` suppresses `renderGrid()`'s gridlines and y-axis tick labels altogether (x-axis category labels are unaffected). All seven are opt-in and no-ops when left unset/`false`.
- 82a3419: `<lr-markdown>` gains four additive properties. Every rendered `<img>` now carries a `part="img"` (with a matching `[part='img'] { max-width: 100% }` base style), alongside the existing `content`/`heading`/`code-block`/`link`/`table`/`blockquote` parts — previously images went through marked's default renderer with no styling hook at all. `heading-offset` (default `0`) shifts every rendered heading's depth before emitting `<h${depth}>`, clamped to `<h1>`–`<h6>`, letting a consumer nest rendered markdown under an existing heading level without losing document outline. `link-target` (default `'_blank'`, unchanged) can now be set to `null`/`''` to omit `target`/`rel="noopener noreferrer"` entirely and open links in the same tab, instead of always forcing a new tab. `eager-load` (default `false`) skips `connectedCallback()`'s async `marked`/`dompurify` `import()` and renders synchronously whenever the shared module cache (`markdown-loader.ts`) is already warm — e.g. a second `<lr-markdown>` on the same page, or a consumer that primes `loadMarkdownDeps()` at startup — avoiding the brief plain-text fallback paint that otherwise happens on every connect, even when both peers load without error. All four are opt-in; unset, output is byte-identical to before.
- 82a3419: `<lr-menu-item>` gained a `type` property (`'normal' | 'checkbox'`, default `'normal'`) and a `checked` boolean, mirroring `wa-dropdown-item`'s identical `type="checkbox"` pattern for building things like a "Word wrap" or "Show minimap" toggle inside a `<lr-menu>`. A `type="checkbox"` item renders `role="menuitemcheckbox"` (instead of `role="menuitem"`) with `aria-checked` reflecting `checked` and a checkmark glyph shown once checked; activating it (click, or Enter/Space via a parent `<lr-menu>`'s roving-focus handling) toggles `checked` and fires a new `lr-menu-item-change` event (`detail: { value, checked }`) in addition to — not instead of — the existing `lr-menu-item-select`, so a parent menu still closes and re-fires its consolidated `lr-menu-select` exactly as before. `type="normal"` (the default, and every existing `<lr-menu-item>` in the wild) is completely unaffected: same role, same rendering, same events as prior releases.
- 82a3419: `<lr-model-select>`: added a `label` property that renders a visible `part="form-control-label"` title above the trigger/combobox, paired with it via `for`/`id`, mirroring `<lr-select>`'s own `label` exactly. Once non-empty it also takes over as the accessible-name source, with an explicit host `aria-label` still winning over it (same precedence as `lr-select`). Unset (the default), the control keeps today's exact `aria-label || placeholder || 'Model'` fallback chain unchanged.
- 82a3419: `<lr-select>`'s single-enabled-option auto-commit trigger (added 1.3.0) is now gated behind a new `autoCommitSingleOption` property, default `false`. Previously this behavior was unconditional as soon as exactly one `<lr-option>` was enabled, silently swapping the trigger's ARIA role and keyboard model on any consumer whose option list happened to narrow to one entry at runtime. Existing consumers now get the pre-1.3.0 combobox trigger unless they explicitly opt in with `auto-commit-single-option`.
- 82a3419: `<lr-split>`'s `collapseState` is now a public accessor with force/auto semantics mirroring `<lr-app-rail>`'s `mode`: it was previously derived only from the `ResizeObserver`-measured container width, but assigning a concrete `'wide'`/`'rail'`/`'floating'` value now pins it there (ignoring further measurement) until released back to automatic tracking by assigning the write-only `'auto'` sentinel, which immediately re-derives it from the current width. `lr-split-collapse-change` fires on both a forced assignment and a release-to-auto, exactly as it already did for a breakpoint crossing, and only when the effective state actually changes. The `'floating'` tier also gains a new `open` property (default `false`): previously this state always rendered its pane as an always-visible overlay card the moment the container narrowed past `float-breakpoint`; it's now a hidden-by-default drawer — the pane renders nothing (hidden, out of the accessibility tree) until a consumer sets `open`, at which point it renders with a `[part="backdrop"]` scrim, traps focus, and closes (`open = false`) on Escape or a backdrop click, mirroring `<lr-app-rail>`'s mobile overlay. `collapseState` still reflects to a `collapse-state` attribute for CSS targeting. `open` defaulting to `false` is a deliberate behavior change for the `'floating'` tier specifically (it was previously always visible); every other collapse behavior, and `collapse="none"` (the default), is unaffected.
- 82a3419: `<lr-tabs>` can now render a leading icon inside a generated tab button without changing its accessible name. Give a panel's tab an extra direct-child sibling of `<lr-tabs>` carrying `slot="<id>-icon"` (any markup — an inline SVG, an emoji span, a custom icon element) and it renders ahead of the label inside that tab's button, wrapped in a new `part="tab-icon"` `aria-hidden="true"` span so it's always excluded from the button's accessible name (which stays exactly the `label` attribute's text, as before). A tab with no matching `<id>-icon` sibling renders no icon wrapper at all, so every existing text-only `<lr-tabs>` is byte-for-byte unaffected. A named slot (rather than an `icon="<name>"` attribute keyed into this library's internal `icons.ts`) was chosen because that internal set is a small closed vocabulary of chrome glyphs for this library's own components, not a public icon registry — a slot lets a consumer supply an arbitrary, domain-specific icon instead.

## 2.0.0

### Major Changes

- 8b5f729: **Breaking:** the root `@aceshooting/lyra-ui` entry point no longer re-exports or
  side-effect-registers the optional-peer-dependent component families — `<lr-chart>`
  and its typed subclasses, `<lr-box-plot>`, `<lr-histogram>`, `<lr-map>`, and
  `<lr-graph>`. Import each of these directly from its own subpath instead (the README
  already recommends granular subpath imports as the primary pattern):

  ```js
  import "@aceshooting/lyra-ui/components/chart/chart.js";
  import "@aceshooting/lyra-ui/components/map/map.js";
  ```

  Why: the root barrel previously re-exported every component's public API from one
  `lyra.ts` file, so TypeScript had to resolve `chart.js`/`maplibre-gl`/`d3-force`'s type
  declarations even for a consumer who only imports an unrelated component (e.g.
  `LyraEmpty`) from the package root — a hard compile error for anyone who hadn't
  installed every optional peer. Splitting these families out of the root barrel means
  importing `@aceshooting/lyra-ui` (or any of its remaining members) never requires an
  optional peer's types to be resolvable.

  Every other component (including `<lr-lite-chart>`, which has zero peer
  dependencies) is unaffected — the root barrel still re-exports/registers everything
  else exactly as before.

### Minor Changes

- 144ad8f: Add a `compact` flag tier and expose three fidelity tiers via `variant`.

  `@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
  `flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
  original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
  code-split per flag _and_ per tier so a bundled app ships only the tiers it actually uses. The
  `standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
  (no fidelity loss perceptible at card/row scale).

  `@aceshooting/lyra-ui`: `<lr-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

- 2a7390d: Fix `lr-heatmap` calendar mode's month/weekday axis labels to follow the runtime locale instead of hardcoded English, and add a `columnX` override so a calendar's week columns can be pixel-aligned with an external coordinate function.
- 43864d6: Add `lr-lite-chart` `layout="scroll"` (fixed-width, horizontally-scrollable bars via `barWidth`), `maxLabels` axis-label decimation, and a `barX` coordinate override for pixel-aligning bars with a sibling `lr-heatmap`.
- 043b7b0: Move `LyraSelectSize` above `<lr-select>`'s class JSDoc block so `custom-elements.json` correctly documents `lr-select` as a custom element.
- 7bbe3d2: Add `lr-split` opt-in responsive collapse (`collapse="start"|"end"`, `rail-width`, `rail-breakpoint`, `float-breakpoint`): below `rail-breakpoint` the chosen pane clamps to a fixed rail width, below `float-breakpoint` it becomes an absolutely-positioned floating overlay, both signaled via a `data-collapse-state` attribute/dataset marker and the new `lr-split-collapse-change` event.
- f14165f: `<lr-stat>` breakdown rows (`StatRow`) gain an optional `exactValue` field, mirroring the headline value's tooltip: setting it renders a `title` tooltip and makes that row's `[part='row-value']` keyboard-focusable, independently per row.
- d62725d: `lr-table`'s `[part='reveal-columns-button']` now renders only when a `priority` column is actually hidden by the `@container` breakpoints (or `showAllColumns` force-visible mode is active), instead of whenever any column merely declares a `priority`; the new `columnsHidden` reactive property and `lr-columns-hidden-change` event expose the same real-time state to consumers.

### Patch Changes

- Updated dependencies [144ad8f]
  - @aceshooting/lyra-flags@1.3.0

## 1.3.0

### Minor Changes

- 6358479: Added a "Conversation & Agent UI" family: chat/tool-call/agent-config building blocks for
  streaming AI interfaces, plus the general-purpose primitives (dialog, tabs, checkbox, switch,
  menu, chip, JSON viewer, live region, markdown, code block) they're built from. No breaking
  changes to any existing component.

  New tags: `lr-dialog`/`confirm()`, `lr-tabs`, `lr-checkbox`, `lr-switch`,
  `lr-json-viewer`, `lr-live-region` (+ `internal/announcer.ts`'s throttled `Announcer`),
  `lr-markdown` (needs the optional peers `marked`/`dompurify`), `lr-chat-message`,
  `lr-typing-indicator`, `lr-tool-call-chip`, `lr-tool-result-view` (+ its
  `registerToolRenderer()` renderer registry), `lr-tool-result-dialog`, `lr-chat-composer`
  (form-associated), `lr-attachment-chip`, `lr-stream-status`, `lr-virtual-list`,
  `lr-conversation-item`, `lr-model-select`, `lr-slider` (form-associated),
  `lr-tool-select-dialog`, `lr-citation-badge`, `lr-source-list`/`lr-source-card`,
  `lr-app-rail`, `lr-responsive-panel`, `lr-mention-popover`, `lr-streaming-text`,
  `lr-thinking-panel`, `lr-generation-status`, `lr-code-block` (needs the optional peer
  `shiki`), `lr-tool-approval-dialog`, `lr-tool-param-form`, `lr-menu`/`lr-menu-item`,
  `lr-chip`/`lr-chip-group`, `lr-model-settings-panel`, `lr-context-meter`,
  `lr-dock-panel`, `lr-document-preview`, `lr-media-card`, `lr-attachment-trigger`,
  `lr-kbd`, `lr-result-card`/`lr-result-field`.

  Also extends `internal/rtl.ts` with `rtlAwareSide()`/`rtlAwarePlacement()` (mirrors a physical
  `left`/`right` value, or the `left`/`right` component of a Floating UI `Placement`, under RTL) —
  used by `lr-menu`'s `placement` property so an explicit `placement="left-start"` still anchors
  to the trailing edge instead of the physical left when the page is RTL.

- 6358479: `<lr-select>`: when exactly one `<lr-option>` is enabled, the trigger now auto-commits that
  option on click or Arrow Up/Down instead of opening a single-row listbox — no chevron, no popup,
  `role="button"` instead of `role="combobox"`. Avoids an unnecessary extra click for "only one
  choice available" states (e.g. a filtered picker that's converged to a single match). Multi-option
  selects are unaffected; `value`/validity defaults are unchanged. Not gated behind a new prop — this
  is the new default trigger behavior for any select with a single enabled option.

## 1.2.0

### Minor Changes

- 6e832d5: `<lr-chart>`: added `IntersectionObserver`-gated lazy redraw and content-signature memoization — a
  chart skips calling into Chart.js while scrolled off-screen (redrawing once when it re-enters the
  viewport) or when none of its content-affecting properties (`type`, `labels`, `datasets`, `legend`,
  `area`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`) have actually
  changed since the last draw. `refreshTheme()` is unaffected and always redraws.
- 9d36af5: `<lr-combobox>`: the input's accessible name now checks a host-level `aria-label` attribute before
  falling back to `label`/`placeholder`/`"Combobox"` — previously a plain `aria-label` on
  `<lr-combobox>` was silently ignored. Matches the same fix in `<lr-select>`.
- 0b3ea6c: `<lr-flag>`: added a `detailed` boolean property that requests the pristine, full-detail source SVG
  for the minority of flags whose default rendering was recently optimized for icon scale (e.g. `es`,
  `pt`, `sv` — see the `@aceshooting/lyra-flags` changeset). A safe no-op for every other flag. Useful
  for a flag rendered larger than icon scale (e.g. a hero display) where the extra illustrative detail
  is actually visible.
- 2027e3f: `<lr-flag>`: the default accessible name (`alt`, used when `label` is unset) is now a human-readable
  region name via `Intl.DisplayNames` (e.g. `language="en"` → `"United Kingdom"`) instead of the bare
  uppercase country code (`"GB"`, previously read letter-by-letter by most screen readers).
- 49569ed: `<lr-heatmap>`: fixed `role="img"` conflicting with the canvas's own focusable, keyboard-interactive
  descendant (arrow-key roving focus, Enter/Space activation) — now `role="group"`, matching
  `lr-lite-chart`/`lr-word-cloud`'s existing pattern. Added `cellText?: (pos, value) => string`, a
  formatter hook for the per-cell hover tooltip and keyboard live-region announcement (both draw from the
  built-in English template by default; this is additive, not breaking). Also fixed calendar mode's date
  label formatting, which hardcoded the literal `'en'` locale instead of the runtime locale.
- ef74f4a: `<lr-lite-chart>`: added `tickFormat?: (value: number) => string` to customize y-axis tick label
  formatting (e.g. currency, duration) instead of the built-in nice-number formatter. Also added
  `IntersectionObserver`-gated lazy rendering and content-signature memoization — a chart skips
  recomputing its grid/marks while scrolled off-screen or when none of its content-affecting properties
  (`type`, `labels`, `datasets`, `legend`, `xLabel`, `yLabel`, `beginAtZero`, `stacked`, plot size) have
  actually changed since the last render.
- 22cf001: `<lr-select>`: added a `size` property (`xs`/`s`/`m`/`l`/`xl`, default `m`, same scale as
  `lr-toast-item`'s `size`) for compact toolbar placements that don't fit the default trigger height.
  Also, the trigger's accessible name now checks a host-level `aria-label` attribute before falling back
  to `label`/`placeholder`/`"Select"` — previously a plain `aria-label` on `<lr-select>` was silently
  ignored.
- 4bf80aa: `<lr-stat>`: added `exact-value` (shown as a hover/focus tooltip on the headline value, e.g.
  `value="$1.2K" exact-value="$1,204.37"`), a `sub` property/slot (a secondary line distinct from
  `caption`, e.g. a comparison-period label), a `prose` boolean (renders `value` as smaller/lighter text
  with `unit` hidden, for a loading/status message in place of a numeric value), and a `compact` boolean
  (tighter padding for constrained spaces — same convention as `lr-empty`'s and `lr-widget`'s
  `compact`).
- c8206f8: `<lr-widget>`: added `fullscreen-inset` (a raw CSS `inset` shorthand, e.g. `"0 0 0 240px"`, applied to
  the fullscreen panel and backdrop instead of the default `var(--lr-space-l)` on every side — for apps
  with a persistent sidebar/toolbar that should stay visible during fullscreen) and a `compact` boolean
  (tighter header/body padding), matching `lr-empty`'s existing `compact` convention.
- a768a20: `<lr-word-cloud>`: fixed the rendered `<svg>` not respecting a host-assigned height —
  `[part='base']` had no `block-size` rule, so the internal `svg { block-size: 100% }` resolved against
  an indefinite containing-block height and fell back to the spiral layout's own intrinsic size instead,
  overflowing past the host's box. `[part='base']` now constrains to `block-size: 100%`, matching the
  component's own documented `<lr-word-cloud style="height: 20rem">` usage pattern.

### Patch Changes

- Updated dependencies [da766cb]
  - @aceshooting/lyra-flags@1.2.0

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lr-flag
country=...>`/`<lr-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lr-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

- c033ec0: Added `<lr-lite-chart>` — a dependency-free bar/line chart (plain SVG/DOM rendering, zero peer
  dependencies) for projects whose architecture forbids a charting dependency outright. Covers
  grouped/stacked bars, multi-series lines, per-point click (`lr-point-click`, same detail shape as
  `lr-chart`'s), and hover tooltips via native SVG `<title>`. Not a full `lr-chart` replacement —
  no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
  passthrough. Reuses `lr-chart`'s `--lr-chart-*` theme token names for free cross-component
  theming.
- c033ec0: Added `<lr-word-cloud>` — a dependency-free SVG word/tag cloud, laid out via an outward
  Archimedean-spiral placement search (heaviest word first). Supports `linear`/`sqrt` weight-to-font
  scaling, optional `mixed` (rotated) orientation, per-word or per-`group` coloring with a themeable
  `--lr-word-cloud-color-1..8` palette, and roving-tabindex keyboard navigation matching
  `lr-heatmap`'s pattern (a single tab stop, arrow keys, Home/End, a live-region announcement).

  Also a hardening pass across the rest of the library — real bugs fixed, not just polish:

  - `lr-skeleton`: `width`/`height` properties had zero visual effect (the custom property was set
    on the wrong shadow-DOM node); now actually resizes the placeholder.
  - `lr-combobox`: setting `open` directly (bypassing `show()`) never wired up click-outside or
    fired `lr-show`/`lr-hide`; picking a row or clearing while using `source` left stale async
    results displayed; a `<lr-option selected>` appended after the first slotchange was ignored;
    two nameless `multiple` comboboxes in the same form merged their submitted values; a pending
    debounced `source` fetch could fire after the element was removed.
  - `lr-chart`: bubble-chart series got a categorical (not numeric) x-axis, collapsing every point
    onto one tick; `resetZoom()` double-emitted `lr-zoom`, briefly reporting the stale pre-reset
    `zoomed` state to `{ once: true }` listeners.
  - `lr-date-picker` / `lr-date-input`: the already-exported `clampDate()` was never actually
    wired in, so `goToDate()`/`goToToday()` could navigate to (and focus) an out-of-range date;
    locale/weekday-format/first-day-of-week wiring gained test coverage; outside-month placeholder
    cells are now `aria-hidden` only in rows that also have a real visible day.
  - `lr-tree`: mouse-driven expand/collapse/select could desync the roving-tabindex `activeId` from
    real DOM focus; arrow-key expand/collapse is now RTL-aware, matching `lr-split`/`lr-time-range`.
  - `lr-widget`: the fullscreen focus trap didn't pierce into a slotted custom element's own shadow
    root, letting focus escape to a hidden nested control.
  - `lr-toast-item`: the close button used the native `disabled` attribute, which force-blurs a
    focused element with nothing to restore it — switched to `aria-disabled`.
  - `lr-empty`: gained a live-region announcement when entering the empty state, matching
    `lr-skeleton`'s existing `role="status"` convention.
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
- `@aceshooting/lyra-flags` optional companion package for `<lr-flag>` artwork.

[Unreleased]: https://github.com/aceshooting/lyra-ui/compare/0.1.3...HEAD
[0.1.3]: https://github.com/aceshooting/lyra-ui/releases/tag/0.1.3
