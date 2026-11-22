# Changelog

## 32.0.0

### Major Changes

- 0a87a8b: `lr-stat` values (headline, breakdown rows and the exact-value reveal) now use the surrounding text font with tabular digits instead of the monospace face, so text values such as names render correctly in every script, including Arabic. Set the new `--lr-stat-value-font-family: var(--lr-font-mono)` to keep the previous look.
- 369dc81: - The viewers family barrel (`@aceshooting/lyra-ui/components/viewers`) no longer exports the `LyraGeojsonView` subclass. Import `LyraGeoJsonViewer` instead; `lyra-ui-migrate --origin=lyra-v31` re-binds `import { LyraGeojsonView } from '@aceshooting/lyra-ui/components/viewers'` to `LyraGeoJsonViewer as LyraGeojsonView` and reports other uses.
  - `adaptA2UiSurface()` results no longer carry the `state` alias of `bindingState`; read `bindingState`.
  - Profile `export` globals in the migration ledger may now name a `./components/<family>` barrel as well as the package root.
- 921d77a: Count messages choose their wording by the locale's plural rules instead of an English singular/plural switch, and composed accessible names are single translatable templates.

  - `wordCloud`, `trendOf`, `flowRunSummary` and `treeSourceSummary` are plural messages selected by the numeric count (English now reads "1 value", "0 of 1 step complete", "1 visible of 1 node."). `wordCloud` no longer takes `{word}`; the noun is part of each category.
  - Removed `wordCloudWord` and `wordCloudWords`. The capped word-cloud note uses the new plural `wordCloudWordLimit`.
  - `fileInputAcceptedOne`/`fileInputAcceptedMany` are replaced by the plural `fileInputAccepted`, and `fileInputRejectedOne`/`fileInputRejectedMany` by `fileInputRejected`. Move `.strings` and `registerLyraLocale()` overrides to the new keys as category objects.
  - `sequenceStripBucketSummary` is now `'{items} in {ranges}'`, filled from the new plural fragments `sequenceStripItemCount` and `sequenceStripRangeCount`.
  - `graphSourceTotals` and the three `graphSourceCoverage*` messages take whole count phrases in `{nodes}` and `{edges}`, from the new plural fragments `graphSourceNodeCount`, `graphSourceEdgeCount`, `graphSourceShownNodes` and `graphSourceShownEdges`. They no longer receive `{shownNodes}` or `{shownEdges}`. Rewrite custom overrides of these messages.
  - New template keys for names that were assembled by concatenation: `showMoreOverflowLabel` (`lr-chip-group` and `lr-avatar-group` overflow buttons, keeping the visible "+N" at the start of the name), `emailViewerOpenAttachmentSize` (`lr-email-viewer` attachment buttons) and `countAtLeast` (lower-bound counts in `lr-json-viewer` and `lr-xml-viewer`). Overrides of `showMoreCount` no longer change the overflow button names.
- 6fb4cdf: - `lr-chart` (and its typed presets), `lr-lite-chart`, `lr-box-plot`, `lr-chart-3d` and a provider-backed `lr-json-viewer` keep their chart runtime, renderer, prepared data and loaded tree across a same-task DOM move (`moveBefore()`, or remove and re-insert in one task). A genuine disconnect still releases them, one microtask later instead of synchronously. Migration: code that removed one of these elements and re-inserted it in the same task to force a rebuild must now let a microtask pass between the two (or replace the element).
  - `lr-terminal`: setting `follow` to `true` directly now scrolls to the latest line at once, without emitting `lr-follow-change`.
  - `lr-video`: a rejected playback request from the play/pause button, the poster play action or `togglePlay()` now emits `lr-render-error` (`detail: { error }`) and shows and announces the localized `error` part. An interrupted request (`AbortError`) is not reported.
  - `lr-graph` and `lr-neighbor-list`: `updateComplete` now also covers the source pager's first render after its lazy registration.
- 44b9c4f: - `lr-map` keeps its native map, camera, markers, controls, custom layers, camera session and scene renderer across a same-task DOM move (`moveBefore()`, or remove and re-insert in one task). A genuine disconnect still releases everything, one microtask later instead of synchronously; camera sessions and custom layers report `disconnect`/`removed` at that point. While detached, `project()`, `unproject()` and `editDrawing()` return their unavailable result. Migration: code that removed a map and re-inserted it in the same task to force a new native map must now let a microtask pass between the two (or replace the element); code that inspected teardown right after `remove()` must await a microtask.
  - `lr-map`: a reconnected map's `scene` no longer reports and announces the previous connection's initialization failure before the new connection settles.
- 9ba9cca: - **Breaking:** `lr-map` vertex editing now moves a focused vertex in screen direction under RTL as well. ArrowLeft moves it left and ArrowRight moves it right in both directions, because the map canvas is never mirrored. Migration: if you documented or tested mirrored arrow keys for RTL map editing, swap ArrowLeft and ArrowRight there. Nothing changes for LTR pages.
  - `lr-map` puts the scene panel in the same row layout as the legend and the pick and drawing bars. It no longer covers the bottom corner controls, scale, attribution or legend. When collapsed, the panel is only as wide as its content instead of spanning the map.
  - `lr-video` keeps a panorama view in the picture row when narrow controls move below the video, so the controls no longer overlap it.
  - `lr-av-player` with `controls-surface="clear"` gives the playback-rate select visible hover and pressed fills that differ from each other. It also honours `--lr-av-player-rate-select-hover-bg` and `--lr-av-player-rate-select-active-bg`.
  - `lr-animated-image` starts playing on the first press of its play button when `play` is set but reduced motion is holding the image frozen.
  - `lr-flag`, `lr-map` and `lr-lightbox` class modules no longer import composed-child class modules that do nothing on import.
  - Default-string slices now resolve a key read from a typed state field, so `lr-qr-code` no longer ships unused default strings.
  - The optional-peer reference now names the opt-in `lr-flag` resolver entries that load `@aceshooting/lyra-flags`.
- 0e15a2a: Accessible names and keyboard ownership:

  - Viewers named by a nonblank host `aria-label` now give the host the viewer's role (`region`, `document`, `group`, `navigation` or `img`) through `ElementInternals`, so the authored name reaches a real role owner instead of a generic host. `lr-model-viewer`, `lr-geojson-viewer` and `lr-highlight-layer` follow the same single-owner rule, and `lr-video-playlist` (`region`) and `lr-sequence-playback` (`group`) do the same.
  - A viewer's overflow scroll body is now named by the localized `scrollerLabel` ("Scrollable content") instead of repeating the viewer name; `lr-document-preview` scroll bodies take a host label before the file name.
  - Whitespace-only `name` values and highlight labels fall back to the localized defaults in every viewer; `lr-docx-viewer` highlight actions use the positional "Highlight N of M" name instead of the full quote.
  - The `lr-graph` 3D surface uses the same `label`-first naming as the 2D view and takes only its "3D view" name when a host `aria-label` names the graph.
  - Blank and whitespace-only caller labels (host `aria-label`, `label`/`name` properties, data labels such as series, file and suite names, and label callbacks) no longer become empty accessible names across forms, overlays, layout, data, charts, media, conversation, agent-tools, retrieval and utility components; they fall back to the localized default or are omitted. `lr-table` `editLabel`/`rowExpandLabel` callbacks that throw no longer abort rendering. Unlabeled `lr-video` caption tracks are named by their language, and an unnamed `lr-audio-visualizer` becomes presentational.
  - Breaking: an explicitly empty name no longer produces an unnamed required owner; it falls back to the localized default. This covers host `aria-label=""` on `lr-zoomable-frame` (iframe title) and `lr-pan-zoom` (viewport), `aria-label=""`/`label=""` on the `lr-embedding-explorer` plot, `label=""` on the `lr-source-picker` tree, and the `lr-pagination` `previous-label`/`next-label`/`first-label`/`last-label`/`page-label`. Migration: supply real text or omit the attribute; landmark opt-outs (`aria-label=""` on a region or navigation host, `lr-pagination` `label=""`) are unchanged.
  - Breaking: `lr-chart` series, category and point label text is trimmed (`' a '` renders as `'a'`). Migration: pass the exact text you want shown.
  - Breaking: in `lr-command-palette`, Enter on the focused clear button now clears the query instead of running the active command. Migration: none needed unless a test relied on the old behaviour; keep focus in the search field to run a command with Enter.
  - Breaking: in `lr-emoji-picker`, ArrowLeft/ArrowRight in the search field now move the text caret instead of the active emoji. Migration: use ArrowUp/ArrowDown from the search field, or the arrow keys inside the grid.
- 0e15a2a: - Default entries register rarely rendered children on first use instead of eagerly: the five
    `lr-agent-workspace` details panels, the `lr-table` pager and skeleton, the `lr-data-grid` pager,
    the virtual list and source pager of `lr-chunk-inspector`, `lr-retrieval-results` and
    `lr-ingestion-queue`, the `lr-av-player` transcript list, the `lr-test-results` source pager, the
    `lr-knowledge-base-admin` ingestion queue and the `lr-dashboard-grid` default-cell widget stack.
    `updateComplete` still settles after the child upgrades. Migration: an application that renders
    one of those children itself and relied on a composite entry registering it must import that
    child's own entry (for example `components/lr-pagination.js`).
  - Component entries export the named support types their own public signatures use (for example
    `LyraAccordionAppearance` from `lr-accordion.js`, `LyraChartType` from `lr-line-chart.js`,
    `Engine3dPreference` from `lr-video.js`).
  - `lr-slider`, `lr-otp-input`, `lr-code-editor` and `lr-signature-pad` accept
    `label-display="hidden"`.
  - `lr-background-runs` accepts the active `collecting`, `waiting-input` and `waiting-approval`
    states with their agent-run labels and a Cancel action.
  - `lr-table`, `lr-data-grid`, `lr-tree`, `lr-dashboard-grid`, `lr-card` and `lr-stat` share one
    nested-interactive vocabulary: a cell containing `role="link"`, `label` or `area[href]` no longer
    activates its row, and a `tabindex="-1"` element no longer blocks a dashboard drag.
- 2a6d019: - **Breaking:** `lr-chat-viewport` no longer emits `lr-follow-change` for a direct `follow` assignment or a `scrollToBottom()` call; only a reader's scroll or a jump-pill click emits it, matching `lr-transcript-feed`, `lr-terminal`, `lr-activity-feed` and `lr-thinking-panel`. Migration: code that relied on the echo to learn about its own write already knows the new value; update local state where you assign `follow` or call `scrollToBottom()`.
  - `lr-transcript-feed` scrolls to the latest entry as soon as `follow` is set from `false` to `true`, without waiting for a new entry.
  - `lr-realtime-session` `captureOptions` accepts `streamOnly` and `levelEvents` (default `true`), so a long chunked take no longer has to be retained in memory.
  - `lr-message-parts` forwards `html-mode`, `without-images`, `link-target`, `link-schemes` and `max-height` to its built-in text and reasoning Markdown parts, with `lr-markdown`'s defaults.
  - `lr-conversation-item` names its row from the visible title, excerpt, meta and timestamp unless a host `aria-label` is set; `lr-thread-list` rows announce the pinned status and include `renderExcerpt`, `renderMeta` and `renderRowContent` text in that name.
  - `lr-markdown` and `lr-markdown-core`: a highlighted code block evicted from the shared highlight cache is highlighted again on the next render instead of staying plain.
  - `lr-markdown` and `lr-markdown-core`: `--lr-markdown-content-min-size` now defaults to `0`, so a one-line reply no longer reserves an icon-button-sized box.
  - `lr-model-select` and `lr-voice-picker` no longer list the inert `--lr-picker-*` custom properties; use the per-component `--lr-model-select-*` and `--lr-voice-picker-*` names.
  - `lr-thread-list` `--lr-thread-list-search-clear-size` defaults to `var(--lr-icon-button-size)`; `lr-branch-picker`, `lr-message-feedback` and thread-list row actions drop fixed sizes the shared target floor always overrode.
- 55c733d: - **Breaking (appearance):** every field-shaped control now paints a danger border while it matches `:state(user-invalid)`. `lr-input`, `lr-number-input`, `lr-time-input`, `lr-textarea`, `lr-select`, `lr-combobox`, `lr-date-input` and `lr-locale-picker` previously kept a neutral border, and `lr-phone-input` and `lr-otp-input` fell back to their resting border. All of them now read `--lr-form-control-invalid-border-color` (default `--lr-color-danger`), and so do the invalid indicators of `lr-checkbox`, `lr-radio`, `lr-radio-button`, `lr-switch` and their groups. The invalid edge now gives way to the focus edge while a field is focused or open, so a focused invalid field always shows its focus. Migration: to keep the old neutral look, set `--lr-form-control-invalid-border-color` to your resting border colour (for example on `:root`). Remove any light-DOM `:state(user-invalid)::part(...)` rule that only repeated the danger colour.
  - Library-supplied validation messages for mismatch, range, step, incomplete and invalid input now follow a later locale change, as the required messages already did (`lr-input`, `lr-number-input`, `lr-textarea`, `lr-code-editor`, `lr-time-input`, `lr-date-input`, `lr-otp-input`, `lr-phone-input`, `lr-radio`, `lr-button`, the catalog pickers, `lr-known-date` and `lr-chat-composer`).
  - A native form submission now marks an untouched required `lr-otp-input`, `lr-code-editor` or `lr-emoji-picker` as interacted with, so its inner `aria-invalid` and invalid chrome turn on together with `:state(user-invalid)`.
  - `lr-input`, `lr-textarea`, `lr-number-input`, `lr-time-input`, `lr-phone-input`, `lr-code-editor` and `lr-token-input` now take one snapshot of the value for each gesture, so a listener that rewrites `value` no longer changes the `lr-input` or `lr-change` detail.
  - `lr-token-input`, `lr-code-editor` and `lr-signature-pad` now declare the reflected `appearance` property (`outlined`, `filled-outlined`, `filled`, `plain`, `accent`). Before, the attribute painted these controls but the property did nothing.
  - `lr-signature-pad`'s stroke count and `lr-otp-input`'s required length now use the active locale's digits.
  - The keyboard focus ring of `lr-switch` and `lr-radio` now sits on the track or circle instead of the enlarged hit target, as on `lr-checkbox`. The switch ring also stays visible over its invalid outline.
  - A failed search in the catalog pickers and a failed locale load in `lr-locale-picker` now use the danger text colour, so they no longer look like a neutral notice.
- 55c733d: - **Breaking:** `lr-agent-workspace` stops the generic control-state events of its built-in children (native `input` and `change`, `lr-change`, `lr-invalid`, disclosure and show/hide events) at its boundary. Child intents such as `lr-load-more`, chunk, citation and tool activation, clipboard and export events keep bubbling out of the host.
    - Migration: listen on the workspace's own events, or read the composer's state through the workspace properties instead of a `change` listener above the host.
  - **Breaking:** `lr-prompt-input` and `lr-model-settings-panel` keep their embedded pickers' request and popup events inside; `lr-prompt-input` also keeps the pickers' `lr-input` from reaching the host as its own.
    - Migration: an `lr-input` listener above `lr-prompt-input` now hears only the prompt's own input; observe the model or voice choice through the host's documented properties and events.
  - **Breaking:** `lr-geojson-viewer` keeps every `lr-map-*` event of its internal map inside the viewer.
    - Migration: render `lr-map` directly when an application needs its map events.
  - **Breaking:** `lr-markdown` routes only unmodified primary link activations.
    - Migration: listen for `click` directly to handle modified or previously canceled link clicks.
  - **Breaking:** `lr-notebook-viewer` no longer loads remote images from markdown cells and keeps nested markdown link activations from reaching the host. No option restores remote image loading.
  - **Breaking:** `lr-archive-viewer` no longer shows the "File"/"Folder" text beside every entry; it stays available to assistive technology through the new `entry-kind` part.
    - Migration: override the visually hidden `::part(entry-kind)` styles to show the text again.
  - `lr-tree` and `lr-file-tree` with a `treeSource` let keys a row does not handle, such as Escape and application shortcuts, reach document and ancestor listeners, so an enclosing dialog or drawer closes on Escape.
  - Editor data and the manifest list the defaults of accessor-backed attributes, such as `lr-chat-composer`'s `actions-layout` and `status`, `lr-audio-visualizer`'s `mode` and `state`, and every `autocorrect`.
  - `@aceshooting/lyra-map`: update the style-spec dependency to 26.9.0; the third-party notices name the installed version.
- 55c733d: - **Breaking:** `<lr-geojson-viewer>` no longer fires `lr-render-error` when the optional `maplibre-gl` peer is missing, and `<lr-notebook-viewer>` no longer fires it when DOMPurify is missing or fails. Both keep the fallback visible and report the condition only through `lr-viewer-diagnostic` (`fatal: false`). Migration: hosts that reacted to `lr-render-error` for these cases listen to `lr-viewer-diagnostic` and branch on `detail.diagnostic.code` (`geojson-map-unavailable`, `notebook-sanitizer-unavailable`). `lr-render-error` now means the viewer failed.
  - `<lr-notebook-viewer>` reports an HTML or SVG output over the passive-markup limits as one `notebook-output-too-large` diagnostic per load instead of one `lr-render-error` per output.
  - `<lr-document-preview>` and `<lr-svg-viewer>` region-highlight targets and actions expose the active highlight through `aria-current`, and the targets drop their redundant `role="button"`.
  - `document-viewer-kinds.js` now registers GeoJSON lazily through the new `geojson-view/geojson-viewer-register.js` entry, so `.geojson` files no longer fall back to a download.
  - `<lr-ebook-viewer>` cancels the body of a superseded or failed EPUB response instead of leaving the connection open.
  - `<lr-archive-viewer>` no longer re-renders on every scroll event once its list is bound, and no longer scans every entry to find the active search match.
  - `<lr-notebook-viewer>`'s load-failure block drops the inline-start danger bar that no other viewer draws.
- 181418d: - Keyboard handlers across the library now leave alone a key that an earlier listener already claimed with `preventDefault()`, as well as input-method composition keys. Alt/Ctrl/Meta chords that a handler does not define also pass through, for example in `lr-token-input` (Backspace), `lr-accordion`, `lr-dashboard-grid`, `lr-reorder-list`, `lr-video-playlist`, `lr-file-input`, `lr-av-player`, `lr-zoomable-frame`, `lr-signature-pad`, `lr-heatmap`, `lr-flow-canvas`, `lr-data-grid`, `lr-code-editor`, `lr-usage-badge`, `lr-model-viewer`, `lr-context-menu` and panorama hotspots; `lr-tree` and `lr-heatmap` also ignore claimed keys.
  - Caller text is now bidi-isolated under RTL: select and combobox options (including the catalog pickers), tree and file-tree labels, funnel, calendar, context-meter, flow-node, stat, source-card and chunk-inspector labels, map measurements, contact and email viewer values, and retrieval metadata. Plain-text email bodies use `dir="auto"`.
  - New polite announcements for state changes that were previously silent:
    - pptx slide changes, pdf zoom changes, and failed pdf pages (the failed-page note now names the page through `pdfViewerPageFailed`)
    - prompt-queue moves and removals
    - map drawing progress and measurements
    - approval-queue arrivals and connector-manager status losses
    - eval-dataset match counts
    - pagination invalid page jumps, which also show a visible `[part="page-error"]` message
  - **Breaking:** disclosure toggles now keep one accessible name while `aria-expanded`/`aria-pressed` carry the state. This covers app-rail, page, dock-panel, widget, xml/notebook/email viewers, table, data-grid, map scene, thread-list, chat-message, code-block, test-results, commit-card, stack-trace and json-viewer. The state-pair string keys (`appRailExpand`/`appRailCollapse`, `dockPanelExpand`/`dockPanelCollapse`, `expandCode`/`collapseCode` and the other pairs) are removed. Move `.strings` overrides to the replacement keys listed in the migration profile; the two `threadGroup*` keys have no replacement because the group's visible label now names the toggle. The table reveal button is always named "Additional columns", and the data-grid expand button no longer repeats `aria-expanded` on tree and group rows.
  - **Breaking:** repeated per-item controls now carry item identity. When several instances render, the following are numbered or qualified, and an indexed key needs its own override:
    - widget header buttons
    - table inline editors and row toggles
    - map anchor and popup close buttons
    - markdown code regions, copy buttons and table regions
    - prompt-queue attachment lists
    - change-review hunks
    - prompt-studio remove buttons
- 17a0be0: - **Breaking:** short byte sizes below the first step now read with the locale's abbreviated symbol (`20 B` beside `1.5 kB`, French `20 o`) instead of Intl's short word (`20 byte`). This applies to `formatBytes()`, `formatFileSize()`, `<lr-format-bytes>` and every component that shows a file size. Locales whose kilo rung is itself a word keep Intl's wording; `long` and `narrow` displays are unchanged. Migration: update exact-string assertions or snapshots of base-rung sizes (for example `'512 byte'` becomes `'512 B'`).
  - A host `aria-label`/`aria-describedby`/`dir` change, an inherited direction change, a slot-presence change or the post-hydration correction no longer counts as an explicit `requestUpdate()` refresh, so provider-backed components (`lr-knowledge-base`, `lr-ingestion-queue`, `lr-retrieval-results`, `lr-eval-result` and others) no longer refetch for them. Calling `requestUpdate()` with no arguments still refreshes.
  - Holding Enter/Space activates once in `lr-tree` (declarative and source mode), `lr-file-tree`, `lr-heatmap`, `lr-calendar`, `lr-locale-picker` and the `lr-av-player` timeline. `lr-table` keeps moving focus on held arrow and paging keys.
  - Row lists in `lr-env-list`, `lr-graph-query-builder`, `lr-calendar`, `lr-neighbor-list`, `lr-schema-viewer`, `lr-retrieval-results`, `lr-memory-panel`, `lr-provenance-panel`, `lr-source-picker`, `lr-rag-answer`, `lr-claim-evidence`, `lr-grounding-summary`, `lr-retrieval-search` and `lr-entity-card` are keyed by record identity, so focus and per-row state follow the record when the host reorders or prepends.
  - A request listener that assigns the property itself is respected in `lr-test-results` (`statusFilter`), `lr-artifact-panel` (`view`), `lr-graph-legend` (`hiddenTypes`) and `lr-graph-query-builder` (`value` on load); `lr-graph-query-builder` also stops when a listener disables or removes it, `lr-known-date` does not auto-advance after an input listener moved focus, and `lr-push-to-talk` arms nothing after an `lr-record-start` listener retired the take.
  - `lr-locale-picker` emits `lr-load-error` with `detail: { value, error }` when `localeLoader` rejects.
  - `lr-video` fires its host `error` event when a non-empty `src` or `<source>` set has no allowlisted URL, and shows a localized `error` part with an assertive announcement for that rejection and for native media errors.
