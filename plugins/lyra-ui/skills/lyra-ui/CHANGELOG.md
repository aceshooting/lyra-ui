# Changelog

## 21.0.0

### Major Changes

- bccd9f6: `lr-file-input`: the form label and the dropzone instruction are now independent surfaces. A set `label` renders only as the form-control label (and names the dropzone button); it no longer replaces the localized drop-or-browse instruction inside the dropzone. `label=""` and whitespace-only labels now render exactly like an omitted label: no visible form label, the localized instruction is shown, and the instruction names the button (previously an empty label blanked both and left the button without an accessible name). Labelled instances now show the instruction, which is often longer than the label, inside the box, so it can wrap in `compact` toolbars. `lr-eval-dataset`'s `import` part is now a `compact` control that shows the localized `evalDatasetImportLabel` once as its dropzone text and uses it as its accessible name, with no separate form label.
  
  **Migration**
  
  - Custom dropzone copy via `label` on `lr-file-input`: move it to `<span slot="dropzone">…</span>`. Keep `label` only if you also want a visible form label; otherwise add a matching host `aria-label` (or `accessible-label`) so the accessible name contains the visible text.
  - Icon-only dropzone via `label=""`: slot your glyph or an empty element into `dropzone` and name the control with a host `aria-label`. A bare `label=""` now shows the instruction and uses it as the name.
  - `lr-eval-dataset`: override the import copy through `evalDatasetImportLabel` (`.strings` on `lr-eval-dataset` or `registerLyraLocale()`), and restyle the control through `::part(import)`.
  - Your own components that render `lr-file-input` inside their shadow root: slot the copy yourself, because per-instance `.strings` does not cascade into nested components.
- 520613c: **Major because documented CSS custom property defaults change.** Every decorative edge hook now defaults to the new `--lr-color-border-subtle` tier instead of `--lr-color-border`: `lr-card` `--border-color`, `lr-divider` `--color`, `lr-accordion` outlined border colours, `lr-tree`/`lr-tree-item` `--indent-guide-color`, `lr-timeline-item` `--lr-timeline-rail-color`, the `--lr-chart-grid-color` of every chart, `lr-badge`/`lr-tag` `--lr-badge-edge`, `lr-attachment-chip` `--lr-attachment-chip-border`, the `--lr-*-border-color` hooks of `lr-activity-feed`, `lr-agent-run`, `lr-commit-card`, `lr-result-card`, `lr-stack-trace` and `lr-terminal`, and the floating-panel `--lr-overlay-border` listed below. The chart canvas hover outline now documents its full fallback, `var(--lr-chart-grid-color, var(--lr-color-border))`. With the new theme input unset these render exactly as before, including when you override `--lr-color-border` on the element, so no code change is required. If you want a decorative edge to follow the control tier again after setting `--lr-theme-color-surface-border-subtle`, set that component's hook explicitly.
  
  New opt-in `@aceshooting/lyra-ui/themes/shadcn.css` preset restyles every component after shadcn/ui's default "new-york" style on the Neutral base colour: white and near-black surfaces, a monochrome primary (the default `lr-button` renders shadcn's black primary in light and near-white in dark), `0.5rem` radii, `text-sm` body text, `h-9` controls, a 3px focus ring with no offset, and Tailwind's shadow geometry. Import it next to `theme.css`; either may load first.
  
  - The preset answers to shadcn's `.dark` / `.light` classes as well as `.lr-dark` / `.lr-light` and `data-lr-theme`, so an application that toggles `.dark` on `<html>` gets Lyra's dark mode without extra wiring, and a nested `.dark` region is themed on its own. `theme.css` itself still ignores `.dark` / `.light`, so each preset block also repeats `theme.css`'s own value for that mode of every input the preset leaves alone (the success, warning and remaining danger slots, the scrims, and the chart, graph and terminal colours); `.dark` switches those too.
  - Gemstone and other `setLyraTheme({ accent })` accents recolour the default button, checked controls and the focus ring under the preset, while the secondary and muted greys stay grey. Applications that use accents should switch modes with `setLyraTheme({ mode })` rather than toggling `.dark` alone.
  - A few values deliberately differ from shadcn so every contrast guarantee still holds: control borders use a 3:1 grey (shadcn's hairline is kept for decorative edges only), the focus ring is an opaque grey, the light danger red is one notch darker and dark danger is a light red with dark text, charts keep Lyra's validated colours, and hover/press mix toward a mid grey so the black primary button still visibly reacts.
  - New `--lr-color-border-subtle` token for purely decorative edges (dividers and rules, card, panel, table and section edges, separators between items), fed by the new `--lr-theme-color-surface-border-subtle` input. Unset, as in `theme.css`, it resolves to `--lr-color-border`, so nothing renders differently; the shadcn preset sets it to shadcn's hairline. Control boundaries, form controls and meaningful graphics stay on `--lr-color-border` (WCAG 2.2 SC 1.4.11). `tokens-root.css` publishes it at `:root`.
  - Floating panels now default the shared `--lr-overlay-border` edge to `--lr-color-border-subtle`: `lr-popover`, `lr-dropdown`, `lr-menu`, `lr-dialog` and `lr-drawer`, `lr-selection-toolbar`, and the popups of `lr-entity-chip`, `lr-citation-badge`, `lr-usage-badge`, `lr-tool-call-chip` and `lr-export-button`. Popups that belong to a form control keep `--lr-color-border`: the listboxes of `lr-select`, `lr-combobox`, `lr-locale-picker`, `lr-model-select`, `lr-voice-picker` and `lr-mention-popover`, and the `lr-color-picker` and `lr-time-input` panels. A `--lr-overlay-border` you set still wins on both kinds, and while the subtle input is unset both render exactly as before.
  - Fills no longer borrow the border token. These render differently even without the preset, because the neutral fill ramp differs from the control grey: `lr-avatar` `--lr-avatar-bg` and `lr-avatar-group` `--lr-avatar-group-badge-bg` now default to `var(--lr-color-neutral-fill-quiet)` (the quiet tint the non-neutral variants already use), `lr-skeleton` `--lr-skeleton-color` (and so upstream `--color`) now defaults to `var(--lr-color-neutral-fill-normal)`, and the default `lr-empty` icon glyph now uses `--lr-color-text-quiet`. Set the hook back to `var(--lr-color-border)` to keep the previous look.
  - `lr-data-grid` gains `--lr-data-grid-line-color` (default `var(--border-color, var(--lr-color-border-subtle))`) for its decorative grid lines: the outer edge, header, row, cell and footer separators, and the toolbar and pager rules. `--border-color` keeps its default and still recolours both when set; the search field, buttons and page-size select stay on the control tier. A passive `lr-stat` tile's edge moves to `--lr-color-border-subtle`, while a linked tile keeps `--lr-color-border`, matching `lr-card`. With the subtle input unset both render exactly as before. `lr-details` deliberately keeps `--lr-color-border`: its summary is a borderless control whose only visible boundary is that frame.
  - Cascade layers: `theme.css`, `native.css`, `utilities.css`, `tokens-root.css` and `design-tokens.css` now declare `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides`. Nothing renders differently without the preset. If your application declares Lyra's layer order itself, add `lr-theme-preset` to that statement: a layer missing from the first statement the browser sees is ranked last, above `lr-overrides`.
- bccd9f6: **Major because a previously-working default activation path is removed.** The `focus` trigger of
  `lr-tooltip` (default `hover focus`), `lr-popover` and `lr-dropdown`, and the hover/focus surfaces
  of `lr-copy-button`, `lr-app-rail-item`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-citation-badge`
  and `lr-entity-chip`, now open only on keyboard focus: the focused control must match
  `:focus-visible` and no pointer press may have preceded it. Pointer, touch and scripted focus that
  follows them — such as a drawer moving focus to its close button after a tap, or an application
  calling `.focus()` on a trigger from script — no longer pops a surface. Focus from any source still
  gives `lr-tooltip`, `lr-copy-button`, `lr-usage-badge` and `lr-tool-call-chip` triggers their
  accessible description while focus stays on them. A pointer click that opens a closed hover- or
  focus-mode `lr-popover`/`lr-dropdown` now always opens it pinned like click mode, including
  `[autofocus]` and menu focus. A direct tap still opens hover surfaces through the browser's
  compatibility `mouseenter`.
  
  **Migration**
  
  - `lr-tooltip`, `lr-popover`, `lr-dropdown`: any code that relied on a programmatic `.focus()` call
    (or synthetic `focus` event) to reveal one of these must call `show()` (or set `.open = true`)
    instead — that public scripted-reveal API is unaffected by this change.
  - `lr-copy-button`, `lr-app-rail-item`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-citation-badge`,
    `lr-entity-chip`: their hover/focus preview has no public scripted-reveal method, so there is no
    like-for-like replacement for a previously-relied-upon programmatic-focus preview — this is a
    deliberate accessibility narrowing (WAI-ARIA tooltip pattern), not a renamed API. The accessible
    description/name these components attach on focus is unaffected; only the *visible preview
    surface* stops following non-keyboard focus.
  - Tests that open any of the above surfaces with `.focus()` or a synthetic `focus` event should
    move focus with a real Tab key (see `test/wtr-focus.ts`'s `focusByKeyboard`) or, for
    `lr-tooltip`/`lr-popover`/`lr-dropdown`, call `show()` directly.

### Minor Changes

- 754df2f: `lr-accordion-item` gains four independently tunable padding hooks, mirroring `lr-details`: `--lr-accordion-item-summary-padding-block`/`-inline` for the trigger button and `--lr-accordion-item-content-padding-block-end`/`-inline` for the panel content. Each falls through to the existing `--lr-accordion-item-spacing` (and its `--spacing` alias) when unset, so an un-set item renders unchanged; an asymmetric trigger row or a flush, zero-padded panel no longer requires a `::part()` override.
- aacd1e5: Fixes several component presentation defects: emoji-picker rows now fill the grid and its search
  field shows a visible placeholder from the new localized `emojiPickerSearchPlaceholder` string
  (falling back to the search label when blank), overridable per instance with the new
  `searchPlaceholder` property (`search-placeholder` attribute); file-input keeps its localized drop instruction
  separate from the optional form label; file-icon truncates long labels with an ellipsis; closed
  mobile app-rail panels no longer paint a shadow; floating collapsed multi-split panes hide their
  adjacent divider; and checked switches use their checked fill even when an unchecked fill is set.
  
  Markdown task lists now use the checkbox in place of the bullet, tables scroll horizontally with
  word-aware cell wrapping, code remains left-to-right inside RTL documents, and the streaming plain
  text fallback no longer displays template indentation. Markdown also gains opt-in progressive
  streaming with `streaming-render="progressive"` and localized language labels plus source-copy
  buttons for fenced code via `code-block-header` (`code-block-chrome` is an equivalent alias).
  Both keep their previous defaults.
- d7b5939: `lr-app-rail`'s mobile overlay now completes its focus return after the close has been published
  and the host has re-rendered. A host that hides its own menu button while the overlay is open and
  re-shows it in response to `lr-toggle` previously lost focus to `<body>` on every close, because the
  return ran before that re-render. When the return cannot land immediately, it is retried once the
  close's update has completed and a frame has passed, without taking back focus moved elsewhere in
  the meantime. If the trigger still cannot take focus, the element focused when the overlay opened,
  then the built-in toggle, receive it instead.
  
  The same deferred focus return now also covers `lr-page`'s mobile navigation drawer (falling back to
  the default navigation toggle, then the main landmark), `lr-responsive-panel`'s overlay
  presentation, and `lr-dialog`/`lr-drawer` (retried after the exit animation, so an opener re-shown
  from `lr-after-hide` is reached too).
  
  **New: `lr-app-rail` re-resolves its `trigger`/`for` association at close, not just at open.**
  Previously the element that would receive focus back was captured once, when the overlay opened.
  Now, unless the overlay was opened by the built-in toggle button's own click (which still keeps
  that click as the explicit, higher-priority return target throughout the open/close cycle),
  `lr-app-rail` re-reads the `trigger`/`for` association again right before the overlay closes and
  prefers whatever it currently resolves to — falling back to the target captured at open only when
  the live association no longer resolves to anything. This means reassigning `trigger`/`for` while
  the overlay is still open changes where focus lands on close, which was not previously possible:
  the return target used to be fixed for the lifetime of that open/close cycle.
