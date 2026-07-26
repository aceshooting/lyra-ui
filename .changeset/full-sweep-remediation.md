---
"@aceshooting/lyra-ui": minor
---

Full-sweep remediation: additive public surface, accessibility, i18n and documentation fixes across
the library. No breaking change — every item below is additive, and every new custom property is an
inline `var()` fallback carrying today's value, so rendering is unchanged when it is left unset.

New public API:

- `<lr-svg-viewer>` adopts the shared `DocumentAnchorTarget` contract: it gains the reactive `anchor`
  property alongside the existing `highlights`/`activeHighlightId`, a retrying
  `scrollToAnchor(target): Promise<boolean>`, the `anchor-live-region` part, and the
  `lr-anchor-result` event (`detail: { found: boolean }`). Its registry entry declares
  `capabilities: { anchors: ['region'], search: false, textSelect: false }`, so opening an SVG
  through `<lr-document-viewer>` no longer drops deep-link anchors and highlights. The same
  registry wiring and `capabilities` declaration was added for `<lr-html-viewer>`,
  `<lr-pptx-viewer>` and `<lr-archive-viewer>`.
- `<lr-table>`'s `lr-column-resize` becomes cancelable **at the commit only**: a pointer drag still
  streams non-cancelable per-pixel feedback, then fires exactly one `{ cancelable: true }` event for
  the width committed at drag-end, and a keyboard step (Arrow/Shift+Arrow/Home/End) fires that single
  cancelable commit directly. `preventDefault()` reverts the column to its pre-gesture width.
- `<lr-pdf-viewer>` gains the `previous-button`, `next-button`, `zoom-out-button` and
  `zoom-in-button` CSS parts, so the toolbar controls are reachable from a consumer stylesheet (a
  descendant combinator after `::part()` never matched).
- `<lr-tool-param-form>` gains the `control` CSS part on its `string`/`number`/`integer` native
  inputs.
- `<lr-commit-card>` gains the `file-status` CSS part: the one-letter git-status badge now carries a
  localized expansion as its accessible name, reusing `<lr-file-tree>`'s shared `gitStatus*` message
  keys.

New component-scoped custom properties, each defaulting to the value its rule already used:
`--lr-chart-canvas-hover-outline-width`, `--lr-chip-group-overflow-expanded-color`,
`--lr-confirm-bar-approved-color`, `--lr-confirm-bar-denied-color`, `--lr-date-picker-nav-hover-bg`,
`--lr-knowledge-base-admin-tab-selected-border`, `--lr-knowledge-base-admin-tab-selected-color`,
`--lr-pagination-invalid-border`, `--lr-radio-checked-border-color`, `--lr-radio-checked-dot-color`,
`--lr-result-card-compact-header-gap`, `--lr-result-card-compact-body-gap`,
`--lr-schema-viewer-info-border`, `--lr-schema-viewer-info-bg`, `--lr-split-divider-hit-slop`,
`--lr-task-list-compact-header-gap`, `--lr-widget-view-toggle-hover-bg`,
`--lr-widget-view-toggle-hover-color`. `--lr-tree-selected-bg`/`--lr-tree-selected-color` were
already honored by the stylesheet and are now declared, so editor tooling and the manifest see them.

New `DEFAULT_STRINGS` message keys (additive; the English defaults match what shipped before, except
`flagLoadError`, which previously rendered its own key name):

- `emojiPickerGroupSmileysEmotion`, `emojiPickerGroupPeopleBody`, `emojiPickerGroupComponent`,
  `emojiPickerGroupAnimalsNature`, `emojiPickerGroupFoodDrink`, `emojiPickerGroupTravelPlaces`,
  `emojiPickerGroupActivities`, `emojiPickerGroupObjects`, `emojiPickerGroupSymbols`,
  `emojiPickerGroupFlags` — `<lr-emoji-picker>`'s auto-loaded group headings now follow
  `registerLyraLocale()`. `EmojiPickerGroup` gains an optional `labelKey`, set only by the built-in
  `emoji-picker-element-data` adapter; a consumer-supplied group is still rendered verbatim.
- `flagLoadError` — `<lr-flag>`'s fail-closed alert had no default entry, so it rendered the literal
  string `flagLoadError` unless a locale was registered.

Accessibility, correctness and lifecycle fixes:

- Container components no longer leak an internal child's composed event past their own host under
  an undocumented name (`lr-activity-feed`, `lr-document-library`, `lr-filter-bar`,
  `lr-claim-evidence`, `lr-knowledge-graph-explorer`, `lr-message-feedback`).
- A host `aria-label` now wins over the computed internal name on `<lr-document-viewer>` and
  `<lr-flow-canvas>`.
- `<lr-split>`'s divider and `<lr-image-viewer>`'s fit/rotate/annotate controls meet the shared
  minimum hit-area floor on both axes.
- `<lr-slider>`, `<lr-time-range>` and `<lr-swatch-picker>` forward host `focus()`/`blur()`/`click()`
  to their real internal control; `<lr-prompt-studio>` bridges its native `focus`/`blur` to the host
  and pairs its role select with a visible chevron affordance.
- `<lr-subagent-panel>` implements the full roving-tabindex tree keyboard model
  (ArrowUp/ArrowDown/Home/End) its `role="tree"` already advertised.
- `<lr-compare-panel>` no longer clobbers a new pair's vote when a listener re-entrantly changes
  `itemId`; `<lr-approval-queue>` marks the selected row with `aria-current`; `<lr-schema-viewer>`
  renders `info`-severity issues distinctly from `error`; `<lr-heatmap>` drops a focused cell that a
  `values` refresh made non-interactive; `<lr-test-results>` and `<lr-notebook-viewer>` key their
  expand state by stable identity instead of position; `<lr-box-plot>` preserves legend-toggled
  visibility across a redraw; `<lr-selection-toolbar>` re-arms positioning after a reconnect;
  `<lr-graph>`'s canvas renderer draws the expand badges and honors `--lr-graph-hull-opacity`;
  `<lr-diff-view>` locks code content to LTR under an RTL ancestor.
- `<lr-chart>` redraws on a live `dir`/`lang` change, and its zoom-plugin loader reads
  `mod.default ?? mod`.
- `<lr-voice-picker>` no longer throws when constructed in a DOM without `attachInternals()`; that
  guard now shares one implementation with the `FormAssociated` mixin and also covers an
  `attachInternals()` that throws.
- `<lr-locale-picker>`, `<lr-flag>` and `<lr-chart>` call `super.willUpdate()`/`super.updated()`.
- `<lr-button-group>` no longer collapses to zero width when it has no definite inline size.

Documentation: corrected the drifted default values, anchor kinds, sanitizer, ARIA model and
object-URL lifecycle claims across `llms/`, switched every copy-paste helper example from the root
barrel to its side-effect-free granular subpath, and documented all of the surface above.