- b183985: Report component-owned state changes, and stop re-reporting unchanged ones.

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
- 23afcda: - `lr-graph`'s `lr-viewport-change` detail no longer carries `k`; read `zoom`, which holds the same
    scale. `npx lyra-ui-migrate --origin=lyra-v31 --check src` reports each listener to review.
  - `lr-filter-bar`, `lr-data-grid`, `lr-message-feedback` and `lr-eval-dataset` drop listeners for
    the removed `lr-menu-item-change` and `lr-chip-select` events, which no component dispatches.
  - `lr-flow-canvas` documents `lr-edge-activate` without the removed `source`/`target` fields.
  - `lr-file-tree` forwards its `.strings` overrides to the inner tree, so a `noData` override
    reaches the empty state of object data.
- ee5dc18: State paint, forced colors and text-action hit areas.

  **Breaking**

  - `lr-checkbox` state tokens use the `-color` suffix of `lr-radio`: rename `--lr-checkbox-hover-border`, `-active-border`, `-active-ring`, `-invalid-border` and `-checked-border` to `--lr-checkbox-hover-border-color`, `-active-border-color`, `-active-ring-color`, `-invalid-border-color` and `-checked-border-color`. `--lr-checkbox-group-invalid-border` and `--lr-radio-group-invalid-border` become `--lr-checkbox-group-invalid-border-color` and `--lr-radio-group-invalid-border-color`. Rename the properties in your stylesheets; the old names are no longer read.
  - `lr-select` `multiple` chips now look like `lr-combobox` tags: brand-quiet fill (`--lr-select-tag-bg`), `--lr-radius` corners (`--lr-select-tag-radius`), and per-size padding and text. Set `--lr-select-tag-bg: var(--lr-color-surface-raised)` and `--lr-select-tag-radius: var(--lr-radius-xs)` to keep the old chip. Its remove-button hover now defaults to a currentColor tint.
  - `--tag-max-size` now defaults to `var(--lr-size-12rem)` on `lr-combobox` too, so combobox tags are capped like select chips. Set `--tag-max-size: var(--lr-size-5rem)` to keep the old cap.
  - `lr-token-input` chips round with `--lr-token-input-token-radius` (default `var(--lr-radius)`) and no longer follow `--lr-token-input-radius`.
  - `lr-terminal` copy, download and jump-to-latest buttons use the shared agent action chrome, so they are at least `--lr-icon-button-size` and follow `--lr-button-*`.
  - `lr-word-cloud` words keep their group colors under forced colors, so they match the legend.

  **Added**

  - New resting, hover and pressed tokens where a sibling already had them: select tags; checkbox, radio and radio-button rest; slider track, indicator and marker; time-range track and range; chip-group overflow; stepper index, error index and check; table controls; map native controls, pressed controls and marker halo; video controls and poster press; av-player timeline; image-comparer divider; file-input rows and remove button; attachment-chip thumbnail; checkpoint buttons; message-feedback submit and comment; usage-badge; thread-list search; code-block toggle and gutter; markdown copy glyph; agent-tool headers and rows; mind-map links and nodes; source-picker rows; ingestion-queue actions; viewer highlight actions and table-viewer cell actions; xml-viewer attribute syntax colors.
  - The voice-picker preview button follows the trigger's border and fill tokens, and the multi-split divider tints on keyboard focus.

  **Fixed**

  - Under forced colors, pressed, selected and current states stay visible: agent action buttons, eval metrics, artifact views, prompt versions, graph source and spatial rows, map controls, video playlist items and the open conversation row. Splitters, resize handles and divider rules stay visible, attachment upload progress keeps its bar, page-rail heat dots keep their tone with distinct shapes, flow edges and minimap nodes get per-status patterns, and focused text fields show an outline.
  - The document-preview active region gets an offset outline, not just a border color.
  - Checkpoint, chat-message retry, xml-viewer copy, email-viewer quote and attachment buttons, the av-player rate select and the map legend controls now meet the `--lr-icon-button-size` hit-area floor.
  - Hierarchy source rows use the shared hover and press steps and the trace-tree and task-list row tokens.
- 8db6263: - `lr-permission-rules`: with `readonly`, each decision now renders as plain text (`part="decision"` is a `span`, not a `select`), so nothing reads as operable. Consumers that queried the readonly `select` should query the part instead.
  - `lr-span-waterfall`: status text and duration now show at every container width (beside the bar when wide), and the axis reserves the same meta column; source-mode updates no longer re-measure axis labels unless the view window or locale changed.
  - `lr-trace-tree`: the narrow bar-column breakpoint now follows the root font size (`22.5rem`) like every other container rule.
  - `lr-activity-feed`: a virtualized body no longer wraps the virtual list in a second 1px scroll region.
  - `lr-commit-card`, `lr-test-results`: hover tints on file rows, the files toggle and test names have an inline gutter.
  - `lr-terminal`: the jump-to-latest label uses `--lr-color-on-brand`.
  - `lr-prompt-studio`: documented that `lr-change-request` also governs an accepted reorder.
- 88f2a91: - **Breaking** `lr-map`: native controls (zoom, compass, geolocate, scene controls, attribution toggle) no longer read `--lr-map-action-hover-bg`/`--lr-map-action-active-bg`; set `--lr-map-control-hover-bg`/`--lr-map-control-active-bg` for them. The action tokens now style only scene, pick, drawing and anchor-close actions.
  - `lr-map`: shared control chrome tokens (`--lr-map-control-size`, `-radius`, `-border`, `-shadow`, `-bg`, `-color`, `-hover-bg`, `-active-bg`, `-gap`, `--lr-map-attribution-radius`/`-border`) for native controls and initialization outlines.
  - `lr-map`: `legend-placement` (corners and edge centres) plus legend inset, size, column, typography, surface and swatch tokens; slotted legend cards stack in the panel.
  - `lr-map`: `--lr-map-controls-inset-*` reservations for application chrome on a map edge, honoured by the control stacks, the legend and the pick, drawing and scene bars.
  - `lr-map`: the `anchor` slot gains a scrolling `anchor-body` part and `--lr-map-anchor-close-reservation` (also on `lr-map-anchor`).
  - `lr-map`: click, contextmenu, pick and hover details carry `point`, `clientX` and `clientY`.
  - `lr-map`: `drawingCompleteBehavior: 'clear' | 'edit'` and `drawingSticky` keep a completed shape editable or the mode armed.
  - `lr-map`: `anchorAvoid` observes application chrome and keeps anchors clear of it.
  - `lr-map`: `setOverlayGroup()`/`removeOverlayGroup()` merge keyed overlay contributions from independent modules.
  - `lr-drop-zone`: `without-rejection-list` omits the visible rejection list while keeping the announcement and event detail.
- e75ecdd: - `lr-streaming-text` and `lr-message-parts` no longer let the composed Markdown or JSON viewer's generic `lr-error` escape; listen for the typed `lr-copy-error` instead.
  - `lr-chat-message` names its retry button by the localized author instead of the raw `message-id`; `lr-message-parts` part retry/resume buttons are named by the part's own failure or interruption text.
  - `lr-message-parts` audio parts bind `src` on the `<audio>` element so a replaced source reloads; the ignored `type` attribute on the source is gone.
  - `lr-widget-renderer` row/col/text layout moved from inline styles to the stylesheet, so `::part(row|col|text)` rules can override it.
  - `lr-thread-list` search input turns off spell-check, autocorrect, autocapitalize and autofill.
  - `lr-push-to-talk` hold mode ignores the click some engines synthesize on Space release.
  - `lr-stream-status` no longer shifts layout when a stall begins; `lr-usage-badge` rounds its focusable base so the hover tint and focus ring are rounded.
- 4b94b62: - `lr-radio-group`: the single `--lr-radio-group-row-gap` token no longer also spaces the options. It now only sets the gap between the label, options and messages (default `0.1` of the control height, matching `lr-checkbox-group`); the new `--lr-radio-group-option-gap` (default `0.2` of the control height) spaces adjacent options. Migration: move any `--lr-radio-group-row-gap` override that was tuning option spacing, or collapsing adjacent `lr-radio-button` segments with `0`, to `--lr-radio-group-option-gap`.
  - `lr-otp-input`: segments now step their border on hover (`--lr-otp-input-hover-border-color`); the `--lr-otp-input-active-ring-color` description now says inset ring.
  - `lr-locale-picker`: the search field follows `--lr-locale-picker-radius`.
  - `lr-date-picker`: preset buttons follow `--lr-date-picker-radius`; the month title scales with `size`.
  - `lr-color-picker`: an unparseable text entry stays in the field, flagged `aria-invalid`, until a valid commit, an edit or Escape (themeable with `--lr-color-picker-invalid-border-color`).
  - `lr-code-editor`: an empty `resize="auto"` editor keeps `rows` sizing instead of growing by its wrapped placeholder.
  - `lr-model-select` / `lr-voice-picker`: closed-catalog type-ahead prevents the default of every key it consumes.
- 4b94b62: - `lr-dashboard-grid`: under `dir="rtl"` Ctrl/Cmd+Shift+Arrow resize now follows the visual arrow direction like Ctrl/Cmd+Arrow move (ArrowLeft widens, ArrowRight narrows). Consumers who documented the old RTL resize keys should update their help text.
  - `lr-virtual-list`: the `active-item-id` row now paints a background, themable via `--lr-virtual-list-active-row-bg` (set to `transparent` to opt out).
  - `lr-carousel`: clamping the active slide no longer writes state from `updated()`.
  - `lr-card`: `actionable` and `href` cards ignore the click that ends a text selection.
  - `lr-tab-group`: the selected-tab underline overlap follows `--track-width`.
- 17a0be0: - `lr-tour` keeps a declarative `open` pending until `steps` arrive (assignment order no longer matters) and no longer emits `lr-tour-step-activate` while closed; hosts that relied on activation events for a closed tour must read `activeIndex` directly.
  - `lr-media-card frame="plain"` draws an outline on hover and press, using `--lr-media-card-hover-border-color` and `--lr-media-card-active-border-color`.
  - `lr-mention-popover` no longer retains the caller's `items` array.
  - Lazy composite children: every host settles its own children's first render even when another host started the shared load.
  - The `lr-map` guide documents the `pick-mode`, `draw-mode` and `anchor-closable` attributes.
- 181418d: - `lr-funnel`, `lr-agent-eval-dashboard` and `lr-context-meter` render a missing or non-finite value as the localized "No data" text instead of `0` (funnel stage, metric card and its accessible name, segment legend value and title). A funnel stage with such a value has no share, drop-off or bar.
  - `lr-path-strip` names each node button with its position ("Marie Curie, node 1 of 3") and no longer announces focus through a live region.
  - `lr-transcript-feed` and `lr-message-parts` announce the "earlier parts hidden" notice when windowing starts, not on every count change while streaming; `lr-node-palette` skips an unchanged result-count announcement; `lr-ebook-viewer` no longer announces a later relocation after a toolbar navigation that did not move.
  - `lr-heatmap` and synchronized charts dismiss the shown tooltip or crosshair with Escape even when focus is elsewhere.
  - `lr-sequence-playback` holds its frame while the document is hidden and resumes when it is visible.
- 17a0be0: - `accessibleLabel` on `lr-breadcrumb`, `lr-navigation-menu`, `lr-navigation-menu-item`, `lr-command-palette` and `lr-timeline` is now typed `string | null` with a `null` default, matching every other component that mirrors `aria-label`. Migration: assign `null` (not `undefined`) to clear it; code comparing the property against `undefined` must compare against `null`.
  - Optional-peer and plugin diagnostics from `lr-chart`, `lr-box-plot`, `lr-map` controls, `lr-flag`, `lr-emoji-picker` and a rejecting `lr-combobox` `source()` are development-only and warn once per cause instead of once per instance or retry; their message text no longer ships in production bundles. `devWarnOnce()` accepts trailing detail arguments.
  - Removed pass-through lifecycle and search overrides from several components and dropped `export` from helpers only tests used; the shared anchor, file-intake and toolbar-action modules moved into `src/internal`, with the published `toolbar-actions.js` subpath kept as a re-export.
- fdb38b1: - `confirm()` renders its title as the dialog header title, its actions as `<lr-button>` elements (so `--lr-button-*` tokens and looks apply, with `variant: 'danger'` mapping to a danger button), and accepts `size`, `headingLevel` (default `'2'`) and `className` options. Code that selected the actions as native `button` elements should select `lr-button[slot="footer"]` or `[data-lr-confirm-action]`, and code that read a light-DOM `<h2>` should read `[part~="heading"]`.
  - `lr-dialog` / `lr-drawer`: `--lr-dialog-heading-font-size`, `--lr-dialog-heading-font-weight` and `--lr-dialog-heading-font-family` tokens, and a `fill-body` attribute that makes the body a column flex container whose slotted content fills the panel.
  - `lr-empty`: `--lr-empty-heading-font-size`, `--lr-empty-heading-font-weight`, `--lr-empty-heading-color` and `--lr-empty-description-color`, applied at every size.
  - `lr-badge`: `wrap` for multi-line labels and `dot` for a leading status dot; a dot-only badge named by `aria-label` takes `role="img"`, and an unnamed one warns in development.
  - New experimental `lr-help`: a "?" explanation disclosure (icon-button trigger plus popover) with a localized default name, click pinning, keyboard-focus reveal and Escape dismissal.
  - `lr-stat`: an `actions` slot and part at the inline end of the label row.
- a3635b5: - **Breaking:** `lr-data-grid` names its columns-menu trigger "Columns" through the new
    `dataGridColumns` string (was "Show all columns"). A `strings.showAllColumns` override no longer
    reaches the grid; set `strings.dataGridColumns` instead (`lr-table` still reads `showAllColumns`).
    `npx lyra-ui-migrate --origin=lyra-v31 --check src` reports each grid override, and the removed
    `threadGroupExpand`/`threadGroupCollapse` overrides of `lr-thread-list`, which have no
    replacement.
  - **Breaking:** `--lr-embedding-explorer-height` now wins over the `height` property, and `height`
    is no longer written back to the host's public property. Set one or the other.
  - **Breaking:** `lr-flow-canvas` no longer emits `lr-selection-delete` for Delete/Backspace while
    `readonly` (including when locked from `lr-flow-controls`).
  - **Breaking:** a refused or redirected select request no longer emits `lr-activate` on
    `lr-radio`, `lr-radio-group`, `lr-swatch-picker` and `lr-rating`, matching `lr-segmented` and
    `lr-tab-group`; an arrow key whose request is refused leaves focus where it was.
  - `lr-data-grid`: a `<label>`, `area[href]` or `role="link"` element inside a cell now counts as
    nested interactive content, so activating it no longer emits `lr-cell-click` or activates the
    cell.
  - `lr-menu`: toggling an enclosing menu's `top-layer` now moves an already open submenu.
  - `lr-video`: the poster play button hands focus to the control-bar play button even when 360
    hotspots are listed.
  - `lr-button-group` and `lr-control-group`: a non-empty host `aria-label` names the group even
    while `accessibleLabel` is set to an empty string.
  - `lr-memory-panel`: promotion buttons whose row text differs only past the shortened name carry
    their row position, so their names stay distinct.
  - `lr-mention-popover`: a row whose `disabled` is any truthy value is skipped by the resting
    highlight, like keyboard movement already did.
  - `lr-flow-minimap`: a partial wheel notch is dropped when the pointer leaves or the minimap
    disconnects.
  - `lr-flow-canvas`, `lr-archive-viewer` and `lr-docx-viewer` reveal source rows, archive entries
    and highlight targets without animation under reduced motion.
  - Scroll bodies that stopped overflowing while focused drop their leftover `tabindex="-1"` once
    focus leaves.
  - `lr-span-waterfall`, `lr-task-list` and `lr-trace-tree` no longer send a second source request
    when their source runtime first loads.
  - Data grids, graphs and rubric forms skip the lazy child registration check while nothing they
    render needs it, and the remaining checks run one query per update.
  - `lr-tour`: documents that an `open` declared at mount waits for `steps`.
  - `lr-phone-input`: documents that the built-in invalid edge follows `:state(user-invalid)`.
- a9446ce: Consistent names for this release's new events, attributes and tokens.

  **Breaking**

  - `--lr-callout-border` is now `--lr-callout-border-color`, the name `lr-alert` uses for the same color. `npx lyra-ui-migrate --origin=lyra-v31` now rewrites it, together with the seven `lr-checkbox`, `lr-checkbox-group` and `lr-radio-group` `-border` / `-ring` tokens that now end in `-color`.

  **Renamed before first release**

  - Tokens use `-bg`, `-radius` and the state before the property everywhere: the viewer `-action-background` tokens are `-action-bg` (`-action-hover-bg`, `-action-active-bg`); `--lr-csv-viewer-`, `--lr-dataset-viewer-` and `--lr-spreadsheet-viewer-background` / `-border-radius` are `-bg` / `-radius`; `--lr-virtual-list-active-row-background` is `--lr-virtual-list-active-row-bg`; the `lr-code-block` toggle and gutter and `lr-markdown` copy-button tokens are `-hover-bg`, `-active-bg`, `-hover-color` and `-active-color`.
  - The pointer-press tokens of `lr-activity-feed`, `lr-approval-queue`, `lr-stack-trace`, `lr-task-list`, `lr-thinking-panel` and `lr-tool-call-block` end in `-active-bg`, like every other `:active` token. `lr-trace-tree`, `lr-agent-trace` and `lr-conversation-item` keep `-pressed-bg`, because their `-active-bg` already names the current row.
  - `--lr-alert-border` is `--lr-alert-border-color`; `--lr-table-stack-label-size` is `--lr-table-stack-label-inline-size`.
  - Retrieval hover, selected and disabled backgrounds end in `-bg`, not `-fill`: `--lr-graph-legend-item-hover-bg`, `--lr-neighbor-list-node-hover-bg`, `--lr-path-strip-action-hover-bg`, `--lr-node-palette-item-hover-bg`, `--lr-knowledge-graph-explorer-source-action-hover-bg`, `--lr-graph-spatial-control-hover-bg`, `--lr-embedding-explorer-row-selected-bg` and `--lr-embedding-explorer-page-disabled-bg`.
  - `lr-widget` vetoes a view switch with `lr-widget-view-change-request`, paired with `lr-widget-view-change`.
  - `lr-tab-group` stretches its active panel with `fill-body` (`fillBody`), as `lr-card` and `lr-dialog` do.
  - `lr-thread-list` hides the pin indicator with `without-pin-icon` (`withoutPinIcon`), next to `without-group-icon`.
  - `lr-color-picker`, `lr-rating`, `lr-swatch-picker`, `lr-date-picker`, `lr-radio-group` and `lr-segmented` propose a value with the library's one cancelable `lr-change-request` (`{ value, previousValue }`) before `lr-change`. Hosts that embed them (`lr-date-input`, `lr-style-panel`, `lr-rubric-form`, `lr-retrieval-search`) keep the child's request inside.
  - `lr-table` proposes a page with `lr-before-page-change` (`{ page, pageSize, offset }`, one-based `page`), the name `lr-pagination` and `lr-data-grid` use; one event reaches the document per page action.
  - `lr-data-grid` fires one commit per action again: `lr-row-select`, `lr-sort-change` and `lr-row-expand` / `lr-row-collapse`, without the duplicate `lr-selection-change`, `lr-sort` and `lr-row-expand-toggle`. Its selection veto is `lr-row-select-request`.
  - The `lr-load` event of `lr-archive-viewer`, `lr-calendar-viewer`, `lr-contact-viewer`, `lr-csv-viewer`, `lr-dataset-viewer`, `lr-email-viewer`, `lr-geojson-viewer`, `lr-html-viewer`, `lr-spreadsheet-viewer`, `lr-svg-viewer` and `lr-xml-viewer` carries a `null` detail, like the library's other no-data events.
  - `setLyraStyle({ surfaceOpacity })`, `getLyraStyle()`, the saved style record and the theme bootstrap use the 0–1 scale of `--lr-theme-surface-opacity` (default 0.6, clamped). The `lr-style-panel` glass slider holds 0–1 and still shows a percentage.

  **Added**

  - `label-placement="start"` now also reaches `lr-time-input`, `lr-phone-input`, `lr-token-input`, `lr-otp-input`, `lr-code-editor`, `lr-signature-pad`, `lr-color-picker`, `lr-locale-picker`, `lr-country-picker`, `lr-currency-picker`, `lr-time-zone-picker`, `lr-unit-picker`, `lr-model-select` and `lr-voice-picker`, so a form mixing field controls lines its labels up in one column.
- ce63ef5: One spelling for state tokens, parts and event detail types.

  **Breaking** (`npx lyra-ui-migrate --origin=lyra-v31` rewrites every renamed custom property and reports the renamed part)

  - `lr-icon-button` state tokens put the state first: `--lr-icon-button-hover-bg`, `-active-bg`, `-hover-color`, `-active-color`, `-hover-border` and `-active-border` replace `-bg-hover`, `-bg-active`, `-color-hover`, `-color-active`, `-border-hover` and `-border-active`. Every host that forwards them (alerts, toasts, dialogs, viewers, conversation and agent tools) documents the new names.
  - Pointer-press tokens end in `-active-bg`: `--lr-token-input-edit-active-bg`, `--lr-token-input-remove-active-bg` and `--lr-time-range-handle-active-bg` replace their `-pressed-bg` names.
  - `lr-date-picker` and `lr-time-range` quick-range buttons use one vocabulary: `preset-hover-*`, `preset-pressed-*` (the press) and `preset-selected-*` (the applied preset). The duplicate `--lr-date-picker-preset-active-bg`, `--lr-date-picker-preset-selected-border` and `--lr-time-range-preset-active-bg` / `-active-border-color` / `-active-color` are no longer read.
  - Color-valued state border tokens end in `-border-color`, like `lr-checkbox` and `lr-radio-group`: for example `--lr-switch-invalid-border-color`, `--lr-code-editor-invalid-border-color`, `--lr-pagination-invalid-border-color`, `--lr-button-hover-border-color`, `--lr-select-option-selected-border-color` and `--lr-source-picker-checked-border-color` (41 tokens in total). Shorthand-valued tokens such as `--lr-icon-button-hover-border` keep `-border`.
  - `lr-thread-list` names its pin indicator part `pin-icon` (was `pin-glyph`), like the `without-pin-icon` attribute.

  **Renamed before first release**

  - The `lr-change-request` detail types are `LyraDatePickerChangeRequestDetail`, `LyraRadioGroupChangeRequestDetail`, `LyraSegmentedChangeRequestDetail` and `LyraSwatchPickerChangeRequestDetail`, like `LyraRatingChangeRequestDetail`.
