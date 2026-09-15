---
"@aceshooting/lyra-ui": minor
---

Sweep of hardcoded `--lr-color-brand-quiet`/`--lr-color-brand` inline-surface colors with no
override hook (the same shape just fixed for `<lr-markdown>`'s code surfaces). Every
`src/components/**/*.styles.ts` hit for both literal patterns (`--lr-color-brand-quiet`: 392
lines; `--lr-color-brand)`: 482 lines; 862 lines once the two are de-duplicated, across 179 files —
unchanged after this task's own fixes, since each new hook's inline `var()` fallback still contains
the exact literal default it preserves rather than adding or removing an occurrence) was triaged
into "already hooked at the point of use" (a nearby or JS-resolved public
`--lr-<component>-*` custom property already wraps it — the majority, once multi-line `var()`
nesting and JS-driven private-var indirection are accounted for), "shared idiom, excluded" (the
same deliberate, library-wide pattern used identically by hundreds of controls — interactive
`:hover`/`:active` fills; `aria-pressed`/`aria-selected`/`data-active`/`data-current`-style
selection chrome; an opt-in `variant="brand"`/`appearance="accent"` presentation; a link- or
toggle-styled text color; a filled primary/CTA button's `background`/`color` pairing; a native
range/checkbox `accent-color`; a `:checked`/`aria-checked` indicator), or "new public hook,"
below. Additive new custom properties on 11 components:

- **New:** `<lr-av-player>`'s `--lr-av-player-cue-hover-bg` (default `var(--lr-color-brand-quiet)`)
  retints a hovered transcript cue row; its pressed state now mixes from this same hook instead of
  the bare shared token, matching `--lr-av-player-cue-current-bg`'s and
  `--lr-av-player-marker-bg`'s existing indirection in the same component.
- **New:** `<lr-file-icon>`'s `--lr-file-icon-bg` (default `var(--lr-color-brand-quiet)`) and
  `--lr-file-icon-color` (default `var(--lr-color-brand)`) retint the format badge — every file
  category previously rendered the same fill with no escape hatch, unlike its `media` family
  siblings `<lr-avatar>`/`<lr-avatar-group>`, which already expose an equivalent hook for their own
  identity-badge fill.
- **New:** `<lr-pdf-viewer>`'s `--lr-pdf-viewer-toolbar-bg` (default `var(--lr-color-brand-quiet)`)
  and `--lr-pdf-viewer-text-selection-bg` (default `var(--lr-color-brand-quiet)`) retint the
  toolbar background and the native text-selection tint over extracted page text, closing the same
  gap already closed for that component's own `--lr-pdf-viewer-toolbar-button-hover-bg` and
  `--lr-pdf-viewer-search-match-bg` hooks.
- **New:** `<lr-image-viewer>`'s `--lr-image-viewer-annotation-box-border` and
  `--lr-image-viewer-annotation-box-bg` (defaults `var(--lr-color-brand)` /
  `color-mix(in srgb, var(--lr-color-brand) 15%, transparent)`) retint the in-progress draft
  rectangle drawn while annotating, independent of the saved highlight boxes' own tone colors and
  the annotate-toggle's own active-state hooks.
- **New:** `<lr-flow-canvas>`'s `--lr-flow-canvas-connection-line-color` (default
  `var(--lr-color-brand)`) retints the in-progress connect-gesture ghost path, independent of a
  finished edge's own `--lr-flow-canvas-edge-*-color` tone hooks in the same file.
- **New:** `<lr-flow-minimap>`'s `--lr-flow-minimap-viewport-color` (default
  `var(--lr-color-brand)`) retints the viewport rectangle's fill and stroke, independent of the
  per-status node fills (`--lr-flow-status-*-color`) already hooked in the same file.
- **New:** `<lr-code-block>` (and `<lr-code-block-core>`, which reuses its stylesheet directly)
  gain `--lr-code-block-language-bg` (default `var(--lr-color-brand-quiet)`) and
  `--lr-code-block-language-color` (default `var(--lr-color-brand)`) for the header `language`
  badge, independent of the already-hooked `--lr-code-block-active-line-outline-color`.
- **New:** `<lr-docx-viewer>`'s `--lr-docx-viewer-table-header-background` (default
  `var(--lr-color-brand-quiet)`) retints a rendered document table's header row, independent of
  the highlight/search-match backgrounds already hooked in the same file.
- **New:** `<lr-dataset-viewer>`'s `--lr-dataset-viewer-header-row-bg` (default
  `var(--lr-color-brand-quiet)`) retints the sticky header row, independent of the already-hooked
  `--lr-dataset-viewer-highlight-color`.
- **New:** `<lr-xml-viewer>`'s `--lr-xml-viewer-tag-color` (default `var(--lr-color-brand)`)
  retints every rendered element tag name, independent of the already-hooked
  `--lr-xml-viewer-active-attribute-color`.
- **New:** `<lr-select>`'s `--lr-select-option-badge-bg` (default `var(--lr-color-brand-quiet)`)
  retints the `[part='option-badge']` "not in catalog" badge `show-unknown-option` renders,
  independent of the already-hooked `--lr-select-unknown-value-border-color`.

All fifteen are inline `var()` fallbacks at the point of use, so every default rendering stays
byte-identical when unset.

**Deliberately not fixed this round, with a reason:**
- `<lr-markdown>`'s `[part='table'] th` background and `<lr-combobox>`'s `[part='option-badge']`
  background are the identical shape (an unhooked content surface inconsistent with an
  already-hooked sibling in the same file — `--lr-markdown-code-bg`/`-highlight-*-bg` and
  `--lr-combobox-option-selected-*` respectively) and were found by this same sweep, but both
  files carried another in-flight task's uncommitted changes this round
  (`markdown.styles.ts`/`markdown.class.ts` and `combobox.class.ts`); adding a hook here risked
  colliding with that work mid-flight rather than after it lands. Landed as the tracked follow-up,
  not left as an informal "someday" note: `--lr-markdown-table-header-bg` and
  `--lr-combobox-option-badge-bg`, same shape as the fixes above — see the sibling changeset.
- `<lr-mind-map>`'s resting node-circle fill, `<lr-agent-run>`'s current-step spinner icon color,
  `<lr-tool-approval-dialog>`'s tool-name label color, and the standalone loading-ring
  `border-block-start-color` in `<lr-tree>`'s tree-item spinner, `<lr-document-preview>`, and
  `<lr-document-viewer>` are each the only brand-colored surface of their kind in their own file —
  none has an already-hooked sibling of the same visual role to be inconsistent with, unlike every
  fix above. Not given a new hook this round; a maintainer ask for any of these specifically is a
  one-line follow-up, not a rediscovery.
- The retrieval-family sweep from the previous round (`<lr-retrieval-results>`'s
  `[part='load-more']`, `<lr-provenance-panel>`'s and `<lr-community-card>`'s header
  disclosure/member buttons) is re-confirmed excluded as the shared "quiet interactive fill" idiom
  — matching e.g. `<lr-commit-card>`'s `[part='files-toggle']` (resting `--lr-color-brand` text,
  `:hover` background `--lr-color-brand-quiet`), not `<lr-icon-button>`, which uses no brand token
  at all for its own hover/active fill.