- af1cb1c: Closed mobile app-rail panels park one pixel beyond the edge, preventing fractional-width background slivers. Slides run only for real opening and closing, so direction changes and entry into mobile mode cannot sweep a closed panel across the page. Open-only elevation is customizable with `--lr-app-rail-panel-shadow`; closed content stays inert.
- af1cb1c: `lr-app-rail` gains app-sidebar options: `frame` (floating `card` or edgeless `plain`), a mode-aware `toggle()`, `trigger-collapses` for external trigger ARIA in every mode, and an opt-in `hotkey`. It composes with `lr-page` for an allocation-based drawer.
  
  `lr-app-rail-item` hides its nested disclosure and list while icon-only, preserving `expanded` and recovering focus to the visible parent. `end` content remains visible and requires sufficient compact rail width.
  
  `toggleCollapse()` now alternates the recorded preference while `forceMode` pins presentation. Collapsing a focused resizer returns focus to the rail. `lr-button` and `lr-icon-button` forward host `aria-keyshortcuts` to their native control.
  
  `lr-command-palette` safely ignores key-less autofill events and removed hotkeys, supports non-Latin keyboard layouts through physical key fallback, and shares chord ownership with rails.
- 754df2f: `lr-combobox` now exports a `LyraComboboxInputEvent<Multiple>` type alias from the package root, matching `LyraComboboxChangeEvent` and mirroring `<lr-select>`'s own `LyraSelectChangeEvent`/`LyraSelectInputEvent` pair. Combobox has no dedicated `lr-input` custom event, so the new alias types its native `input` listener (`InputEvent | CustomEvent<...>`) instead.
- 754df2f: `lr-combobox`'s "+N" selected-tag overflow indicator now carries a second, distinguishing `tag-overflow` part alongside `tag` (`part="tag tag-overflow"`), matching `<lr-select>`'s identical two-part overflow chip so `::part(tag-overflow)` can style just that indicator. `lr-filter-bar` forwards it from a `multiple` `'combobox'` filter as `filter-control-tag-overflow`.
- c591b4d: Add `<lr-context-menu>`: opens menu items beside the pointer on right-click, on touch press-and-hold, or below the focused element on Shift+F10/ContextMenu, with a cancelable `lr-show` that leaves the platform menu in place.
- af1cb1c: `lr-file-icon` now shows a short, unlocalized format token (or a generic glyph when no token applies or the badge is too small) inside its icon badge. The full localized label remains in the accessible name and `mode="label"`, and the promised logical-start ellipsis now works. Custom metadata records can provide a trimmed `abbreviation` of up to eight code points; blank values fall back to extension matching. Because a consumer record owns its MIME mapping, its `label` remains verbatim and supplies the accessible name for that record. `fileType*` string overrides (`.strings`, `registerLyraLocale()`) now affect only the accessible name and `mode="label"`; set `abbreviation` on a registry record to control the badge text instead. Source-picker group rows no longer derive a badge token from folder labels.
  
  **Baseline change.** The badge no longer exports its text's baseline. In every engine and in both the token and glyph states it now exports a synthesized baseline at the badge's bottom edge, like an image. A consumer row using `align-items: baseline` will see the icon shift down relative to sibling text; the default inline `vertical-align: middle` placement and centered rows are unaffected.