- 150dd68: - `lr-rubric-form` no longer registers `lr-select`, `lr-option`, `lr-checkbox` and `lr-checkbox-group` when its entry is imported. They now register the first time a `category` key renders, and `updateComplete` waits for them. A score-and-comment rubric therefore never downloads those controls. **Migration:** code that imported `lr-rubric-form.js` only to get `lr-select` or the checkbox controls for its own markup must now import their entries directly (`components/lr-select.js`, `components/lr-option.js`, `components/lr-checkbox.js`, `components/lr-checkbox-group.js`). Code that reads a rubric's category controls right after a render should `await rubric.updateComplete` first.
  - Smaller published bundles with no change in behaviour: component stylesheets drop whitespace and terminators that punctuation makes redundant (custom property values keep their authored text), text-quote anchoring and highlighting share one offset mapper, the localization runtime resolves plural rules without the general formatter-option capture, `lr-markdown` loads its quote-search index only when it first resolves a highlight or text-quote anchor (selection anchors stay synchronous), the GreyCat highlighting grammar loads only when a `gcl`/`greycat` code block is highlighted, unused shared style fragments and frozen lookup tables are now droppable by bundlers, and source-backed components that never resolve explicit selections (such as `lr-flow-canvas`) no longer ship the selection resolver.
  - `@aceshooting/lyra-translations`: locale catalogs that contain plural messages are now packed as compactly as plain-string catalogs, shrinking the package by about 45 KB packed and 64 KB unpacked. Every catalog registers exactly the same messages.
- d8c0eb1: - **Breaking:** `lr-funnel` now owns `stages` and `comparison` like other data components. Each
    assignment is detached into a frozen snapshot of at most the first 10,000 source positions. The
    getters return that snapshot, mutating the caller's array has no effect, and calling
    `requestUpdate()` no longer refreshes a mutated array. Validation runs synchronously, so the
    chunked million-position scan and its `aria-busy` state are gone.
    - Migration: assign a new array to publish a change (`funnel.stages = [...stages]`).
    - A source longer than 10,000 positions shows a localized `limit` notice with the admitted and
      source counts.
  - **Breaking:** `lr-rubric-form` admits at most the first 500 valid keys.
    - `keys` reads back the admitted schema.
    - Values for discarded fields are dropped like any undeclared field.
    - A localized `[part="limit"]` notice follows the fields.
    - Migration: split a larger rubric across several forms.
  - **Breaking:** file sizes are now formatted by the shared Intl byte formatter on binary (1024)
    steps, the same one `<lr-format-bytes unit-step="1024">` uses. This affects `lr-attachment-chip`,
    `lr-file-input`, `lr-file-icon`, `lr-archive-viewer` and `lr-email-viewer`.
    - Units are worded by `Intl.NumberFormat` in the component's locale (`512 byte`, `1.5 kB`, `2 MB`
      in English). Sizes now reach PB instead of stopping at TB.
    - Whole amounts no longer print a trailing `.0`.
    - The `fileSizeUnitB`, `fileSizeUnitKb`, `fileSizeUnitMb`, `fileSizeUnitGb` and `fileSizeUnitTb`
      strings are retired. Remove them from custom catalogs and `.strings` overrides.
    - The public `formatFileSize(bytes, locale?)` is now a thin wrapper over that formatter. Its
      `unitLabel` and `numberLabel` callbacks are removed; pass a locale instead.
    - `FILE_SIZE_UNIT_KEYS` and `localizedNumberLabel` are no longer exported. `formatFileSize` is
      still available from the package root and from `components/media/attachment-chip/file-size.js`.
  - `lr-retrieval-trace`, `lr-chunk-inspector`, `lr-claim-evidence`, `lr-community-card` and
    `lr-rag-eval-dashboard` key their interactive rows by record id. Keyboard focus now stays on the
    same record when an earlier record is removed.
  - Provider-backed components now share one normalization of `sourcePage`, `sourcePageSize` and the
    return to page one after a query change. The pagination control's displayed page is capped at the
    largest safe page in every component.
  - Sparkline, funnel and histogram labels now share one fraction-digit rule for small values. Output
    is unchanged.
- d8c0eb1: - Breaking (behaviour): a closed `lr-tooltip` in the default `description` label mode no longer observes its slotted content, ancestors or label references. Its description, dialog-versus-tooltip role and actionability are read when content is assigned, when its trigger takes focus, and when it opens, and are kept current while open, while the trigger has focus, and always in `label-mode="label"`. Code that edits a closed tooltip's content and reads its description element or `role` immediately, without focusing the trigger or opening it, now sees the previous value. Migration: open the tooltip, focus its trigger, or use `label-mode="label"` before reading; screen-reader behaviour is unchanged because a description is only exposed in those states.
  - The companion elements `lr-docx-editor` (lyra-docs) and `lr-gen-view` (lyra-gen) now have their own `custom-elements.json`; their tags appear in the web-types and VS Code editor data, each gets a `llms/components/<tag>.md` page, and `@aceshooting/lyra-ide`'s published `custom-elements.json` lists them.
  - `normalizeHistogramBinCount` no longer throws for an object whose `toString` is undefined; it returns 0.
  - Announcement live regions in about 30 components are owned by the shared announcement controller, so a component moved to another document re-mounts its live region there.
  - Pointer drags that resize table columns and split-panel separators share one listener helper (no behaviour change).
- d8c0eb1: Give component view events their own names, so a delegated listener never receives an unrelated
  component's view change under the shared `lr-view-change` name.

  - **Breaking:** `lr-artifact-panel` emits `lr-artifact-view-change-request` and
    `lr-artifact-view-change` in place of `lr-view-change-request` and `lr-view-change`. The details
    are unchanged (`{ view, previousView }` and `{ view }`).
  - **Breaking:** `lr-graph` emits `lr-graph-view-change` in place of `lr-view-change` for a toolbar
    view switch, and `lr-knowledge-graph-explorer` lets that event bubble out under the same new
    name. The detail is unchanged (`{ view }`).
  - **Breaking:** `lr-widget` emits `lr-widget-view-change-request` and `lr-widget-view-change` in place of
    `lr-view-request` and `lr-view-change`. The details are unchanged (`{ viewId }`).
  - `lr-date-picker` keeps `lr-view-change` (`{ view, date }`), the name its Web Awesome counterpart
    uses.

  Migration: rename each listener or framework binding on these tags, for example
  `@lr-view-change` on `<lr-widget>` becomes `@lr-widget-view-change`. Detail reads and
  `preventDefault()` calls stay as they are.

  Also in this release:

  - The collapsed overflow button of `lr-chip-group` and the overflow badge of `lr-avatar-group` now
    start their accessible name with the visible text, so speech-input users can name what they see
    ("+2 Show 2 more" instead of "Show 2 more").
- d8c0eb1: Hand-rendered action buttons now share the library's icon-button and bordered-action recipes instead of copying them.

  - Migration: the tool result dialog header buttons, the tool select dialog clear button, the flow controls buttons, the graph query builder saved-delete button, the JSON viewer toggle and copy buttons, and the poll status pause and refresh buttons now honor the documented `--lr-icon-button-bg`, `-color`, `-border`, `-radius` and their hover and active variants. Where such a token is set on an ancestor it now wins over the component's own token of the same state (for example `--lr-json-viewer-copy-hover-bg`); the component tokens still apply when the shared token is unset.
  - Migration: the tool select dialog load-more button, the graph query builder run and save buttons, the diff view copy and line-highlight buttons and the random content pause and next buttons now use the shared bordered-action recipe: hover and press fills no longer apply to a disabled control, and a disabled control shows the shared disabled cursor and opacity.
  - Part names, element types, accessible names and events are unchanged.
- 723f026: Remove the remaining deprecated component events, detail fields and implicit defaults.

  ## Migration

  Run `npx lyra-ui-migrate --origin=lyra-v31 --check src` after upgrading. It reports every listener
  or binding below with its replacement and never rewrites them, because a listener may also hear the
  old name from other components.

  - `lr-calendar` no longer dispatches `lr-view-change`; listen for `lr-month-change`, which carries
    the same `{ viewDate }` detail.
  - `lr-map-anchor` no longer dispatches `lr-close-request` and `lr-close`; listen for
    `lr-map-anchor-dismiss-request` (cancelable) and `lr-map-anchor-dismiss`, which carry the same
    frozen `{ reason }` detail.
  - `lr-entity-dossier`, `lr-memory-panel`, `lr-provenance-panel` and `lr-retrieval-trace` no longer
    dispatch `lr-toggle`; listen for `lr-retrieval-disclosure-change` and narrow on `detail.kind`.
    Its detail names the disclosed item (`chunkId`, `stageId`, `memoryId`, `section`) instead of
    `itemId`; the dossier adds `origin`.
  - `lr-flow-canvas`'s `lr-edge-activate` detail no longer carries `source` and `target`; read
    `sourceNodeId` and `targetNodeId`.
  - `lr-data-grid`'s event map no longer declares the never-dispatched `lr-retry`; listen for
    `lr-retry-request`.
  - `lr-token-input` now mounts a 200-token window when `max-tokens-visible` is omitted or not
    finite. Set `max-tokens-visible="0"` to keep mounting every token; the value and form submission
    still include every token.
  - Each component now has exactly one registration module, its tag-shaped entry
    `@aceshooting/lyra-ui/components/lr-<tag>.js`. The per-directory registration files behind it
    (`components/<family>/<dir>/<name>.js`, not importable since 24.0.0) are gone, so the entry's
    types now ship at `dist/components/lr-<tag>.d.ts`. Imports through `lr-<tag>.js`, the family
    barrels, the `.class.js` modules and `all.js` are unchanged. A project still naming an old
    per-directory path gets the replacement from `npx lyra-ui-migrate --origin=lyra-v22`.
- fff6b42: Register more optional composed children on first use.

  - `lr-attachment-trigger`'s default entry registers `lr-dropdown` and `lr-menu-item` the first time it offers more than one capability, `lr-eval-dataset` registers its search `lr-input` the first time `searchable` is set, `lr-document-compare` registers `lr-document-preview` the first time `view="side-by-side"` renders, `lr-approval-queue` registers `lr-tool-approval-dialog` the first time a request opens, and `lr-rag-answer` registers `lr-grounding-summary` the first time an `assessment` is set.
  - For every composite that registers children on first use, the host's `updateComplete` now also waits for the newly registered children's first render.

  Migration: code that reads `customElements.get()` for one of these children right after importing only the host's entry must import the child's own `components/lr-*.js` entry, or await the host's `updateComplete` after it renders the child.
