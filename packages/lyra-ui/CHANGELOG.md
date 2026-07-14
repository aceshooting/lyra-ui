# Changelog

## 2.6.0

### Minor Changes

- 78d4b58: `lyra-chat-message` gains an `attachments-position` prop (`'before' | 'after'`, default `'after'`) so the `attachments` slot can render above the message body instead of below it, keeping DOM/visual/reading order in sync.
- a072af9: `lyra-chip` gains a `--lyra-chip-pressed-border` custom property so a consumer can set the pressed/selected border color independent of `--lyra-chip-accent` (which also drives the label text color). Falls back to `--lyra-chip-accent`, so existing consumers are unaffected.
- b56bdb2: `lyra-empty` gains a `--lyra-empty-compact-padding` custom property to override `compact`'s fixed uniform padding (e.g. with an asymmetric shorthand like `8px 2px`). Falls back to `var(--lyra-space-xs)`, today's exact value.
- e029ac2: `lyra-heatmap` calendar mode gains a `weekdayLabelText?: (jsWeekday: number) => string | undefined` hook to override the weekday-axis label text (e.g. for a consumer with its own locale/translation state independent of the browser's runtime locale).
- 6d5f9c4: Add `lyra-textarea`, a bare multiline plain-text input primitive (value/rows/resize/placeholder, form-associated validation) — the `lyra-*` equivalent of a plain `wa-textarea`.
- bbe8007: `lyra-segmented`'s `SegmentedItem` gains an optional `icon` field, rendered before the item's label.
- e98013a: `lyra-table`'s `TableColumn` gains a `headerCell` render hook (mirroring `cell`/`footer`) and `width`/`minWidth` fields. Any column defining `width` switches the table to `table-layout: fixed` so widths are authoritative.
- 993809a: `lyra-widget` gains a `backdrop-inset` prop to decouple the fullscreen backdrop's inset from the panel's own `fullscreen-inset`. Falls back to `fullscreen-inset`, so existing consumers are unaffected.

### Patch Changes

- 1c78bd2: Fix `lyra-poll-status`, `lyra-typing-indicator`, and `lyra-stream-status`'s ambient "still alive" pulse/bounce animations, which reused `--lyra-transition-base` (180ms — reserved for discrete UI micro-interactions) and rendered as a fast flicker instead of a calm breathing loop. Adds a dedicated `--lyra-transition-ambient` token (1.8s) for infinite looping indicators.
- e029ac2: Fix `lyra-heatmap`'s `cellColor` hook silently rendering solid black when it returns a CSS custom property or other non-literal color (e.g. `color-mix(...)`) — the value is now resolved via a cached, hidden probe element before being assigned to the canvas `fillStyle`.
- 600544f: Fix `lyra-skeleton` rendering as an invisible 0×0 box everywhere: `[part='base']` was a bare `<span>` (UA default `display: inline`), so its own `inline-size`/`block-size` were CSS no-ops per spec. Adds `display: block`.

## 2.5.0

### Minor Changes

- 84cefde: `lyra-attachment-trigger`'s single-capability trigger `aria-label`s ("Attach files"/"Attach an
  image"/"Use camera"), its multi-capability menu's "Add attachment" label/aria-label, and its menu
  item labels ("Upload files"/"Upload a photo"/"Take a photo") now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- 6bf30ea: `lyra-avatar` now accepts default-slotted icon/glyph content (e.g. an inline SVG), shown in place of
  the image/initials and taking priority over both `src` and `initials` — useful for a chat UI
  distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set
  `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.
- 87890ea: `lyra-checkbox`'s built-in required-field validation message ("Please check this box if you want
  to continue.") now routes through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English output is unchanged when no override is set.
- b720eda: Fixed `lyra-chip`'s opt-in `selected` toggle/pressed mode so it stays interactive after the first
  click. `[part='base']`'s `role="button"`, `tabindex`, `aria-pressed`, and click/keydown handlers
  used to be gated on the _current_ value of `selected`, so a chip that started `selected` and was
  clicked (flipping it to `false`) lost its focusable/clickable semantics on the next render — there
  was no way to click it back on. `selected` becoming `true` at any point now latches the chip into
  toggle mode for good, so it stays clickable in both directions. A chip that must be interactive
  from the outset while starting **unselected** (e.g. an initially-inactive filter chip) can opt in
  explicitly with the new `toggleable` property, since `selected`'s own default (`false`) can't be
  told apart from "never opted in" on its own.
- cbfec47: `lyra-citation-badge`'s visible status words folded into its computed accessible name ("High
  confidence"/"Medium confidence"/"Low confidence"/"Verified"/"Unverified") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- dba57e9: `lyra-context-meter`'s accessible summary ("{used} of {total} used" / "{used} used") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 7379a41: `lyra-conversation-item`'s "Untitled conversation" fallback title now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- acdaa37: `lyra-dock-panel`'s resize-handle and collapse-toggle `aria-label`s ("Resize panel",
  "Collapse panel"/"Expand panel") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- eca2ea4: `lyra-document-preview`'s hardcoded English strings — the image-preview `alt` fallback
  ("Document preview"), the unsafe-URL error ("Document URL is not allowed."), the non-`Error`
  fetch-failure message ("Failed to load document."), and the empty-`error-message` fallback
  ("Something went wrong.") — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Its in-flight text-fetch spinner label ("Loading document…")
  is now also wired through the existing `loadingDocument` message key. Default English output is
  unchanged when no override is set.
- a3c4ebf: `lyra-export-button`'s trigger button text (default "Export", also reused for the format menu's
  `aria-label`) now routes through `this.localize()` when `label` is left at its built-in default,
  overridable via `.strings`/`registerLyraLocale()` — matching `lyra-attachment-chip`'s
  `removeLabel`/`retryLabel` convention. Setting the `label` attribute/property explicitly still
  overrides it directly. Default English output is unchanged when no override is set.
- df8341b: `lyra-generation-status`'s stop-button `aria-label` ("Stop generating") now routes through
  `this.localize()` (sharing the existing `stopGenerating` key used elsewhere in the library), and
  the tokens segment's singular/plural noun ("token"/"tokens") is now localizable too, matching
  `lyra-json-viewer`'s/`lyra-word-cloud`'s existing count-noun pattern. Overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 20ae3e7: `lyra-graph`'s visually-hidden data-list `aria-label` ("Graph data") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 8c29581: `lyra-segmented` gains a `label` property giving its `role="radiogroup"` root an accessible name.
  When unset, a plain `aria-label` attribute on the host element is honored as a fallback, matching
  `lyra-slider`'s existing `label`/`aria-label` convention. Previously the radiogroup had no way to
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
  - `lyra-avatar`: fixed a dangling `--lyra-color-surface-alt` token reference, corrected its `size`
    JSDoc, and extended the accessible-name role/`aria-label` to the initials-fallback path (not
    just the icon-slot path) whenever `alt` is set.
  - `lyra-export-button` now fires `lyra-show`/`lyra-hide` on its format menu, matching the same
    convention already used by `lyra-menu`/`lyra-select`/`lyra-combobox`.
  - Fixed a `this.localize(key, literalFallback)` pattern that unconditionally short-circuited
    `registerLyraLocale()` lookups for the affected keys (the fallback is now omitted wherever
    `DEFAULT_STRINGS` already carries the same default).

  AGENTS.md gained a new "Internationalization (i18n), RTL, and theming" section documenting the
  resulting standard, and both READMEs now summarize it for consumers.

- 79e4390: Fixed gaps found during a full re-verification pass over previously-completed work:

  - `lyra-menu`'s type-ahead navigation now excludes `hidden`/`aria-hidden` items (it already
    excluded `disabled` ones), matching the Arrow/Home/End roving-focus navigation it sits next to.
  - The root barrel (`src/lyra.ts`) now re-exports 13 component event-map types that were previously
    unreachable from the package root even though their owning classes were exported: `LyraChip`,
    `LyraChipGroup`, `LyraCitationBadge`, `LyraCopyButton`, `LyraDiffView`, `LyraFileInput`,
    `LyraHeatmap`, `LyraLiteChart`, `LyraMediaCard`, `LyraSelect`, `LyraSourceCard`, `LyraSplit`, and
    `LyraTimeRange`'s `*EventMap` types are now all importable from `@aceshooting/lyra-ui`.

- 59d4477: `lyra-media-card`'s hardcoded English fallback strings — the file-chip "Untitled file" name, the
  `image`/`video` alt-text fallbacks ("Image attachment"/"Video attachment"), and the accessible
  "Open …" label (both the named and generic-kind forms) — now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- ea774a8: `lyra-mention-popover`'s default listbox accessible name ("Suggestions") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()` — matching the already-shared
  `noMatches` key its empty-state row uses. An explicit `label`/`empty-text` value still wins
  verbatim. Default English output is unchanged when no override is set.
- cd10606: `<lyra-menu>` gains an opt-in `closeOnEscapeAnywhere` property. Escape has always closed the menu
  and refocused the trigger when it originates from a real `<lyra-menu-item>`, but slotted non-item
  content (e.g. a form control slotted alongside the items) previously got full default keyboard
  behavior with no way to close the menu on Escape. Setting `closeOnEscapeAnywhere` extends that
  same Escape-closes-and-refocuses behavior to keydowns from anywhere in the list, including slotted
  non-item content. Defaults to `false`, so existing consumers are unaffected.
- 7d63af9: `lyra-menu`'s `role="menu"` popup default accessible name ("Menu") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. An explicit `label` value
  still wins verbatim. Default English output is unchanged when no override is set.
- f232381: `lyra-model-settings-panel`'s hardcoded English strings — the visible "Temperature" caption
  (also reused as the nested `lyra-slider`'s accessible name) and the internal `lyra-model-select`'s
  "Select a model…" placeholder — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 1686322: `lyra-playback`'s play/pause button and position-slider `aria-label`s ("Play"/"Pause",
  "Playback position") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 0cacb4d: `lyra-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
  three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. It also now shows a distinct
  "Paused" countdown state while `paused`, instead of freezing on whatever value it last displayed.
  Default English output is unchanged when no override is set.
- 870523f: `lyra-widget` gains two new named slots, `collapse-icon` and `fullscreen-icon`, overriding the
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

- aeef118: `lyra-select`'s required-field validation message ("Please select an option.") and its
  trigger's fallback accessible name ("Select", used only when no `aria-label`, `label`, or
  `placeholder` is set) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 4fb27a2: `lyra-skeleton`'s default accessible name ("Loading…") now routes through `this.localize()`
  (reusing the shared `loading` key), overridable via `.strings`/`registerLyraLocale()`. An
  explicit `label` still wins verbatim. Default English output is unchanged when no override is set.
- f7b9f0e: `lyra-source-list`'s fallback header text ("Sources", used only when neither `label` nor
  `label-plural` is set) now routes through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- f2ea145: `lyra-stepper`'s `StepItem` gains an optional `title` field, rendered as a native `title` tooltip on
  that step's button — useful for explaining why a `disabled` step is locked (e.g. "Complete Basics
  first"). Steps that omit it render no `title` attribute at all, unchanged from today.
- 9e5864a: `lyra-stream-status`'s built-in stalled-message default ("Taking longer than usual…") and its
  three live-region announcements ("Connection stalled."/"Connection restored."/"No longer
  stalled.") now route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`.
  Default English output is unchanged when no override is set.
- 9174500: `lyra-switch`'s built-in required-field validation message ("Please turn this on.") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 60084ba: `lyra-thinking-panel`'s default header label ("Thinking") and its duration-display text ("Thought
  for …"/"Thinking…") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. An explicit `label` still wins verbatim. Default English
  output is unchanged when no override is set.
- b113bda: `lyra-tool-approval-dialog`'s heading text, generic tool-name fallback, args-editor accessible
  name, invalid-JSON fallback error, and its Deny/Edit/Approve button labels now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 3b1f930: `lyra-tool-call-chip`'s visible status labels (Pending/Running/Success/Error/Denied, shared with
  `lyra-tool-result-dialog`'s identical vocabulary) and its unnamed-tool fallback ("Tool call") now
  route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- bbaea80: `lyra-tool-param-form`'s validation messages (required field, wrong type for a string/number/
  integer/boolean, enum mismatch, const mismatch, unsupported field type, malformed schema shape,
  non-serializable value) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- bda19ac: `lyra-tool-select-dialog`'s dialog title, search placeholder, "use default tools" switch label
  and hint, category count/"Other" fallback, tools-enabled summary, no-matches message, and the
  no-tools-available empty state now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 220bd73: `lyra-widget`'s collapse/expand, exit-fullscreen/expand-to-fullscreen, and view-toggle-group
  aria-labels, plus its fullscreen dialog's fallback accessible name, now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. The collapse/expand labels
  reuse `lyra-dock-panel`'s existing `dockPanelCollapse`/`dockPanelExpand` keys. Default English
  output is unchanged when no override is set.

### Patch Changes

- 00ce49f: Fix `lyra-date-picker`'s day-grid keyboard navigation to swap ArrowLeft/ArrowRight under `dir="rtl"`, matching the grid's own visual mirroring (the day cells use unset `direction`, so the browser already lays them out right-to-left). ArrowUp/ArrowDown (by week) are unaffected.
- 37e1a2f: `lyra-table`'s header-cell ArrowLeft/ArrowRight roving-tabindex navigation now derives its RTL
  check through the shared `isRtl()` helper instead of a duplicated inline `getComputedStyle`
  check, and gains test coverage confirming ArrowRight/ArrowLeft already swap correctly under
  `dir="rtl"` (a native `<table>` mirrors column visual order under RTL on its own) while
  ArrowUp/ArrowDown row navigation is unaffected. No behavior change.
- 2fd3786: Fix calendar-heatmap weekday-axis labels to respect firstDayOfWeek instead of always labeling grid rows 1/3/5.

## 2.4.0

### Minor Changes

- 171bdbd: `lyra-attachment-chip`'s file-size unit abbreviations ("B"/"KB"/"MB"/"GB"/"TB") now route through
  `this.localize()` when rendered, overridable via `.strings`/`registerLyraLocale()`. The exported
  `formatFileSize()` pure function gains an optional `unitLabel` resolver parameter, defaulting to the
  plain English abbreviation — every existing single-argument call is unaffected.
- 5f043ba: `lyra-chart`'s data-table "Category" column header, per-row "Point N" fallback label, and "Reset
  zoom" button text now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- 5e90140: `lyra-chat-composer`'s action button labels ("Send message"/"Stop generating") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Also adds `stoppable: boolean =
true` — when set to `false`, the button never renders as a Stop/cancel control while busy; it stays a
  disabled Send button instead, for backends with no cancellation endpoint. Default behavior is
  unchanged.
- 558e76c: `lyra-chat-message`'s visible status text ("Sending…"/"Responding…"/"Failed to send") and its two
  live-region status-change announcements ("Message failed to send."/"Message complete.") now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English text is
  unchanged.
- 238c8d7: `lyra-chip-group`'s collapsed overflow-indicator's visible "+N" text now routes through
  `this.localize('showMoreCollapsed', ...)`, matching the aria-label it sits beside, which was already
  localized. Default English output ("+N") is unchanged.
- 0d9018f: `lyra-code-block`'s collapse-toggle, copy-button, and code-region aria-labels now route entirely
  through `this.localize()` instead of concatenating a localized verb with a hardcoded English suffix
  ("code"/"to clipboard"/"Code"). Default English output is unchanged.
- a249bd6: `lyra-diff-view`'s copy-button aria-label now routes entirely through `this.localize('copyDiff', ...)`
  instead of concatenating the localized "copy" verb with a hardcoded " diff" suffix. Default English
  output ("Copy diff") is unchanged.
- 58c6e59: `lyra-file-input`'s drag-preview live-region announcements ("Release to add the file." / "This file
  type is not accepted.") now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged. The post-drop `acceptedMessage`/
  `rejectedMessage` properties and the visible `label` property are unaffected (already
  consumer-overridable).
- b3e3bb6: `lyra-json-viewer`'s root-node toggle/copy fallback words ("array"/"object"/"value", used only when a
  node has no key label) now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- b322e75: `lyra-model-select`'s synthetic stale-value row badge ("not in catalog") now routes through
  `this.localize('notInCatalog')`, so it can be overridden via `.strings`/`registerLyraLocale()` like
  the component's other built-in message (`noMatches`). Default English text is unchanged.
- e54eeee: `lyra-source-card`'s "Untitled source" fallback and its " — p. N" page-suffix format now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- 0576643: `lyra-split` now redistributes the track space freed when a `panelConstraints` pixel bound clamps a
  panel's percentage basis down (e.g. a `maxPx` cap on a wide viewport) to sibling panels that have no
  pixel constraint of their own, instead of leaving that space unused. No behavior change for splits
  without `panelConstraints`, or where no panel is actually clamped this render.
- 97756af: `lyra-table`'s `columns[].sticky` option now accepts `'start' | 'end'` in addition to the legacy
  `boolean` (`true` continues to mean `'start'`, unchanged). An `'end'`-sticky column pins to the
  inline-end edge instead — useful for a trailing actions column that would otherwise be pushed off
  a narrow viewport — via the same `inset-inline-*` logical-property approach, so RTL is unaffected.
- ffee803: `lyra-tool-result-dialog`'s tool-name fallback ("Tool call"), visible status label
  ("Pending"/"Running"/"Success"/"Error"/"Denied"), and maximize/restore button aria-label now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- f9f57f9: `lyra-word-cloud`'s default aria-label's pluralized "word"/"words" noun now routes through
  `this.localize()` too, so a registered translation of the `wordCloud` template's `{word}` slot is no
  longer stuck in English. Default output is unchanged.

## 2.3.0

### Minor Changes

- a1b2f8e: `lyra-app-rail` gains `dragging` (reflected boolean, true for the duration of a pointer-driven
  resize -- not a keyboard step -- so its own `[part='base']` transition suppresses during the drag
  instead of visibly "chasing" the pointer) and `hideToggle` (suppresses the built-in mobile hamburger
  button for a consumer that owns its own external toggle wired to `open`).
- e9075b8: `lyra-app-rail-item` gains an opt-in `tooltip` property: a hover/focus flyout showing the item's
  label text while `icon-only` hides it from view, using the library's existing Floating-UI-backed
  `place()` positioner -- an explicit, documented alternative to hand-rolling a `::part()`+`::after`
  tooltip composition.
- 8160548: `lyra-attachment-chip`'s `compact` variant now also shrinks font-size and gap (via new
  `--lyra-attachment-chip-compact-font-size`/`-compact-gap` custom properties), not just
  border/radius/padding/thumbnail-size. Also adds `thumbnailOnly`, which -- combined with `compact`
  on an image-mime chip -- hides the filename/size text entirely for a pure thumbnail density with
  no consumer-side CSS.
- 099fa8a: Add `lyra-avatar`: a small, fixed-size identity marker (image, or an initials fallback) for a
  user-menu trigger or similar identity affordance -- `size`/`shape`/`tone` variants mirror
  `lyra-chip`'s existing tone vocabulary for consistency.
- bf9d442: Add `lyra-card`: a generic bordered content container (`appearance` variants mirroring `wa-card`,
  `header`/`media`/`footer`/`actions` slots) for the "small bordered surface with padding" idiom
  common across hero highlights and clickable grid tiles -- a real `lyra-ui` parity counterpart to
  `wa-card`, which this library otherwise mirrors 1:1.
- f9ecffd: `lyra-chip` gains an opt-in `selected`/pressed interactive mode: `[part='base']` becomes
  keyboard-activatable and reflects `aria-pressed`, toggling on click/Enter/Space and emitting
  `lyra-chip-select`. Not combinable with `removable` (avoids a nested-interactive a11y violation);
  today's passive-label-pill usage is unaffected since `selected` defaults to `false`.
- db24359: Add `lyra-code-block-core`: a build-lean variant of `lyra-code-block` for a consumer whose
  `languages` map already covers every language it renders. Unlike `languagesOnly` (a runtime flag
  on `lyra-code-block` itself, which a bundler can't prove always-true and so can't tree-shake),
  `lyra-code-block-core` is a genuinely separate module that never references shiki's full
  ~200-language default entry point at all -- importing it instead of `code-block.js` gives a real
  compile-time exclusion of that table from the build output.
- 83ba36c: `lyra-dialog` gains `--lyra-dialog-width`, unset by default -- when set, the panel actually
  stretches to that width instead of only shrink-wrapping its content capped at
  `--lyra-dialog-max-width`, which was a real gotcha for anyone porting from `wa-dialog`'s
  assertive `--width` token.
- a1d7030: Add `lyra-diff-view`: a real two-string line diff (LCS-aligned), rendered as interleaved
  unified-diff output -- unlike diff-flavored syntax highlighting over an already-formatted string,
  this computes the alignment itself, so a one-line change inside a longer block renders as one
  red/green pair near the change instead of every old line then every new line.
- b56abda: `lyra-empty`'s `heading`/`description` gain the same slot-override-attribute treatment
  `lyra-stat`'s `caption`/`sub` already have -- a consumer can now pass rich mid-sentence content
  (e.g. an inline `<code>` reference) while the plain-string attribute stays the default.
- 4324a73: `lyra-graph` now renders a link whose `target` isn't a real node as a short dashed stub off the
  source's position, instead of silently dropping it -- for a wiki-style `[[link]]`/broken-reference
  visualization where "this edge exists but its endpoint doesn't" is a meaningful state, not noise.
  A dangling `source` is still dropped (no position to draw a stub from).
- 1e71d71: Rewrite `lyra-heatmap`'s two weekday-axis-label tests to assert against independently fixed dates
  instead of re-deriving the implementation's own formula, which could never fail regardless of
  correctness -- the underlying `weekdayLabels()`/`firstDayOfWeek` anchoring was already correct.
  Also add `cellColor`, an optional per-cell color override function (mirroring the existing
  `cellText`/`cellInteractive` shape) that bypasses the color ramp entirely for an exact value.
- 2e74ea0: Fix `lyra-lite-chart`'s `minBarHeight` z-order bug for stacked bars: a floored near-zero segment
  was being overdrawn by the segment stacked on top of it, since each segment's position was derived
  independently from cumulative value rather than from where the previous (possibly-floored) segment
  actually ended on screen. Also add `selectedIndex: number[]`, reflecting `data-selected` onto every
  bar at a given category index across all datasets, for highlighting a whole selected column.
- 00f3b37: `lyra-markdown` gains `escapeHtml`, an opt-in property overriding `marked`'s `html` renderer hook
  to emit escaped text instead of parsed/sanitized markup -- for a consumer rendering arbitrary
  already-written content (transcripts, logs) where a stray angle bracket should render as visible
  text rather than a real DOM element, without giving up GFM tables/lists/etc.
- d3fbf36: Add `lyra-poll-status`: a "next scheduled refresh" countdown with a built-in pause control -- a
  ticking M:SS display, a "Refreshing…" due state, and an internal live region announcing phase
  transitions, mirroring `lyra-stream-status`'s own composition for a different concern (a scheduled
  interval, not transport/connection health).
- b5464bd: Add `lyra-segmented`: a single-select button row with the WAI-ARIA APG `radiogroup` contract
  (role="radio", roving tabindex, automatic-activation Arrow/Home/End navigation) built in --
  "choose exactly one of N labeled options" is ubiquitous settings/filter-panel UI that otherwise
  gets hand-rolled without keyboard/ARIA semantics every time.
- 551f272: `lyra-select` gains `--lyra-select-trigger-height`, unset (auto) by default -- when a consumer sets
  it, the trigger resolves to exactly that height (both floor and cap) instead of only being
  floored by `--lyra-select-trigger-min-height`, for pixel-matching a sibling form field in the same
  row without a blunt `::part(trigger){block-size:...}` override.
- 1fddbdc: Add `lyra-stepper`: ordered multi-step wizard navigation (label + index, current/completed/
  locked/error state, click-to-jump, horizontal/vertical orientation). Fully data-driven and
  controlled -- like `lyra-table`, it never mutates its own `steps` data, firing a cancelable
  `lyra-step-select` event and leaving state updates to the host, so gating a jump behind an
  external validity check (e.g. "does the target step's data exist yet") is a normal listener, not a
  workaround.
- 60dbf18: `lyra-table` gains two per-column hooks: `footer(rows)`, rendered in a real sticky-bottom
  `<tfoot>` (only when at least one column defines it) -- e.g. a totals row; and `cellStyle(row)`,
  applied via `styleMap` directly to the generated `<td>` -- e.g. a computed heat-tint background --
  which coexists safely with the existing sticky-column offset styling.
- 6ce5b87: Add a new `./testing` subpath exporting `installHappyDomFormAssociatedShims()` -- an opt-in,
  environment-guarded polyfill for `HTMLElement.prototype.attachInternals`, for a downstream
  consumer's own Vitest+happy-dom test suite (happy-dom has no `ElementInternals` implementation,
  and every form-associated `lyra-*` component calls `attachInternals()` unconditionally in its
  constructor). Not used by this package's own tests, which already run against real browsers.
- 25254f2: `lyra-widget` gains a leading `icon` slot, rich `label`/`sublabel` slot overrides (mirroring
  `lyra-stat`'s `caption`/`sub` pattern), and a `views` property driving a built-in header toggle
  group plus one named slot per entry -- for a chart/table (or similar) toggle inside the same card
  chrome, so a consumer no longer has to hand-roll that shell around a bare default slot.

### Patch Changes

- 062f036: Fix `lyra-attachment-trigger`'s internal hidden `<input type="file">` actually rendering as a
  visible, focusable-adjacent element in normal document flow — it now has `display: none` by
  default (and a new `hidden-input` CSS part, for the rare integration that needs to override that).
- 9094b39: Fix `lyra-chart` losing a user's legend-toggled hidden-dataset state on every data-driven redraw --
  `draw()` now snapshots each dataset's `isDatasetVisible()` state before reassigning `chart.data` and
  restores it via `setDatasetVisibility()` afterward, since Chart.js's own dataset-object identity
  changes on every reactive update from a live-polling consumer.
- a413c8c: Fix `lyra-chip-group`'s "+N"/"Show less" overflow toggle hardcoding English strings instead of using
  the library's own existing `localize()`/`strings` override mechanism, which every other component
  with translatable text already uses (including the identical `showMore`/`showLess` keys, already
  consumed by `lyra-source-card`).
- 4010bc4: `lyra-menu`'s `onListKeyDown` now ignores a keydown whose target isn't a real `<lyra-menu-item>`,
  matching the same `instanceof LyraMenuItem` guard `onItemSelect`/`onListFocusIn` already use --
  previously it unconditionally intercepted Arrow/Home/End/Enter/Space/Escape/Tab from any keydown
  bubbling through `[part="list"]`, including from non-item slotted content (e.g. a custom-range
  date input), hijacking keystrokes meant for it. Note: Escape/Tab now also only close the menu when
  the event originates from a real item -- a slotted non-item control gets fully default keyboard
  behavior instead.
- a5a055f: Fix `lyra-split`'s fixed-percent panels not reserving space for the auto-inserted divider between
  them, causing a deterministic `(panelCount - 1) * dividerWidth` container overflow in the default
  (uncollapsed) state. Panels now get a nonzero `flex-shrink` so they absorb the dividers' own width
  instead of the row overflowing.
- 18003f0: Fix `lyra-stat`'s `[part='base']` not stretching to fill its host in a CSS Grid -- a stat tile with
  a longer `sub`/breakdown-rows line rendered visibly taller than its row-mates. `block-size: 100%` on
  `[part='base']` now matches the convention `lyra-word-cloud`/`lyra-context-meter` already use.
- 55c384e: Fix `lyra-tabs`'s `tablist` part showing a phantom vertical scrollbar on a tablist with no
  vertically-overflowing content — `overflow-x: auto` alone can leave the y axis's computed overflow
  at `auto` too per the CSS overflow spec, which sub-pixel rounding can trip; `overflow-y: hidden` is
  now explicit, since the tablist is never meant to scroll vertically.

## 2.2.0

### Minor Changes

- ff41aba: `lyra-app-rail`: add a `resizable` opt-in (drag + keyboard-steppable `[part="resizer"]` handle,
  `railWidthPx`/`minRailWidthPx`/`maxRailWidthPx`, `lyra-rail-resize` event) for the `'full'` state's
  width; add `preferredMode` to manually prefer `'full'`/`'icon-only'` while the mobile breakpoint
  keeps tracking automatically; and fix the mobile toggle button's `aria-label` to use a proper
  `openNavigation` message key (consistent with the existing `closeNavigation` key) instead of
  concatenating a hardcoded `" navigation"` suffix onto a partially-localized string.
- 3b1a404: `lyra-app-rail-item`: add an `active` property that reflects `aria-current="page"` onto the
  internal link/button, mirroring `lyra-conversation-item`'s existing `active` pattern.
- 3b7a98b: `lyra-attachment-chip`: fix the uploading progressbar/spinner's `aria-label` to actually use
  `uploadingLabel` (previously hardcoded, unlike the adjacent visible status text); add an
  `untitledLabel` override for the empty-name fallback; add a `compact` density variant.
- 49be9e4: `lyra-attachment-trigger`: add a `triggerTitle` property forwarded to the internal trigger
  button(s)' native `title` (a sighted-mouse-user hover tooltip, distinct from `triggerLabel`'s
  `aria-label` role); reduce the internal `.trigger-button:hover` rule's specificity via `:where()`
  so a consumer's `::part(trigger):hover` override wins without needing `!important`.
- 4d04843: `lyra-code-block`: add a `languagesOnly` opt-in that skips the default `loadShikiHighlighter()`
  call entirely, so a consumer whose `languages` map already covers every language it renders has no
  bundler-reachable path to shiki's full per-language dynamic-import table.
- 2968d7b: Add `lyra-copy-button`: a standalone icon-only copy-to-clipboard button for a plain text `value`,
  with no positioning opinion of its own — for a consumer needing just the copy/checkmark-swap
  affordance without adopting `lyra-code-block`'s or `lyra-json-viewer`'s full content model.
- 49be9e4: `lyra-dialog`: add `noLightDismiss` to opt out of backdrop-click dismissal, and make `close()`
  actually respect a `lyra-dialog-close` listener's `preventDefault()` (the event is now genuinely
  `cancelable: true`) for every dismissal path — Escape, backdrop, the built-in close button, and a
  consumer's own `close()` call.
- 6958595: `lyra-heatmap`: add a `cellInteractive` predicate to opt individual cells out of hit-testing and
  keyboard roving focus, and a `colorSteps` discrete-array ramp as an alternative to the 2-endpoint
  `--lyra-heatmap-scale-lo`/`-hi` linear interpolation (governs both `mode`s and both `scale`
  values). Also adds test coverage confirming `firstDayOfWeek`'s calendar-mode weekday-axis labels
  are correct for a non-Sunday-first week (the underlying computation was already correct; only the
  test combining the two was missing).
- 2c6fc82: `lyra-lite-chart`: add a `minBarHeight`/`min-bar-height` pixel floor for near-zero stacked
  segments, fix `scale="sqrt"` proportionality for stacked bars (previously compressed each
  segment's absolute cumulative stack position independently instead of the bar's total height
  split linearly by segment share), and add a `chartLabel`/`chart-label` override for the chart's
  auto-derived `aria-label`.
- e29b2f9: `lyra-markdown`: add `part="paragraph"`, `part="list"` (both `<ul>` and `<ol>`), and
  `part="inline-code"` (bare inline codespans only, not a fenced code block's `<code>`, which
  already has its own `part="code-block"` wrapper) so a consumer's `::part()` CSS can reach plain
  text elements that previously had no themeable hook.
- 3b7a98b: `lyra-split`: add a `dividerLabel` function property overriding the auto-inserted divider's
  hardcoded English `aria-label` template.

## 2.1.0

### Minor Changes

- 82a3419: `<lyra-attachment-chip>`: added four label-override properties for i18n/locale — `removeLabel`/`retryLabel` (`remove-label`/`retry-label` attributes, the verb prefixed to the remove/retry buttons' `aria-label` ahead of the interpolated filename) and `uploadingLabel`/`uploadFailedLabel` (`uploading-label`/`upload-failed-label` attributes, the verb/phrase used in the visible uploading/error status text, keeping the live percentage interpolation intact for `uploadingLabel`). All four default to today's exact hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload failed'`), so leaving them unset changes nothing for existing consumers.
- 82a3419: `<lyra-attachment-trigger>`: added a `triggerLabel` property (`trigger-label` attribute) that overrides the single-capability trigger button's `aria-label`, which previously came unconditionally from the built-in `CAPABILITY_META` table (e.g. `'Attach files'`, `'Attach an image'`, `'Use camera'`). Lets a host localize the accessible name without forking the component. Unset (the default) preserves today's exact `CAPABILITY_META`-derived label for every capability.
- 82a3419: Add `<lyra-code-block>` `languages`, a map of language id to an already-imported shiki grammar module (e.g. `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key in `languages`, highlighting for it is seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()` highlighter (`code-loader.ts`'s new `loadShikiHighlighterCore()`), bypassing the default `loadShikiHighlighter()` singleton and its dynamic per-language `loadLanguage()` import entirely for that language — no loading skeleton either, since this path never waits on that singleton. shiki's main entry point (what the default path imports) bundles a dynamic `import()` per bundled language (~200 of them), since a bundler can't statically narrow which of those a `loadLanguage(lang: string)` call might request at runtime; `shiki/core`'s fine-grained API has no such table, so a consumer who pins its full, known language set this way gets a build output scoped to just those languages instead of shiki's entire bundled set. A `language` value absent from `languages` (or left unset, or when `languages` itself is unset) still falls back to the ordinary dynamic-import path unchanged — this is a partial, additive opt-in, not a replacement for it.
- 82a3419: Fixed 'confirm()''s own usage example to import from the granular subpath
  ('@aceshooting/lyra-ui/components/dialog/confirm.js') instead of the root barrel
  ('@aceshooting/lyra-ui') — following the root-barrel example as written previously pulled in the
  library's entire ~80-component side-effect-import chain into a consumer's eager bundle
  (confirmed via a real build: +79 KB gzip regression, fixed by switching to the subpath import).
  No code changed, documentation only.
- 82a3419: Add `heading`/`closable` convenience chrome and a `--lyra-dialog-max-width` token to `<lyra-dialog>`. `<lyra-dialog>` previously required a consumer to hand-build any visible title bar (by slotting a real heading element) and any close affordance (via a footer button wired to `close()`) — `heading` now renders a visible header row with that text when no heading element is slotted (still deferring to a slotted heading, unchanged, when present), and `closable` renders a built-in close (X) button in that same header row, wired through the exact same `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`. `[part="panel"]`'s previously-hardcoded `max-inline-size: min(32rem, 100%)` is now `min(var(--lyra-dialog-max-width, 32rem), 100%)`, mirroring `<lyra-media-card>`'s `--lyra-media-card-max-height` — the default stays exactly `32rem` when unset. All three are additive/opt-in; existing consumers see no behavior change.
- 82a3419: `<lyra-heatmap>`'s calendar mode gained four additive extensions. `firstDayOfWeek` (0-6, Sunday-first default, same numbering as `CalendarCellPos.weekday`) anchors the week grid at a different weekday instead of always Sunday, threaded into `buildCalendarGrid()`'s new `firstDayOfWeek` parameter; matrix mode ignores it. `rowY` overrides the y-origin computed for each weekday row, the vertical analogue of the existing `columnX`, consulted consistently by drawing, hit-testing, and the keyboard focus ring via a new private `rowYFor()` helper mirroring `columnXFor()`'s exact dispatch-with-computed-fallback shape. The previously matrix-mode-only `cellSize`/`fitToWidth` properties now also size calendar mode's grid, replacing its hardcoded 11px cell constant when explicitly set (unset, calendar mode keeps that original 11px default). The previously matrix-mode-only `scale` property now also governs calendar mode's bucketing: `scale="sqrt"` compresses via the same square-root magnitude compression matrix mode uses instead of always calling `quartileBucket()`, so one heavy day doesn't wash out a skewed dataset; the default `"linear"` preserves today's exact quartile-only calendar behavior. All four are opt-in and no-ops when left unset/default.
- 82a3419: `<lyra-lite-chart>` gained seven additive properties. `pointText` overrides the per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors `lyra-heatmap`'s `cellText` hook), falling back to today's exact raw-value template when unset. `roundedBars` draws bars as a rounded-top-corner path instead of a square-cornered rect (default `false` keeps the plain rect). `skipZero` omits a bar entirely — no mark, no `tabindex`, no tooltip — for a value that is exactly `0`, instead of today's zero-height-but-focusable bar (default `false` unchanged). `padLeft`/`barGapRatio` override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants (36px / 0.2 respectively) when set. `scale` (`'linear' | 'sqrt'`, `type="bar"` only) switches the bar-height mapping from the default linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)` compression mirroring `lyra-heatmap`'s matrix-mode `sqrt` scale, so a skewed dataset's smaller bars aren't washed out by one dominant value; `type="line"` ignores `scale` entirely. `hideAxis` suppresses `renderGrid()`'s gridlines and y-axis tick labels altogether (x-axis category labels are unaffected). All seven are opt-in and no-ops when left unset/`false`.
- 82a3419: `<lyra-markdown>` gains four additive properties. Every rendered `<img>` now carries a `part="img"` (with a matching `[part='img'] { max-width: 100% }` base style), alongside the existing `content`/`heading`/`code-block`/`link`/`table`/`blockquote` parts — previously images went through marked's default renderer with no styling hook at all. `heading-offset` (default `0`) shifts every rendered heading's depth before emitting `<h${depth}>`, clamped to `<h1>`–`<h6>`, letting a consumer nest rendered markdown under an existing heading level without losing document outline. `link-target` (default `'_blank'`, unchanged) can now be set to `null`/`''` to omit `target`/`rel="noopener noreferrer"` entirely and open links in the same tab, instead of always forcing a new tab. `eager-load` (default `false`) skips `connectedCallback()`'s async `marked`/`dompurify` `import()` and renders synchronously whenever the shared module cache (`markdown-loader.ts`) is already warm — e.g. a second `<lyra-markdown>` on the same page, or a consumer that primes `loadMarkdownDeps()` at startup — avoiding the brief plain-text fallback paint that otherwise happens on every connect, even when both peers load without error. All four are opt-in; unset, output is byte-identical to before.
- 82a3419: `<lyra-menu-item>` gained a `type` property (`'normal' | 'checkbox'`, default `'normal'`) and a `checked` boolean, mirroring `wa-dropdown-item`'s identical `type="checkbox"` pattern for building things like a "Word wrap" or "Show minimap" toggle inside a `<lyra-menu>`. A `type="checkbox"` item renders `role="menuitemcheckbox"` (instead of `role="menuitem"`) with `aria-checked` reflecting `checked` and a checkmark glyph shown once checked; activating it (click, or Enter/Space via a parent `<lyra-menu>`'s roving-focus handling) toggles `checked` and fires a new `lyra-menu-item-change` event (`detail: { value, checked }`) in addition to — not instead of — the existing `lyra-menu-item-select`, so a parent menu still closes and re-fires its consolidated `lyra-menu-select` exactly as before. `type="normal"` (the default, and every existing `<lyra-menu-item>` in the wild) is completely unaffected: same role, same rendering, same events as prior releases.
- 82a3419: `<lyra-model-select>`: added a `label` property that renders a visible `part="form-control-label"` title above the trigger/combobox, paired with it via `for`/`id`, mirroring `<lyra-select>`'s own `label` exactly. Once non-empty it also takes over as the accessible-name source, with an explicit host `aria-label` still winning over it (same precedence as `lyra-select`). Unset (the default), the control keeps today's exact `aria-label || placeholder || 'Model'` fallback chain unchanged.
- 82a3419: `<lyra-select>`'s single-enabled-option auto-commit trigger (added 1.3.0) is now gated behind a new `autoCommitSingleOption` property, default `false`. Previously this behavior was unconditional as soon as exactly one `<lyra-option>` was enabled, silently swapping the trigger's ARIA role and keyboard model on any consumer whose option list happened to narrow to one entry at runtime. Existing consumers now get the pre-1.3.0 combobox trigger unless they explicitly opt in with `auto-commit-single-option`.
- 82a3419: `<lyra-split>`'s `collapseState` is now a public accessor with force/auto semantics mirroring `<lyra-app-rail>`'s `mode`: it was previously derived only from the `ResizeObserver`-measured container width, but assigning a concrete `'wide'`/`'rail'`/`'floating'` value now pins it there (ignoring further measurement) until released back to automatic tracking by assigning the write-only `'auto'` sentinel, which immediately re-derives it from the current width. `lyra-split-collapse-change` fires on both a forced assignment and a release-to-auto, exactly as it already did for a breakpoint crossing, and only when the effective state actually changes. The `'floating'` tier also gains a new `open` property (default `false`): previously this state always rendered its pane as an always-visible overlay card the moment the container narrowed past `float-breakpoint`; it's now a hidden-by-default drawer — the pane renders nothing (hidden, out of the accessibility tree) until a consumer sets `open`, at which point it renders with a `[part="backdrop"]` scrim, traps focus, and closes (`open = false`) on Escape or a backdrop click, mirroring `<lyra-app-rail>`'s mobile overlay. `collapseState` still reflects to a `collapse-state` attribute for CSS targeting. `open` defaulting to `false` is a deliberate behavior change for the `'floating'` tier specifically (it was previously always visible); every other collapse behavior, and `collapse="none"` (the default), is unaffected.
- 82a3419: `<lyra-tabs>` can now render a leading icon inside a generated tab button without changing its accessible name. Give a panel's tab an extra direct-child sibling of `<lyra-tabs>` carrying `slot="<id>-icon"` (any markup — an inline SVG, an emoji span, a custom icon element) and it renders ahead of the label inside that tab's button, wrapped in a new `part="tab-icon"` `aria-hidden="true"` span so it's always excluded from the button's accessible name (which stays exactly the `label` attribute's text, as before). A tab with no matching `<id>-icon` sibling renders no icon wrapper at all, so every existing text-only `<lyra-tabs>` is byte-for-byte unaffected. A named slot (rather than an `icon="<name>"` attribute keyed into this library's internal `icons.ts`) was chosen because that internal set is a small closed vocabulary of chrome glyphs for this library's own components, not a public icon registry — a slot lets a consumer supply an arbitrary, domain-specific icon instead.

## 2.0.0

### Major Changes

- 8b5f729: **Breaking:** the root `@aceshooting/lyra-ui` entry point no longer re-exports or
  side-effect-registers the optional-peer-dependent component families — `<lyra-chart>`
  and its typed subclasses, `<lyra-box-plot>`, `<lyra-histogram>`, `<lyra-map>`, and
  `<lyra-graph>`. Import each of these directly from its own subpath instead (the README
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

  Every other component (including `<lyra-lite-chart>`, which has zero peer
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

  `@aceshooting/lyra-ui`: `<lyra-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

- 2a7390d: Fix `lyra-heatmap` calendar mode's month/weekday axis labels to follow the runtime locale instead of hardcoded English, and add a `columnX` override so a calendar's week columns can be pixel-aligned with an external coordinate function.
- 43864d6: Add `lyra-lite-chart` `layout="scroll"` (fixed-width, horizontally-scrollable bars via `barWidth`), `maxLabels` axis-label decimation, and a `barX` coordinate override for pixel-aligning bars with a sibling `lyra-heatmap`.
- 043b7b0: Move `LyraSelectSize` above `<lyra-select>`'s class JSDoc block so `custom-elements.json` correctly documents `lyra-select` as a custom element.
- 7bbe3d2: Add `lyra-split` opt-in responsive collapse (`collapse="start"|"end"`, `rail-width`, `rail-breakpoint`, `float-breakpoint`): below `rail-breakpoint` the chosen pane clamps to a fixed rail width, below `float-breakpoint` it becomes an absolutely-positioned floating overlay, both signaled via a `data-collapse-state` attribute/dataset marker and the new `lyra-split-collapse-change` event.
- f14165f: `<lyra-stat>` breakdown rows (`StatRow`) gain an optional `exactValue` field, mirroring the headline value's tooltip: setting it renders a `title` tooltip and makes that row's `[part='row-value']` keyboard-focusable, independently per row.
- d62725d: `lyra-table`'s `[part='reveal-columns-button']` now renders only when a `priority` column is actually hidden by the `@container` breakpoints (or `showAllColumns` force-visible mode is active), instead of whenever any column merely declares a `priority`; the new `columnsHidden` reactive property and `lyra-columns-hidden-change` event expose the same real-time state to consumers.

### Patch Changes

- Updated dependencies [144ad8f]
  - @aceshooting/lyra-flags@1.3.0

## 1.3.0

### Minor Changes

- 6358479: Added a "Conversation & Agent UI" family: chat/tool-call/agent-config building blocks for
  streaming AI interfaces, plus the general-purpose primitives (dialog, tabs, checkbox, switch,
  menu, chip, JSON viewer, live region, markdown, code block) they're built from. No breaking
  changes to any existing component.

  New tags: `lyra-dialog`/`confirm()`, `lyra-tabs`, `lyra-checkbox`, `lyra-switch`,
  `lyra-json-viewer`, `lyra-live-region` (+ `internal/announcer.ts`'s throttled `Announcer`),
  `lyra-markdown` (needs the optional peers `marked`/`dompurify`), `lyra-chat-message`,
  `lyra-typing-indicator`, `lyra-tool-call-chip`, `lyra-tool-result-view` (+ its
  `registerToolRenderer()` renderer registry), `lyra-tool-result-dialog`, `lyra-chat-composer`
  (form-associated), `lyra-attachment-chip`, `lyra-stream-status`, `lyra-virtual-list`,
  `lyra-conversation-item`, `lyra-model-select`, `lyra-slider` (form-associated),
  `lyra-tool-select-dialog`, `lyra-citation-badge`, `lyra-source-list`/`lyra-source-card`,
  `lyra-app-rail`, `lyra-responsive-panel`, `lyra-mention-popover`, `lyra-streaming-text`,
  `lyra-thinking-panel`, `lyra-generation-status`, `lyra-code-block` (needs the optional peer
  `shiki`), `lyra-tool-approval-dialog`, `lyra-tool-param-form`, `lyra-menu`/`lyra-menu-item`,
  `lyra-chip`/`lyra-chip-group`, `lyra-model-settings-panel`, `lyra-context-meter`,
  `lyra-dock-panel`, `lyra-document-preview`, `lyra-media-card`, `lyra-attachment-trigger`,
  `lyra-kbd`, `lyra-result-card`/`lyra-result-field`.

  Also extends `internal/rtl.ts` with `rtlAwareSide()`/`rtlAwarePlacement()` (mirrors a physical
  `left`/`right` value, or the `left`/`right` component of a Floating UI `Placement`, under RTL) —
  used by `lyra-menu`'s `placement` property so an explicit `placement="left-start"` still anchors
  to the trailing edge instead of the physical left when the page is RTL.

- 6358479: `<lyra-select>`: when exactly one `<lyra-option>` is enabled, the trigger now auto-commits that
  option on click or Arrow Up/Down instead of opening a single-row listbox — no chevron, no popup,
  `role="button"` instead of `role="combobox"`. Avoids an unnecessary extra click for "only one
  choice available" states (e.g. a filtered picker that's converged to a single match). Multi-option
  selects are unaffected; `value`/validity defaults are unchanged. Not gated behind a new prop — this
  is the new default trigger behavior for any select with a single enabled option.

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