- 754df2f: `lr-model-select`, `lr-voice-picker`, `lr-code-editor`, `lr-emoji-picker` and `lr-color-picker` now adopt the shared `--lr-form-control-focus-shadow` hook alongside the other field-shaped controls: each paints it as a `box-shadow` on its own primary surface (the trigger/combobox row for the pickers, the editor frame for `lr-code-editor`, and the search field for `lr-emoji-picker`) while focused, additive to the existing focus outline and border. `lr-model-select` and `lr-voice-picker` also gain `--lr-model-select-trigger-hover-border-color` / `--lr-voice-picker-trigger-hover-border-color`, matching the shape of each control's existing resting and open-state border tokens, so the hovered (and, on `lr-voice-picker`, pressed) trigger border is independently overridable. Nothing changes unless one of these tokens is set.
- 3aa339f: `lr-heatmap` calendar mode now honours explicitly set `cell-gap-x`, `cell-gap-y` and `cell-radius`, so a GitHub-style contribution graph with rounded, visibly spaced cells no longer needs a hand-built matrix. Painting, hit-testing, labels, selection and `lr-cell-click` all follow the spacing; calendars that leave these unset are unchanged. A new read-only `calendarGeometry` getter reports the painted calendar layout (exported type `LyraHeatmapCalendarGeometry`).
- 754df2f: `lr-heatmap` calendar mode now fires `lr-calendar-geometry-change` whenever the painted `calendarGeometry` snapshot changes (e.g. after `cellGapX`/`cellGapY`/`cellRadius` changes or a `fitToWidth` resize), mirroring matrix mode's `lr-matrix-geometry-change`. This closes the parity gap that made aligning a sibling chart with a calendar harder than with a matrix: a consumer no longer has to poll `calendarGeometry` on its own resize cadence.
- 9c40f8c: `lr-lite-chart` gains `barSlotWidth` (attribute `bar-slot-width`): a fixed per-category slot width for the default `layout="fit"`, so bars can share an external column pitch (such as a sibling `lr-heatmap`'s cell pitch) without switching to `layout="scroll"`, overflowing the host, or shifting under `dir="rtl"`. `barX` still overrides each category's x-origin; `layout="scroll"` keeps using `barWidth`. Sparse category ticks — for example one month name every few weeks, with the other ticks blanked or empty — now use the room of their empty neighbors before ellipsizing, in both layouts, while ticks with labelled neighbors are ellipsized exactly as before.
- af1cb1c: Markdown and streaming-text variants and message-parts gain opt-in code-block-header controls with language labels, accessible copy feedback, and exact source copying.
- af1cb1c: `lr-markdown` and `lr-markdown-core`: GFM table cells no longer split words mid-letter. Cells wrap
  only between words, even under an inherited `overflow-wrap: anywhere` or `word-break: break-all`,
  and a table too wide for the component now scrolls horizontally inside a new `table-wrapper` CSS
  part instead of squeezing its columns. The wrapper is one keyboard tab stop (the arrow keys scroll
  it) with a localized accessible name from the new `markdownTableRegion` message ("Table"); a table
  that fits still fills the width. GFM column alignment (`:--`, `:-:`, `--:`) is now applied. Like a
  long code line, a wide table now counts toward the component's minimum content width.
  `lr-streaming-text` and `lr-streaming-text-core` forward the new part. Set
  `::part(table) { overflow-wrap: anywhere }` to restore the previous wrapping, or
  `::part(table) { word-break: keep-all }` to keep a `keep-all` preference inside tables. Raw HTML
  tables in the Markdown source and tables from a custom `table` renderer are unchanged; a custom
  renderer that wants the scroller wraps its table in the `table-wrapper` markup itself. A
  `::part(table) { overflow-wrap: break-word }` workaround for the old wrapping can be removed; kept,
  it also reaches unwrapped `part="table"` tables, which have no scroller and would then widen the
  whole document.
- af1cb1c: `lr-markdown` and `lr-markdown-core`: GFM task-list items no longer show a bullet beside their
  checkbox. In unordered lists the read-only checkbox now takes the bullet's place, so task text
  lines up with neighbouring items; ordered lists keep their numbers. The checkbox is drawn with
  design tokens (a visible border, and a brand fill with a check mark when checked) instead of the
  browser's faint disabled styling, in light, dark and forced-colors modes, keeps its fill when
  printed, and stays disabled. The space previously rendered after the checkbox is now a margin. New
  CSS parts `task-list`, `task-item`, `task-item-checked` (a checked task, for styling completed
  items) and `task-checkbox`, also forwarded by `lr-streaming-text` and `lr-streaming-text-core`,
  allow restyling. The new `--lr-markdown-task-checkbox-size` custom property resizes the checkbox
  while keeping the text aligned. An unordered list made only of task items carries `role="list"`
  so it is still announced as a list.
- af1cb1c: Markdown, streaming-text, message-parts and agent-workspace gain opt-in progressive Markdown streaming with settled blocks, stable text tails, and final full-document parsing.
- af1cb1c: Add `lr-menubar` and `lr-menubar-item`, an APG menubar whose items drop down slotted `lr-menu`s, with roving focus, RTL-aware arrow traversal that carries the open menu along, hover switching, and typeahead. Items wrap at narrow allocations, preserve native Tab behavior, and support card and plain frames.
- c591b4d: Add `lr-navigation-menu` + `lr-navigation-menu-item`: disclosure-pattern site navigation with hover/click flyout panels, a shared animated panel region, an optional indicator, arrow-key navigation, and opt-in collapse to an in-flow disclosure list.
- bccd9f6: Dropdowns, menus, tooltips and other anchored overlays inside transformed or contained containers now open at full size outside them, in the browser top layer where the native Popover API is available. This includes containers that become transformed while an overlay is open. This covers `lr-thread-list` and every `lr-virtual-list` row, `lr-flow-canvas` nodes, `lr-selection-toolbar`, and any consumer `transform`/`filter`/`contain` ancestor, in left-to-right and right-to-left documents.
  
  Behaviour change: such promoted `lr-popover`, `lr-dropdown` and `lr-tooltip` instances no longer stack at `--lr-overlay-stack-index`/`--lr-layer-popover` while open. Overlays that are not inside such a container keep their layering.
  
  Behaviour change: overlays inside virtual-list rows and flow-canvas nodes now resolve the `fixed` strategy when none is set (their declared default is unchanged). An explicit `positioning-strategy` or an ancestor `--lr-positioning-strategy` still wins, and `::part(row)`/`::part(node) { --lr-positioning-strategy: absolute }` opts a list or canvas out.
  
  A promoted overlay whose trigger scrolls out of view is hidden until the trigger returns. Where the Popover API is absent, a row holding an open `lr-dropdown` in `lr-virtual-list` (including `lr-thread-list`) temporarily stops transforming, so its menu is no longer clipped. Overlays inside `lr-pan-zoom` content now align with their trigger at any zoom, with either strategy. Scrolling the wheel over, or pressing on, an open `lr-flow-canvas` node menu no longer zooms the canvas or drags the node. Inside unsanitized `lr-markdown` content, Lyra overlays can now paint over the surrounding app while open. A dropdown or popover whose virtual-list row moves while it is open (for example after a re-sort) now stays open and follows its trigger.
  
  `place()` now positions a popup that is already in the native top layer correctly. It now recognises `content-visibility`, `transform-style: preserve-3d`, a non-`none` `offset-path`, and `will-change: contain` or `offset-path` containing blocks, and it no longer mistakes `will-change: transform-origin` for one.
- 417a629: Associate an external multi-split launcher with `trigger` or `for` to synchronize its disclosure ARIA and return focus when the floating pane closes. App-rail now returns focus to its host when every other close target is unavailable, preserving authored tabindex. Update the layout reference and Storybook examples, and capture the shadcn preset and gemstone accent in the visual matrix.
  
  Refresh the README feature guides and current import/theming documentation, and remove obsolete Lyra 7 upgrade walkthroughs from the main documentation.
- cf2d2ce: Theme runtime: `setLyraTheme()` and theme presets accept a validated, per-mode `tokens` map of `--lr-theme-*` inputs (persisted, applied by the no-flash bootstrap, and contrast-floored against the same token families the static contrast gate checks). `@aceshooting/lyra-ui/theme/presets/shadcn.js` ships the shadcn look as a runtime preset generated from `themes/shadcn.css`; it changes only the look and leaves mode, accent and surface alone. Accent and surface colours, and component CSS length/colour/inset properties, with an unclosed parenthesis or quote (for example `rgb(0 0 0`) are now rejected instead of being written in a form that corrupts the rest of the element's inline `style` when it is re-parsed. The `lyraThemeBootstrap` / `theme-bootstrap.js` bytes change: regenerate any pinned CSP hash for the inline or external bootstrap.
- c591b4d: Add `lr-toggle`, a two-state pressed button, and `lr-toggle-group`, a one-tab-stop group of toggles with `multiple` or zero-or-one `single` selection.
- c591b4d: Add `<lr-tool-call-block>`, an inline disclosure showing one tool call's status, duration, arguments, and result or error with field redaction. Add `tool-display="block"` on `<lr-message-parts>` to render each paired tool-call/tool-result through it. `ToolInvocation` gains optional `startedAt`, `endedAt` and `redactedFields`. `<lr-message-parts>` now masks `redactedFields` in both tool displays. The agent-stream runtime rejects an invocation whose values for these keys are malformed. `<lr-message-parts>` now reflects `tool-display="chip"` by default.
- bccd9f6: Ship twenty new translation catalogs, bringing the total to thirty-two: Czech (`cs`), Danish (`da`), Swiss Standard German (`de-CH`), Finnish (`fi`), Croatian (`hr`), Hindi (`hi`), Hungarian (`hu`), Indonesian (`id`), Kazakh (`kk`), Korean (`ko`), Norwegian Bokmål (`nb`), Dutch (`nl`), Norwegian Nynorsk (`nn`), Polish (`pl`), European Portuguese (`pt-PT`), Slovenian (`sl`), Swedish (`sv`), Turkish (`tr`), Ukrainian (`uk`) and Traditional Chinese (`zh-TW`). Each covers every key in `LYRA_DEFAULT_STRINGS` with the locale's CLDR plural categories, and each is available as a whole-catalog import (`@aceshooting/lyra-ui/translations/<locale>.js`) or as per-family slices.
- cf2d2ce: Adds opt-in typography styles to `utilities.css`: `lr-heading-1`–`lr-heading-4` and `lr-inline-code` role classes, an `lr-typography` scope that styles headings, paragraphs, links, blockquotes, lists, inline code and tables inside it, and an `lr-not-typography` boundary to opt a subtree out.

### Patch Changes

- bccd9f6: Long text adornments now truncate with a real ellipsis instead of being hard-clipped. Slotted `start`/`end` (and `prefix`/`suffix`) content in `lr-button`, `lr-option` and `lr-date-input` carries its own shrinkable block, as `lr-input` already did, so the ellipsis fires at the logical end; `lr-option` adornments were previously clipped on both sides. The cloned `option-start`/`option-end` adornments in the `lr-select` and `lr-combobox` popups get the same treatment, and `lr-combobox` async `source` rows now wrap a string or number `start`/`end` in a span so it truncates from its start edge instead of centre-clipping. Element and template adornments (such as an `lr-icon`) render unwrapped as before.
- c591b4d: `adaptAiSdkMessage()` maps the AI SDK `output-denied` state, and `approval-responded` with a rejected approval, to tool status `denied` instead of `running`.
- 520613c: Two border fixes:
  
  - `lr-stat`: a linked tile now shows its hover border when the pointer rests on slotted content (a `sub`, `caption` or `spark` slot, for example), not only when it rests on the tile itself. On that same path, `frame="plain"` no longer shows the lift shadow; it keeps the underline it shows for any other hover.
  - `lr-agent-eval-dashboard`: run rows no longer show the native button border on three sides. Only the intended top divider remains.
- 754df2f: `lr-tree-item`'s disclosure toggle, `lr-flow-controls`' toolbar and slotted buttons, and `lr-node-palette`'s draggable items now fall an unset hover/press fill back to `--lr-color-neutral-fill-quiet` instead of `--lr-color-border`. The internal `--lr-color-surface-hover` override point is unchanged and, once set, still wins as before; this only changes the color painted when it is left unset, matching the `lr-avatar`/`lr-skeleton`/`lr-empty` fill fix shipped earlier this release.
- f017a8e: `lr-chat-viewport` with `live="polite"` or `live="assertive"` now announces a newly appended `lr-chat-message` that was created and appended in one step. The viewport previously read the message before its first render, found no accessible text, and never announced it. It now retries once after the message has rendered, and it still announces each message only once. A child that is appended and removed again before the viewport observes it is no longer announced.
- af1cb1c: Code now reads left-to-right inside right-to-left documents. This covers:
  
  - `lr-markdown`/`lr-markdown-core` fenced, indented and inline code, including the plain-text view
    shown while streaming;
  - the scroll area, language badge and file name of `lr-code-block`/`lr-code-block-core`;
  - `lr-notebook-viewer` raw cells, `lr-geojson-viewer` metadata, `lr-stack-trace` function names and
    `lr-terminal` without `wrap`.
  
  Some text now takes its direction from its own content: authored preformatted text inside
  Markdown, `lr-tool-result-view` text results and `lr-test-results` failure messages. Surrounding
  prose, block margins and headers still follow the page direction, and explicit `dir` attributes on
  authored code are honored. Code scroll areas now open at the start of the code. As a result, under
  `dir="rtl"` the vertical scrollbar of `lr-code-block`, `lr-code-block-core` and `lr-terminal`
  without `wrap` sits on the physical right.
- af1cb1c: Keep disclosure header boundaries at the control-border tier and use readable text colors while pressed: the card edges of `lr-thinking-panel`, `lr-task-list` and `lr-source-list` stay on `--lr-color-border`, because each header is a borderless button whose only visible boundary is that edge, and the quiet `lr-thinking-panel` duration (including the pending label) and `lr-task-list` summary now follow the header's own colour on hover and press instead of losing contrast on the tint. Navigation-menu items now release their parent ownership when detached, so moving them out of a removed menu restores their standalone disclosure behavior.
- 754df2f: Fix a batch of translation-content defects found during a pre-release audit of the localization catalogs.
  
  - `ja`: `temperature` (the LLM sampling-temperature label) was left as the literal English word; now `温度`.
  - `zh-CN`/`zh-TW`: `artifactPanelLabel` was left as the literal English word `Artifact`; now `产物`/`產物`.
  - `pt-BR`/`pt-PT`: `policySummaryCategoryGuardrail` was left as the literal English word `Guardrail`; now `Barreira de proteção`.
  - `de`/`de-CH`: the retrieval span-kind badges `spanKindRetriever` and `spanKindEmbedding`, and the retrieval-compare/stage score labels `Dense`/`Sparse`/`Rerank`/`Final`, were left in English while every other locale (and this catalog's own `retrievalStageEmbed`/`retrievalStageRetrieve`) already translates them; now `Abrufkomponente`/`Einbettung`/`Dicht`/`Dünn`/`Neuordnung`/`Endgültig`.
  - `sl`: the singular and plural forms of the chat unread-count pill (`newMessageCount`/`newMessagesCount`) were byte-identical, so a single unread message rendered the ungrammatical `Nova sporočila: 1`; the singular form is now `Novo sporočilo: {count}`.
  - `uk`: `threadListMatchAnnounce` used the same text for all four CLDR plural categories; it now declines by category (`Знайдено {count} розмову`/`розмови`/`розмов`/`розмови`).
  - `id`: `fileTypeFile` and `archiveViewerFile` used the native word `Berkas` while the rest of the catalog consistently uses the loanword `File` for the same concept; normalized to `File`.
  - `hi`/`tr`: `generationStatusThroughput` (tokens-per-second) was left as the raw `tok/s` abbreviation while the sibling `generationStatusTokenCount` key already translates "token" in the same catalog; now `{rate} टोकन/सेकंड` and `{rate} belirteç/sn` respectively.
  - `hi`: `geojsonViewMissingMapLibrary` left the English word "peer" untransliterated mid-sentence; replaced with `पैकेज` (package), matching this catalog's own `mapMissingLibrary` wording for the same package.
  - `kk`: normalized nine strings that quoted a package name or placeholder with plain ASCII `"..."` quotes to the catalog's own established guillemet (`«...»`) convention.
  - `hi`, `id`, `ko`, `nl`, `pl`, `uk`: dropped the optional `{ dir: 'ltr', name: '<endonym>' }` `registerLyraLocale()` metadata, which nothing in the library currently reads back and which the other 26 locale catalogs omit, so all-LTR catalogs are consistent again.
  - `<lr-flag>`/`<lr-locale-picker>`: added the missing `nn` → `no` and `kk` → `kz` entries to the language-to-country flag map, so those two locales resolve a flag like every sibling locale instead of rendering unresolved.
  
  Every catalog's key set, key order, interpolation placeholders and plural-category shapes are unchanged.
- 754df2f: `lr-map` now paints a marker with an omitted `color` in the themed `--lr-color-brand` token, matching the GeoJSON data-layer default, instead of maplibre-gl's own hardcoded `#3FB1CE`. An explicit invalid color (or a `url()` paint server) still falls through to maplibre-gl's own default, unchanged.
- 1b0388a: lr-markdown and lr-markdown-core with `html-mode="escape"` now escape all text that follows a raw `<pre>`, `<code>`, `<kbd>` or `<script>` tag, in the same paragraph and in every later block, so it displays as literal text like the rest of the raw HTML in that mode. Escape-mode output without such a tag is unchanged, and sanitize and trusted modes are unaffected. The `htmlMode` documentation now states that a consumer `renderer.text` or `renderer.html` override replaces the escape-mode escaping.
- 22107b6: With `math` enabled, `lr-markdown` and `lr-markdown-core` no longer read a line holding two dollar amounts, such as "$500 and $200", as inline TeX. Inline math now follows pandoc's delimiter rule: the opening `$` must be followed by a non-space, and the closing `$` must follow a non-space and must not be followed by a digit. Ordinary spans such as `$x^2$` and escaped `\$` are unchanged.
- af1cb1c: `lr-menu-item` now shows its `details` part for any assigned element, so a shadow-rendered `<lr-kbd slot="details" keys="mod+t">` shortcut chip is visible. An empty placeholder element in `details` now reserves one gap. Whitespace-only text and empty forwarding slots remain hidden.
- c591b4d: `lr-menu-item` now strips `opener` case-insensitively and de-duplicates `rel` tokens, matching `lr-button`/`lr-icon-button`/`lr-breadcrumb-item`/`lr-card`.
- 333dcc0: `lr-multi-split`: when the collapsing pane is floating (drawer open or closed), the divider beside it no longer takes a gutter or paints a line, so the remaining panes fill the split as documented. The rail state keeps its divider. Focus moved out of a collapsing pane now prefers a divider that stays enabled; with three or more panels and `collapse="start"` it previously landed on the divider being disabled.
- c591b4d: Closing the topmost non-modal overlay without focus restoration (for example a hover-closed tooltip or popover) no longer moves focus into the overlay beneath it unless focus was inside the overlay that closed. A focus-trapping overlay beneath, such as a modal dialog, still takes focus back.
- bccd9f6: `lr-popup` (and every overlay built on it) no longer reports an activated popup as `visibility: hidden` for the first moment of its entry fade. Visibility now flips at once when the popup shows and holds until the exit fade ends when it hides; only opacity animates, over `--show-duration` and `--hide-duration` as before. The computed `transition-duration` and `transition-delay` therefore list two values, one for opacity and one for visibility.
- 65a333c: lr-markdown and lr-markdown-core show exactly `content` in their plain-text fallback (streaming, loading, render failure), with no leading blank line, indent or trailing blank line. This also reaches lr-streaming-text(-core) and lr-message-parts, which additionally no longer render their own template indentation inside a container that preserves whitespace, such as a pre-wrap chat bubble. The same fix applies to lr-context-inspector segment text, to the lr-code-block(-core) activatable line-number gutter without syntax highlighting, and to lr-json-viewer placed under a preformatted ancestor such as lr-notebook-viewer JSON outputs.
- 754df2f: The `pt-PT` translation catalog now uses genuine European Portuguese grammar and vocabulary throughout instead of reusing Brazilian Portuguese constructions verbatim. Progress and status labels use the European periphrastic construction (`A carregar…`, `A ligar`, `A aguardar entrada`) instead of the Brazilian bare gerund (`Carregando…`, `Conectando`, `Aguardando entrada`); standalone labels and announcements that were left lower-case by the earlier word-substitution pass are capitalized (`Transferir`, `A carregar…`, `Ligação restabelecida.`); and a set of European-specific word choices replace their Brazilian counterparts, including `palavra-passe` for password, `controlo` for a UI control, `telemóvel` for a mobile phone, `eliminar` for delete, `guardar` for save, `registo`/`registado` for record/recorded, and `premido` for a held key or button. A few sentences also pick up European syntax: the `até ao`/`até à` contraction, `já não` instead of `não … mais`, `num` instead of `em um`, and `do que` after `mais`. Every key, placeholder token and plural category shape is unchanged.
- bccd9f6: State paint now survives the resting tokens and the pointer:
  
  - `lr-switch`: a checked track now paints `--lr-switch-checked-track-fill` (default `--lr-color-brand`) even when `--lr-switch-track-fill` is set, and the default hover and press mixes start from the checked fill while checked. Previously, setting `--lr-switch-track-fill` repainted the checked track (and its hover and press) in the unchecked colour. If you set only `--lr-switch-track-fill` and relied on the checked track sharing it, also set `--lr-switch-checked-track-fill`. An explicit `--lr-switch-track-hover-fill` / `-active-fill` still applies in both states; for a per-state value, set it from `lr-switch:state(checked)`.
  - `lr-chip`: a selected toggleable chip's hover and press wash now starts from `--lr-chip-pressed-bg` instead of the resting `--lr-chip-bg`.
  - `lr-checkbox`, `lr-radio` and `lr-tree-item`'s checkbox: a checked (or indeterminate) control keeps `--lr-checkbox-checked-border`, `--lr-radio-checked-border-color` or `--lr-tree-checkbox-checked-border-color` / `-indeterminate-border-color` under the pointer instead of switching to brand. An explicit `--lr-checkbox-hover-border`/`-active-border` or `--lr-radio-hover-border-color`/`-active-border-color` still applies in every state.
  - `lr-tree-item`, `lr-prompt-studio`, `lr-pagination`, `lr-test-results` and `lr-env-list`: the hover and press of the selected row, selected version, current page, pressed filter or revealed button now start from that state's token (`--lr-tree-selected-bg`, `--lr-prompt-studio-version-selected-bg`, `--lr-pagination-current-bg` and `-current-border-color`, `--lr-test-results-filter-active-bg`, `--lr-env-list-reveal-active-bg`) instead of its built-in default. Nothing changes unless you set those tokens.
  - `lr-trace-tree` and `lr-agent-eval-dashboard`: pressing the already-active row or already-pressed metric now deepens that item's own fill instead of flashing the unselected press colour.
  - `lr-video-playlist`: the current item keeps its current border and background tint under the pointer and while pressed, instead of taking the plain item hover.
- 754df2f: `<lr-zoomable-frame>` now routes its `focus()`/`blur()` overrides and its internal frame-focus tracking through the shared `activeElementIn()` guard instead of reading `ShadowRoot.activeElement`/`Document.activeElement` directly. It was missed by the earlier sweep (`fix(a11y): guard every ShadowRoot.activeElement read`) that moved every other focus-rehoming site in the library onto that helper, so it could still throw an unhandled error under a DOM whose `activeElement` getter itself throws (e.g. happy-dom 20.11.1) when nothing is focused. Real browsers never take the guarded path, so behavior there is unchanged.

## 20.0.1

### Patch Changes

- 54cf4f8: Maintenance release: refreshes the development toolchain (Vite 8.3.1) and the development/test versions of the optional `maplibre-gl` (6.11.2) and `libphonenumber-js` (1.13.14) peers. The supported peer ranges and the published runtime are unchanged.

## 20.0.0

### Major Changes

- bb88896: `lr-branch-picker`, `lr-chat-viewport`, `lr-realtime-session`, `lr-selection-toolbar`,
  `lr-message-actions`, `lr-prompt-queue`, `lr-prompt-input`, `lr-audio-visualizer`, and `lr-map` now
  declare `label` as `label?: string` instead of `label: string = ''`, matching the copy-override
  contract already used by `lr-transcript-feed`, `lr-thread-list`, `lr-suggestion-chips`,
  `lr-agent-workspace`, and `lr-file-input`. Rendered/attribute behavior is unchanged: an omitted
  `label` still renders the localized default, and `label=""` still suppresses it. Only the read
  type and readback value of the unset property change.
  
  MIGRATION: a TypeScript consumer that reads `el.label` and calls a `String` method on the result
  without a guard needs a null check. Before:
  ```ts
  const trimmed = el.label.trim();
  ```
  After:
  ```ts
  const trimmed = (el.label ?? '').trim();
  ```
  No migration is needed for anyone who only sets `label`, interpolates it, or relies on the
  `label=""`-suppresses-the-default behavior, which is unchanged on all nine tags.
  
  Additionally, `lr-map`'s read-only `legendProjection` accessor now has a documented no-op setter
  (matching `lr-chart`'s `chartArea`), so an accidental `.legendProjection=${x}` Lit template binding
  degrades silently instead of throwing from inside lit-html's property-commit machinery. No
  migration needed for this part of the change.
- db1294b: `lr-combobox` and `lr-date-input` now support the full shared `LyraAppearance` vocabulary
  (`accent`/`filled`/`outlined`/`filled-outlined`/`plain`) on their `appearance` property, matching
  `<lr-select>`'s trigger. `accent` paints the loud brand fill with on-brand text, and `plain` drops
  both the fill and the border; previously both values parsed and reflected but silently rendered
  identically to `outlined`, with no warning. A genuinely unsupported value (a typo, or any other
  string outside the five-member set) still clamps to the documented `'outlined'` default and the
  reflected attribute is still repaired.
  
  MIGRATION: A TypeScript consumer with an exhaustive `switch`/`assertNever` over
  `lr-combobox`'s or `lr-date-input`'s previously 3-member `appearance` type must add `'accent'`
  and `'plain'` cases (or a `default` branch). No HTML/attribute migration is needed:
  `appearance="accent"` and `appearance="plain"` were previously accepted syntactically and
  silently downgraded to `outlined`; they now render as designed instead of being a documented
  no-op.
  
  Before:
  ```html
  <!-- silently rendered identically to appearance="outlined" -->
  <lr-combobox appearance="accent">…</lr-combobox>
  <lr-date-input appearance="plain"></lr-date-input>
  ```
  
  After:
  ```html
  <!-- renders the loud brand-filled / chromeless treatment, matching lr-select -->
  <lr-combobox appearance="accent">…</lr-combobox>
  <lr-date-input appearance="plain"></lr-date-input>
  ```
- 81ec7d1: `lr-video-playlist`'s `lr-video-change` event now fires when the playlist goes from an active video to none (the last enabled video removed or made inert), with `detail.video` set to `null` and `detail.currentIndex` set to `-1`. `LyraVideoPlaylistChangeDetail.video`'s type widens from `LyraVideoPlaylistVideo` to `LyraVideoPlaylistVideo | null` to carry this. Every other `lr-video-change` emission is unchanged. Migration: add a null check before reading `detail.video.title`/`.poster`/`.sources`/`.tracks` in an `lr-video-change` listener, e.g. `if (event.detail.video === null) { /* playlist emptied */ }`.
  
  `lr-tour` no longer accepts a step object's undocumented, pre-rename `id` field as a fallback for `stepId`. A step supplying only `id` (no `stepId`) is now dropped like any other malformed step, instead of silently being accepted. Migration: rename any tour step's `id` field to `stepId` (`const steps = oldSteps.map(({ id, ...rest }) => ({ stepId: id, ...rest }))`).
- b7c56bc: `lr-command-palette` now fires `lr-show` (not `lr-open`) as its cancelable pre-open event, matching the `lr-show`/`lr-hide` overlay-lifecycle vocabulary used by `lr-dialog`, `lr-lightbox`, and the rest of the library — `lr-open` collided in name with the unrelated "item activated" `lr-open` fired by `lr-document-library`/`lr-source-card`. `lr-close` is unchanged. `lr-open` keeps firing as a deprecated alias (identical `detail: null`, cancelability, and timing, dispatched at the same call site; either event can veto the open) through the 20.x line and is removed no earlier than 21.0.0.
  
  MIGRATION: `el.addEventListener('lr-open', handler)` -> `el.addEventListener('lr-show', handler)` (same handler signature, same cancelability and timing). No action needed for `lr-close` listeners, and no action needed at all until the `lr-open` alias is removed in 21.0.0.
- dec3a2a: `lr-xml-viewer`'s `source`, `lr-pdf-viewer`'s and `lr-pptx-viewer`'s `pageViewerSnapshot`, and `lr-heatmap`'s `matrixGeometry` now accept a documented no-op setter, matching `lr-chart.chartArea` and `lr-notebook-viewer.source`: a lit-html property binding (`.source=${x}`, `.pageViewerSnapshot=${x}`, `.matrixGeometry=${x}`) on these read-only, derived properties no longer throws from inside lit-html's property-commit machinery. The getter's value and type are unchanged. Migration: no consumer action required; a template that was avoiding these bindings defensively may use them, and the assignment remains a silent no-op.
- 22c7b90: `lr-chart`, `lr-box-plot`, `lr-graph-legend`, and `lr-graph-query-builder`'s seven `lr-before-*` cancelable veto events are renamed to the library's dominant `*-request` convention, matching the ~17 other components that already use it. Every settled event name, detail shape, and cancelability is unchanged, and each old `lr-before-*` name keeps firing (deprecated, removal not before 21.0.0) with the same detail immediately alongside its new counterpart, so either name may veto the action.
  
  MIGRATION:
  - `lr-before-legend-visibility-change` (`lr-chart`, `lr-box-plot`) -> `lr-legend-visibility-change-request`
  - `lr-before-datum-visibility-change` (`lr-chart`) -> `lr-datum-visibility-change-request`
  - `lr-before-visibility-change` (`lr-graph-legend`) -> `lr-visibility-change-request`
  - `lr-before-query-run` (`lr-graph-query-builder`) -> `lr-query-run-request`
  - `lr-before-query-save` (`lr-graph-query-builder`) -> `lr-query-save-request`
  - `lr-before-query-load` (`lr-graph-query-builder`) -> `lr-query-load-request`
  - `lr-before-query-delete` (`lr-graph-query-builder`) -> `lr-query-delete-request`
  
  Existing listeners on the old names keep working unchanged until the alias is removed; rename at your convenience to adopt the canonical spelling.
- f39e2ff: `lr-checkbox` and `lr-switch`'s `input`/`change`/`lr-input`/`lr-change`/`lr-checkbox-toggle-request`/`lr-switch-toggle-request` events now carry `detail: { checked: boolean, value: string }`, matching `lr-radio`'s shape (previously `{ checked: boolean }` only). MIGRATION: no consumer code needs to change unless it relied on the detail object having exactly one key (for example a strict `deep.equal({ checked: true })` assertion) — before: `{ checked: true }`; after: `{ checked: true, value: 'on' }` (or the control's current `.value`). New code may read `event.detail.value` instead of `event.target.value`.
- 493465e: `lr-combobox` and `lr-otp-input` now declare `appearance` as a validating accessor: any value outside the documented set (including a raw attribute) is normalized to the `'outlined'` default and the reflected attribute is repaired, instead of silently rendering unstyled. Migration: TypeScript subclasses that redeclared `appearance` as a field must override the accessor (`get`/`set`) instead; reads and writes from consumer code are unchanged.

### Minor Changes

- 2f98d62: `<lr-embedding-explorer>` now caps `points` rendering at 1,000 points and `<lr-mind-map>` now caps its currently-visible topic count at 500 nodes, each keeping a deterministic, distribution-preserving sample of the full input (spread across the whole array/tree rather than a leading run) instead of rendering every item, with a localized "showing N of M" notice exposed as the new `limit` CSS part.
- 79090a0: Treat an explicitly blank (or whitespace-only) label as absent instead of rendering an unnamed, still-interactive control: lr-locale-picker option rows and lr-data-grid column headers now fall back the same way an omitted label already does, and lr-table column headers gain an optional per-column `ariaLabel` so a blank visible header still gets an accessible name (falling back to the column key when neither is set).
- 9990701: `lr-combobox` and `lr-otp-input` now clamp an unsupported `appearance` value to their documented default instead of silently reflecting it unstyled. `lr-combobox` gains a public `loading` property, mirroring `lr-select`'s, so a committed value can show a loading placeholder instead of the "not in catalog" badge while its `<lr-option>` catalog is still mounting asynchronously with no `source` involved, and a new `readonly` property that locks the committed value (still focusable, still submitted with the form) while blocking the popup and all typed or picked edits. In `lr-combobox` `multiple` mode, removing one tag for a duplicate-valued selection (including via Backspace) now removes only that occurrence instead of every occurrence sharing the same value. `lr-otp-input`'s horizontally-scrolling segment row now shows a measured edge fade once it actually overflows, matching `lr-tab-group`/`lr-segmented`/`lr-stepper`.
- 845da8e: `lr-avatar-group`'s overflow badge action surface is now a floor, not a cap: at the default size
  and at `size="l"`/`"xl"` the "+N" hit area grows to fully contain its own avatar-sized painted
  disc instead of clipping it, while still keeping its `--lr-icon-button-size` minimum at every
  tier. `lr-avatar` and `lr-avatar-group` also gain `--lr-avatar-radius` and
  `--lr-avatar-group-radius` custom properties, so the corner radius is retunable without a
  `::part()` rule, defaulting to today's exact per-`shape` rendering.
- aea7b2c: `lr-diff-view` gains the viewer-family search/highlight surface shared with `lr-csv-viewer` and `lr-xml-viewer`: `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`, `scrollToAnchor()`, a `highlights` property, and the matching `lr-search-change`/`lr-highlight-activate`/`lr-anchor-result` events, so a diff can be searched or deep-linked to from outside the component just like every other document viewer. Both navigation paths automatically reveal a `contextLines` fold hiding their target instead of leaving it stranded behind a static marker.
- 142dbcf: `lr-lite-chart` no longer fits axis titles and category labels against stale pre-render geometry inside its `ResizeObserver` callback, removing a redundant, doubled layout pass on every resize. `lr-heatmap.exportData()` gains a `'csv'` format alongside `'png'`, matching `lr-chart`/`lr-lite-chart`/`lr-box-plot`. `lr-chart`, `lr-lite-chart` and `lr-box-plot`'s `[part='base']` now stretches to fill a CSS-Grid- or flex-stretched host instead of leaving blank space below the plot. `lr-box-plot` gains an `xLabel` property for its category axis, mirroring the existing `yLabel`. `lr-heatmap` and `lr-flag` now gate their diagnostic `console.warn` calls behind the shared development-mode signal, so they no longer log in production.
- 995af6b: `lr-funnel` and `lr-entity-card` now stretch their root `[part="base"]` to fill a CSS-Grid or flex row under the default `align-items: stretch`, instead of shrink-wrapping to their own content and leaving blank space below a taller sibling tile.
  
  `lr-community-card`'s `compact` now also tightens `[part="base"]`'s padding and gap (new `--lr-community-card-compact-padding`/`-gap` hooks), matching its sibling `lr-entity-card`/`lr-source-card`. `lr-flow-node`'s `compact` now also tightens the header's own icon-to-heading gap (new `--lr-flow-node-compact-header-gap`). `lr-activity-feed`'s `compact` now also tightens the gap between an entry's icon/dot and its label/timestamp (new `--lr-activity-feed-compact-entry-gap`). `lr-thinking-panel`'s `compact` now also reduces the transcript body's font size (new `--lr-thinking-panel-compact-body-font-size`). `lr-source-list` gains new `compact` and `frame` properties (`'card' | 'plain'`), matching the density/chrome escape hatches its own slotted `lr-source-card` children already had.
  
  `lr-activity-feed`'s `renderText` callback can now return a rich anchor that renders in the library's brand color instead of the browser's default link blue, via the new `--lr-activity-feed-entry-text-link-color` custom property, since the returned content lands inside a shadow root that page CSS and `::part()` cannot otherwise reach past the wrapper.
- baea5b9: Added a `maxHeight`/`max-height` property to `lr-geojson-viewer`/`lr-geojson-view`, matching every other document viewer's ability to cap its rendered content at a bounded scrollable height, and added a `size` property to `lr-drop-zone`, matching `lr-file-input`'s density scale so the two can be sized consistently in the same layout. Contained the fallback `lr-json-viewer`'s `lr-error`/`lr-copy-error` clipboard-failure events inside `lr-geojson-viewer` instead of letting them leak past it under undocumented names.
- 6be1d6c: `lr-graph-query-builder` now exposes its outer label through the shared `form-control-label` CSS part (the existing `label` part keeps working as a compatibility alias), so a theme rule targeting `::part(form-control-label)` across every lyra-ui form control now reaches it too.
  
  `lr-phone-input` gains a `start` slot as an alias for `country-prefix` (matching the leading-adornment slot name every other single-line form field uses) and a new `end` slot for an optional trailing adornment after the telephone input; `country-prefix` keeps working unchanged.
- 2923b1d: `lr-color-picker` and `lr-token-input` gain a new `readonly` property, mirroring `lr-input`'s: the committed value stays focusable, selectable/copyable, and submitted with the form, while every value-committing affordance (the color picker's popup, palette, sliders and eyedropper; the token input's draft, remove buttons and inline token editor) is blocked. `lr-color-picker`'s `swatches` entries, `lr-rubric-form`'s category options, and `lr-voice-picker`'s `catalog` entries each gain an optional decorative `icon` field, rendered inert and `aria-hidden` alongside the option, matching the same field already supported by `lr-swatch-picker`, `lr-filter-bar`, and `lr-model-select`.
- 108456b: Fixed `lr-dock-panel`'s collapse-toggle chevron so it mirrors immediately when an ancestor's writing direction changes, instead of staying stale until an unrelated re-render.
  Added component-scoped custom properties for retinting `lr-context-meter`'s tone bands, `lr-gauge`'s per-variant fill, `lr-sequence-strip`'s selection ring, and `lr-mention-popover`'s active-row text color, independently of the shared color tokens those components previously read directly.
- 6e334b6: `lr-code-editor`, `lr-segmented`, `lr-checkbox`, `lr-progress-bar`, `lr-export-button` and
  `lr-combobox` gain dedicated corner-radius (and, for `lr-export-button`, gap) custom properties
  for their size-tiered chrome — `--lr-code-editor-radius`, `--lr-segmented-segment-radius`,
  `--lr-checkbox-box-radius`, `--lr-progress-track-radius`, `--lr-export-button-gap`/`-radius` and
  `--lr-combobox-tag-bg`/`-color`/`-radius` — each defaulting to today's exact rendering, so they are
  retunable without a `::part()` rule. `lr-widget`'s collapse and fullscreen buttons now expose their
  own `--lr-widget-collapse-button-hover-bg`/`-hover-color` and
  `--lr-widget-fullscreen-button-hover-bg`/`-hover-color` hooks, and `lr-select`'s tag remove-button
  gains `--lr-select-tag-remove-hover-bg`, so retinting the shared brand tokens for one purpose no
  longer silently repaints these unrelated controls.

### Patch Changes

- cf4d019: Remove settled-closed lr-popover, lr-tooltip, lr-dropdown, lr-popup, lr-mention-popover and lr-export-button panels from layout after their exit transitions, preventing stale popup geometry from creating unexplained scrolling when a container resizes.
- d559cb2: Fixed `lr-date-input`, `lr-time-input`, and `lr-locale-picker` so their calendar/picker/option popups are fully removed from layout once settled closed, instead of staying present at `visibility: hidden`, so they no longer silently enlarge a scrollable ancestor's scroll area.
- b27e22f: Remove the closed lr-menu submenu surface, and the closed lr-model-select and lr-voice-picker listboxes, from layout after their exit transitions, preventing stale popup geometry from creating unwanted scrolling in a container that establishes a positioning context for them.
- 64d3fed: Fixed a hydration mismatch in `lr-locale-picker`, `lr-phone-input`, `lr-token-input`, `lr-code-editor`, `lr-button`, `lr-checkbox-group`, `lr-radio-group`, `lr-slider`, and `lr-time-input`: declaratively slotted label/hint/error/adornment content is now revealed correctly instead of briefly disagreeing with the server-rendered markup on the very first client render.
- d59eae5: `lr-context-inspector`, `lr-eval-run`, `lr-approval-queue`, and `lr-policy-summary` now cap their rendered rows at 500 and show a localized "only the first N are shown" notice (`part="limit"`) when the host-supplied collection is larger, preventing main-thread jank from very large agent sessions, evaluation batches, approval queues, or policy decision sets. Summary counts, progress bars, and dialog selection still reflect the full collection.
- 4a402dd: `lr-rag-eval-dashboard`, `lr-grounding-summary`, `lr-claim-evidence`, `lr-memory-panel`, and `lr-funnel` now cap their rendered rows at 500 and show a localized "only the first N are shown" notice (`part="limit"`) when the host-supplied collection is larger, preventing main-thread jank from very large evaluation runs, citation sets, claim sets, memory lists, or funnel stage sets. `lr-calendar` caps event markers at 4 per month-view day cell and at 500 in agenda view, showing a localized "+N more" notice (`part="event-limit"`/`part="agenda-limit"`) rather than mounting an unbounded number of event buttons. Summary counts and computed values (latest metric readings, funnel shares) still reflect the full collection.
- fa99d3f: Fire `lr-slide-change` when a `slidesPerPage` change or a slide removal clamps the carousel's active slide, `lr-sources-change` when a `sources` reassignment prunes the source picker's selection, and `lr-view-change` when a `views` reassignment drops the widget's active view, so consumers tracking these components purely through their change events no longer go silently out of sync. Restore `lr-entity-dossier` and `lr-source-picker`'s documented JS-only `accessibleLabel` override so it actually reaches the internal tab strip and tree.
- 7e7b409: Fix `lr-eval-dataset` and `lr-prompt-studio` no longer crashing and blanking their whole display when one record in a host-assigned collection has a malformed nested field (a non-array `tags` value, or missing/null message `content`); the malformed record is tolerated in place and every other record still renders.
- ebd4289: Fix `lr-heatmap`, `lr-word-cloud`, `lr-voice-picker` and `lr-tool-call-chip` so a host-authored `aria-describedby` now reaches the internal element that owns the accessible role (the canvas/grid in `lr-heatmap`, the SVG in `lr-word-cloud`, the trigger/combobox-input in `lr-voice-picker`, the button in `lr-tool-call-chip`), matching how each component already forwards `aria-label`.
- ccbf93e: Fixed `lr-emoji-picker`'s built-in emoji dataset to load the `emoji-picker-element-data` locale matching the page's locale (falling back to English, and reloading on a later locale change), so emoji accessible names and search now match the page language instead of always being English. Also anchored the search/command clear-button glyph in `lr-emoji-picker` and `lr-command-palette` to the inherited font size instead of the browser's undersized default button font.
- d07fae0: Fix `lr-tool-param-form.focus()`/`.blur()` (previously silent no-ops) to move focus into, and blur out of, its first field like `click()` already did. Fix a JSON Schema `const` on a non-enum `string`/`number`/`integer` property to pre-fill the field with the locked value and render its control read-only instead of an ordinary blank, fully-editable input.
- 4275699: Fix `lr-markdown` and `lr-markdown-core` now force `rel="noopener noreferrer"` (merging any author-supplied `rel` and stripping `opener`) onto a raw HTML `<a target="...">` written directly in Markdown content, closing a reverse-tabnabbing gap that previously affected only that raw-HTML path — markdown-syntax `[text](url)` links with `link-target` set were already guarded.
- 64e53f0: Fix `lr-map` point icons rasterizing solid black when a data layer's `point.iconColor` was set to a color the browser couldn't parse; it now falls back to the layer's theme-appropriate tone color instead, matching every other color the component resolves.
- 6d3a386: Fix `lr-branch-picker`, `lr-chat-viewport`, `lr-realtime-session`, `lr-selection-toolbar`, `lr-message-actions`, `lr-prompt-queue`, `lr-prompt-input`, `lr-audio-visualizer`, and `lr-map` so an explicitly empty `label` (`label=""` or `.label = ''`) suppresses their localized default accessible name instead of silently falling back to it, matching how the other conversation-family copy-override properties already behave.
- c58597a: Fix `lr-checkbox-group`, `lr-reorder-list`, `lr-menu`/`lr-dropdown-item`, `lr-accordion` and `lr-tree`/`lr-file-tree` to coalesce bursts of per-child metadata notifications (bulk value assignment or form reset, framework re-renders re-keying every row, several items changing `disabled` together, staggered descendant attribute mutations) into a single reconciliation pass instead of one full-collection pass per notification, removing a quadratic-cost pattern on moderately sized lists and trees. Fix `lr-reorder-list` to use the same guarded active-element helper as its sibling components, so a move no longer risks an uncaught error under a DOM implementation whose `ShadowRoot.activeElement` getter throws when nothing is focused.
- 1559f0a: Fix `lr-archive-viewer` so that when a ZIP archive contains two entries sharing the same path, search navigation and its active-row highlighting (`aria-current`) now follow the true active occurrence instead of always landing on the first same-named entry. The public fragment-anchor `id` syntax is unchanged and its documented behavior for a duplicate-named entry (resolving to the first central-directory occurrence) is now explicit in the component's JSDoc and `llms/viewers.md`.
- 51c1703: `lr-tool-call-chip`'s hover/focus tooltip and `lr-citation-badge`/`lr-entity-chip`'s floating preview popover now register with the shared overlay stack, so Escape correctly defers to a genuinely topmost overlay (e.g. a dialog opened on top) instead of always closing the preview first, and an open preview now also dismisses on Escape while only hovered, not only while focused.
- ce8dd52: Fix components that reflect a host `aria-controls`/`aria-describedby` relationship onto an internal control (including `lr-button`, `lr-icon-button`, `lr-checkbox`, `lr-menu`, `lr-stepper`, `lr-flow-minimap`, `lr-image-comparer`, `lr-model-select`, `lr-file-input` and `lr-attachment-trigger`) so that changing the host attribute to an id that no longer resolves clears the internal relationship instead of leaving it pointing at the previous target.
- 2b4ae6e: `lr-subagent-panel` and `lr-json-schema-viewer` now reserve a position inside their 500-item render cap for the controlled selection (`selectedRunId`/`selectedPath`) and its resolvable ancestor chain, so a selection that would otherwise fall outside the rendered window still renders as selected instead of silently disappearing.
- 18d1e0d: `lr-code-block` and `lr-code-block-core` now share a single header-actions slot-detection
  implementation, preventing that logic from silently drifting between the two variants in the
  future. `lr-ebook-viewer` and `lr-graph-legend` resolve their theme-token colors once per repaint
  instead of once per highlight/legend entry, and `lr-retrieval-compare` computes each comparison
  set's ranked chunk list once per render instead of redundantly recomputing it for every overlap
  pair and render usage. `lr-retrieval-compare`'s comparison-set row no longer exposes a
  sub-pixel-rounding phantom vertical scrollbar.
- 382b18c: `lr-data-grid`'s per-column menu now closes on Escape exclusively through the shared overlay stack, so it correctly defers to a genuinely topmost overlay instead of always intercepting the key press first. Its ResizeObserver-driven row/gutter measurement pass is also coalesced into a single scheduled read per animation frame instead of running once per observer tick, reducing jank while an ancestor container animates or resizes.
- e4df70d: Fixed `lr-radio-group` and `lr-slider` so an out-of-vocabulary `orientation` value (whether set as an attribute or directly on the property) now clamps to the documented default instead of being forwarded verbatim into `aria-orientation`.
- 5a9ff7e: Honored the native `autofocus` attribute on `lr-combobox`, `lr-time-input`, `lr-date-input`, `lr-date-picker`, `lr-locale-picker`, `lr-color-picker`, `lr-emoji-picker`, `lr-swatch-picker`, `lr-time-range`, `lr-token-input`, `lr-rubric-form`, `lr-checkbox`, `lr-checkbox-group`, `lr-radio`, `lr-radio-button`, `lr-radio-group`, `lr-switch`, `lr-button`, and `lr-icon-button`, which previously silently ignored it; `lr-input`, `lr-textarea`, `lr-select`, `lr-slider`, and `lr-otp-input` already supported it and keep working unchanged.
- e33f74f: Add missing narrow-allocation (320px) and `dir="rtl"` regression coverage for `lr-chat-message`, `lr-command-palette`, `lr-file-icon` (`mode="label"`), `lr-streaming-text`/`lr-streaming-text-core`, and `lr-activity-feed`, so a future logical-CSS or RTL-mirroring regression in any of them is caught automatically instead of shipping silently.
- 071ebfa: No functional change: added regression coverage confirming `lr-skeleton` stays accessible while `announce` is set (mounting its `role="status"` live region), and that `lr-pagination` and `lr-table` correctly parse `has-next="false"` written as a plain HTML attribute string, not just as a JS property binding.
- 8fb8a1f: Corrected several shipped doc/JSDoc inaccuracies: `lr-time-range` no longer claims `lr-slider`'s label is invisible text, `lr-context-meter`'s docs no longer claim its ring stroke matches `lr-gauge`'s, `lr-trace-tree`'s active-row contrast note now states a live, palette-tracking ratio instead of a stale one, `lr-icon-button`'s `rel` doc no longer names a nonexistent `wa-icon-button` tag, `lr-tooltip`'s `trigger` slot is now correctly documented as a Lyra-original addition rather than a Web Awesome shape, `lr-page`'s `visiblePixelsInViewport()` now documents its deliberate divergence from `wa-page` for a `null` argument, `lr-dialog`/`lr-callout`/`lr-condition-builder` now warn that resizing their composed close/remove `lr-icon-button` requires `--lr-icon-button-size-scope` rather than the no-op `--lr-icon-button-size`, and `lr-message-parts`' `renderPart` now documents that overriding an interactive part type (error, citation, tool call/result, attachment, data) fully replaces that part's built-in interactive wiring.
- bcd27b3: Fixed the repository's dependency-upgrade and full-regeneration scripts so they reach every generated artifact contract-policy checks for freshness, and kept the pinned pnpm version they record in sync with the one an upgrade actually installs.
  Hardened the Web Awesome/Shoelace migration-coverage check so an attribute-polarity comparison that examines zero pairs is treated as a bug instead of a silent pass.
  Made `sideEffects` discovery for registration- and optional-peer-only modules behavior-based instead of filename-based, so a future side-effect-only module survives production tree-shaking regardless of its name.
- 72f29ba: Fix `lr-menu-item`/`lr-dropdown-item` losing an element-wrapped row's accessible name (`aria-label`/`getTextLabel()`) once its owning dropdown popup or `lr-menu` submenu settles fully closed, restoring the name regardless of the panel's open/closed state.

## 19.0.1

### Patch Changes

- 0ce9a98: Batch select and combobox option metadata refreshes so mounting or updating a large catalog no longer rescans every option for each individual notification. Explicit selection writes retain their immediate behavior.
- 0ce9a98: Remove closed select and combobox option panels from layout after their exit transitions, preventing stale popup geometry from creating horizontal scrolling when a container resizes.
- 8753686: Keep chart-area geometry and center-slot content synchronized after responsive Chart.js layouts, including charts outside the visible scroll area.
- 8753686: Avoid unnecessary style calculations when reading plain-text option labels, improving large select and combobox catalog mounting without changing accessible text.
- d49abfc: Fix a table rendering loop near responsive column-hiding thresholds when expansion controls or row totals are present. Include those columns in the measured grid width so priority columns remain stable during loading, resizing, and reveal toggles.

## 19.0.0

### Major Changes

- 6e31ab9: Distinguish omitted text overrides from explicit empty strings in `lr-agent-workspace` (`label`, `composerPlaceholder`), `lr-copy-button` (`copyLabel`, `successLabel`, `errorLabel`), `lr-file-input` (`label`), and `lr-retrieval-search` (`placeholder`). Omission uses the localized fallback; an explicit empty string suppresses it.
  
  These properties now read `undefined` when unset. Code that assumes an unset value is a string must handle the optional value, for example with `value ?? ''`. Remove an empty override to restore the localized fallback.

### Minor Changes

- 27ca436: Export the shared `LyraImageFit` type from granular media entries and preserve safe primitive point ids in chart activation details.

### Patch Changes

- c485895: Keep overflowing dialog and drawer bodies reachable by keyboard after resizing or changing their content. Preserve intermediate scroll-region stops in the shared overlay focus order, and expand coverage for chart point identities, granular image-fit types, and required-input descriptions.

Older releases: the package's own CHANGELOG.md (bundled under `node_modules/@aceshooting/lyra-ui/` once installed) or https://github.com/aceshooting/lyra-ui/releases.