- e4d6610: Load optional composed controls on first use and publish smaller locale catalogs.

  - `lr-filter-bar`'s default entry registers each filter type's control (`lr-select`, `lr-combobox`, `lr-option`, `lr-date-input`, `lr-input`, `lr-dropdown`, `lr-dropdown-item`) and the `loading` spinner the first time a bar renders it. `lr-prompt-input` does the same for `lr-model-select`, `lr-voice-picker`, `lr-source-picker` and `lr-prompt-queue`, and `lr-document-library` for its tag facet's `lr-combobox`. Each control upgrades in place, and the host's `updateComplete` waits for the registrations its render started. The `components/layout` family barrel still registers every filter control up front.
  - `@aceshooting/lyra-translations` omits a message whose text equals the English default when the locale's lookup falls straight back to English (a catalog without a parent locale that shares its base language with no other shipped catalog, and the regional deltas built on it). Rendered text is unchanged; development builds do not report these messages as missing.

  Migration:

  - Code that reads `customElements.get('lr-combobox')` (or any control listed above) right after importing only `lr-filter-bar.js`, `lr-prompt-input.js` or `lr-document-library.js` must import that control's own `components/lr-*.js` entry, or await the host's `updateComplete` after it renders the control. `filter-bar-register.js` and `prompt-input-register.js` still register nothing on demand.
  - For those locales, an application-registered `en` catalog (or an application-registered standalone catalog sharing the locale's base language, such as `fr-BE`) now also answers the omitted messages, `getRegisteredLyraLocaleKeys()` no longer lists them, and a `resolveLyraString()` call without its `defaults` argument returns the key for them. Register the locale's own override with `registerLyraLocale()` to pin a message, and pass the component's `defaultStrings` as `defaults`.
- fff6b42: - `lr-map` loads the projection code for `dataLayers` and `choropleth` (descriptor model, vector-style admission and GeoJSON projection) only when one of them is set, cutting about 27 KB from the map's first-paint chunk. Until that runtime arrives the derived choropleth legend, the data extent and generated layers are absent; `updateComplete`, `whenStyleReady()` and `whenIdle()` wait for it, and an unloadable runtime shows the localized configuration error. Migration: code that reads data-layer state synchronously right after assigning `dataLayers` or `choropleth` should `await el.updateComplete` first.

### Minor Changes

- d72f7b0: Add resting color, border, sizing, and alignment hooks to chart data-table toggles. Keep agent-run metrics together while the current step label contracts.
- d7c393e: - New `lr-chord` component for weighted relationships, with proportional SVG arcs and ribbons, relationship highlighting, keyboard navigation, and an accessible data table.
- 844a92c: - New `lr-choropleth` component for coloring GeoJSON and TopoJSON regions by value, with a scale legend, keyboard navigation, and an accessible data table.
- afb2b75: Add toolbar and label controls for checkbox and radio groups, trigger labeling modes for tooltips, grouped tool timelines, and plain and icon-only export buttons. Extend theming for form labels, buttons, disclosures, navigation rails, tree rows, split-panel dividers, and chat controls. Add fill layout for tab panels and end-aligned composer toolbars.

  Keep tab strips visible beside overflowing panels. Preserve keyboard focus styling on hovered textareas and time segments, keep checkbox focus rings clear of their labels, and preserve the checked indicator on circular radios. Empty textareas and chat composers now size from their row settings even when a placeholder wraps. Segmented controls keep a 24 CSS pixel minimum target across size tiers.

  Publish runtime accessor defaults in editor metadata. Keep focus after submitting an agent question, name 3D chart rows from their IDs when labels are blank, and visibly mark a data grid's current page. Pause timed alerts while the document is hidden. Preserve anchoring when a context menu reopens during its close event. Recover signature input after pointer capture is lost and expose external signing instructions to the focused drawing surface.

  Restore default placement when an overlay or picker placement attribute is removed. Repair keyboard focus after a panel closes, a tag is disabled, or a pager reaches its endpoint. Let modified navigation keys and canceled radio keys reach their existing handlers. Keep calendar dates within ISO bounds and use Gregorian formatting for the Gregorian grid. Leave pristine form validation passive and expose authored errors to assistive technology.

  Keep replacement autoload watchers and locale bridges active during reentrant cleanup. Settle current viewer failures, leave retired response bodies unread, and localize persistent errors with the active locale. Keep a ready model mounted during same-document moves. Protect presentation search and replacement loads from obsolete work. Fix time-input forced closure, voice preview after removal, relative-time unit boundaries, and continuous map legends across large finite ranges. Allow progress indicators and dropdown APIs to be queried before the first render.

  Refresh required-field validation messages and calendar heatmap labels when the locale changes. Keep invalid JSON unapprovable when translated validation copy is empty. Preserve accessible names for media controls with blank label bindings, and send the draft displayed in the prompt queue.

  Retire obsolete media replay, search, selection, downloads, attachment picks, and approval actions when their owners change during a callback. Keep dialog names and descriptions in sync with referenced content. Restore focus after loading a button, clearing a select, or expanding a chip group. Process chip visibility changes in linear time and preserve user changes during removal.

  Restore documented defaults when formatter, alert, tooltip, spinner, keycap, and menu label attributes are cleared. Format tiny chart and map values distinctly and choose byte units consistently at power boundaries and with fractional steps. Preserve input-method navigation and keep user input events tied to the actual edit.

  Keep menu and result focus on surviving choices, and reconcile radio and checkbox submission with native form behavior. Prevent superseded overlays, viewers, and charts from acting on replacement targets. Restore cluster legends for spatial embeddings and scale extreme coordinates. Keep breadcrumb separators synced with visible items and preserve literal early ISO years in calendar and thread views.

  Keep export, widget, chip, path, approval, and stop actions tied to the item and state that initiated them. Recover emoji loading after reconnection, ignore superseded copy feedback, and preserve argument drafts when record keys arrive in a different order. Refresh menu descriptions as their references change, return focus to the memory confirmation trigger, and move focus to an available zoom control at its limit.

  Suppress duplicate OTP commits and repeated keyboard activation. Let browser-modified arrows through data and retrieval navigation, restore popup strategy and optional media defaults after attribute removal, and distinguish small nonzero values and unmeasured metrics. Correct the published checkbox group event and random-content action references.

  Split independently used form and control styles so standalone imports carry less CSS. Build optional look-mode aliases on first use. Reuse owned response storage for exact-fit reads.

  The new control surfaces and lifecycle handling add several KiB gzip to full registration. The largest standalone entry is the agent workspace, which composes the updated composer, message, viewport, and tool timeline. Richer dialog descriptions and group labels account for additional shared accessibility code. The affected bundle ceilings advance to measured 64-byte boundaries.

  The quick Chromium comparison with 31.2.1 first flagged chart assignment and select metadata at 1,000 items. A second run flagged only one 10,000-row table filter sample. Alternating published and candidate builds reproduced about 5 ms of chart settle p95 difference while chart total p95 stayed within 0.6 ms across the runs. The published chart baseline's median shifted by one animation frame, matching the first chart total median difference. The select and table follow-ups showed no consistent p95 increase. All paired runs processed the same numbers of items and passed the same correctness checks.
- 5bb1448: - `registrations.json` rows gain `lazyRegisters`: the tags in `registers` that an entry defines on first use through a lazy import rather than when the import settles (for `lr-table.js`, `lr-pagination` and `lr-skeleton`).
  - `lr-agent-question` announces a response form that fails to load with its own `agentQuestionFormLoadFailed` message (same wording in every catalog), so all seven `genView*` renderer messages ship in each locale's `conversation` slice again, as documented for `@aceshooting/lyra-gen`.
  - `lr-time-range` no longer keeps host-relationship observers when its first connection is interrupted before the first render.
  - `lr-select`'s "not in catalog" badge inside a `multiple`-mode tag uses the tag's text color, meeting WCAG AA contrast on the tag fill.
- f226c9b: Time input segments, time range handles, OTP segments and token buttons no longer act on or cancel Ctrl/Alt/Meta-modified or IME-composing keys.
  In the code editor, Tab indents selected lines while preserving their text, selection direction, and `maxlength`. An auto-resizing editor refits when its width changes.
  Textarea and code editor `rows` return to 4 when the attribute is removed; an IME-confirming Enter no longer flushes a pending settle on input and textarea.
  Signature pad: `focus()`, `blur()` and `click()` reach the drawing surface, a held Space or Enter no longer flips the pen repeatedly, and a signature assigned before layout is re-exported at the measured aspect ratio.
  Time input: the day-period segment accepts the first letter of the displayed localized label, a show request vetoed by a disabling or removing listener no longer opens, and the segment group no longer carries popup state that belongs to the expand button.
  Token input: add and remove requests keep a controlled write made by their listener, and a held Backspace removes one token.
  Phone input: the country select no longer leaks a native `input` event before the country applies, and a failed flag-module load can be retried.
  Time range: an unselected preset tints on hover.
  OTP input: the active segment ring is drawn inside the segment so the scrolling row no longer clips it.
  Token input: an edit request listener that rewrites, disables or removes the field no longer has its change overwritten by a stale write.
  Time range: the handle eases its hover paint with the shared interactive transition.

  Whitespace-only accessible names fall back to a visible label or localized name in text, time, and signature controls.
  Form fields render error descriptions before hints, match the shared field radius, and use the shared hint and error styles.
  Text inputs follow the entered text direction. Numeric and code entry keep a left-to-right base direction in RTL layouts.
  Time input emits one change pair when the last visible segment of a previously complete time is cleared. A partial draft emits input only. Time segments and input actions follow the shared interaction transition.
  Signature pad announces when a drawing reaches its stroke or point limit.
  Signature pad supports `readonly` and emits `lr-clear` after the Clear button empties it.
  Token input forwards autocomplete, keyboard mode, and Enter hints to both text fields.
  Textarea, phone input, token input, and OTP input expose theme tokens for placeholder colors.
  Signature pad updates the active stroke path incrementally and reuses committed paths when supporting text changes.
  Code editor Tab indentation participates in native undo and redo. Scrolling reuses live text metrics and respects changes to the textarea’s line height.
  Textarea and code editor retain native editing when a resize observer cannot attach.
  Token input, phone input, OTP input, code editor and signature pad accept the shared `--lr-form-control-invalid-border-color` theme override.
  Signature pad exposes surface and clear-button paint tokens. Code editor accepts the shared field padding and font-size tokens for both text and line numbers.
  Code editor applies its fill color to the line-number gutter.
  Textarea and phone input return `null` for the selection direction before their native fields render.
  Auto-resizing textareas resolve percentage height limits against the available space as their parent resizes.
- 8e9ad29: - Checkbox, switch, radio, slider and picker key handlers preserve modified, composing and previously handled keystrokes.
  - Holding Space activates a radio once.
  - Checkbox, switch and standalone radio events carry the user's original edit even when an input listener writes another value.
  - Slider input and change events report the position that triggered each event.
  - Checkbox, radio and toggle group change events include the previous selection and the option that initiated the edit.
  - Checkbox and radio groups present errors before hints. Address the named error and hint parts when styling either message.
  - Checkbox group and combobox accept the `helpText` property and the `help-text` attribute and slot aliases.
  - A combobox accepts `defaultValue` and `default-value` as its form reset baseline.
  - Combobox selection, removal, creation and clearing emit a cancelable `lr-change-request` before committing.
  - Select omits `aria-activedescendant` while no option is active. Use attribute presence to detect active navigation.
  - Select type-ahead and combobox filtering match accented labels with unaccented input.
  - Select and combobox format the complete accessible selection in the control's locale.
  - Select and combobox reuse the accessible selection text across unrelated renders.
  - Select and combobox keep the current option visible in forced colors. Radio buttons and switches preserve their checked foreground on hover.
  - Disabled combobox options retain their resting appearance under the pointer.
  - Combobox handles unsupported validator flags and displays its validation fallback when a validator returns an unreadable flag.
  - Combobox clears pending loading state on disconnect and can reuse cached source rows after reconnection.
  - A current combobox source that independently rejects with `AbortError` shows a retry action and emits `lr-source-error`. Superseded requests retire silently.
  - Toggle group forwards accessible name and description references to its role owner across document adoption.
  - A toggle released by a toolbar retains the `tabindex` most recently supplied by its author.
  - Radio groups omit an individually disabled checked radio from form submission and restore its value when re-enabled.
  - Radio button adornments retain their size beside long labels.
  - Horizontal sliders retain usable tracks in shrink-to-fit and narrow containers.
  - Switch hints and errors align with the label in either writing direction.
  - Reporting an invalid checkbox or radio group preserves the positions of its choices.
  - Select popups respect their allocated inline space.
  - Stacked select chips leave room for the clear button and chevron.
  - Combobox preserves the label and payload of a chosen suggestion, including when other suggestions share its value.
  - Sliders reserve room for endpoint hit targets and remove inactive value bubbles from layout. The vertical track length includes the endpoint reserve.
  - Slider thumbs, checkboxes and switches follow the shared interaction transition.
  - Select and combobox skip hidden and ARIA-disabled options and update their open rows when option availability changes.
  - Reselecting a combobox option after editing its value updates the submitted value in place, including among duplicates.
  - The custom elements manifest identifies the combobox text selection methods so editor tooling can offer their signatures.
- 67673cb: Emoji pickers also emit `lr-activate` after the existing native and Lyra events on every pick, including a repeated selection.
  Color, date, swatch and rubric value events also carry `previousValue` alongside `value`.
  Keep browser shortcuts, text composition and held activation keys from triggering unintended picker actions or repeated rubric submissions.
  Distinguish button, icon-button and color-picker trigger hover and press in forced-colors mode.
  Keep locale and date-input popups within the available space on both axes.
  Isolate locale labels and left-to-right locale identifiers in bidirectional layouts.
  Expose today's date and current period to assistive technology in the date picker.
  Announce form errors before hints on date inputs, emoji pickers, color pickers and rubric forms.
  Surface invalid date-input validator results as localized validation errors.
  Announce the displayed calendar page after activating a previous or next navigation button.
  Keep the selected custom swatch icon outlined when its glow is zero.
  Keep emoji search and virtual scrolling usable when the browser rejects resize observation.
  Remove a rejected open attribute from disabled and readonly color pickers and expose readonly on their inline sliders.
  Release focus from the active nested editor when calling blur on a rubric form.
  Resolve color-picker colour names in the picker's own document, so iframe-hosted pickers parse named and modern CSS colours.
  Mark the selected color-picker swatch with an icon (`swatch-check` part) instead of a text glyph, and dim disabled swatches with `--lr-opacity-disabled`.
  Mix hover and press over the existing fill of selected emoji cells, date-range days and the rubric submit button instead of replacing it.
  Add `--lr-emoji-picker-grid-max-height` to cap the emoji grid.
  Show a not-allowed cursor on disabled date-input actions and a default cursor while readonly.
  Join currency names and symbols with the locale's list pattern.
  Forward date-input `strings` to its popup calendar navigation labels.
  Name emoji options from their glyph and groups from the localized fallback when a caller label is whitespace.
  Add a `pressed` property to icon buttons for toggle actions.
  Keep catalog pickers usable when the search field fails to load, and offer a localized retry.
  Type the popup lifecycle, activation and clear events on all four catalog pickers.
  Theme the catalog pickers' resting invalid borders without overriding focus or open styling.
  Format secondary catalog identifiers and symbols with the locale's list pattern.
  Mount the color picker editor only while the popup is open or inline.
  Reuse unchanged rubric score choices when editing another field.
- c768915: - Tooltips honor inherited `--lr-overlay-radius` and `--lr-overlay-shadow-anchored`. To retain the previous geometry in a themed container, set those properties on the tooltip to `var(--lr-radius-xs)` and `var(--lr-shadow-m)`.
  - Alerts and toast items emit a cancelable `lr-close-request` and a committed `lr-close` with the dismissal reason for button, timer and programmatic closes.
  - Alerts support the shared `appearance` values and scoped tokens for panel background, border, text, radius and shadow.
  - Spinners, keyboard caps and chip-group overflow controls expose component-specific paint tokens.
  - Alerts and callouts give the full message row to content when the icon and close control are absent.
  - Long dialog and drawer titles wrap within the panel.
  - Drawers respect the safe-area insets at the edges they occupy.
  - Progress indicators, filled rating symbols and selected chips remain distinguishable in forced colors.
  - Keyboard shortcuts keep their reading order in RTL.
  - Keyboard shortcut announcements use a localized separator.
  - Rating and dropdown controls preserve browser-modified keystrokes and input-method composition.
  - A callout discards a close request if its listener removes it, closes it or disables its close control.
  - Alert and toast close buttons follow the shared icon-action styling.
  - A confirmation stays open when nested content dismisses itself.
  - The rating, toast region and toast-item element getters return `null` before their first render.
  - Toast creation retries failed registration.
  - Toast overflow announcements format counts in the active locale.
  - An announcing skeleton speaks its current label once after reconnecting, including when labels change before paint.
  - Removing the popup's `arrow-padding` attribute restores its default.
  - Attribute-only tooltips update their descriptions while remaining concealed. Changes to fallback text reuse the current slotted description.
  - A popover dismisses an outside press even if the target stops propagation.
- 71a8b37: Rail item and group toggles accept optional stable-name keys `appRailItemToggle` and `appRailGroupToggle`; the state-specific keys keep working when those are not supplied.
  Assigning `open`, `railWidth`, or a menu item's `checked` inside its request listener resolves the request, including a write of the held value.
  Read-only steppers retain focus on the list when they replace a focused step.
  Steppers expose progress and error states as localized text and restore orientation defaults when their attributes are removed.
  Tabs, segments, steps, and rail items distinguish selected or current states in forced colors.
  Navigation controls ignore composing and modified navigation keys. Holding an activation or close key triggers one action.
  Navigation landmarks and groups forward host descriptions to their semantic owners and support consistent label properties.
  Menu item details and shortcuts describe the item while its visible action text supplies the name.
  Tab groups and segmented controls suppress stale selection notifications. Tab groups report a replacement selection after rendering it.
  Tab buttons honor descriptor labels and live label references. Screen readers can close individual tabs using named actions.
  Steppers and segmented controls expose the number of input positions beyond their collection limits.
  Menu and menubar items emit show and hide notifications when their menus change state.
  Rail resizing, navigation indicators, and segment scrolling use layout coordinates under scaling. Navigation menus respond to resizing when ResizeObserver is unavailable.
  Navigation components expose additional chrome and interaction color tokens. Current rail rows show hover feedback and rail tooltips use the shared overlay surface.
  Rail backdrops respect reduced motion and stop intercepting input when closed.
  Breadcrumbs, navigation links, and tab panels keep emergency wrapping scoped to their labels.
  Menu type-ahead matches labels without regard to accents or case.
- 376f3e2: - Give multi-page autoplay carousels a localized pause and resume button.
  - Distinguish the current carousel page by its border and preserve selected carousel and widget states in forced colors.
  - Keep carousel, card, scroller and widget keyboard focus indicators visible while hovering or scrolling.
  - Preserve a card’s accent stripe during interaction, respect canceled clicks and allow calling `click()` before rendering.
  - Forward host descriptions to interactive cards, disclosure triggers and modal panels, and accept programmatic accessible names across layout containers.
  - Return focus to the widget collapse button when collapsing a focused body and use meaningful fallback names for blank widget view and dashboard cell labels.
  - Honor synchronous state writes in widget fullscreen, page navigation and responsive panel close requests.
  - Preserve browser shortcuts, composing input and nested editor keys during carousel, scroller, dashboard and reorder-list navigation.
  - Keep the current carousel slide across DOM moves and use the declared defaults for empty autoplay intervals and dashboard column counts.
  - Size and place carousel slides and dashboard gestures correctly under scaling, and use layout width for page and panel breakpoints.
  - Paint sticky page menus and asides with configurable backgrounds and omit empty page landmarks.
  - Add spacing and surface controls for widgets, responsive panels, accordions, scrollers and carousels.
  - Show dashboard resize grips at rest and reserve the cell hover outline for draggable cells.
  - Skip unavailable accordion items during keyboard navigation, match trigger heights to the size tier and preserve settled events when moving an item within its group.
  - Limit carousel and dashboard mutation observation to the content each mode needs and scope post-drag click suppression to the originating component.
  - Give the focusable carousel viewport its own localized accessible name.
  - Deliver Details toggle and after-events when a disclosure moves during a transition.
  - Add opt-in measured sticky offsets for page regions with wrapping or changing content.
- 8e9ad29: - Keep screen-reader-only row text visually hidden in virtual lists.
  - Preserve the virtual list’s keyboard focus outline while the pointer is over it.
  - Give sticky virtual-list headers a themeable background and identify each row’s group for assistive technology.
  - Request another page when appended virtual-list items leave the end in view.
  - Give command-palette search a named combobox linked to its results.
  - Respect modified, composing and already-handled keys in the command palette and panel dividers. Holding Enter activates a command once.
  - Preserve text editing in command search. Home and End navigate results when the caret is already at the requested boundary.
  - Discard a pending command action if a selection listener removes, replaces or disables the command or replaces its callback.
  - Discard a multi-split resize proposal when a listener changes its layout.
  - Honor an explicitly empty collapsed-panel set assigned after a saved multi-split layout has been restored.
  - Support disabling resize interaction on dock and multi-split panels.
  - Restore dock sizing defaults when extent attributes are removed.
  - Honor the dock handle’s authored accessible name and ignore whitespace-only labels on panel controls.
  - Expose theme settings for dock resize lines and drilldown panel spacing.
  - Preserve the intrinsic width of content in split, multi-split and drilldown panels.
  - Keep focus in the drilldown panel when navigation replaces a focused breadcrumb.
  - Let events from nested drilldown tab groups reach their listeners.
  - Restore focus to a filter field when resetting the last active filter disables the reset button.
  - Keep filter-control selection requests, popup events and diagnostics inside the filter bar.
  - Isolate mixed-direction filter chip labels and values.
  - Align the filter bar’s loading spinner with its reset button.
  - Avoid remeasuring unchanged multi-split dividers when a gutter changes size.
  - Keep the keyboard-active command selected when the pointer hovers another result. Click to select the hovered command.
  - Consume multi-split resize keys at a limit so the surrounding page stays in place.
  - Enable filter Reset whenever a value differs from its default, including when the chip row is empty.
- c768915: - The table's additional-columns button exposes its state with `aria-expanded`. Supply a `tableAdditionalColumns` string to give it one constant visible name, with the show and hide labels as action tooltips.
  - Use the shared pagination controls in the data grid, with compact page jumps, range summaries, unknown server totals and zero-based page events.
  - Veto grid or table paging before it commits, including when a synchronous listener changes the destination.
  - Observe grid sort, selection and expansion through the collection events. Veto selection and expansion requests before keys change.
  - Report page resets caused by sorting, searching or filtering. Suppress repeated selection notifications when the keys stay the same.
  - Resume listener-driven grid data requests after the grid moves during a pending load.
  - Bound selection and expansion key ingestion, and expose omitted document counts and configurable local admission limits.
  - Find accented text with unaccented queries in default searches and announce result counts. Use locale-aware plural categories for count overrides and localized lists for provider tags.
  - Identify rows and columns in control names. Keep focus indicators visible inside scrollports and forced-color selection indicators distinct.
  - Preserve browser shortcuts and composing keystrokes. Move table focus by a page and skip unavailable targets.
  - Forward spellchecking, capitalization and correction to grid search and column-filter inputs.
  - Keep pinned grid headers opaque during pointer interaction and raise pinned cells containing open overlays.
  - Customize table row and sortable-header pointer colors and honor interactive motion preferences.
  - Preserve themed padding on resizable table headers and allow narrow flex layouts to shrink.
  - Keep longer page numbers visible in the compact pagination field and preserve link semantics for unavailable destinations.
  - Delay CSV download URL cleanup in the grid’s owner window. Recognize dates and set filters from other windows.
  - Load the grid’s optional column-menu controls when the menu is enabled.
  - Apply consistent CSV formula protection across delimiters while retaining finite numeric values. An empty delimiter uses the format’s default separator.
  - Honor sort-direction changes made by a table sort accessor on the next read.
- 96166b2: Data visualization navigation and activation handlers leave Alt, Ctrl, Meta and IME-composing keys to the browser.
  The heatmap and word cloud clear their drawn focus rings on blur. Word cloud keyboard focus announces the current word, including the first word on initial focus.
  Heatmap matrix-source tooltips open beside the pointer and can be dismissed with Escape. Calendar-mode labels use the Gregorian calendar.
  Small values and shares in heatmap tooltips and labels, sparkline summaries, and the context meter keep their significant digits.
  Funnel stage numbers and sequence-strip legend counts are isolated from adjacent RTL text.
  Funnel bars, sequence-strip cells and markers, word-cloud and heatmap legend swatches, gauges, and sparklines preserve data paint in forced colors.
  Sequence-strip tooltips wrap, fit inside the strip, stay opaque over disabled cells, and close on Escape. Enabled cells expose a keyboard activation hint.
  Gauges ignore malformed thresholds, fit narrow containers, and keep linear captions proportional as the track resizes.
  The sparkline no longer clips its first and last points.
  Linked stats deliver one click to host listeners.
  Calendars announce month navigation and preserve hover feedback on selected days, and report month navigation with `lr-month-change`.
  The context meter uses its summary as a fallback name and emits `lr-segment-selection-change` after a default selection toggle.
  Stats and context meters show when a collection exceeds the input limit.
  Sparkline marks, stat exact-value hover color, and calendar event hover tint have component theme tokens.
  Heatmaps accept equivalent CSS color spellings and require canonical Gregorian dates for calendar cells.
  Cancelled heatmap drags suppress their own release click without swallowing later clicks.
  Canvas-only heatmaps build the cell index on demand, and sparklines reuse line geometry across unrelated updates.
  Static sequence strips mount a source announcement region only when a source is assigned.
  Funnel rendering tolerates revoked arrays and reads array limits without invoking a length getter.
  Stat values expose their exact text to assistive technology, including when the card is a link.
- 8e9ad29: - `lr-video`: the timeline range now shows a visible keyboard focus ring and a forced-colors-safe track and fill.
  - `lr-video`: activating the poster play button keeps keyboard focus on the player instead of dropping it to the page.
  - `lr-video`: the scrub preview stays inside the player, removing the volume attribute restores the default volume, muted autoplay is skipped under reduced motion, and an unread thumbnail response body is released.
  - `lr-video`: adds `toggle()` as an alias of `togglePlay()`.
  - `lr-av-player`: marks the playback position on the timeline with a playhead (`timeline-playhead` part), names each highlight marker with its time range, and accepts Up/Down/PageUp/PageDown on the timeline.
  - `lr-av-player`: transcript search ignores accents, the current cue stays distinguishable in forced colors, caller cue text isolates its direction, and an authored playback rate no longer emits `lr-rate-change` at mount.
  - `lr-video-playlist`: swapping videos keeps keyboard focus inside the playlist, and row navigation clamps at the ends.
  - `lr-animated-image`: a load that finishes while the element is detached is kept, and focus returns to the play button after a source change.
  - `lr-animation`: removing `iterations` restores the infinite default.
  - `lr-sequence-playback`: removing `interval-ms` restores the default interval, and `autoplay-interval` is accepted as a second spelling.
  - `lr-flag`: the inset ring is drawn above the image and the loading skeleton follows the flag shape and radius.
  - `lr-qr-code`: modules are painted in a single path.
  - `lr-video`: the timeline range now carries a localized `{current} of {duration}` `aria-valuetext` and the volume range a localized percentage.
  - `lr-video`: a non-blank host `aria-label` now gives the host a `region` role so the name has an owner, and `title` names the native video the same way whether it is set as an attribute or a property (a `title` attribute no longer forces the generic "Video player" name).
  - `lr-video`: adds a `playbackRate` property (attribute `playback-rate`) that applies to the native video, survives source changes and follows native rate changes; WebVTT thumbnail parsing now loads on demand.
  - `lr-av-player`: highlight markers paint their true time range, with a pointer target extending around short markers and kept inside the timeline.
  - `lr-av-player`, `lr-video-playlist`, `lr-animated-image`, `lr-sequence-playback`: new state tokens `--lr-av-player-rate-select-hover-bg`, `--lr-av-player-rate-select-active-bg`, `--lr-av-player-cue-match-color`, `--lr-video-playlist-item-hover-bg`, `--lr-video-playlist-item-hover-border-color`, `--lr-video-playlist-item-active-bg`, `--lr-animated-image-control-box-bg`, `--lr-animated-image-play-button-hover-bg`, `--lr-animated-image-play-button-active-bg` and `--lr-sequence-playback-play-button-hover-border-color`.
  - `lr-flag`: a flag peer import that fails for a reason other than a missing package is reported as a load failure instead of an install instruction, and is retried by the next flag resolution.
  - `lr-video`: the elapsed/duration readout follows the translation's order and separator through a new `videoTimeReadout` message.
- 376f3e2: - Keep lightbox loading and error messages legible over the backdrop in dark mode.
  - Report lightbox index corrections after the replacement image renders.
  - Respect browser shortcuts and input composition in image navigation and annotation.
  - Apply icon-button theme colors, borders, and pointer transitions to viewer toolbar controls.
  - Show and announce localized image and video load failures in media cards and pan-and-zoom frames.
  - Announce the image highlight limit and keep highlight labels within the image’s top edge.
  - Announce consecutive file selections and use the numeric count for localized plurals.
  - Limit visible and spoken file rejections to 20 reasons and a remaining count.
  - Limit file-input thumbnail previews to the first 50 rows while keeping every selection available.
  - Cancel pending folder selections when a file input resets or restores form state.
  - Include the accepted batch in typed file-input events in non-retaining mode.
  - Apply MIME policies and per-file, count, and total-byte limits in attachment pickers, including externally held files.
  - Restore the default accept filter after attribute removal and use localized names for blank attachment action labels.
  - Give targeted drop overlays a configurable stacking level and distinguish drag states in forced colors.
  - Expose image-comparer divider and handle colors and keep the divider visible in forced colors.
  - Preserve a media card’s plain frame while its action is pressed.
  - Keep file icon labels readable alongside descriptions and sizes in narrow layouts.
  - Let shrink-to-fit iframe previews follow their allocated dimensions.
  - Include the visible filename in file-card action names, including localized untitled files.
  - Report the rendered zoom or image index after navigation settles. Synchronous actions in one render report their final destination.
  - Accept read-only file-count and drag-state bindings while keeping the underlying state derived from file and drag operations.
  - Theme media control hover and press states, file preview geometry, and avatar overflow badge rings with component-level properties.
  - Match drag verdict tints across file inputs and drop targets and scale rejection text with the field.
  - Synchronize iframe theme properties without enumerating standard CSS longhands.
  - Use the visible label or localized instruction to name file inputs when the host `aria-label` contains only whitespace.
  - Reduce the standalone image-viewer bundle while preserving region-anchor navigation and highlights.
- f226c9b: Conversation list, feedback and message-item controls leave modified and IME-composing keys to the browser and input method.
  Conversation rows discard an in-progress rename when their conversation ID changes.
  Message feedback skips its persistence request when a change listener invalidates the rating or detaches the control.
  Message-part retry controls ignore clicks for parts that have been replaced.
  Whitespace-only conversation labels fall back to localized names or visible content.
  Branch picker announces the next navigation after a move between parents.
  Typing indicator stays quiet when it moves between parents with the same label.
  Stream status restores the 10000 ms stall threshold when the attribute is removed.
  Stream status announces connecting, streaming, interrupted, and idle transitions.
  Generation metrics captures the final elapsed time when a run completes.
  Streaming text core preserves Markdown highlight state across renders when no languages are supplied.
  Plain streaming text and message parts take their direction from the caller's text.
  Message actions can reveal on interaction when placed directly inside a shadow root.
  Chat viewport announces messages after a bounded wait when their busy state persists.
  Chat viewport reports every follow flip after mount, from scrolling, the jump button, `scrollToBottom()` or a direct `follow` write.
  Thread list sticky group headers expose a background token.
  Thread list search matches accented titles and excerpts with unaccented queries.
  A throwing thread filter excludes the affected row and keeps the list usable.
  Thread row action names include the thread title or ID.
  Thread list skips rows inside hidden wrappers during keyboard navigation.
  A throwing message-part renderer falls back to the built-in rendering.
  Transcript feed isolates speaker names for mixed-direction text.
  Chat message retry names include the message ID when supplied.
  Conversation rows take their default names from visible custom content.
  Conversation rename inputs restore the browser's autocorrect default when the host removes an authored hint.
  Suggestion chips wrap unbroken labels and draw the keyboard focus outline inside scrolling rows.
  Decorative separators in generation metrics and usage badges carry empty alternative text.
  Usage badge tooltips use the shared overlay surface and border tokens.
  Thread lists load pagination and error controls on demand. Message feedback loads its chip control when reasons are present.
  Thread lists keep each group usable when its label or adornment callback fails.
  Thread lists refresh row content when its inputs change and update changed excerpts independently.
  Thread group chevrons support themed transforms, RTL and reduced motion.
  Message parts and transcript feeds show and announce how many older items their render windows hide.
  Transcript history and its caption log have distinct accessible names.
  The branch picker, message actions, conversation item and suggestion chips support disabling all built-in controls.
  Message parts supports an explicit accessible group label.
  Markdown render errors propagate through both streaming text variants.
  Resume controls in stream status and message parts use the shared button theme and support long labels.
  Chat messages and message parts preserve whole-word intrinsic sizing in narrow layouts.
  Selected feedback thumbs retain their own fill during hover and press. Closing feedback details removes unused spacing.
  Checkpoint rules remain aligned when its controls wrap.
  Conversation controls expose shared icon-action styling and component tokens for message retries, row hover, handoff dividers, checkpoints and suggestions.
  Transcript jump controls support theming, long localized labels and reduced motion.
  Usage badge and generation metric separators stay with the preceding value when metrics wrap.
- 67673cb: Set `composer-disabled` and `heading-level` to disable the workspace composer or integrate its headings into a page outline.
  Style the workspace, model settings panel and queue items with component background, border, radius and padding tokens.
  Host label references and descriptions reach the workspace, prompt queue and realtime session regions.
  The composer preserves keyboard shortcuts and submits once per Enter press.
  The prompt input preserves shortcuts while suggesting completions and dismisses stale insertions after selection moves.
  The source picker shows its disclosure marker and the prompt input reports admission limits across its collections.
  The push-to-talk control supports click-only activation, ignores secondary buttons and ends a hold released outside the trigger.
  The recording pulse centers the built-in and slotted recording icons.
  The model picker exposes the draft query while typing. Re-selecting the current model or voice closes the picker quietly.
  Voice preview failures announce a localized message.
  The model settings panel reports temperature corrections after rendering.
  The selection toolbar announces successful copies and ignores superseded clipboard completions.
  The widget renderer clears content before reporting a new document failure.
  The prompt queue uses shared pagination buttons and retains the page-button styling hook.
  The composer returns null for unavailable selection endpoints, and class-only prompt and workspace imports avoid loading the editor.
  Whitespace-only labels fall back to localized names across the conversation controls.
  Model, voice and push-to-talk triggers support themed hover and pressed backgrounds. The composer supports a themed focus border and disabled picker options use the shared opacity.
  The Sources disclosure visibly dims when disabled.
  Audio visualization continues when resolution media queries are unavailable.
  Blank maximum-row and temperature-maximum attributes restore their defaults. A blank visualizer level restores ambient behavior.
  The model settings panel forwards size and readonly to both fields. A readonly prompt locks its built-in pickers, queue editing and attachments.
  The realtime session can disable its built-in controls and configure its recorder and transcript.
  The composer coalesces width changes into one resize per animation frame, including after a move between documents.
  At widths below 40rem, the prompt queue puts actions on a separate row so translated labels leave room to edit.
  The selection toolbar coalesces viewport changes and leaves focus and pointer styling to its action buttons.
  Widget text wraps at narrow widths. Updating one widget binding preserves unrelated property values and event subscriptions.
  Audio visualization reuses sample buffers and limits waveform drawing to the backing canvas width.
  Set `stream-only` on push-to-talk to receive chunks without retaining a full recording in memory.
  Voice previews release their audio source on stop, failure, and disconnect.
  Model and voice pickers omit empty hint descriptions when the only supplied content uses an unsupported slot.
  Editor metadata lists the chat composer's selection operations as methods.
- 8e9ad29: Failed syntax and math imports can be retried. Custom grammar loaders should support a second call after rejection.
  Code blocks load bundled syntax support on demand and retain plain source when a highlighter fails.
  Code blocks and Markdown retain highlighting across moves and restore annotations after reconnection.
  Code block gutters respect browser shortcuts, input composition, and held activation keys.
  Highlighted and active code lines have localized descriptions and a visible edge.
  Code block copy actions announce clipboard outcomes. Markdown fences also emit the generic clipboard error before the detailed failure.
  Markdown reports property-driven render errors after displaying the fallback, allowing listeners to supply replacement content.
  Code blocks expose padding, corner radius, header colors, and gutter color for theming.
  Numbered code rows keep their spacing when the gutter becomes interactive.
  Plain Markdown fences support separate background colors and use code line spacing in both palettes.
  Markdown copy controls honor icon-button styling, and text highlights remain visible in forced colors.
  Whitespace-only labels fall back to the code region name or the document's implicit naming.
  Markdown preserves focus when the containing document cannot report its active element.
  Core code blocks accept a missing grammar map and start highlighting when a map is supplied.
  Markdown reads initial script content through its first render and preserves explicitly cleared content across moves.
  Collapsed code blocks paint a single lower border, and short language labels remain legible beside long filenames.
  Markdown applies link-target protections to authored forms.
  Markdown limits explicit math sizes to 20 em and macro expansion to 1,000.
  Code block disclosures expose their state through `aria-expanded`. Supply a `codeBlockToggle` string to give them one stable accessible name; `expandCode` and `collapseCode` keep working otherwise.
  Code block disclosure requests respect synchronous writes to `collapsed` and stop if the listener removes the disclosure.
  Code block headers track slotted controls in the code block's current document.
  Style Markdown's minimum content size and the resting, hovered, and pressed backgrounds of fenced copy buttons, code block disclosures, and line buttons.
  Markdown paints neutral highlights on the raised surface color so they remain visible against the document background.
  Plain Markdown streaming updates without animation frames. Progressive streaming continues when the browser pauses those frames.
  Fenced Markdown copy feedback stays independent for each fence, and a later click supersedes an earlier write for that fence.
  Markdown and code blocks distinguish unresolved optional peers from import failures in development.
  Markdown requires spaces or tabs after closing fence markers.
- 71a8b37: - `lr-mcp-app` no longer throws on pages served over plain HTTP, closes a bootstrap port it cannot deliver, and shows its unavailable state if the browser cannot provide secure random bytes.
  - `lr-tool-param-form` marks required enum, array, boolean and number fields as required for assistive technology and paints the required marker, and falls back to the property key for a blank schema title.
  - Approval queues emit `lr-approval-close` and tool timelines emit `lr-tool-approval-close` when review ends. The nested dialog's `lr-decision-settled` notification stays inside each component.
  - `lr-confirm-bar` drops a pending `waitUntil()` decision when the proposal is rebound, so a late save can no longer decide the new proposal.
  - `lr-tool-result-dialog`, `lr-tool-approval-dialog` and `lr-tool-select-dialog` make their capped body a named keyboard tab stop only while it overflows.
  - `lr-permission-rules` keeps a read-only decision focusable, names a rule with a blank label from its scope, and isolates the scope text.
  - `lr-tool-timeline` words a grouped summary by status. Set `groupSummary` or the `summary` slot to use the same wording across statuses.
  - `lr-tool-result-view` announces a lazily loaded renderer.
  - `lr-approval-queue` keeps the decision badge of a resolved request at full strength, isolates the tool name and request id, and `lr-permission-grant` and the approval dialog's JSON editor stay left-to-right in right-to-left pages.
  - `lr-policy-summary` forwards a nonblank host `aria-label` to the decision list. Omit the attribute to retain the localized list name.
  - Tool dialogs share overlay surface, border, radius and shadow tokens. The result and search actions use the icon-button theme.
  - Tool selection matches accents, announces the filtered count, and reuses search results while updating selection.
  - Tool approval, selection and result dialogs support cancelable user dismissal. Result dialogs report an accepted maximize or restore action.
  - Approval queues and timelines report when a review opens or closes. Dismissing nested content keeps the review open. Both wrappers forward deferred approval decisions. Set `disabled` to prevent decisions.
  - Approval queues, tool approval dialogs and tool selection dialogs support configurable heading levels.
  - Tool call activation, disclosure and render failures carry correlated invocation identifiers. Chip categories and request identifiers are included in control names.
  - Timeline loading failures show a localized message and retry on the next review or disclosure. Result views report normalized status changes.
  - Parameter forms refresh translated validation messages and capture values bound before first render as the reset default.
  - Native parameter and permission controls follow form-control sizing. Permission rules support cancelable changes.
  - Decision panels share legend and status theme controls. Selected approvals and timeline markers remain visible in forced colors.
  - Tool call blocks preserve renderer wrapping. Tool chips keep decorative separators out of the accessible name.
  - Confirmation bars load argument viewers on demand. Server renderers that use these viewers can import the `details` and `json-viewer` entries explicitly.
  - Embedded app loading feedback preserves frame layout and supports a CSS height override.
  - Tool dialogs release their scroll body observers while detached and restore keyboard scrolling when reconnected.
  - Timeline entry updates leave the closed approval dialog idle.
- 8e9ad29: Budget meters expose the `meter` role. Small nonzero percentages and nearly full budgets retain their precision, and formatted quantities and units keep their reading direction in bidirectional text.
  Keep a localized accessible name when the heading of a budget meter or agent question is hidden.
  Keep keyboard focus in the current workflow when run actions change, a span leaves the timeline, a question changes state, or a task list collapses.
  Preserve browser shortcuts and composing keystrokes in run trees, span timelines, reorderable tasks, and highlighted terminal output.
  Keep selected rows, budget and progress fills, span bars, activity indicators, and header feedback visible in forced colors.
  Draw keyboard focus rings inside clipped rows, frames, and terminal lines.
  The span bar rectangle now measures painted duration. Hit-testing the track includes the extended pointer target for short spans.
  Identify repeated run actions by run, expose subagent progress to assistive technology, and include a per-run attempt number in retry events.
  Keep fallback task-list state across equivalent run updates and contain events from internal form, task-list, and terminal controls.
  Respect a toggle-request listener that closes, removes, or updates a thinking panel or activity feed before the toggle commits.
  Announce submitted questions after reconnection and announce clipboard results in stack traces and terminal output.
  Show and announce a localized terminal note when an input or line exceeds its character limit.
  Report terminal text selection on key or pointer release inside the viewport, once for unchanged endpoints. Listen on the selected content's owner for selections elsewhere on the page.
  Recognize shared completion, failure, and cancellation spellings in task lists.
  Observe streamed thinking-panel content only while the expanded live transcript follows new output.
  Load question form controls when a schema is supplied.
  Navigate background runs and reorderable tasks with arrow keys and a single active row.
  Stack background-run actions in compact layouts and announce newly truncated run lists.
  Keep the count-based internal-frame disclosure label stable and recognize patterns from another window.
  Use a host accessible name for trace trees, agent traces and thinking-panel transcripts.
  Choose a compact density or card frame for budget meters, agent traces, trace trees and span waterfalls.
  Set the number of spans shown in an array-mode waterfall with `max-nodes`.
  Customize activity-header, trace-row and handoff pointer colors and distinguish over-budget meter fills.
  Keep short spans visible and omit disabled metric columns from trace-tree layouts.
  Keep terminal search results visible alongside keyboard focus and limit pointer feedback to interactive lines.
  Handle structured run statuses and lifecycle names that match inherited JavaScript properties.
- 8e9ad29: Fix the review, schema and context inspectors for assistive technology: validation issue severity and redacted ranges are now announced as text, hunk Keep/Discard and prompt-studio message actions name their item, blank hunk, pane and test names fall back to the default name, and render-limit notices are announced.
  Fix `lr-commit-card` and `lr-artifact-panel` copy outcomes being silent to screen readers, `lr-commit-card` line counts reordering under right-to-left text, and listener-written `files-expanded` values being overwritten.
  Fix `lr-artifact-panel` restoring a version other than the one shown, and report its automatic fall back from the code view with `lr-view-change`.
  Fix `lr-json-schema-viewer` constraint rows not being indented with their node.
  Fix `lr-test-results` filter changes having no cancelable `lr-filter-request` and no announcement of the shown count.
  Fix `lr-browser-frame` throwing when the `url` attribute is removed, and distinguish ping kinds by line style in forced-colors mode.
  Fix `lr-eval-dataset` emitting `lr-example-select` from inside an update, `lr-eval-run` approval helpers throwing before first render, and Object.prototype-named status kinds in `lr-eval-run` and `lr-agent-eval-dashboard`.
  Add a cancelable `lr-view-change-request` to `lr-artifact-panel`, a cancelable `lr-example-select-request` to `lr-eval-dataset`, a post-commit `lr-vote-change` to `lr-compare-panel`, and a correlated `lr-example-citation-open` to `lr-eval-run`.
  Fix `lr-eval-run` silently showing empty example details when its detail views fail to load; it now shows and announces a localized notice and retries on the next expand.
  Fix `lr-eval-run`, `lr-eval-result` and `lr-eval-dataset` letting nested copy, content, citation, chip, table and diff events escape the host.
  Fix `lr-json-schema-viewer` throwing on malformed `enum`, `examples`, `$ref`, `type`, `title` or `description` keywords, resolving selections through inherited property names, and its keyboard walker ignoring composition; its render-limit notices are now notes.
  Fix `lr-agent-eval-dashboard` rounding small nonzero metrics to zero and reading inherited run metric names.
  Fix `lr-artifact-panel` selected view button having no hover or press feedback, draw its version chevrons as icons, and keep server-rendered code views visible before hydration; `lr-browser-frame` no longer paints its screenshot over server-rendered live content.
  Fix `lr-compare-panel` panes being tab stops when nothing scrolls, `lr-test-results` provider rows each forming a separate list, and `lr-eval-dataset` tags ignoring the locale's list format.
  Add `--lr-change-review-file-border-color`, `--lr-change-review-file-radius` and `--lr-change-review-header-hover-bg` to `lr-change-review`; `lr-browser-frame` toolbar actions follow the shared button tokens.
  Fix result cards, eval runs, test results and eval results overflowing narrow flex and grid allocations.
  Indicate the selected `lr-json-schema-viewer` trigger with a themeable fill and a visible outline in forced colors.
  Reuse file, hunk and redaction projections in `lr-change-review` and `lr-context-inspector` across unrelated updates.
  Keep the last 500 distinct `lr-browser-frame` action markers in input order and announce the overflow notice.
  Show a performance advisory when `lr-prompt-studio` contains more than 500 rows.
  Show an unavailable note when an explicit `lr-agent-eval-dashboard` metric selection matches no metric; the dashboard still displays the first valid metric.
  Use one Tab stop for run history in `lr-agent-eval-dashboard`, file rows in `lr-commit-card`, and test names in `lr-test-results`, with ArrowUp, ArrowDown, Home and End navigation.
- 71a8b37: - `lr-neighbor-list` adds `separate-relations` to show each relation and direction to the same neighbor as its own row; by default one row per neighbor node is kept, first-wins.
  - Graph source navigation and embedding selection surfaces expose distinct accessible names. Use the localized records name for graph navigation and the plot or list name for embedding selection.
  - Graphs, search results, embedding bins and palettes preserve browser and IME shortcuts. Palette placement fires once per keypress. If a placement listener replaces the catalog or removes the palette, the retired item no longer emits a follow-up selection.
  - Neighbor rows wrap long labels and relations and support keyboard movement between the primary and expand actions. Graph source rows expose incident actions for the current row. Revealing either kind of row keeps scrolling inside its list.
  - Keyboard navigation skips unavailable graph rows. Replacing the source or changing the page prevents an old graph or neighbor row from moving focus into the new results.
  - Graph source search has a localized clear action and styleable search, filter and row controls. Default graph and neighbor views load pagination on demand. The knowledge graph explorer loads detail components on selection.
  - Graphs bound accessible data summaries and canvas buffer allocation, position tooltips in scaled layouts and preserve paired node and edge hover events during camera or pointer movement.
  - Graph and embedding renderers resolve colors in their owner document. Graph renderer failures fall back to the built-in view. The 3D graph canvas exposes keyboard controls to assistive technology.
  - The knowledge graph explorer supports accent-insensitive search and a cancelable `lr-hidden-types-change-request` event for legend changes.
  - Graph nodes, embedding markers and legend swatches preserve their data colors in forced-colors mode. Embedding and graph legends share scalable swatches, and embedding focus changes reuse unchanged point labels.
  - Retrieval controls expose hover and selection colors. Mind maps distinguish expandable nodes, fit long labels and source diagrams, follow inherited direction and show a focus ring on keyboard focus.
  - Path strips announce directed relations, mirror their arrows in RTL and leave nested scroll controls operable.
  - Palette icons sit beside labels. The list scrolls inside a fixed-height palette and filter announcements resume after reconnection.
- 8e9ad29: - Citation badges, entity chips and retrieval search leave modified or composing keystrokes to the browser.
  - Whitespace-only retrieval labels use their localized fallback.
  - Retrieval results restore focus when Load more becomes a spinner and announce provider errors.
  - Chunk inspector and retrieval compare keep focus rings inside clipped rows.
  - Retrieval compare includes `chunkId` and `sourceId` in `lr-chunk-select`, and page buttons share hover and press treatments.
  - Retrieval trace, provenance panel, memory panel and entity dossier report disclosure changes with `lr-retrieval-disclosure-change`; read `detail.kind` and the owning stage, section, memory or dossier panel.
  - Chunk inspector gives standalone multi-row lists one row-action Tab stop and supports arrow navigation across virtualized rows.
  - Memory panel gives short-term actions one Tab stop. When several Add buttons are present, each accessible name includes the memory text.
  - Retrieval status changes are announced after reconnect, during provider reloads and when selection reaches its limit.
  - Knowledge base keeps its internal table's page and sort events inside when no data source is set; provider mode still emits the documented sort events. Knowledge-base admin and entity dossier also contain nested events.
  - Per-item toggles and card actions include the item's visible label or title in their accessible names.
  - Member and memory counts pluralize.
  - Inline citation badges and entity chips retain their hit areas without making the surrounding line taller.
  - Source picker identifies and announces truncation, matches labels without regard to accents and case, and uses directional folder chevrons.
  - Research progress prioritizes running, failed and recent steps when the display reaches its cap, and its fill remains visible in forced colors.
  - Selected claim, chunk and evidence rows keep a visible outline with the plain frame.
  - Long titles, warnings, evidence text and run labels wrap in constrained space.
  - Community card member buttons use a pill-shaped hover treatment, and community and entity headings validate the authored level.
  - Provenance section headers show directional disclosure chevrons and use consistent spacing between community cards and paths.
  - RAG answer reports the citation displayed by an activated badge while the citation list is changing.
  - RAG answers and evaluation dashboards use their visible section headings. Entity dossier and retrieval trace avoid repeating the host's accessible name.
  - Evaluation dashboards report an unavailable metric, and short shares and out-of-range percent values preserve their meaning.
  - Knowledge-base admin tabs reserve their selected width.
- c768915: - Known date fields read errors before hints, fall back to localized names for whitespace-only field labels and preserve in-progress IME input.
  - Mention suggestions respect shortcut and composition keys, skip disabled choices and contain filter failures. The overflow count is exposed as a disabled option.
  - Tour navigation ignores repeated activation keys, honors synchronous request handlers and emits `lr-tour-step-activate` after the index changes. Progress indicators wrap in narrow panels.
  - Diff and JSON viewers provide named keyboard stops for overflowing content and reveal search matches within the viewer.
  - Diff viewers reuse line rendering when only copy feedback changes.
  - JSON viewers match keys and values without accents, distinguish repeated controls by full path and deliver search events after rendering.
  - Copy buttons resolve dotted source IDs, use localized feedback for whitespace-only overrides and forward host accessibility relationships to the built-in control.
  - Diff viewers and copy buttons stop reporting obsolete clipboard outcomes when a listener changes the control.
  - Export buttons describe the native trigger, never export `Object.prototype` members as column values and announce failures with the `exportFailed` message.
  - Export, diff, JSON, poll and random-content actions support scoped hover and pressed colors. Export controls honor the interactive transition token.
  - Decorative icon loading failures stay silent while labeled icons announce the failure. Remote SVG sprites retain supported local references.
  - Poll status freezes the remaining countdown while inactive. Random content suspends timer-driven selection in hidden documents and omits unnamed groups.
  - Resize observers recover from unavailable constructors and capability getters. Intersection observers wait for a named root and clear obsolete intersection classes.
  - Dividers normalize unsupported orientations and retain a visible vertical rule in auto-height flex rows.
  - Number and byte formatters isolate their output in bidirectional text.
- 8e9ad29: - `lr-notebook-viewer` hides the sanitized-output loading text and labels stderr streams for assistive technology.
  - `lr-notebook-viewer`, `lr-archive-viewer` and `lr-xml-viewer` keep active and highlighted rows visible under forced colors.
  - `lr-csv-viewer`, `lr-dataset-viewer` and `lr-spreadsheet-viewer` resume loading when moved in the DOM while a request is in flight.
  - `lr-calendar-viewer`, `lr-email-viewer`, `lr-svg-viewer` and `lr-geojson-viewer` scroll bodies are keyboard focusable while they overflow.
  - `lr-csv-viewer`, `lr-spreadsheet-viewer`, `lr-dataset-viewer`, `lr-archive-viewer` and `lr-notebook-viewer` cap one scroll container at `max-height` and shrink to short content instead of nesting a second scrollbar.
  - `lr-xml-viewer` paints highlights and active matches in source mode, keeps XML syntax left-to-right under RTL, styles the partial-search notice and reports no clipboard failure after it was disconnected.
  - `lr-geojson-viewer` bounds and scrolls its metadata block, and `lr-html-viewer` and `lr-email-viewer` scroll wide content instead of clipping it.
  - `lr-calendar-viewer`, `lr-contact-viewer` and `lr-email-viewer` isolate caller text from the surrounding direction.
  - `lr-notebook-viewer` searches error outputs and ANSI-styled text, shrinks image outputs to the cell and parses JSON outputs once.
  - `lr-calendar-viewer`, `lr-dataset-viewer` and `lr-email-viewer` report a missing parser before downloading the document body.
  - `lr-model-viewer` keeps focus after a lost context disables the focused control; `lr-include` reports the loaded source in `lr-load`.
  - `lr-spreadsheet-viewer` shows small numbers without rounding them to zero.
  - Every data and document viewer (`lr-archive-viewer`, `lr-calendar-viewer`, `lr-contact-viewer`, `lr-csv-viewer`, `lr-dataset-viewer`, `lr-email-viewer`, `lr-geojson-viewer`, `lr-html-viewer`, `lr-notebook-viewer`, `lr-spreadsheet-viewer`, `lr-svg-viewer`, `lr-xml-viewer`) and `lr-include` now cancel an unread response body after an HTTP failure, a superseded request or a missing parser, releasing the connection instead of leaving it open.
  - `lr-model-viewer` coalesces theme and size changes into one refresh per frame and skips restyling the engine when the resolved colors did not change.
  - `lr-svg-viewer` marks the active region with an outer ring so it stays distinct from a warning-tone highlight.
  - `lr-notebook-viewer` gives its output toggle the minimum touch-target height.
  - `lr-calendar-viewer` stops counting events as soon as the limit is exceeded, and `lr-svg-viewer` parses sanitized markup once.
  - `lr-xml-viewer` copy feedback uses the shared feedback duration.

  - Model viewers report source, format and rendering failures through `lr-render-error` and preserve the existing `lr-engine-fallback` notification.
  - Archive, calendar, contact, CSV, dataset, email, GeoJSON, HTML, spreadsheet, SVG and XML viewers emit a bubbling, composed `lr-load` after a parsed document renders.
  - `lr-calendar-viewer` and `lr-contact-viewer` accept `max-events` and `max-contacts` to configure the default limit of 250 up to a maximum of 2,500.
  - CSV and spreadsheet viewers support `scroll-mode="page"` with sticky headers. CSV, spreadsheet and dataset viewers expose frame and header colors and isolate mixed-direction cell text.
  - Model, email, SVG and XML viewers expose separate action backgrounds for the resting, hovered and pressed states.
  - Email attachment names include the visible size, and the interactive model viewport has its own localized accessible name.
  - HTML, SVG, notebook, email and include reuse sanitized content. Folding an email quotation or repainting notebook output avoids parsing the same markup again.
  - XML browsing avoids indexing a collapsed document until a search or expansion needs it, and provider copy feedback stays associated with the current document.
  - GeoJSON and notebook previews emit a recoverable `lr-viewer-diagnostic` when an optional map or sanitizer is unavailable. Existing error notifications continue to fire.
- b68579a: - New `lr-sankey` component for weighted flows across stages, with proportional SVG ribbons, keyboard navigation, and an accessible data table.
- d72f7b0: Include the exact free-text draft in `lr-input` event details from `lr-model-select` and `lr-voice-picker`, alongside the committed value and catalog membership. Selection commits continue to report the committed value.
- 14a0730: - New `lr-treemap` component for hierarchical data, with nested SVG tiles, keyboard navigation, a top-level legend, and an accessible data table.
- 81bd291: - `lr-textarea` adds `--lr-textarea-font-family`, `lr-input` adds `--lr-input-font-family` (both default `inherit`), and `lr-code-editor` adds `--lr-code-editor-font-family` (default `var(--lr-font-mono)`, applied to the gutter and text together).
  - `lr-app-rail-item` hides `[part="icon"]` while `start` is empty, so an icon-less item reserves no icon column or gap.
  - `lr-app-rail-item` adds `--lr-app-rail-item-children-gap` for the gap between the row and its nested `children`, separate from `--lr-app-rail-item-gap`.
  - `lr-app-rail-item` adds `toggle-placement` (`start` | `end`, default `end`) and `--lr-app-rail-item-toggle-size`. The disclosure is still a sibling of the link or button, and `start` respects RTL.
  - `lr-app-rail-item` exposes a `row` part around base, meta, end and the disclosure. `highlight="row"` paints the hover, press and current fills across the whole row; each control keeps its own activation and focus order.
  - `lr-app-rail-group` adds `highlight="header"`, a hover, focus and press fill on `[part="header"]` that covers the collapse control and `header-actions`. The new `--lr-app-rail-group-header-hover-bg` and `--lr-app-rail-group-header-active-bg` tokens set its colors. `header-actions-reveal="hover"` shows the actions only while the header is hovered or holds focus.
  - `lr-pagination` adds an opt-in page-size selector:
    - Set `pageSizeOptions` (JS only) and optionally `page-size-label`.
    - The selector has the `page-size` part and works in the standard and compact formats and with an unknown total.
    - Choosing a size fires the cancelable `lr-before-page-size-change` and then `lr-page-size-change` with `{ page, pageSize }`. The new page keeps the first visible item in view.
    - The selector is controlled the same way as `page`, and its option text is localized.
  - `lr-data-grid` now lists its page-size options in ascending order, without duplicates or non-integer values, with the current size placed among them.
  - Fix: `lr-tab-group` created inside a `display: none` ancestor now names its tabs from their label text instead of the panel key, and keeps those names once shown.
- 8b312f4: Cancelable requests before a user selection commits, and a `top-layer` opt-in on more anchored popups.

  - `lr-swatch-picker`: new cancelable `lr-change-request` (`{ value, previousValue }`). Calling `preventDefault()`, or assigning `value` in the listener, stops the built-in commit and `lr-change`.
  - `lr-date-picker`: new cancelable `lr-change-request` (`{ value, previousValue }`) before a day or preset pick commits. `lr-date-input` keeps its calendar's request internal.
  - `lr-rating`: new cancelable `lr-change-request` (`{ value, previousValue }`).
  - `lr-color-picker`: new cancelable `lr-change-request` (`{ value, previousValue }`) before a swatch, text-entry or eyedropper pick commits.
  - `lr-country-picker`, `lr-currency-picker`, `lr-time-zone-picker`, `lr-unit-picker`: new cancelable `lr-change-request` (`{ value, previousValue }`) before a user selection or clear commits.
  - `lr-tab-group`: new cancelable `lr-tab-group-select-request`. `lr-segmented`: new cancelable `lr-change-request`.
  - `lr-knowledge-graph-explorer`: new cancelable `lr-selection-change-request` and `lr-pin-change-request`; `lr-hidden-types-change-request` now also carries `previousHiddenTypes`.
  - `lr-source-picker`: new cancelable `lr-selection-change-request` before a row or select-all toggle commits.
  - `lr-tool-call-block`: header activation emits a cancelable `lr-toggle-request` (`{ expanded, callId, invocationId }`) before `expanded` changes.
  - `lr-eval-run`: a cancelable `lr-toggle-request` (`{ exampleId, expanded }`) before an example expands or collapses; `lr-message-parts` documents `lr-toggle-request` as a passthrough.
  - `lr-background-runs`: `lr-run-activate` also carries the `run` record, matching `lr-subagent-panel`. `lr-run-activate` and `lr-run-cancel` details are frozen.
  - New `top-layer` property on `lr-color-picker`, `lr-date-input`, `lr-time-input`, `lr-context-menu`, `lr-menu` (submenus), `lr-tool-call-chip`, `lr-usage-badge`, `lr-mention-popover`, `lr-export-button` and `lr-tour` (for interactive-target steps). It now also reflects on the forms catalog pickers.
  - The popups of `lr-menu`, `lr-tool-call-chip`, `lr-usage-badge`, `lr-mention-popover` and `lr-export-button` now stack at the overlay stack index.
- 7d210b5: - New pointer-state tokens, each defaulting to the current paint: `--lr-chunk-inspector-action-hover-bg/-active-bg`, `--lr-memory-panel-button-hover-bg/-active-bg`, `--lr-memory-panel-expand-toggle-hover-bg/-active-bg`, `--lr-source-list-header-hover-bg/-active-bg`, `--lr-provenance-panel-header-hover-bg/-active-bg`, `--lr-retrieval-compare-chunk-hover-bg/-active-bg`, `--lr-rag-eval-dashboard-item-hover-bg/-active-bg`, `--lr-tour-button-hover-bg/-active-bg` and `--lr-tour-next-button-hover-bg/-active-bg`.
  - `lr-input`, `lr-time-input` and `lr-date-input` keep an icon or image start/end adornment at full size in a narrow row; only text adornments shrink and ellipsize.
  - `lr-embedding-explorer` eases its point ring on hover, focus and press (the transition now sits on the marker whose stroke changes).
  - The `lr-document-preview` and `lr-highlight-layer` region actions ease their hover and press fills.
- d266133: - Numeric attributes keep their documented default when they are empty or contain only whitespace. Before, they became `0`. Removing such an attribute also restores the default instead of leaving `null`. This covers every attribute-backed numeric property in the library, including `lr-otp-input` `length`, `lr-popup` `arrow-padding`, `lr-heatmap` `bucket-count` and the `lr-format-number` digit options. Those last options go back to unset, which leaves the `Intl` default in place.
  - Under reduced motion, every programmatic scroll now uses `'instant'` instead of `'auto'`. A stylesheet that sets `scroll-behavior: smooth` therefore cannot animate it. This covers the table, spreadsheet, SVG, document-preview, XML, DOCX and PDF viewers, `lr-chat-viewport`, `lr-span-waterfall`, `lr-trace-tree`, `lr-tour`, `lr-code-block`, `lr-path-strip`, and markdown heading anchors. `lr-virtual-list` `scrollToIndex()` now also accepts `behavior: 'instant'`.
  - `lr-spreadsheet-viewer`, `lr-csv-viewer` and `lr-dataset-viewer` no longer set `aria-busy` on the presentational wrapper inside each data-source row. That attribute broke the row and cell structure for assistive technology. Loading state stays on `[part="base"]`.
- 7f31eef: - Per-component English default-string slices are smaller: a key read from an imported key map, a parameter typed with a closed key union, or a `localize` forwarder handed to a shared controller is now attributed to the module that renders it, so `lr-video`, `lr-image-viewer`, `lr-graph` and about 25 other elements no longer ship unrelated messages.
  - `lr-thinking-panel`'s body, `lr-activity-feed`'s plain list and `lr-notebook-viewer`'s raw cells are tab stops only while their content overflows; a short body adds no stop. `lr-markdown` and `lr-code-block` keep their always-on stops, now documented.
  - `lr-test-results` with `dataSource` announces "Showing {shown} of {total} tests" once a status-filter page settles, from the provider's filtered `total` and whole-run `summary.total`.
  - Test-only map helpers and loader seams are no longer emitted into the built package.
  - `lr-ebook-viewer` loads through the shared viewer source lifecycle (URL gate, abort, body cleanup), keeping its book, search and anchor guards.
- 59cb878: - `lr-heatmap` gains `label` and `description`, matching `lr-chart`: a host `aria-label` still wins, a blank label falls back to the generated summary (which moves to the new `[part="description"]` while a label names the chart), and `description` replaces that summary as the canvas, grid or `matrixSource` description.
  - Lyra Gen object schemas accept a bounded open map: `additionalProperties: <schema>` with required `maxProperties` and `propertyNames.maxLength`. Validation, the exported catalog JSON Schema and the content policy (URL-named map keys are refused) all honor it; the closed profile rejects it.
  - Lyra Gen roles can declare `hostProperties`: element properties only `prepareProperties` supplies. The view assigns them, generated content cannot set or bind them, and prompts, catalog artifacts and exported schemas omit them.
- 9ba9cca: - `lr-alert`: the leading icon and the countdown bar follow the appearance's ink, so `appearance="accent"` paints them on-loud instead of in the panel's own fill colour.
  - `lr-callout`: the close button's default hover fill is a translucent mix toward the mix partner again, so non-brand variants and `appearance="accent"` keep a legible glyph; `--lr-callout-close-hover-bg` still overrides it.
  - `lr-badge` / `lr-tag`: the `start` slot wrapper is inert and `aria-hidden`, like the leading icon of `lr-chip`, `lr-alert` and `lr-callout`; `end` stays exposed because it often carries a count. Move meaningful `start` content into the label.
  - `lr-empty`: new `--lr-empty-padding`, `--lr-empty-gap`, `--lr-empty-icon-size` and `--lr-empty-compact-icon-size` tokens; the compact density (`size="s"` and below) now shrinks the icon to the m font size by default.
- 0e15a2a: - Lazily registered child components now load through one shared loader: a failed chunk no longer leaves `updateComplete` rejected or the child permanently unloaded, it is retried on a later render and reported as a development warning, and `updateComplete` settles only after the upgraded children have rendered (`lr-rubric-form`, `lr-stream-status`, `lr-message-feedback`, `lr-thread-list`, `lr-data-grid` columns menu, `lr-confirm-bar`, `lr-drilldown-panel`, `lr-tool-timeline`, `lr-message-parts`, `lr-dashboard-grid` default cells).
  - `lr-agent-question` renders its question and actions even when its response form cannot load, shows a localized notice (`agentQuestionLoadError`), keeps Submit disabled until the form loads, and retries on a later render.
  - `lr-message-parts` retries a renderer whose registration failed when the message reconnects; `lr-skeleton` no longer raises an unhandled rejection when its announcer chunk fails.
  - Wheel zoom on `lr-flow-canvas`, `lr-flow-minimap` and the 3D `lr-graph` view follows the wheel delta magnitude (normalized across line and page modes) instead of a fixed step per event, and a horizontal swipe no longer zooms out or blocks page scrolling.
  - New cancelable `lr-change-request` on `lr-radio-group` (`{ value, previousValue, option, radio }`) and `lr-radio-select-request` on `lr-radio` and `lr-radio-button` (`{ checked, value }`) let a listener veto or resolve a radio selection before it commits, like the other choice controls.
  - `lr-model-select` and `lr-voice-picker` gain `top-layer`, and their listbox follows the overlay stack index like `lr-select`.
- 70a9046: - Keyboard focus rings are no longer clipped by a component's own scroll or overflow container: `lr-tab-group` tabs and panels, `lr-segmented` segments, `lr-token-input` remove and edit actions, and `lr-code-block` line gutters draw their ring inside the control, while `lr-widget` actions, `lr-scroller` content, the `lr-chat-composer` actions-row toolbar and `lr-selection-toolbar` leave room for slotted controls' rings. `lr-scroller` items gain that room (the ring width plus offset) at the content's ends.
  - `lr-dataset-viewer`, `lr-csv-viewer`, `lr-spreadsheet-viewer` and `lr-data-grid` no longer draw a column divider on the last column, so the frame alone draws the inline-end edge.
  - Rotating spinners and the running stripe turn at a constant rate: the defaults of `--lr-tool-call-chip-spin`, `--lr-tool-result-dialog-spin`, `--lr-agent-run-spin`, `--lr-task-list-spin`, `--lr-button-spinner-duration` and `--lr-attachment-chip-spinner-duration` are now `var(--lr-duration-ambient) linear`, as are `lr-tool-call-block`'s spinner and `lr-trace-tree`'s running stripe. New `--lr-trace-tree-stripe-speed` sets the stripe's duration, like `--lr-span-waterfall-stripe-speed`.
  - `rail-width`, `min-rail-width`, `max-rail-width` (`lr-app-rail`), `row-height`, `gap` (`lr-dashboard-grid`) and `thumb-width` (`lr-page-rail`) share one converter: a blank attribute is now unset (the default applies) instead of `0`, and `Infinity` stays a CSS string instead of a number.
- 0e15a2a: - `lr-trace-tree` / `lr-agent-trace`: token counts of 100,000 or more render in compact notation, and the duration, token and cost cells ellipsize (full text on `title`) instead of painting into the next column. Accessible names keep the exact figures.
  - `lr-subagent-panel`: under `frame="plain"` the selected run keeps an inline-start rule in `--lr-subagent-panel-selected-border`.
  - Script-focused targets in `lr-approval-queue`, `lr-agent-run`, `lr-background-runs`, `lr-subagent-panel` and `lr-tool-param-form` now paint the tokenized focus ring instead of the browser default.
  - `lr-permission-grant`, `lr-permission-rules`, `lr-connector-manager` and `lr-background-runs` gain `frame="plain"` and the shared `--lr-panel-frame-bg`, `--lr-panel-frame-border-color`, `--lr-panel-frame-radius` and `--lr-panel-frame-padding` hooks. All four now fill with `--lr-color-surface` by default (previously only `lr-permission-grant` did); set `--lr-panel-frame-bg: transparent` to keep the old look.
  - `lr-tool-param-form`, `lr-tool-approval-dialog` and `lr-tool-select-dialog` now carry the shared form-control size ladder, so their text fields (the param-form inputs, the JSON editor and the search field) follow `--lr-theme-form-control-*` and `--lr-form-control-*` radius, padding, height and font-size together. Previously those tokens were not declared in these components, so the param-form inputs only picked them up from a sized ancestor.
  - `lr-connector-manager` keeps rows with an unrecognized `status` visible as a neutral "Unknown" row with no action, and omits the kind label for an unrecognized `kind`, instead of dropping them.
  - `lr-tool-param-form` clears visited fields and revealed errors when a structurally different `schema` is assigned.
  - `clearToolRenderers()` is documented public API (test isolation and hot-module reload).
- 5cbe812: - `lr-stat`: label, value, unit, caption and icon-chip tokens (`--lr-stat-label-*`, `--lr-stat-value-font-size`/`-font-weight`, `--lr-stat-unit-*`, `--lr-stat-caption-*`, `--lr-stat-icon-*`) and a reflected `fill` that gives tiles in a grid one height with the caption pinned to the block end.
  - `lr-table`: `--lr-table-header-font-weight`/`-color`/`-font-size` and `--lr-table-cell-border-color`; `--lr-table-header-sorted-color` now falls back to the resting header color.
  - `lr-table`: `columns[].href(row)` (with `target`/`rel`) renders a real, guarded `[part="cell-link"]` anchor for row navigation.
  - `lr-table`: `stack="never|auto|always"` stacks rows as label/value cards below `--lr-table-stack-breakpoint`, keeping roles, sorting and selection.
  - `lr-timeline-item`: `--lr-timeline-title-font-weight`.
  - `lr-heatmap`: legend tokens (`--lr-heatmap-legend-font-size`/`-color`/`-gap`/`-padding`/`-bg`/`-radius`/`-swatch-size`/`-ramp-*`), `legend-placement="top|bottom"`, a `fill` mode that makes the grid the single scroller in a definite-height parent, and `axis-selection="rows|cols|both"` label toggle buttons for whole-row/column selection.
  - `lr-pagination`: change events carry `offset`, and an `offset` property derives the page; `lr-data-grid` page events and `dataSource` requests carry `offset` too.
- 70a9046: - `lr-chart-3d` updates a live WebGL renderer in place when `data`, `type`, an axis title or `hiddenCategories` changes, instead of disposing and re-creating the context. `hiddenCategories` now returns a cached read-only snapshot; assign a new `Set` to change it.
  - `lr-lite-chart` no longer leaves stray row gaps for empty grid tracks, and its legend uses the shared `--lr-font-size-xs` and `--lr-radius-xs` tokens.
  - `lr-chart` reuses computed legend values between renders.
- 2a6d019: - `lr-stat`: a keyboard-focused exact-value stop (headline value, breakdown row, or a linked stat's card link) now shows its exact value on its own line; browsers show no `title` tooltip on keyboard focus.
  - `lr-sequence-strip`: the source exact-item button describes its key help with `aria-describedby` and shows it below the button while keyboard-focused.
  - `lr-heatmap`: without `sticky-labels`, the hover tooltip is clamped inside the component and flips below a first-row cell instead of hanging past the host edges.
  - `lr-word-cloud`: `[part="base"]` pins `overflow-y: hidden` and the drawing shrinks in a definite-height host, so the legend and notes no longer turn the base into a vertical scroller.
  - `lr-calendar`: the default unselected-day hover is a neutral step off the surface instead of the selected-day fill, so the hovered day never looks selected.
  - `lr-data-grid`: Ctrl/Cmd+C copies rows only when rows are selected and no text selection is live; otherwise the browser's own copy runs. Previously an unselected grid copied every processed row.
  - `lr-data-grid`: Enter on a focused column resize separator fits the column to its content, the keyboard form of double-click.
  - `lr-data-grid`: the `drag-ghost` preview follows the pointer during a column drag and stays inside the grid box instead of sitting clipped at its static position.
- 2a6d019: - `lr-app-rail`: the `resizable` drag handle now sits wholly outside the rail edge, so the rail's scrollbar and item edges stay clickable; new `--lr-app-rail-resizer-hit-area` (default 24px, at least the icon-button size for coarse pointers).
  - `lr-dashboard-grid`: the corner resize handle keeps to a 24px target over the widget's corner; new `--lr-dashboard-grid-resize-handle-hit-area` (coarse pointers keep the icon-button size).
  - `lr-multi-split`: Home/End/arrow keys on a divider that is already at its limit no longer scroll the page.
  - `lr-multi-split`: an explicitly bound `collapsedPanels` (including `[]`) now wins over a collapsed set stored under `storage-key`.
  - `lr-carousel`, `lr-app-rail`, `lr-responsive-panel`: `lr-slide-change`, `lr-mode-change` and the forced `lr-toggle` that a property change causes now fire after the render, so listeners see the updated DOM.
  - `lr-breadcrumb-item`, `lr-app-rail-item`, `lr-card`: `focus()`/`blur()` (and `autofocus`) now forward to the internal link or button; `lr-navigation-menu-item` and `lr-accordion-item` gain `blur()`.
  - `lr-command-palette`: a hotkey without a Ctrl/Cmd/Alt modifier (for example `/`) is ignored while typing in a text field, and no hotkey fires while the palette is in a hidden or inert subtree.
  - `lr-segmented`, `lr-virtual-list`: reduced-motion programmatic scrolls use `behavior: 'instant'`, so a `scroll-behavior: smooth` stylesheet cannot animate them.
  - `lr-carousel`: the scroll-container hover preview defaults to `--lr-color-border`, matching `lr-scroller` and `lr-tab-group`; `lr-scroller` and `lr-tab-group` drop that preview while the region shows its focus ring.
- 3814758: - `lr-chart`: a `type: 'band'` series with per-category `lower`/`upper` bounds fills a confidence
    interval or percentile envelope beneath every line on line and bar charts, tinted by the new
    `--lr-chart-band-opacity` token. The tooltip, generated data table, keyboard announcement, summary,
    CSV export (`<label> lower`/`<label> upper`) and legend swatch carry both bounds; formatters receive
    them as `statistic: 'min'`/`'max'`. New localized string `chartBandRange`.
  - Chart legends: `--lr-chart-legend-gap`, `--lr-chart-legend-padding`, `--lr-chart-legend-font-size`,
    `--lr-chart-legend-item-min-height`, `--lr-chart-legend-item-padding`,
    `--lr-chart-legend-swatch-size` and `--lr-chart-legend-swatch-radius` style the DOM legend of
    `lr-chart` and its typed aliases (such as `lr-doughnut-chart`) and `lr-box-plot`; `lr-lite-chart`
    honors the gap, padding, font-size and swatch tokens. Defaults are unchanged.
  - `lyra-gen`: the reviewed `stat` role accepts `frame`, `deltaPercent` and `goodDirection`, sharing the
    `kpi-row` validators.
- 8db6263: - `lr-env-list` renders the first 500 entries; `[part="limit"]` counts every entry not shown.
  - `lr-file-input` renders the first 200 held files; new `[part="file-more"]` counts the rest.
  - `lr-agent-eval-dashboard` renders at most 100 metric cards (plus the active one); new `[part="metrics-limit"]` note.
  - `lr-path-strip` and `lr-graph-legend` render at most 200 elements or types; new `[part="limit"]` note.
  - `lr-email-viewer` renders the first 200 attachments with a new `[part="attachments-limit"]` note, and `[part="to"]` ends with a `+N` count of recipients past the position ceiling.
  - `lr-xml-viewer` renders at most 256 attributes per element row; new `[part="attribute-more"]` `+N` marker.
  - `lr-highlight-layer` reads at most 1,000 rectangle positions per item.
  - New `omittedViews` on `lr-widget` and `omittedCells` on `lr-dashboard-grid` report input positions beyond their admission limits.
  - `lr-accordion` no longer re-checks item availability for attribute changes inside an item's content.
  - 3D engines (`lr-embedding-explorer`, `lr-chart` 3D, `lr-model-viewer`, panorama media) share the realm's theme watcher, restyle when a stylesheet or contrast preference changes, and skip pushing an unchanged style; ancestor fence observation shares one observer per root.
  - Map point-icon and image rasterization and the panorama media probe create their readback canvas contexts with `willReadFrequently`.
- ee5dc18: - `lr-pagination` wraps its controls onto their own line instead of crushing the summary into a one-glyph strip between the 320px baseline and roughly 600px; layout regions of `lr-dashboard-grid`, `lr-page`, `lr-details`, `lr-accordion-item`, `lr-responsive-panel`, `lr-breadcrumb-item` and `lr-navigation-menu-item` use `overflow-wrap: break-word`, so slotted flex, grid and table content keeps its own min-content size.
  - Truncation, capability and load notices in `lr-graph`, `lr-knowledge-graph-explorer`, `lr-embedding-explorer`, `lr-json-schema-viewer`, `lr-eval-run` and `lr-eval-result` render as quiet small text with token margins; `lr-graph`'s 2D notices stay inside the host box; `load-error` is painted as an error; `lr-email-viewer`'s expanded quote wraps like the message body.
  - The `lr-page` and `lr-app-rail` mobile drawers, the `lr-responsive-panel` overlay and the `lr-widget` fullscreen panel paint from `--lr-overlay-surface` behind their own hooks; they, `lr-drawer` and `lr-toast-item` read `--lr-overlay-shadow-modal` (default unchanged). `lr-flow-minimap` uses the same subtle frame edge as the other flow chrome.
  - A consumer `--lr-xml-viewer-max-height` / `--lr-json-viewer-max-height` now sizes the source-mode tree unless `max-height` is set; `lr-drilldown-panel` no longer overrides a consumer `--lr-breadcrumb-item-color`.
  - `lr-flow-canvas` fit, focus, wheel zoom, pan, drag and connection math, `lr-timeline` trailing extent, `lr-heatmap` hit testing, `lr-tree` drop indicator and `lr-video` scrub thumbnail work in layout pixels under a scaled or zoomed ancestor.
  - Disabled `lr-map` scene, pick, drawing and legend actions look disabled and show no hover or press fill; `lr-embedding-explorer` page buttons and `lr-av-player` placeholder transcript rows (new `cue-unavailable` part) no longer react to hover.
  - A vertical `lr-card` and `lr-agent-trace` size by content in shrink-to-fit contexts (only the horizontal card is a query container).
  - Search, anchor and record reveal in `lr-xml-viewer`, `lr-docx-viewer`, `lr-document-preview`, `lr-svg-viewer`, `lr-archive-viewer`, the table viewers and `lr-flow-canvas` scroll only the component's own scrollport, never the page or an outer scroller.
- e75ecdd: - `lr-pagination`: the compact page-jump input now follows `appearance` and `--lr-pagination-control-bg` / `--lr-pagination-control-border-color` like the buttons.
  - `lr-flow-minimap`: the focusable viewport control is `role="application"` so screen readers pass its keys through.
  - `lr-data-grid`: internal `frozenArray` helper renamed `freezeSnapshot` (no public surface).
  - `lr-table`: sticky cells show the editable hover/press fill and the heat tint instead of the opaque row fill.
  - `lr-flow-canvas`: Space while choosing a keyboard-connect target no longer scrolls the page and commits like Enter.
  - `lr-env-list`: the copy button drops its `aria-label` while the visible "Copied"/"Copy failed" text shows, so the visible label names it.
- c6489ec: - Text-entry form controls floor their editable text at `--lr-form-control-touch-font-size-min` (16px) under a coarse pointer, so mobile Safari no longer zooms on focus.
  - `lr-checkbox`, `lr-radio` and `lr-switch` add `--lr-*-label-font-size` and `--lr-checkbox-label-color` / `--lr-radio-label-color` label tokens.
  - `lr-combobox` adds `commit="text"` for free-text fields with suggestions, and a press on the focused input reopens the list.
  - `lr-slider` adds `marks` for labelled ticks at arbitrary positions, with automatic label thinning.
  - `focus()` called on a form control before its first render is applied once it renders.
  - `lr-button` `appearance="link"` honours an explicit `--lr-button-width`.
  - `lr-input`, `lr-textarea`, `lr-select`, `lr-combobox` and `lr-date-input` add `label-placement="start"` for a label column beside the field, collapsing above it in narrow allocations.
- 3f4a1ef: - `lr-menu`, `lr-menu-item`, `lr-menu-label`: density hooks `--lr-menu-padding`, `--lr-menu-gap`, `--lr-menu-item-padding-block`, `--lr-menu-item-padding-inline`, `--lr-menu-item-font-size`, `--lr-menu-item-icon-size` and `--lr-menu-label-font-size`, all defaulting to the previous spacing.
  - `lr-details` and `lr-accordion-item`: summary font-weight, colour, font-size and min-block-size hooks; the min-block-size hook never goes below the 24px pointer-target minimum.
  - `lr-segmented`: new `layout="scroll | wrap | grid"` (default `scroll`) and `--lr-segmented-columns` for the grid; wrap and grid never scroll, drop the edge fade and let labels wrap.
  - `lr-card`: `--lr-card-interactive-hover-transform` (suppressed under reduced motion), `--lr-card-transition`, and a reflected `fill-body` that makes the body a full-height column with `--lr-card-body-gap`.
  - `lr-app-rail`: collapsed mobile toggle placement hooks `--lr-app-rail-toggle-position`, `--lr-app-rail-toggle-inset-block-start`, `--lr-app-rail-toggle-inset-inline-start` (safe-area aware and mirrored under RTL), plus `--lr-app-rail-toggle-size` and `--lr-app-rail-toggle-radius`.
- e87ee1d: - `lr-markdown` / `lr-markdown-core`: new prose tokens `--lr-markdown-block-gap`, `--lr-markdown-heading-1-font-size` through `--lr-markdown-heading-4-font-size`, `--lr-markdown-heading-font-weight`, `--lr-markdown-link-color`, `--lr-markdown-link-hover-color`, `--lr-markdown-blockquote-border-color`, `--lr-markdown-blockquote-color` and `--lr-markdown-list-indent`. Unset, rendering is unchanged.
  - `lr-thread-list`: new `without-pin-icon` and `without-group-icon` boolean attributes, plus `--lr-thread-list-group-header-padding`, `--lr-thread-list-group-toggle-font-size`, `--lr-thread-list-group-toggle-font-weight`, `--lr-thread-list-group-toggle-color` and `--lr-thread-list-group-toggle-min-block-size`. Pinned rows keep a hidden "Pinned" label when the glyph is omitted.
  - `lr-chat-composer`: `--lr-chat-composer-send-glyph-offset-inline` and `--lr-chat-composer-send-glyph-offset-block` nudge the send glyph; the inline offset mirrors in RTL.
  - `lr-icon`: built-in icons read `--lr-icon-stroke-width` (falling back to `--lr-theme-icon-stroke-width`, then `1.75`) instead of a fixed `stroke-width` attribute. Fetched and library SVGs are unchanged.
- 2a4a51c: - `setLyraStyle({ surfaceOpacity })` takes the Glass surface opacity on the 0–1 scale of `--lr-theme-surface-opacity` (clamped; `null` or a non-finite value restores the default 0.6). It is persisted with the other style choices, restored by `lyraThemeBootstrap` before first paint, reported by `getLyraStyle()` and `lr-style-change`, reset by `resetLyraStyle(['surfaceOpacity'])`, and accepted by `applyLyraStyleScope()`.
  - `LYRA_LOOKS` (theme subpath) lists the built-in looks as frozen `{ id, name, optional, stylesheet }` entries for appearance pickers.
  - New `--lr-theme-scrollbar-color` theme input (default `auto`) beside `--lr-theme-scrollbar-width` and `-gutter`, read by `lr-scroller`, `lr-virtual-list`, `lr-code-block` and `lr-code-block-core`.
  - `isPlainPrimaryClick(event)` from `@aceshooting/lyra-ui/utilities/plain-click.js` reports an unhandled, unmodified primary click for client-side routing of `href`-bearing components; the shared guide has a router recipe.
  - `utilities.css` adds a static 12-column grid: `lr-grid-12`, `lr-span-1` to `lr-span-12` and `lr-row-span-2` to `lr-row-span-4`, collapsing to 6 columns below 56rem and to one column below 32rem of its own width.
  - Generated component references list the tokens each part's descriptions name, and `llms/index.md` shows each tag's standalone gzip size.
- 76d8604: - New experimental `lr-style-panel`: ready-made appearance controls (colour mode, look, surface, glass opacity, density, accent, reset) bound to `setLyraStyle()`, with an `axes` filter, localized labels and one `lr-change`.
  - `LYRA_LOOKS` entries carry a `labelKey` for their localized name; 31 new translated message keys for the panel, its gemstone accents and the built-in looks.
  - `lr-popover`: `trigger="hover-card"` opens a supplementary preview on pointer rest or keyboard focus, never pins on click and adds no disclosure ARIA to its owner; the new `forElement` property points a popover at any element without an id.
  - `--lr-theme-scrollbar-color` now also reaches `lr-table`, `lr-menu`, the `lr-select`/`lr-combobox` listboxes, `lr-emoji-picker`, `lr-code-editor` and `lr-time-input`; `lr-menu` and the listboxes also honor `--lr-theme-scrollbar-width`/`-gutter`, and the `lr-thread-list` viewport documents all three.
  - `lr-option`: the `group` property is documented with a grouped-select example.
- 5608cb5: - `lr-treemap`, `lr-sankey`, `lr-chord`, `lr-choropleth`: the hover tooltip no longer intercepts pointer input, so a mark beneath it can still be clicked and emits `lr-datum-activate`.
  - `lr-sankey`, `lr-chord`, `lr-choropleth`: the plot is measured and laid out in CSS pixels, so labels keep the token font size and the height stays bounded at any width. New `--lr-sankey-height`, `--lr-chord-height` and `--lr-choropleth-height` set the plot's block size. `lr-chord` omits entity labels when the circle would otherwise become too small.
  - `lr-sankey`, `lr-chord`, `lr-choropleth`: a throwing `valueFormatter` falls back to default formatting, and a non-string result is converted to text.
  - `lr-sankey` and `lr-chord` announce a later change into an error state, as `lr-choropleth` already did.
  - `lr-choropleth`: a region with no drawable area, when other regions can be drawn, stays in the data table and shows a notice instead of disappearing silently.
- 7f71f81: - `lr-entity-card` and `lr-community-card` accept `heading-level` (`'1'`-`'6'` or `'none'`), the spelling the other retrieval panels use; it wins over the host `aria-level`, and `none` keeps the title without heading semantics. `lr-entity-dossier` forwards its own `heading-level` to its entity card.
  - `lr-dataset-viewer` gives its capped, self-scrolling body a named keyboard tab stop while the rows overflow, and none otherwise.
  - Count messages pick the right plural form: the commit-card file summary and toggle, context-inspector token counts, the table and data-grid row-limit notices and the tag-facet overflow note (document library and eval dataset) now read "1 row", "1 file", "1 token" and "+1 more tag" in English, and pass the numeric count so other locales can choose their own plural category.
- 7f71f81: - `lr-model-select` and `lr-voice-picker` emit a cancelable `lr-change-request` before a pick or free-text commit, and report every listbox open and close after the first render with `lr-show`/`lr-hide` (cancelable, except a close forced by disabling) and `lr-after-show`/`lr-after-hide`, however `open` changed.
  - `lr-combobox` no longer shows the previous query's rows after a source aborts its own current request.
- 7f71f81: - `lr-diff-view` no longer paints a highlight whose start lies outside the diff on the last line; painting and `scrollToAnchor()` now agree.
  - `lr-email-viewer` shows a localized note instead of a blank body when an HTML-only message sanitizes to nothing.
  - `lr-include` resolves a same-page `#id` inside the shadow root that contains it before falling back to the document.
  - `lr-format-bytes` and `formatBytes()` show a value that rounds up to the next unit step on that unit (`1 MB`, not `1,000 kB`).
  - `lr-image-comparer` drops a pending keyboard change when it is disconnected.
  - `lr-model-viewer` keeps the loaded model when only `name` changes and the detected format stays the same.
  - `lr-word-cloud` keeps words legible in a narrow host (scrolls instead of shrinking) via the new `--lr-word-cloud-legible-font-size` token.
  - `lyra-docs` and `lyra-gen` publish a `custom-elements.json` for `lr-docx-editor` and `lr-gen-view`.
- 7f71f81: - Forced colors: `--lr-color-border-strong` now maps to `ButtonText`, so the `lr-video` timeline rail and the flow node and status dots keep a visible system-colour paint instead of collapsing into the page.
  - `lr-drop-zone` and `lr-file-input` share one size ladder and one forced-colors drag-verdict treatment, so a tier retune moves both together. Rendered values are unchanged.
  - New theming tokens with unchanged defaults: `--lr-conversation-item-pressed-bg`; `--lr-code-editor-gutter-bg`, `--lr-code-editor-gutter-color` and `--lr-code-editor-gutter-border-color`; `--lr-retrieval-results-selected-width`.
  - Documented that `lr-select`, `lr-checkbox`, `lr-switch`, `lr-radio-group` and `lr-checkbox-group` have no `readonly`, matching their native counterparts.

### Patch Changes

- 7f5ec4a: Dismiss stale prompt-input suggestions when the caret moves and preserve a textarea selection set by an insertion listener.
- 6962da4: Table rows, editable cells and the load-more and reveal-columns buttons keep their text in step with a theme change instead of fading from the previous mode's colour over the new surface.
- 6962da4: Dialogs, drawers, the lightbox and the tool approval, result and select dialogs paint their text from the enclosing theme scope, so an open panel stays readable when an ancestor switches to a dark mode or look.
- 6962da4: Map scene markers and lines recover their colors on the next theme update after a canvas pixel read fails.
- b42179f: Size ceilings follow reviewed measurements: the four peer-free SVG charts add about 15.5 KB gzip to the data barrel, `all.js`, `ssr/all.js` and the autoloaders, and about 7 KB to the packed editor data. Chart Escape dismissal, roving tree focus, shared slot, scroll-region and file-intake helpers, and the member descriptions now documented for every public member account for the remaining growth. Exceeded bundle ceilings advance to 2% above their measurement; the button canary, initial-route ceilings and the editor-data archive ceiling advance only to the next 64-byte boundary.
- 6962da4: Correct plural forms for community member counts, long-term memory confirmations, and retrieval selection limits.
  Use European Portuguese wording for retrieval selection limits in `pt-PT`.
- 6962da4: Document, DOCX, document preview, diff and JSON viewers no longer keep a resize observer on their scroll body after removal from the page, including when they update while detached.
- dba234e: - `lr-chart`: a chart fed `preparedData` no longer reads the legacy `datasets` input while building its tooltip configuration.
  - `lr-badge`: the host `aria-label` and `aria-labelledby` attributes are documented in the manifest and editor data.
  - `lr-help` and `lr-style-panel` are classified as static-safe for server rendering.
  - Size ceilings follow reviewed measurements: `lr-style-panel` brings the segmented, select, slider and swatch-picker controls it composes into the utility barrel (247,422 gzip bytes). The forms, media and overlays barrels, `lyra.js`, `theme.js`, and the standalone button, combobox and gauge entries grew by 68 to 2,284 gzip bytes each; the combobox initial route measures 39,227 marginal gzip bytes. Each exceeded ceiling advances only to the next 64-byte boundary. The unpacked package ceiling advances to 23,555,328 bytes, 0.5% above the 23,438,128-byte measurement.
- 376f3e2: Flow canvas, minimap and tree keyboard navigation respect text composition and browser shortcuts while preserving their documented selection and reorder commands.
  Holding Enter, Space or Delete on a flow node triggers its action once.
  Flow controls accept a group label and keep focus in the group when locking the canvas disables the focused button.
  Timeline items expose their variant as text, and horizontal timelines resume measuring items after a move.
  Timeline markers and rails, selected tree rows and running-node progress remain distinguishable in forced colors.
  Tree row focus rings and active timeline marker rings stay inside their scroll containers.
  Flow canvas edge strokes, pointer targets and minimap viewport outlines keep a consistent on-screen width at different zoom levels.
  Flow minimaps follow horizontal right-to-left canvases and accept the next genuine click after a drag.
  Flow source searches announce result counts, and endpoint actions name the source or target node and its edge.
  A failing flow companion no longer prevents other subscribers from receiving viewport updates.
  Flow nodes name progress bars after their node and reserve space only for the handle groups they display.
  Whitespace-only accessible names fall back to usable text on trees, environment lists, flow components and the graph query builder.
  Condition builder controls identify their row, announce additions and removals, show validation errors on the affected control and wrap at narrow widths.
  Both builders contain requests from their own pickers, and file trees contain bulk-toggle events from the inner tree.
  File trees accept a row size and include visible diff summaries and status in source-row names.
  Settled lazy tree branches retain their expansion when moved, and pointer reordering tolerates unavailable pointer capture.
  Disabled selected tree rows keep their selection fill under the pointer.
  Environment lists isolate variable names and values, announce remasking, show copy feedback and give text actions a minimum 24px target.
  Graph query builders accept a saved-queries heading level and describe errors before hints.
  Environment lists show a localized notice when entries beyond the ceiling are not rendered, and expose hover and pressed fill tokens for their buttons.
  Flow minimaps expose hover and pressed fill tokens for the map.
  Timeline items and flow nodes recognise slotted content through shared slot tracking, including content forwarded through another component's slot.
  Flow controls expose hover and pressed fills for built-in and slotted buttons.
  Unchecked tree checkboxes expose hover and pressed border colors.
  Tree item badges supplied without a tone use a quiet neutral fill.
  Timeline items expose ordered marker sizing and marker colors for each variant.
  Flow canvas and minimap drags release pointer capture when canceled, and edge connection gestures track their initiating pointer.
  Bulk tree expansion reads each branch's motion style once and honors its own duration.
  Condition builders load optional value editors when a row needs them.
- c768915: - Keep chart activation and legend changes current when an event listener replaces data or removes the chart.
  - Activate a chart mark once per keyboard press and dismiss the canvas keyboard tooltip with Escape.
  - Return keyboard focus to the chart after resetting zoom and enlarge the reset and table action targets.
  - Expose generated table action buttons through the `data-table-button` part.
  - Give chart legends a localized accessible name and use the chart or series name for whitespace-only labels.
  - Keep lite chart bar textures visible on hover and press in forced colors.
  - Keep lite chart axis titles and tick labels clear of each other as font sizes grow.
  - Reuse stable histogram ranges and update their counts when samples enter or leave a rolling window.
  - Distinguish tiny values on lite chart axes and histogram bucket boundaries.
  - Honor the `scale-type` attribute and `scaleType` property on lite charts.
  - Draw a keyboard focus indicator for spatial chart points and density bins.
  - Load the spatial renderer when a chart first receives a spatial source.
  - Retry transient chart and plugin imports while preserving charts whose optional feature is unavailable.
  - Show the accessible data table when a canvas renderer throws and restore the canvas on a successful redraw.
  - Honor motion preferences when chart controls change their hover and pressed colors.
  - Allow applications to veto 3D row selection with `lr-chart-row-select-request`.
  - Isolate 3D table numbers in right-to-left layouts and keep disabled pagination controls visually inactive.
  - Expose 3D selected-row, hover, and pressed-border colors and refresh the renderer when its effective theme changes.
- 96166b2: - Map configuration errors appear in a readable banner above the canvas.
  - Pick and drawing controls reserve space for the legend, scene panel and corner controls, and restore focus when a focused action disappears.
  - A concurrent map image export reports its busy result without displaying an error banner.
  - Unlabeled markers retain their localized accessible name as map controls update.
  - Marker popup tips point toward the marker in right-to-left layouts.
  - Disabling a map prevents marker activation and legend changes.
  - A camera command issued by an interrupt listener takes precedence over the interrupted action.
  - Read-only map properties tolerate framework bindings, and a gradient set before custom-element registration renders after upgrade.
  - Drawing counts and vertex names use the active locale's numbering system.
  - Whitespace-only anchor names fall back to the next usable label.
  - Slot-anchor dismissal, pick cancellation and globe and terrain control changes can be vetoed before the map commits them.
  - Child anchors emit `lr-map-anchor-dismiss-request` and `lr-map-anchor-dismiss`. The map's slot anchor keeps `lr-map-anchor-close-request` and `lr-map-anchor-close`; the two vocabularies are separate and share one detail type.
  - Legend requests respect listener assignments, including a write of the current value, and discard pending changes when a listener reconnects the map.
  - Authored `aria-busy` takes precedence on the map host until removed.
  - Long gradient captions wrap without collapsing the ramp.
  - Drawing geometry, vertex interaction colors and floating control interaction colors can be themed.
  - Floating scene, pick and drawing actions share the map's glass treatment.
  - Maps defer construction of the geographic scene owner until a scene is supplied.
  - Map updates reuse unchanged legend projections and batch child-anchor admission and peer-control decoration.
- 376f3e2: - Retry a map engine import after a load failure and distinguish it from an incompatible engine in development diagnostics.
  - Retry elevated scene rendering when the scene changes after a failed renderer import.
  - Restore keyboard focus after moving native map controls or re-enabling a globe or terrain button.
  - Ignore a nested drawing cancellation while delivering the completed drawing.
  - Abort a remote map image request when its headers and body exceed the 15-second deadline.
  - Handle a failed on-demand image runtime as a declined image for both supported map engines.
  - Scale exported map credits to the canvas resolution, wrap them at word boundaries and align them with the map’s text direction.
  - Use the attribution link’s hostname when its label is blank.
  - Use the surface colour for a data label’s halo when only the halo width is specified.
  - Cap map camera animations at 60 seconds.
  - Preserve camera orientation when a very large bearing would lose precision in the map engine.
  - Suspend canvas allocation polling while the drawing target is offscreen.
  - Release a drawing drag's pan lease once if pointer capture fails during teardown.
- 8e9ad29: Document viewers: highlight layer and page rail keep Alt/Ctrl/Meta, IME and auto-repeat keys for the browser, page rail restarts digit type-ahead after an impossible prefix and announces typed jumps with `lr-page-select`; the highlight layer draws the active highlight apart from a hovered one and holds a lasting reduced-motion flash cue; `lr-pptx-viewer` also emits `lr-page-change`, reports a renderer `AbortError` while still current, and composes the shared viewer frame; `lr-document-compare` reports one `lr-anchor-result` side by side and names panes apart when versions share a name; `lr-document-preview` shows an error for an image that fails to load, isolates caller text direction, and makes overflowing bodies keyboard scrollable; `lr-document-viewer` keeps its rendered content when moved and its body is keyboard scrollable; `lr-docx-viewer` ignores a click that ends a text selection and retries peers that failed to load; `lr-ebook-viewer` clears the previous book's location on a new `src`, titles chapter iframes, fills a definite-height host and exposes highlight tokens; `lr-pdf-viewer` reuses extracted page text across searches, names each page's highlight layer, announces page navigation, re-localizes page errors, centers page errors under RTL and resolves a cancelled thumbnail render instead of rejecting.

  Document viewers, continued: `lr-docx-viewer`, `lr-pdf-viewer`, `lr-pptx-viewer` and `lr-document-preview` release the unread body of a failed or superseded response; `lr-document-compare` gains `active-highlight-id`, `context-lines` and `languageLoaders`, and its `max-height` now also caps the diff view; `lr-document-viewer` gains `active-highlight-id` for its fallback preview; `lr-ebook-viewer` announces the chapter reached with the previous/next buttons; `lr-docx-viewer` highlight actions and the `lr-document-preview` download link share the chrome of their sibling viewers.

  - Document previews keep separated region controls on the image, move overlapping controls to a list, and preserve focus when the layout changes.
  - Region action lists leave modified and IME-composing arrow keys to the browser.
  - Disabled chapter and slide buttons keep their resting appearance. PDF, EPUB and PowerPoint pagers share the `--lr-viewer-pager-button-hover-bg` theme hook.
  - PowerPoint previews release unread responses if the renderer fails to load.
  - PDF viewers report failures from the current text layer, including an unexpected `AbortError`.
  - DOCX text highlights respect reduced-motion and forced-color preferences, and highlight actions inherit the viewer font.

  - DOCX previews reuse the shared highlight painter and heading navigation. EPUB and PowerPoint loader builds omit their test hooks.
- cb9fb3d: - Overlays no longer close on Ctrl, Alt or Meta with Escape; a modified Escape stays available to application and system shortcuts.
  - Exported CSV and data downloads still release their temporary object URL when the browser blocks the download activation.
  - Colour readback for canvas-based components reuses one scratch canvas per document instead of allocating a canvas for every colour.
  - Components gated on viewport visibility no longer throw when the visibility observer delivers a malformed entry list.
- d72f7b0: - QR codes, maps and audio visualizers that wait until they are on screen now follow the newest visibility report when the browser delivers several in one batch, instead of acting on an outdated one.
- 8e9ad29: Panorama camera keys, hierarchy navigation and column resize no longer act on Ctrl/Alt/Meta shortcuts or IME composition.
  Status labels no longer throw or resolve inherited names for non-string or `constructor`-style statuses.
  Roving focus targets under a hidden or inert host across a shadow boundary are now skipped.
  Model and voice pickers no longer re-emit input and change when the current value is re-selected, and emit `change` events in the same order as the other selectors.
  Separator and column-resize drags no longer throw when pointer capture is unavailable.
  Numeric values interpolated into localized messages use the active locale's numerals.
  Catalog pickers filter accent-insensitively.
- 376f3e2: Optional-peer loaders can word the development warning differently for a load failure than for a missing package. Remote response buffering sizes its buffer once from a trusted Content-Length instead of growing and copying. Icon-button hover and press now mix from a themed resting fill and stay visible under forced colors, as do progress tracks and fills. Form-control hint and error text wrap inside narrow controls, and SSR fallback attributes escape single quotes.
- 376f3e2: Overflow-fade observation of a tab, step, segment or timeline item survives a DOM move and no longer re-observes unchanged items on every update.
  A whitespace-only `aria-label` or `accessibleLabel` no longer counts as an authored accessible name.
- 376f3e2: The style-model generator no longer duplicates the slotted look-input list inside the theme module, and the build strips three more test-only parser and loader exports from the published package.
- 7e55a01: Exclude a test-only table-size helper from the published JavaScript.
- 5026900: - `lr-spreadsheet-viewer` with a `dataSource` reads a revealed sheet's first rows once: a search hit or anchor on another sheet no longer re-reads that sheet's opening window while its list scrolls to the target.
  - `lr-xml-viewer` and `lr-json-viewer` keep their single tree tab stop without copying the tree's controls into a new array after every render.
- 600bf98: - `lr-chord`, `lr-sankey`, `lr-treemap` and `lr-choropleth`: data tables use their own localized Source, Target, Name and Value headers, and a second table lists every entity or node total, including zero totals.
  - `lr-chord`: a pair too small to draw shows its own notice, and pair names are a localized template. A focused or hovered ribbon is emphasized. Mirrored weights may differ by floating-point rounding.
  - `lr-sankey`: labels stay against their bars in RTL. Crossing reduction keeps the best pass. Duplicate IDs report truncation, and the cycle error names the nodes in the cycle.
  - `lr-treemap`: the plot is sized from its container (new `--lr-treemap-height`), so labels keep the token size. The tile cap keeps every top-level category. Tiles too small to draw show their own notice and stay in the table. Nested tile names include their level and parent path. A rejected node no longer reserves its ID, and a throwing `valueFormatter` falls back to default formatting.
  - `lr-choropleth`: null and non-polygon geometry is skipped. Geometry with no drawable area reports invalid geometry with a dedicated message. Over-long labels are truncated, and the new `object` property selects one TopoJSON object.
- 70a9046: - The agent docs and component JSDoc name the tag-shaped registration entries
    (`components/lr-<tag>.js`) everywhere they previously named per-directory modules that no longer
    ship, such as `pdf-viewer.js`, `table.js` or `.../markdown/markdown-core.js`.
  - `check:doc-specifiers` also rejects abbreviated prose routes (`components/...js`, `.../x/y.js`,
    `../x/y.js` and a bare component-directory `x.js`) that no export provides.
  - The CSS-reset guidance explains why a reset such as Tailwind preflight strips the host box of
    `lr-callout`, `lr-zoomable-frame`, a standalone `lr-menu` and the modal hosts whatever the layer
    order, and gives a same-layer `revert-layer` rule that restores them.
- 0e15a2a: - `lr-widget`, `lr-artifact-panel`, `lr-details`, `lr-responsive-panel`, `lr-stack-trace` and the `lr-agent-workspace` details pane give their scroll body a named keyboard tab stop while, and only while, its content overflows (dashboard stat cells included). `lr-document-compare` panes and the `lr-lightbox` caption no longer add a tab stop when nothing scrolls.
  - The shared scroll-region helper now also watches slotted content, and keeps focus (at `tabindex="-1"`) on a body that stops overflowing while focused.
  - `lr-lightbox`, `lr-pan-zoom`, `lr-zoomable-frame`, `lr-pagination`, `lr-chart-3d`, the `lr-map` scene list and the `lr-image-viewer`/`lr-video` panorama pager keep keyboard focus on a sibling control when the focused button disables itself at a limit. `lr-tab-group` moves focus to the newly selected tab when a programmatic selection hides the panel that held it.
  - A blank numeric attribute (`""`) now keeps the declared default instead of becoming `0` on `lr-token-input`, `lr-time-range`, `lr-navigation-menu`, `lr-app-rail`, `lr-model-settings-panel`, `lr-audio-visualizer`, `lr-markdown`, `lr-markdown-core`, `lr-streaming-text`, `lr-code-editor`, `lr-agent-workspace` and `lr-realtime-session`.
  - `lr-spreadsheet-viewer` renders a source-backed workbook's active sheet inside the tab panel its selected tab controls.
- 0d12725: - A `focus()` call made before a component's first render now lands once it renders, across the remaining delegating controls: agent tools, conversation, data, layout, media, overlays, utility and the checkbox, radio and toggle groups. A host that is disabled or removed by then stays unfocused.
  - `lr-tab` also waits for its group to render the real tab button before focusing it.
- 7386ae0: - `lr-slider`: a slider moved in the DOM keeps thinning overlapping `marks` labels when it resizes.
- 2a6d019: - `lr-rag-answer` registers `lr-empty` with its own entry, so the empty state upgrades when it is the only import.
  - Retrieval components share one `DEFAULT_SCORE_THRESHOLDS` default.
  - Roving focus in the memory panel, claim evidence, grounding summary and RAG eval dashboard re-renders only when the focused row changes.
  - The 3D graph canvas listens for non-passive wheel events only while focused, so an unfocused canvas no longer blocks page scrolling.
  - Memory panel row action names quote a bounded excerpt of the memory text instead of all of it.
- 55c733d: - `lr-date-input` resolves `left*`/`right*` placements against the writing direction, like `lr-time-input`, `lr-select` and `lr-popover`.
  - `lr-command-palette` search is case-, accent- and Unicode-normalization-insensitive (`cafe` finds "Café").
  - A host `aria-describedby` now reaches the shadow role owner of `lr-carousel`, `lr-scroller`, `lr-dashboard-grid`, `lr-reorder-list` and `lr-app-rail-group`; `lr-time-range` forwards host `aria-labelledby` to its group and `aria-describedby` to both handles.
  - Small non-zero values no longer read as `0`: `lr-agent-run` default cost text, `lr-rag-eval-dashboard` number metrics, `lr-map` sub-metre drawing measurements, and `lr-video`/`lr-av-player` playback-rate options.
  - `lr-scroller` and the default `lr-carousel` navigation icons are SVG chevrons pointed by their wrapping part, so their size follows the control rather than the page font; `lr-neighbor-list` mirrors its direction glyph under RTL.
  - Required `lr-rubric-form` score controls name the required state in their accessible label; `lr-condition-builder` rows no longer carry `aria-invalid` (the failing control does).
- 23afcda: - Slot-driven chrome in `lr-chat-message`, `lr-conversation-item`, `lr-handoff-divider`, `lr-stream-status`, `lr-usage-badge`, `lr-thread-list`, `lr-avatar`, `lr-result-field`, `lr-tour`, `lr-kbd`, `lr-app-rail`, `lr-app-rail-item`, `lr-document-preview`, `lr-confirm-bar`, `lr-chat-composer` and `lr-agent-run` now uses one shared presence check: a wrapper that forwards an empty `<slot>` no longer renders an empty box (gap or padding), and forwarded content still shows.
  - Roving keyboard focus in suggestion chips, mention popovers, sequence strips, flow canvases, video playlists and graphs keeps exactly one reachable tab stop even when its internal position is not a finite number. The flow canvas page field now uses the same page bounds as the request it sends.
  - `lr-select` end adornments now line up at the row end, like `lr-combobox`. The labelled `lr-chat-viewport` jump pill keeps the shared minimum hit area.
  - `lr-voice-picker`: calling `click()` on the host in free-text mode now relays a click from the inner input, matching `lr-model-select`.
- b183985: - Every public property, attribute and method of every component now reaches `custom-elements.json`, editor hover data and the generated references with a description. Members whose meaning the platform fixes (form lifecycle callbacks, constraint validation, focus and selection passthroughs, native editing hints) share one library-wide description; everything else is documented where it is declared.
  - `lr-chart`'s `config` merge contract and `lr-lite-chart`'s `layout` modes are now documented on the public members instead of being lost from the manifest.
  - Member documentation states current behavior instead of comparing it with earlier releases.
- 3bd1aa6: - `lr-node-palette`, `lr-tree-item` and `lr-flow-controls` no longer read the undeclared `--lr-color-surface-hover` token; the pressed fill of a node-palette item now follows `--lr-node-palette-item-hover-bg`.
  - `lr-tool-select-dialog` sizes the checkbox row (not the control owner) so long tool names no longer compete with the box for width.
  - Hover and press fills now ease on chat-message retry, message-feedback submit, thread-list group toggle, checkpoint buttons, timeline cluster count, card, tab and embedding-explorer points.
  - Start/end adornments in input, time-input, date-input, chip and badge no longer shrink or clip under long labels.
  - Long unbroken prompt-studio version labels and node-palette item labels wrap inside narrow columns.
  - Internal style dedup: shared disclosure chevron and dialog backdrop fragments, merged multi-split and document-library rules, shared visually-hidden in spinner.
- 4b94b62: - `lr-video` control-bar selects inherit the component font, and the timeline range is announced once through its value text.
  - `lr-image-comparer` exposes its position as the range value text.
  - `lr-map` marker popup content is capped to the map height and scrolls; image export attribution strips use the map surface, text color and font.
  - `lr-map-anchor` owns its development warning timer and cancels it on disconnect.
  - `lr-file-input` remove buttons ignore a row whose file was replaced after render, and turning `multiple` off emits the value events for the retained file.
  - `lr-image-viewer` skips a highlight record with a missing anchor or a throwing getter instead of failing to render.
- e75ecdd: - `lr-env-list`: only the latest copy reports feedback, announces and emits; a copy that resolves after a newer copy, a disconnect, or replacement of its entry is dropped.
- e0ab518: - Component tests now assert rendered CSS (computed styles under real hover and keyboard focus) instead of matching stylesheet source text.
  - Timer-driven tests read the pending-timer list or wait on the observable condition instead of sleeping fixed real time.
  - Chart, map, timeline and flow-minimap tests land focus and hover through the shared keyboard and pointer helpers.
- 81f9ed8: - `lr-data-grid`: assigning a large flat `data` collection is faster again. The row projection and display list no longer allocate a traversal record per row or consult the child-row cache when `childRows` is unset, the root rows reuse the projection when nothing was skipped, and a measurement reset with no measured rows no longer re-indexes every row offset only to discard the anchor.
  - The shared measured-offset index used by `lr-data-grid` and `lr-virtual-list` clamps a full height reset in one pass.
- f7fc46c: - `lr-virtual-list`: assigning a large `items` array is faster again. A full row-height reset now builds the measured-offset index in a single pass over the freshly computed heights, without copying them twice or spreading them into a second array, and rows skip the group-marker lookup when no `groups` are set. `lr-data-grid` takes the same single-pass reset.
- f92b674: - `lr-knowledge-base`, `lr-document-library` and `lr-neighbor-list` keep their nested table's or pager's `lr-before-page-change` inside, and `lr-document-library` and `lr-tool-param-form` keep their embedded pickers' `lr-change-request` inside, so a host listener for those shared names no longer sees or vetoes internal picks. `lr-docx-editor` likewise contains its toolbar pickers' `lr-change-request`.
  - A `focus()` queued before a component's first render is cancelled by a later `blur()` and never steals focus that moved elsewhere in the meantime; a failed first render no longer adds an unhandled rejection.
  - `lr-checkpoint` and `lr-conversation-item` forward host `focus()` and `blur()` to the button they already forward `click()` to.
  - `lr-help` names its popup with the trigger's label (or the localized "Details") instead of the generic "Popover".
  - `lr-dropdown` treats the popover-only `trigger="hover-card"` keyword as `hover focus`, so its trigger keeps menu `aria-haspopup`/`aria-expanded`.
- d8397b8: - `npx lyra-ui-migrate --origin=lyra-v31` reports overrides of the retired `fileSizeUnitB`, `fileSizeUnitKb`, `fileSizeUnitMb`, `fileSizeUnitGb` and `fileSizeUnitTb` strings; file sizes word their units with `Intl.NumberFormat`, so these keys have no replacement.
  - The migration reference marks the renamed custom properties that `lyra-ui-migrate` rewrites as rewritten instead of reported only.
  - `llms/index.md` and `llms.txt` count lyra-ui's own elements, the total every other surface states, and name `lr-docx-editor` and `lr-gen-view` with their companion packages.
- 1e2bd68: - `lr-color-picker` with `label-placement="start"` now takes the full row, so the label column works at the default display.
  - Start-placed labels align with the first line of the field instead of centring against tall fields (`lr-textarea`, `lr-code-editor`, `lr-signature-pad`); with `label-display="hidden"` or no label the hint and error start under the field.
  - `lr-heatmap` axis-selection label buttons always keep one enabled tab stop per axis (a disabled leading label or a data shrink no longer removes it), and show hover and pressed states in forced colors.
  - `lr-combobox` `commit="text"`: a programmatic form reset no longer lets the next blur commit the pre-reset text over the reset value.
  - `lr-pagination`: a `page` written on its own leaves a stale `offset` inert, so a later `pageSize`-only change no longer snaps the page back to it.
  - The coarse-pointer touch font floor now also covers the `lr-pagination` page jump and page-size select, the `lr-data-grid` search, column filter and page-size select, the `lr-table` filter and cell editor, and the `lr-command-palette` search.
  - `lr-map` `legend-placement` and `drawing-complete-behavior` reflect and normalize unsupported values; `lr-segmented` `layout` and `lr-combobox` `commit` normalize unsupported property and attribute values instead of keeping them.
- 7f71f81: - `formatBytes()`, `formatRelativeTime()` and `<lr-format-bytes>` declarations name the public `LyraFormatBytesUnit` and `LyraFormatDisplay` types again instead of internal aliases.
- 7f71f81: - `lr-input` follows the surrounding text direction again while it is empty, so in right-to-left layouts its placeholder and caret start on the correct side. Entered text still sets the field's direction. Date and time types, including `lr-native-time-input`, keep the surrounding direction.
- d8c0eb1: - The Custom Elements Manifest documents the defaults of accessor-backed properties again: `lr-chart-3d` `selectedId`, `lr-commit-card` `filesExpanded`, `lr-context-meter` `selectedIndices`, `lr-map` `legendOpen` and `pickMode`, `lr-markdown` `content`, `lr-tool-result-view` `status` and `lr-tour` `activeIndex`. Runtime defaults are unchanged.
- 7f71f81: - Model, voice and prompt pickers now match search text accent-insensitively, consistent with the other searchable lists.
  - `lr-icon-button` and a custom `lr-copy-button` trigger keep a consumer's `tabindex` takeover when an enclosing toolbar releases its lease, matching `lr-toggle` and the message toolbars.
  - Shared internal helpers now back several duplicated descriptor, guard, clipboard and disabled-state checks; behaviour is otherwise unchanged.
- 7f71f81: - `lr-terminal` reports text selections through the shared selection observer, so a keyboard or touch selection that settles inside the viewport now fires `lr-text-select`, and its download uses the shared Blob download helper.
  - `lr-svg-viewer` keeps on-image region targets for several highlights until their minimum hit areas overlap, matching `lr-document-preview` and `lr-highlight-layer`, and moves focus to the matching control when the presentation switches.
  - `lr-model-select` and `lr-voice-picker` share their declarative field properties and template handlers through the common catalog-picker base; `lr-select` and `lr-combobox` share option guards and value normalization.
  - Hierarchy source hosts (`lr-tree`, `lr-file-tree`, `lr-trace-tree`, `lr-span-waterfall`, `lr-task-list`, `lr-xml-viewer`) share source-summary formatting, row-authority guards and active-row reveal.
- 7f71f81: - A chart that cannot rebuild after the annotation plugin registers now reports one development-only diagnostic per page instead of a console warning in production.
  - Optional-peer loaders share one capability check for the methods they call; accepted and rejected peer shapes are unchanged.
  - Components whose message keys resolve entirely to their own local key maps no longer ship unrelated English fallback strings in their default-string slices.
- 7f71f81: - `lr-image-viewer` and `lr-video` panoramas, `lr-embedding-explorer` and `lr-model-viewer` now restyle their WebGL renderer only when a theme attribute or a relevant media query changes, instead of on every attribute change of every ancestor.
- 7f71f81: Consolidate shared component styling without changing how anything renders.

  - Keyboard focus rings, hover and press fills, disabled controls, container hosts and form hint and error tone now come from shared style fragments instead of per-component copies.
  - The form pickers (emoji, locale, color, date, rubric) compute hint and error presence and `aria-describedby` through the shared form-control helper.
  - The status, retry, check and bookmark glyphs shared across components render from the common icon set.
- d8c0eb1: - Production builds now drop development diagnostics and their message text: the production diagnostics entry is marked side-effect free and `lr-map` plus the shared element, request, collection and optional-peer helpers guard each warning, so a bundler removes it even when the diagnostics module lands in a shared chunk. The `lr-map` bundle shrinks accordingly; development warnings are unchanged.
  - `lr-map` no longer re-measures its container and canvas on every camera move of a geographic scene: a move re-reads only the padding and measures again when it changed, while resizes and padding updates still refresh the scene allocation.
  - `lr-map` merges two identical glass-material rule sets and groups its action states, trimming its stylesheet without changing rendered styles.
  - The shared engine-style resolver is smaller: its palette is a tree-shakeable literal and unused override and windowless branches are gone.
- d8c0eb1: - Internal restructuring of `lr-heatmap`, `lr-chart`, `lr-data-grid`, `lr-table` and `lr-document-library`: configuration, pure helpers and rarely used modes moved into colocated modules. Public properties, events, parts, slots and exported types are unchanged.
  - `lr-heatmap` matrix-source mode and `lr-chart` spatial mode now load their interaction code together with the existing lazy source modules, so the initial route of a heatmap or chart without those sources is smaller.
- d8c0eb1: Style consolidation:

  - Every keyboard focus ring (including inset, inward, offset-only and coloured variants) now comes from one set of shared fragments, and `check-style-vocabulary` fails a hand-written `outline` built from the focus-ring tokens.
  - Remaining hover and press fills (text-colour mixes, solid-fill buttons, translucent washes) use shared fill helpers; computed colours are unchanged.
  - Interactive rows and buttons now transition through `--lr-transition-interactive` (fill, text and border colour) instead of only `background-color`, and the controls that had no pointer transition (toggles, preview buttons, clear and remove buttons, widget actions, map activation, poster play button) gained it. Tune or flatten it with the `--lr-transition-interactive` token.
  - The chart data-table toggle now has hover and pressed fills like the other bordered actions.
  - Pagination, clear and navigator buttons in retrieval-compare, signature-pad and flow-canvas share one bordered action recipe; a disabled signature-pad clear button now shows the `not-allowed` cursor like other disabled controls.
  - Checkbox, slider, signature-pad and file-input hint and error text share the form-control tone.
  - `lr-*` size tiers resolve through one shared definition for the unconditional and the contextual ladders; both read the theme-chained tier height and floor it at the coarse-pointer target minimum identically.
  - Search, error, warning, plus, minus, fit and lock glyphs, and the `<lr-icon>` search and refresh paths, come from the shared icon set.
- ef57ee6: Metadata corrections:

  - `lr-flow-controls`, `lr-graph-query-builder`, `lr-json-viewer` and `lr-poll-status` now document the `--lr-icon-button-*` hover and pressed tokens their icon actions already read, so editors and generated references list them.
  - `lr-entity-dossier` documents the `lr-tab-hide` event it forwards from its embedded tabs.
  - `lr-docx-editor` and `lr-gen-view` carry their status and release metadata in the companion manifests, so editor data includes them again.
- fff6b42: - Smaller published styles: Lit `css` templates that interpolate shared fragments now also drop the
    spaces CSS ignores around braces, semicolons, commas and declaration colons, and the last
    semicolon of each block. Strings, URLs, `calc()` operators, descendant combinators and the space
    between two interpolations are kept.
  - Smaller published SVG markup: `svg` templates get the same start-tag whitespace compaction as
    `html` templates. Text and attribute values are unchanged.
- 180a4ba: - `lr-chart-3d`, `lr-embedding-explorer`, `lr-video` and `lr-image-viewer` panoramas now build the style they pass to their optional 3D renderer through one shared resolver. The resolved values are unchanged.
  - `lr-chart` canvas keyboard navigation for ordinary and spatial data now uses one implementation. Key handling is unchanged.
- 52e8c37: - `lr-archive-viewer` and `lr-dataset-viewer` no longer draw a row divider under the last entry or row. Both lists now shrink to their content, so that divider sat directly on the frame's bottom border and doubled it.
- Updated dependencies [150dd68]
- Updated dependencies [e4d6610]
  - @aceshooting/lyra-translations@32.0.0

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
