# Changelog

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
