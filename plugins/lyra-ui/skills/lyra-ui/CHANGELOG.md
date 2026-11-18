# Changelog

## 31.2.0

The quick Chromium comparison of the feature candidate with 31.1.1 flagged five of 150 timing metrics as slower. For 1,000 chart points, total p95 rose from 93.7 to 114.8 ms; for 5,000 ingestion items, paint median rose from 23.2 to 27.9 ms; for sorting 10,000 table rows, settle p95 rose from 8.0 to 9.3 ms. A fixed A-B-B-A follow-up used 15 samples per workload per run. No metric was flagged in both candidate-versus-baseline pairs, and repeated runs of the same version also produced flags. The affected component implementations and dependencies were unchanged; their shared code differed only in package metadata and an unused size constant. Together, these observations point to timing variation without demonstrating a sustained slowdown.

### Minor Changes

- fe6ba7d: Set initial branch expansion with `LyraTreeNodeData.expanded`. The tree remembers expansion by stable ID across data updates and collapsed ancestor remounts. Use `lr-bulk-toggle` to read which branches changed, including branches currently out of view.
- fe6ba7d: Enable `pointer-reorderable` to request a move before or after a visible tree row. Listen for `lr-pointer-reorder` to apply the move. Use `allow-cross-parent-reorder` to permit cross-parent moves and `canDrop` to validate drop candidates.

  The tree additions and shared size/keyboard fixes increase the measured full registration bundle to 1,506,118 gzip bytes and the data bundle to 445,961 bytes. Only the ten exceeded entry limits advance to their next 64-byte boundary. Passing limits, initial-route budgets, optional-peer exclusions and the existing headroom policy remain unchanged.
- fe6ba7d: Set `size` on data and declarative trees to choose a row density. Use `--lr-tree-row-height` and `--lr-tree-toggle-size` to size rows and controls independently while preserving minimum pointer targets.

### Patch Changes

- Keep lazy tree loading and its accessible busy state in one render, including after reconnect.
- fe6ba7d: Include document editor translations in full locale imports and expose a `docx-editor` family for applications that load editor messages separately.
- fe6ba7d: Consume printable select typeahead keys so choosing an option in WebKit cannot also replace a retained text selection in an editor.
- Updated dependencies [fe6ba7d]
  - @aceshooting/lyra-translations@31.2.0

## 31.1.1

### Patch Changes

Map canvas allocation, minimum-query suggestions and sequence playback presentation add runtime code, types and consumer guidance to the package. The page breakpoint, dock focus and tooltip fixes add 554–592 gzip bytes to five aggregate bundles. The affected bundle, packed core and unpacked delivery ceilings round their measurements up to the next 64-byte boundary.

- Update page navigation when a font-relative or viewport-relative breakpoint changes at a fixed page width. Content that only increases the page height no longer repeats breakpoint measurements.
- Keep focus on the dock panel when a rail icon expands it. Keep tooltips anchored as they open in narrow columns.
- Restore the shared `label-display` accessibility reference. Document the JSON viewer's 20rem intrinsic sizing introduced in 31.0.0, including constrained parent grid tracks for narrow panels.
- Make the network monitoring example's history keyboard reachable, with a localized accessible name and visible focus ring.
- Add sequence playback position formatting and an optional visible readout. Restart completed standalone non-looping playback from the first item, preserve listener-owned actions, and document which navigation methods pause playback.
- Add opt-in combobox `min-query-length` to keep short queries closed and out of asynchronous sources. Preserve typed text and selection while canceling obsolete searches; the default remains unrestricted.
- Add map `canvasTarget` for painting behind application chrome while controls, fitting and visible bounds use the host's usable area. Track layout changes, support axis-aligned transforms, and retire geometry work when the map or its document changes.
- 03eaaf1: Preserve valid accessible names for category labels when no glyph fits their measured chart lane. Retire the temporary role and name when a label becomes intentionally blank, and restore native text semantics when the lane widens.

  The semantic repair increases five measured aggregate bundles by 41–44 gzip bytes. Only their exceeded ceilings advance to the next 64-byte boundary; individual-entry limits, passing ceilings, measurement inputs and optional-peer exclusions stay unchanged.

  The generated-view chat composition measures 1,035,535 raw and 293,712 gzip bytes of lazy JavaScript. Only these exceeded lazy limits advance to the next 64-byte boundary, preserving eager-loading limits and external dependency inventories.
- @aceshooting/lyra-translations@31.1.1

## 31.1.0

### Minor Changes

- Add opt-in visible field labels and hints to `lr-segmented`, with shared form styling, label and hint slots, and accessible group naming. Label display remains hidden by default.
- 6dd5f5a: Add explicit custom ingestion-stage presentation and bounded replacement row actions. Hosts can gate built-in Retry/Cancel or request their own actions while stale and disabled controls remain inert.
- 6dd5f5a: Add optional single-reason selection and native UTF-16 comment limits to message feedback detail configuration. Oversized drafts remain intact and receive a localized error before submission.
- 32cbf4c: Add `toolbar-placement="actions"` to chat composer and prompt input. With `actions-layout="below"`, caller toolbar controls sit between start and end below the textarea while attachments remain above it. The default upper toolbar stays unchanged. Live placement changes preserve the editor, draft, selection and focused controls; narrow and RTL layouts keep the toolbar bounded and retain native Tab order. Prompt input's independent model, voice and source controls keep their existing position.

  The stable toolbar layout, viewer request lifecycle fixes, thread excerpt observation and contained stepper focus ring increase eight measured bundles. Reviewed gzip sizes are 303,920 bytes for the largest component, 1,489,754 for all components, 1,715,239 for the CDN autoloader, 1,715,085 for the local autoloader, 452,193 for the conversation barrel, 389,655 for the layout barrel, 463,509 for the viewers barrel and 1,736,802 for the SSR aggregate. Only these exceeded ceilings advance to the next 64-byte boundary; passing ceilings, measurement options and optional-peer exclusions are unchanged.
- 6dd5f5a: Add document-library cursor sources for collections without a known total. Provide bounded Previous, Next, Retry, and Start over navigation, immutable query details, and shared cursor-source types. Retire stale requests and rendered rows when queries or providers change, preserving the existing array and indexed-source routes when cursor mode is unset.
- 6dd5f5a: Add an optional budget meter quantity formatter with locale context, coherent visible and accessible text, and numeric fallback for invalid results.

### Patch Changes

- Keep category labels within narrow chart lanes when even an ellipsis cannot fit, preserve their full accessible names, and restore Unicode text when space grows.

Final release artifacts include versioned changelogs and metadata alongside the thread-navigation focus and shared ingestion presentation fixes. Only exceeded delivery ceilings advance to the smallest reviewed boundaries; passing limits, measurement options, optional-peer exclusions, the UI download limit, file-count ceilings, scaffold reserves and the historical reduction policy remain unchanged.

- 6dd5f5a: Update thirteen measured bundle ceilings for bounded cursor navigation, ingestion actions, feedback detail policies, quantity formatting, and lifecycle recovery. Each ceiling rounds its reviewed gzip measurement to a 64-byte boundary; passing limits, optional-peer exclusions, and initial-route budgets remain unchanged.

  The final ownership guard adds 65 unpacked bytes, and all.js measures 1,498,947 gzip bytes. Only its exceeded ceiling advances by 64 bytes to 1,499,008 bytes; all other reviewed limits stay unchanged.
- 32cbf4c: Report active DOCX and PPTX transport failures even when they use an AbortError, while keeping canceled requests silent. Resume pending transport after same-task DOM moves without restarting active document conversions or presentation renderers, and discard late responses from retired requests.
- cb780e1: Remove redundant environment and RGB channel checks from CDN autoloading and theme startup while preserving document-less imports, input validation, and color calculations.
- 6dd5f5a: Retire obsolete diff-view search and anchor scrolling when synchronous search listeners replace results, compared text changes, or the viewer disconnects. Clear virtual-list sticky scroll insets when no groups remain.
- 6dd5f5a: Prevent graph activation from proposing obsolete selections when an activation listener changes controlled selection or replaces the graph's data, presentation, or connection.
- 6dd5f5a: Suppress movement and settled-view notifications when a native camera or bounds read disconnects or replaces the map, preventing retired camera data from being published after ownership changes.
- 6dd5f5a: Recover to the built-in graph renderer when a companion fit or camera operation fails, and release failed companions even when their final position snapshot throws. Keep fallback controls usable and ignore callbacks from retired engines.
- 63e863b: Reuse a frozen empty presentation for ingestion rows without optional metadata, preserving descriptor validation, cancellation guards and row ownership. A 5,000-row diagnostic reduced returned presentation objects from 5,000 to one while retaining all 10,000 validity checks.

  The initial seven-sample comparison against 31.0.0 observed ingestion update median/p95 increases of 26.6/29.6 to 33.8/48.7 ms and total p95 of 60.4 to 77.3 ms. Chart total p95 increased from 95.8 to 111.9 ms, no-op paint median/p95 from 21.2/25.9 to 24.9/32.7 ms, and no-op total from 22.3/27.0 to 26.0/33.9 ms. Chart production source was unchanged; the elapsed metrics include animation-frame waits.

  The fixed-order, 21-sample before/after ingestion comparisons showed mixed timing results: update medians of 32.5 to 28.9 ms and 30.2 to 30.3 ms, with one comparison observing a 3.9 ms paint-wait increase. The refactor establishes reduced allocation, not a sustained wall-time improvement. The final matched 21-sample comparison against 31.0.0 did not flag ingestion or chart metrics. Its only material increase was evaluation-dataset selection update p95, from 2.1 to 3.3 ms, while median improved from 1.8 to 1.5 ms. This unchanged component's tail timing remains observational. All original samples are retained, and benchmark thresholds are unchanged.
- 3a0f6aa: Update eight measured bundle budget pairs for document-library API compatibility and flow-canvas and virtual-list fixes. Only exceeded ceilings advance to the next 64-byte boundary; passing limits, including all.js at its existing cap, optional-peer exclusions and initial-route budgets remain unchanged.

  The same fixes add 437 unpacked bytes across eight existing package files. The actual archive is 22,736,831 bytes; npm dry-run metadata produces a 22,737,453-byte estimate. Only the exceeded unpacked estimate ceiling advances to 22,737,472 bytes, with 19 bytes of allowance.

  The same source changes add 372 raw bytes to the complete packed core graph, bringing it to 5,734,530 bytes across the same 65 files. Its raw ceiling advances to 5,734,592 bytes, with 62 bytes of allowance. All optional packed bundle limits and gzip limits remain unchanged.
- 6dd5f5a: Update the UI unpacked ceiling and the translation and IDE byte ceilings for cursor navigation, ingestion actions, feedback policies, quantity formatting, localized labels and generated API data. The final ownership guard adds 65 unpacked UI bytes; each exceeded ceiling advances only to the next 64-byte boundary, preserving download limits, file-count reserves and the historical 25% reduction requirement.
- 6dd5f5a: Respect cancellation, stopping, or removal during push-to-talk state notifications: avoid requesting microphone permission for a retired request and suppress obsolete recording-start effects for a take already stopping or disconnected.
- 6d20578: Keep icon-library changes made during a mutator from being overwritten by its retired load. Show a localized error when an active icon request aborts unexpectedly, while keeping replaced and disconnected requests silent.

  The corrected shared icon load path changes bundle compression. Measured media aggregate and popup/export-button marginal gzip sizes exceed their previous canaries by 4, 4, and 2 bytes; only those ceilings move to the next 64-byte boundary.
- 15a78de: Report active PDF and archive transport failures even when they use an AbortError, while keeping canceled requests silent. Resume pending transport after same-task DOM moves, preserve active PDF parsing tasks, and discard late responses from retired requests.

  PDF transport ownership adds 82 gzip bytes to its standalone entry, while archive ownership reduces its entry by 13 bytes. The reviewed all-components, autoloader, viewer-family, PDF and SSR bundle ceilings advance only where exceeded, to the next 64-byte boundary. Together with the bootstrap simplifications, the package measures 22,639,805 unpacked bytes in the actual archive and 22,640,427 in the npm dry-run inventory across the same 3,290 files; its unpacked ceiling becomes 22,640,448 bytes. Download, file-count, companion and passing bundle limits remain unchanged.

  The installed core bundle measures 5,693,092 raw bytes across 65 files, a 642-byte increase. Its raw ceiling advances to 5,693,120 bytes; gzip limits, optional-peer exclusions and the separate exact binary requirement remain unchanged.
- 3a0f6aa: Stop a virtual list's pending notification sequence when a range-change or load-more listener disconnects or moves it to a new document. A removed list no longer requests more data from the retired update, and normal demand resumes after reconnect.
- 7daef56: Warn once per document when multiple active UI runtimes are detected, including copies with the
  same package version. Document application-owned whole-package resolution for components,
  utilities and lazy chunks. The diagnostic identifies unsupported split-runtime use without
  merging overlay ownership or interrupting component operation.

  The shared document-runtime diagnostic increases a standalone button registration from 36,507
  to 37,120 gzip bytes (+613 bytes). Reviewed bundle measurements advance only the 21 exceeded
  entry, aggregate and component-maximum ceilings to their smallest 64-byte boundary, leaving
  0–63 bytes of allowance; the button canary has none. The eight passing measurement/ceiling
  pairs, measurement options and optional-peer exclusions remain unchanged.

  The runtime diagnostic, its overlay declaration and resolution/testing guides add 5,752 unpacked
  package bytes. The actual archive measures 22,654,271 bytes and the npm dry-run estimate measures
  22,654,893 across 3,291 files. Only the exceeded unpacked ceiling advances to 22,654,912 bytes,
  the next 64-byte boundary with 19 bytes of allowance. All other byte limits, file-count ceilings
  and the historical reduction policy remain unchanged.

  The shared document-runtime diagnostic increases the complete installed core graph by 2,022 raw
  bytes to 5,699,985 bytes across 65 files. The immutable package comparison identifies only six
  runtime module payload changes, with no dependency changes. Only the exceeded core raw ceiling
  advances to 5,700,032 bytes, the next 64-byte boundary with 47 bytes of allowance. Gzip limits,
  optional-peer exclusions and exact binary requirements remain unchanged.

  With the runtime diagnostic and lifecycle fixes included, the optional MapLibre v6 map bundle
  measures 2,528,040 raw bytes across 52 files, up 335 bytes from 2,527,705. The optional graph
  bundle measures 463,780 raw bytes across 14 files, up 922 bytes from 462,858. These are complete
  emitted bundle measurements. Only their exceeded raw ceilings advance to the next 64-byte
  boundaries: 2,528,064 bytes with 24 bytes of allowance for map, and 463,808 bytes with 28 bytes
  for graph. The MapLibre v5 bundle remains below its existing ceiling. Gzip limits and peer-graph
  checks remain unchanged.

  Cursor-backed documents, custom ingestion presentation and actions, feedback detail limits,
  quantity formatting and lifecycle fixes increase the complete installed core graph by 34,173 raw
  bytes to 5,734,158 bytes across 65 files. Only the exceeded raw ceiling advances to 5,734,208
  bytes, the next 64-byte boundary with 50 bytes of allowance. Gzip limits, optional-peer
  exclusions and exact binary requirements remain unchanged.
- 3a0f6aa: Preserve the current scene's selection when a flow node or edge activation listener replaces the scene. The original action now retires before applying selection to the replacement, while later actions continue normally.
- 32cbf4c: Report active document preview, notebook, and email transport failures with localized feedback even when named AbortError. Resume pending requests after same-task DOM moves, discard retired responses, and preserve email parsing already in progress.
- a7eeb1d: Preserve outside focus when pending virtual thread navigation finishes rendering its destination.

  The temporary focus-ownership listener and lifecycle cleanup add 103–120 gzip bytes to the affected registration, autoloader, conversation and SSR aggregate bundles. Only the five exceeded ceilings and their exact reviewed measurements advance, using the next 64-byte boundary; passing limits and optional-peer exclusions remain unchanged.

  The focus fix adds 649 emitted runtime bytes and 26 declaration bytes. The ordinary npm inventory also includes 622 more manifest bytes than the published archive. The unpacked package ceiling advances to the next 64-byte boundary above the larger measured inventory; the download limit and file-count allowance stay unchanged.
- 6dd5f5a: Keep time-scaled timeline positions in sync with timestamp changes when timeline items register after their parent has rendered.
- 86ab216: Resume pending contact, calendar, HTML, SVG, and XML document loads after a same-task DOM move while preserving already-loaded content. Report unexpected failures named AbortError with localized feedback, and keep requests cancelled by replacement or disconnect silent.

  Request ownership and pending-load recovery add 149–194 gzip bytes to the five exceeded viewer-containing bundles. Their ceilings advance only to the next 64-byte boundary: all components 1,488,704 bytes, CDN autoloader 1,714,176 bytes, autoloader 1,713,984 bytes, viewers barrel 463,168 bytes, and SSR all components 1,735,744 bytes. The npm dry-run estimate measures 22,639,711 unpacked bytes across 3,290 files; only the exceeded unpacked ceiling advances to 22,639,744 bytes. Passing limits and measurement inputs remain unchanged.

  The complete packed core graph measures 5,692,450 raw bytes across 65 files: 800 bytes from these viewer fixes and 26 bytes from the preceding icon ownership fix above the prior reviewed measurement. Its exceeded raw ceiling advances to 5,692,480 bytes, leaving 30 bytes of headroom. Gzip limits, optional-peer exclusions and binary requirements are unchanged.
- 32cbf4c: Keep horizontal stepper keyboard focus outlines inside the scrolling track, and remove empty thread-list excerpt template spacing while preserving nontext excerpt content and reconnect updates.
- 8deb78a: Update measured delivery budgets for viewer transport recovery, composer toolbar placement and its declarations, thread excerpt layout, and stepper focus containment. The actual UI archive measures 22,648,519 unpacked bytes and the npm dry-run estimate measures 22,649,141 across the same 3,290 files; only the exceeded unpacked ceiling advances to 22,649,152 bytes. The generated composer editor API data measures 1,741,853 packed and 10,755,183 unpacked IDE archive bytes across eight files, bounded at 1,741,888 and 10,755,200 bytes.

  The complete installed core graph measures 5,697,963 raw bytes across 65 files, an increase of 4,871 bytes. Its exceeded raw ceiling advances to 5,697,984 bytes with 21 bytes of headroom. Passing byte limits, the UI download ceiling, file-count ceilings, measurement options, optional-peer exclusions, and exact binary requirements remain unchanged.

  Review the generated-chat composition after shared component runtime and ownership fixes. Lazy JavaScript measures 1,033,397 bytes; its raw ceiling is 1,033,408 bytes, the next 64-byte boundary with 11 bytes of headroom. Its eager JavaScript, gzip, CSS and asset limits, external-import inventory and pinned measurement toolchain remain unchanged.
- Updated dependencies [a7eeb1d]
- Updated dependencies [9c67698]
  - @aceshooting/lyra-map@1.5.2
  - @aceshooting/lyra-translations@31.1.0

## 31.0.0

### Major Changes

- 2479fe6: Major release collecting behavior and type changes that can affect existing pages:

  - `lr-attachment-trigger`'s `lr-files` event `capability` now includes `'camera'`, so code typing it as `'files' | 'image'` must widen.
  - `lr-json-viewer` defaults to `layout="auto"`, which stacks values under keys below 30rem; set `layout="inline"` for the previous layout.
  - `lr-chat-viewport`'s slotted content wrapper is a flex column, so vertical margins between adjacent messages add instead of collapsing.
  - `lr-attachment-chip` honors `thumbnail-src` and `preview-src` while `file` is set.
  - `lr-button` and `lr-icon-button` render real links for author-written `tel:` and `sms:` hrefs.
  - A failed `system` `lr-chat-message` uses `--lr-chat-message-failed-color` for its text.

### Minor Changes

- 47d5ced: `lr-attachment-chip`: a non-empty, safe `thumbnail-src` and a non-empty `preview-src` now take precedence over the blob URL derived from `file`, while `file` keeps supplying the name, size and MIME type. With `thumbnail-src` plus `preview-src` (or `without-preview`) the chip creates no `blob:` URL at all, so a page whose Content-Security-Policy has no `blob:` in `img-src` can keep passing the `File` and supply a `data:` or same-origin thumbnail. Previously `thumbnail-src` and `preview-src` were ignored while `file` was set. The docs now note that showing a `File`'s own image needs `blob:` in `img-src`.
- fceec2c: `lr-attachment-trigger` gains an opt-in `camera-capture` attribute (`'environment'` or `'user'`). On an engine that supports the native `capture` attribute (phones and tablets), the `camera` capability then opens the hidden file input with `accept="image/*"` and that `capture` value inside the same user gesture and reports the photo through `lr-files` with `capability: 'camera'`. Desktop browsers keep firing `lr-camera-request`, so a host can keep its own camera dialog there. Unset, `camera` stays request-only. New exported types: `LyraAttachmentCameraCapture` and `LyraAttachmentFilesCapability`.
- 5e894d7: `lr-button` and `lr-icon-button` now render a native anchor for `tel:` and `sms:` hrefs, so `<lr-button href="tel:+40700000100">Call</lr-button>` is a click-to-call action. Like `mailto:`, both hand off to a system app, name no web origin and execute nothing. Behavior change: such an href previously fell back to the native `<button>` and now renders a link. `download` still drops all three handoff schemes, the `target`-derived `noopener noreferrer` guard is unchanged, and executable or document schemes stay rejected. Content-derived links (`lr-markdown`, `lr-streaming-text`) keep their narrower allowlist and do not admit `tel:` or `sms:`.
- 5cc0590: `lr-chat-composer` gains `actions-layout="below"`: the textarea takes its own full-width line and the `start` and `end` slots share one row beneath it, `start` at the inline start and `end` at the inline end (also while `start` is empty, and mirrored under RTL). `min-rows`/`max-rows` growth and inner scrolling are unchanged, `lr-prompt-input` forwards the new value, and `reservations.css` (and `reservationStyles`) reserves the layout's taller resting footprint before upgrade.
- a0d873c: `<lr-chat-message>` gains layout, border, announcement and failed-text hooks:

  - `avatar-placement="start" | "end"` lays the avatar beside the body instead of in the header row (`"top"`, the default, is unchanged).
  - `--lr-chat-message-bubble-border-width` (every role), `--lr-chat-message-bubble-border-color` (every role except `user`) and `--lr-chat-message-user-bubble-border-color` recolor or remove the bubble border.
  - `--lr-chat-message-width` sets the bubble's inline size; `fit-content` shrinks a bubble to its content while it stays on its role's side.
  - `announce-status="false"` turns off the built-in failure and streaming-complete live-region announcements while keeping the visible status text.
  - `--lr-chat-message-failed-color` (default `var(--lr-color-text)`) paints failed bubble text, so a light role text color no longer lands on the pale failed fill. A failed `system` message now uses this readable color instead of the quiet system color.
- 33515ec: `lr-chat-viewport`: add the `--lr-chat-viewport-padding`, `--lr-chat-viewport-gap` and
  `--lr-chat-viewport-content-max-inline-size` custom properties (a narrower transcript column is
  centred), and a `live-settle` announce-when-settled mode that announces a streamed message once,
  with its final text, after it stops changing. In slotted mode the transcript wrapper is now a flex
  column, so adjacent message margins no longer collapse, and the unread divider is centred in the
  space above the first unread message. The documentation now states the host's flex-column layout
  contract: do not override its `display`, and give it a bounded block size.
- 71b8079: `lr-drop-zone` gains `for` (an element id in the zone's own root) and `target` (an element reference, taking precedence). Set either to attach the zone to a region that already exists in the page instead of wrapping it: the zone handles drags over that element, lays its overlay over the element's box, adds no box of its own and still emits `lr-files` from itself. A `for` id that matches nothing binds nothing and is re-resolved when the root's elements or ids change. The new `targeted` custom state matches while a target is bound. Unset, the zone keeps wrapping its default slot as before.
- bc213b1: Add `layout` to `lr-json-viewer` (`'auto' | 'inline' | 'stacked'`, default `'auto'`). Below a 30rem allocation the default now stacks each scalar value under its key and tightens leaf rows, through a container query on the viewer's own width, so a viewer inside a phone-width `lr-tool-call-block` no longer squeezes key and value side by side. Leaf rows drop the icon-button-sized floor of their hidden toggle spacer, while real expand/collapse toggles keep their full hit area. `layout="stacked"` forces this layout at any width and `layout="inline"` restores the side-by-side row at every width. Keys now break after `_`, `-`, `.`, `/`, `:` and `@` and at camelCase humps instead of mid-word. The `LyraJsonViewerLayout` type is exported.
- ddac560: Add `linkSchemes` (attribute `link-schemes`) to `lr-markdown` and `lr-markdown-core`, forwarded by `lr-streaming-text` and `lr-streaming-text-core`. It narrows which link destinations may become anchors to a space- or comma-separated subset of `http`, `https`, `blob`, `mailto` and `relative`, so `link-schemes="https"` keeps only https links in model-generated text. A refused link renders as plain text, never as an anchor, in every `html-mode`; raw-HTML and SVG anchors are unwrapped after sanitization and `<area>` elements removed. Unknown tokens are ignored, so the list can never widen the default allowlist. Unset keeps today's behavior, and sanitization is unchanged.
- 04fb410: `lr-number-input` gains an opt-in `localized` attribute for locale-aware entry. The field then reads and shows numbers with the grouping and decimal separators of the effective locale (`25.000` and `10,24` in `de` or `ro`), while `value`, the submitted form value and `valueAsNumber` keep the native number form (`25000`, `10.24`). Range, step and required validity still come from the platform, grouping is checked so an entry the locale would not write reports `badInput` instead of being misread, and the text field keeps spinbutton semantics and ArrowUp/ArrowDown stepping. Existing fields are unchanged: without `localized` the component stays a native `type="number"` input with the same defaults.
- d531e88: `reservations.css` (and the adoptable `reservationStyles`) now reserve the upgraded footprint of `lr-tab-group`, `lr-tab`, `lr-tab-panel`, `lr-checkbox`, `lr-badge` and `lr-chat-composer` before their definitions load. A not-yet-upgraded tab group lays out its tabs as one tab-sized row and shows only the panel that will be shown, so prerendered pages using these elements no longer shift when they upgrade.
- 6218e9e: `lr-suggestion-chips` can show a vector icon per suggestion: `iconName` (with optional `iconLibrary`) renders an `lr-icon`, and a light-DOM element in the `icon-<suggestionId>` slot, such as an inline SVG, replaces it. The literal `icon` text is unchanged and is still never parsed as markup. Icons stay decorative; each chip's accessible name is its label.
- 644b7ab: Add `focusTab(name, options?)` to `lr-tab-group`, which moves keyboard focus and the roving tab stop to the named enabled tab's real button, and forward `lr-tab.focus()`/`blur()` to that button. Under the default `activation="auto"` focusing an unselected tab also selects it as `show()` does; under `manual` only focus moves. Disabled, inert and unknown tabs are left alone.
- 2170466: Add `columns[].cellPart(row)` to `lr-table`. When a column defines it, the resting cell content is wrapped in a block `[part~="cell-content"]` element that also carries the returned part names, so the page or the component that owns the table can style `cell()` output per row with `lr-table::part(...)`. Columns without `cellPart` render unchanged. The reference now states that `cell()` templates render inside the table's shadow root, where the owner's class rules do not apply, and that a `part` attribute inside a `cell()` template is also a table part.
- e868ed4: Add `ordered` and `start` to `lr-timeline`. An ordered timeline renders a native `<ol>` and each item's marker becomes a ring around its step number, real text formatted for the effective locale and exposed to assistive technology, in the new `marker-number` part; `start` sets the first number like `<ol start>`. The new `--lr-timeline-marker-number-color` property sets the number colour. `reservations.css` (and `reservationStyles`) now lay out a vertical flow timeline before its definitions load, with markers, rail, floated timestamps, descriptions and CSS-counter step numbers for an ordered timeline, so server-rendered steps no longer shift when the script arrives.

### Patch Changes

- c3498de: Restore release performance comparisons after Playwright upgrades by matching ChromeDriver to the configured Chromium version. Install the pinned benchmark tools in a fresh cache for each run so an older driver cannot be reused. The three workloads and the 10% regression threshold are unchanged.
- 44b9773: Restore theme tokens when an adopted stylesheet is disabled or an imported token stylesheet's media stops matching. Reuse the original provider when it becomes active again without retaining a duplicate fallback.

  Recognize token imports preceded by CSS layer-order declarations so those providers can be replaced and restored correctly.
- 53874fa: Stop reading calendar response bodies when their request has been superseded or the viewer has disconnected. Late responses from a transport that completes despite cancellation no longer start unnecessary body processing.

  The connection and generation guard adds three gzip bytes to the bundled autoloader (1,708,033 bytes). Its exceeded ceiling advances from 1,708,032 to the next 64-byte boundary, 1,708,096 bytes. Passing bundle ceilings remain unchanged.

  The npm dry-run inventory measures 22,550,659 unpacked bytes across the same 3,289 files, an increase of 58 runtime bytes. The exceeded unpacked ceiling advances to 22,550,720 bytes, the next 64-byte boundary; download and file-count ceilings remain unchanged.

  The packed consumer's core graph measures 5,670,441 raw bytes across the same 64 files, an increase of 49 bytes. Its exceeded raw ceiling advances to 5,670,464 bytes, the next 64-byte boundary.
- 3b2998e: Keep a canceled folder traversal classified as cancellation when directory reader initialization throws after the drop session has been withdrawn.

  The cancellation check measures 508,228 gzip bytes in the agent-tools barrel, four bytes over its existing ceiling. Its budget alone advances to the next 64-byte boundary (508,288 bytes); measurement settings and the other limits stay unchanged.

  The unpacked package measures 22,540,871 bytes, seven bytes over its existing ceiling; that ceiling advances by 64 bytes to 22,540,928. Download and file-count limits are unchanged.
- f9b769c: Keep evaluation tag filters and feedback reason chips unchanged when a toggle request is canceled or the component becomes disabled or pending during that request. The visible selection now stays consistent with filtered rows and submitted feedback.

  The two runtime modules add 107 unpacked bytes. The npm package estimate measures 22,552,443 unpacked bytes across 3,289 files; its exceeded ceiling moves to 22,552,448 bytes. The installed core bundle measures 5,671,433 raw bytes across 64 files; its exceeded ceiling moves to 5,671,488 bytes. Conversation and SSR bundles measure 443,655 and 1,730,011 gzip bytes, respectively; their exceeded ceilings move to 443,712 and 1,730,048 bytes. These are the next 64-byte boundaries; all other limits remain unchanged.
- e69c1a0: Clamp out-of-range color percentages before conversion so very large finite RGB values retain the saturated channel instead of turning black.
- f044d39: Remove an unpositioned date-input calendar from layout when its positioning runtime fails, including openings through a property binding or after reconnection. Failed openings settle without reporting a successful show, release the rendered calendar, and remain retryable. An obsolete placement cannot close a newer calendar.
- 411cb01: Discard obsolete contact-file responses before reading their bodies when the viewer disconnects or its source changes while response headers are pending. Late network failures and aborts also remain isolated from the current document across the viewer family.

  The guard adds 58 runtime bytes to the unchanged package inventory. Only the exceeded unpacked-package and two aggregate gzip ceilings advance to their next 64-byte boundaries after measurement.
- 055fb82: Keep the fallback renderer available when a 3D engine rejects with an object whose failure code cannot be read, including a throwing accessor or revoked proxy. Classify that rejection as an engine error without throwing again while handling the original failure.
- fdee86f: Keep file icons accessible when a custom metadata registry returns malformed or unreadable records. Invalid presentation data falls back to a localized generic badge and valid replacement registries recover normally. Read presentation fields once while retaining the glyph fallback for failures in optional badge data.

  Together with namespace-correct theme scopes, the fixes add 530 unpacked archive bytes in two modules and 301 bytes to the complete core consumer bundle. Update only exceeded size ceilings to the next 64-byte boundary using the measured artifacts.
- 926d1b0: Contain spatial chart renderer hit-test failures and reject malformed hit records without invoking getters or emitting an unrelated density selection. Valid later clicks continue to work.
- 2dbef4f: Keep the virtual list's rendered window aligned with the current scroll position when a programmatic jump overtakes a queued native scroll event. This also lets consecutive source-row reveals reach and focus the requested XML node.
- eb64a53: Preserve newer data-grid collection assignments when reading an older caller-owned array reenters a setter. Data, columns, column order, grouping, page-size choices and expanded keys now retain the latest snapshot. Selected rows and key aliases share assignment ownership, including initial template bindings, and row admission metadata stays paired with the data it describes.

  The guards add 1,504 runtime/declaration bytes to the unchanged package inventory and 1,002 raw bytes to the packed core bundle. Only exceeded package and aggregate bundle ceilings advance to their next 64-byte boundaries after measurement.
- 88c0382: Keep the newest data-grid filter and sort assignments when reading older caller-provided records or collections triggers another assignment. An older throwing getter also preserves the newer query, including when that query reaffirms the existing state.

  The guards add 232 unpacked runtime/declaration bytes and 148 raw bytes to the packed core bundle, with both file inventories unchanged. Only exceeded package and bundle ceilings advance to their next 64-byte boundary; passing limits and optional-peer exclusions are preserved.
- 43c4859: Stop obsolete data-grid requests after a request listener disconnects the grid, replaces its source or query, or starts a newer reload. This prevents duplicate loader calls, old queries reaching a replacement loader, and loading restarting after disconnect.

  Recognize both equality and inequality request-generation guards when classifying component security review applicability.

  The fix removes 24 emitted runtime bytes and adds 186 bytes of consumer guidance. Advance the unpacked package limit to the next 64-byte boundary above the 22,552,821-byte dry-run measurement. The shared guard increases the SSR aggregate to 1,730,053 gzip bytes; advance only that exceeded bundle limit to the next 64-byte boundary.
- a182932: Document how `lr-dialog` and `lr-drawer` panels paint when no surface is chosen: they follow the built-in profile's Glass, a 60% fill over a 12px backdrop blur held on an internal layer, so `getComputedStyle(panel).backdropFilter` reads `none` while the backdrop is still blurred. Tests now pin that a translucent panel always carries the blur and that `data-lr-surface="solid"` paints it opaque without one. Rendering is unchanged.
- 4decda0: Dispose rejected elevated-line renderer handles before falling back to ground tracks, including when capability access or cleanup throws.
- 5d47cee: Keep layered graph and flow layouts stable for arbitrary unique string node IDs. Distinct edge endpoints no longer collide when IDs contain null characters, and synthetic ordering waypoints cannot share identities with caller nodes. Renaming node IDs preserves geometry, layer assignments and waypoint counts.

  The identity fix adds small shared graph/flow entry increases. Four exceeded bundle ceilings advance only to the next 64-byte boundary above their measured sizes; passing limits stay unchanged.
  The packed graph consumer measures 460,621 raw bytes across the same 14 files, so its exceeded ceiling advances to 460,672 bytes.
- 81b0923: Ignore detached and obsolete dropdown slot notifications, preventing a WebKit update loop when prompt inputs move through an inert document. Reconnecting collects the current consumer menu and restores its interaction.
- d77a865: Preserve host-routed AG-UI custom data when it arrives before the corresponding text or reasoning message starts.
- b23677f: Keep embedding renderer callbacks scoped to their current connection and inputs. Retired renderers stop startup, dispose exactly once even after a delayed mount, and cannot overwrite a replacement renderer or report its failure. A throwing peer disposer no longer interrupts cleanup.

  The renderer ownership checks add 615 unpacked bytes to one runtime module; the public API and declarations remain unchanged. The archive contains 22,549,979 unpacked bytes in 3,289 files; npm estimates 22,550,601 bytes. The unpacked limit advances to the next 64-byte boundary, 22,550,656 bytes. Four aggregate gzip limits advance only to the next 64-byte boundary above their measured 1,482,741 / 1,708,228 / 1,708,030 / 1,729,721 bytes for all, CDN autoloader, autoloader and SSR all. Passing limits, bundle inputs and optional-peer exclusions remain unchanged.

  The packed consumer's core bundle measures 5,670,392 raw bytes across the same 64 files. Its ceiling advances to 5,670,400 bytes, leaving eight bytes of headroom; the separate required Shiki binary measurement is unchanged.
- a1dadb4: Treat a removed include source as idle in deferred loading. Retain the current included content without fetching or throwing, and allow a later source attribute to load normally.

  Reset an ebook viewer to idle when its source is removed, including across reconnection, and allow a replacement book to load without a deferred null-string error.
- 7b61dc8: Clear custom graph geometry when a companion changes or disables the node renderer while accepting its mesh batch. Keep subsequent renderer replacements usable and suppress error events from obsolete mesh work.
- 4e1f338: Preserve source-backed graph focus and entity-detail activation while the optional 2D rendering dependency loads. Wait for the renderer before moving the camera, and discard the pending focus if its source, view, or connection changes.

  The fix adds 350 runtime/declaration bytes. The UI package measures 22,553,607 unpacked bytes; its exceeded ceiling advances to the next 64-byte boundary, 22,553,664 bytes.

  The two exceeded aggregate gzip ceilings advance to the next 64-byte boundary: autoloader-cdn.js measures 1,708,609 bytes and ssr/all.js 1,730,137. Passing aggregate and initial-load ceilings remain unchanged.

  The installed graph consumer measures 461,047 raw bytes across 14 files. Its exceeded raw ceiling advances to 461,056 bytes, the next 64-byte boundary; the core consumer and peer-loading constraints are unchanged.
- 707146a: Allow file-tree expansion and collapse and thinking-panel and transcript-feed scrolling methods to be called before the first connection without throwing. Scrolling still re-engages follow without emitting a user transition, and the methods remain usable after rendering.
- 11cb9f6: Discard chart clicks when native hit testing replaces the labels, datasets, raw configuration, or chart type. Check ownership after array and hit admission so obsolete hits cannot activate replacement data. A fresh click still selects the current data, and presentation-only updates preserve valid activations.

  The ownership checks add 26 gzip bytes to the autoloader aggregate, which measures 1,706,769 bytes. Its exceeded ceiling advances to the next 64-byte boundary, 1,706,816 bytes. The unpacked UI archive grows by 234 bytes to 22,542,695 bytes, with its exceeded ceiling advancing to 22,542,720. Passing limits and measurement inputs stay unchanged.
- 5236f0d: Return no screen anchor when an optional graph renderer supplies an invalid projection or the graph changes during a projection query. Contain projection failures without preventing a later valid query from recovering.

  The ownership and finite-coordinate guards add 160 gzip bytes to the standalone graph entry. Only the three exceeded autoloader/SSR bundle ceilings advance to the next 64-byte boundary; their exact measurements are recorded. The required UI artifacts measure 22,541,960 unpacked bytes, so the unpacked ceiling advances to 22,542,016 bytes. Download, file-count, companion, and passing bundle limits are unchanged.

  The packed optional graph consumer measures 460,203 raw bytes across the same 14 files after the projection checks, up from 459,450. Its separate raw-byte ceiling advances only to the next 64-byte boundary, 460,224 bytes; bundle contents and optional-peer checks remain enforced.
- 6a59684: Validate optional graph renderer world positions before returning immutable coordinates. Failed or malformed queries and results from a retired view or data model now return no position; coordinate and unrelated metadata accessors are never evaluated. A later valid query recovers without recreating the renderer.

  The shared ownership checks and world-coordinate validation add 83 gzip bytes to the standalone graph entry. The packed optional graph consumer grows by 360 raw bytes to 460,563 across the same 14 files; only its exceeded raw ceiling advances to the next 64-byte boundary, 460,608 bytes.

  The CDN autoloader, autoloader and SSR aggregate measure 1,706,900, 1,706,743 and 1,728,332 gzip bytes. The unpacked UI archive measures 22,542,461 bytes. Their exceeded ceilings also advance only to the next 64-byte boundary; passing limits and the archive inventory stay unchanged.
- c6fde08: Isolate panorama renderer disposal failures so image and video viewers can disconnect, replace their renderer, and show the localized native-media fallback. Dispose renderers arriving after disconnect only once, even when their cleanup throws.

  The SSR aggregate measures 1,728,722 gzip bytes; its exceeded size ceiling advances to the next 64-byte boundary, 1,728,768 bytes. Other bundle ceilings and all coverage settings remain unchanged.
  The npm dry-run inventory measures 22,545,774 unpacked bytes, so its exceeded ceiling advances to 22,545,792 bytes. The actual archive contains 22,545,152 bytes across the same 3,289 files.
- ec87368: Keep scroll-overflow, icon-label, chat viewport, markdown DOM and accessible relationship observers released when an initial render finishes after removal or a detached component updates. Restore ordinary observation on reconnect, and restore markdown text-selection events when reconnecting either markdown variant.

  The packed core retains 64 emitted files at 5,668,068 raw bytes, and the UI npm estimate is 22,545,665 unpacked bytes. Advance only the exceeded core, package and seven direct gzip ceilings to their next 64-byte boundaries; the packed map size is unchanged.
- 26bef2a: Release partial WebGL allocations when an elevated map path cannot compile its shaders, link its program, or initialize its vertex buffers.
- a1dadb4: Recover an invalid multi-split hydration count from the actual panel membership before computing divider geometry. Non-finite, negative, fractional, and unsafe integer counts no longer interrupt rendering or hide existing dividers.
- 5363490: Stop obsolete Markdown code-copy feedback after a copy outcome listener disconnects the component, disables its code-block header, or starts another copy. Both Markdown variants now recheck the active copy before announcing feedback or scheduling its reset, preventing timers from surviving teardown or replacing a newer copy's timer.

  The shared fix adds 13 gzip bytes to the largest component and 141 unpacked package bytes with its guidance. Only the exceeded component maximum and unpacked package budgets advance to the next 64-byte boundary; passing limits remain unchanged.
- 7a85d8d: Refresh cached message widgets when updated action payloads change which fields share an object. Widget actions now emit the current reference relationships, while equivalent shared or cyclic payloads keep their widget document stable across unrelated text updates.

  The fix adds 68 runtime bytes to the unchanged package inventory and 44 raw bytes to the packed core bundle. Only those exceeded ceilings advance to the next 64-byte boundaries; compressed bundle ceilings remain unchanged.
- 2391e13: Preserve model viewer load ownership when renderer callbacks report a failure or change the source. Stop retired initialization, retain context-loss recovery, and prevent stale camera updates and duplicate error events.

  The verified package changes one runtime module (+506 raw bytes, +56 standalone gzip bytes). The installed core consumer adds 329 raw bytes across the same 64 files. Only exceeded archive and bundle limits move to the next 64-byte boundary; package contents and optional-peer exclusions stay unchanged.
- 2f03bb2: Restore cell-anchor navigation in CSV, dataset and spreadsheet viewers with more than 10,000 admitted inline body rows. Let the indexed source resolve its own row keys instead of overriding it with the array key callback. Navigation continues to work when a large table is replaced by a smaller one.

  The three conditional bindings add 78 unpacked bytes: the package estimate is 22,543,419 bytes and the verified archive is 22,542,797 bytes. Raise only the unpacked ceiling to 22,543,424 bytes, five bytes above the estimate. Standalone gzip grows by two bytes for CSV and four bytes each for dataset and spreadsheet viewers.

  The viewers barrel measures 460,904 gzip bytes, exceeding its previous 460,864-byte ceiling. Advance only that exceeded bundle ceiling to 460,928 bytes.

  The packed consumer's complete core graph measures 5,666,723 raw bytes across 64 files. Raise its exceeded 5,666,688-byte ceiling to 5,666,752 bytes, with 29 bytes of headroom.
- ddf7081: Match complete script and style tag names when searching notebook HTML output, preserving visible text in other elements and ignoring hidden raw text after misleading closing-tag prefixes. Keep quoted attribute text out of search results when it contains greater-than characters.

  The quote-aware scanner adds 861 raw bytes to the notebook module. Reviewed bundle and unpacked-package ceilings advance only where this fix exceeds them, to the next 64-byte boundary. The packed consumer remains at 64 emitted files, measured at 5,669,889 raw bytes with a 5,669,952-byte ceiling. Package contents and optional-peer exclusions are unchanged.
- fed2225: Observe custom graph renderer scheduler failures even when the scheduler synchronously cancels admission. Immediate and delayed failures from canceled work no longer escape as unhandled promise rejections.
- a7a5763: Restore localized defaults when attachment uploading labels and tool-selection dialog labels are removed from markup. Preserve menu and mention-popover accessible names and empty-state messages when their copy attributes are removed.
- e52be70: Keep newer panorama camera and hotspot assignments when inspecting older caller-provided data triggers another assignment in image and video viewers.

  The assignment guards add 110–145 gzip bytes to affected aggregate bundles and 362 raw bytes to the packed core bundle across the same 64 files. Their reviewed size ceilings advance only to the next 64-byte boundary; optional renderer loading and bundle contents are unchanged.

  The full package adds 544 runtime and declaration bytes. Its npm dry-run inventory measures 22,554,151 unpacked bytes, bounded at the next 64-byte boundary of 22,554,176 bytes. The actual pnpm archive contains 22,553,529 bytes across the same 3,289 files.
- e104409: Keep PDF document replacement and detached-state cleanup working when the PDF renderer throws or rejects while releasing a document.

  The verified SSR coverage script registration and shared PDF cleanup add 224 published metadata, runtime, and declaration bytes. Update the measured unpacked package allowance to the next 64-byte boundary (22,552,704 bytes); retain the existing download and file-count limits.

  The shared cleanup adds 17 gzip bytes to the PDF entry (74,116 bytes measured). Advance only its exceeded ceiling to 74,176 bytes, the next 64-byte boundary.

  The installed all-components consumer measures 5,671,510 raw bytes across the same 64 files. Advance its exceeded raw ceiling to 5,671,552 bytes, the next 64-byte boundary; keep the separate optional-asset and import-splitting checks.
- 29cb92f: Resolve PDF outline bookmarks that identify pages with zero-based integer indexes, including named destinations and the first page. Only valid pages within the document are exposed; unresolved bookmark titles and children remain available.

  The verified package changes one runtime module (+71 raw bytes, +23 standalone gzip bytes). The installed core consumer adds 47 raw bytes across the same 64 files. Only exceeded archive and bundle limits advance to the next 64-byte boundary; package contents and optional-peer exclusions remain unchanged.
- 7bf8abe: Preserve the selected PDF page when page measurements or viewport resizing change only the end of the visible range. Scrolling across a page boundary still updates the current page, and moving a loaded viewer within the document retains its navigation and search state.

  The fix adds 132 runtime/declaration bytes. The package measures 22,553,257 unpacked bytes; only its exceeded unpacked ceiling advances to the next 64-byte boundary, 22,553,280.

  Four aggregate gzip ceilings also advance to the next 64-byte boundary: all.js measures 1,483,154 bytes, autoloader-cdn.js 1,708,567, autoloader.js 1,708,375, and viewers/index.js 461,783. Other bundle ceilings are unchanged.

  The installed core consumer measures 5,671,600 raw bytes across 64 emitted files after the virtual-row and PDF navigation fixes. Only its exceeded raw ceiling advances to 5,671,616 bytes, retaining 16 bytes of headroom; gzip and initial-load ceilings remain unchanged.
- 474c4cb: Keep the validated identity and label when copying catalog rows, including non-enumerable fields and rows whose key enumeration is unavailable. Preserve an own `__proto__` data field without changing the copied row's prototype.

  The descriptor-safe copy adds 117 unpacked archive bytes and 135 bytes to the packed core graph. Direct gzip measurements are 1,482,120 bytes for all, 1,707,353 for the CDN autoloader, 1,707,189 for the autoloader, 443,528 for conversation and 1,728,775 for SSR all. Only these exceeded entry ceilings advance to their next 64-byte boundaries. The core graph measures 5,668,228 bytes across the same 64 files and is bounded at 5,668,288; the unchanged map graph measures 2,527,557 bytes across 52 files. The UI archive contains 22,545,269 unpacked bytes in 3,289 files; the npm dry-run estimate is 22,545,891 bytes, so only the exceeded unpacked ceiling advances to 22,545,920. Measurement options, optional-peer exclusions, file inventories, and passing ceilings remain unchanged.
- 524f2f4: Keep chart data and CSV export usable while `lr-chart` or `lr-box-plot` belongs to a document without a window. Defer the browser chart instance until the element returns to a browsing context, avoiding a rendering exception during document adoption.

  The two rendering guards add 38 raw bytes to the package. The measured npm unpacked estimate is 22,549,377 bytes; its exceeded ceiling advances to 22,549,440 bytes, the next 64-byte boundary. The actual archive contains 22,548,755 unpacked bytes across the same 3,289 files.
- b5c8da4: Preserve valid CSS when the Happy DOM cascade-layer shim encounters punctuation inside layer-header comments. Block headers and layer-order statements now skip complete comment tokens before locating their actual boundary, and an unfinished header comment leaves preceding rules intact.

  The parser fix adds 78 unpacked package bytes, measuring 22,542,773 bytes. Raise only the exceeded unpacked ceiling to the next 64-byte boundary, 22,542,784 bytes; download, file-count, and bundle ceilings remain unchanged.
- 7378f05: Preserve escaped parentheses and backslashes in unquoted CSS URLs when flattening cascade layers for Happy DOM. Resource paths that resemble layer blocks now remain intact, and following layers still unwrap after the real URL boundary.

  Preserve escaped at-signs and braces in selectors, and escaped punctuation in layer names, so they cannot be mistaken for layer directives or block boundaries.

  The escape handling adds 95 unpacked bytes: the pnpm archive measures 22,542,246 bytes and the npm dry-run estimate measures 22,542,868 bytes. Raise only the exceeded unpacked ceiling to the next 64-byte boundary, 22,542,912 bytes. Download, file-count, and bundle ceilings remain unchanged.
- 65c60d4: Preserve pending virtual-list navigation when unrelated keyboard events originate in the Window that owns the scroller. Typing letters or pressing horizontal arrow keys in an iframe no longer cancels a distant vertical scroll before measured row positions settle.
- 644b1f2: Keep synchronized charts responsive when native hit testing, projection, or reset fails. Discard stale hit results, clear failed cues, let healthy peers update independently, and allow a failed receiver to retry the same category.

  The required hit validation and renderer recovery increase the published JavaScript and its consumer bundles. Only exceeded library, archive, and packed-consumer ceilings advance to the next 64-byte boundary above their recorded measurements; optional-peer exclusions and the complete emitted-file sum remain unchanged.
- bdb0150: Make focus and blur safe before the first render for accordion items, attachment triggers, chips, data grids, known-date inputs, pagination, pan-zoom, videos and video playlists. Add shared native focus and custom-validity contracts for controls created before mounting.

  The defensive focus guards increase the measured CDN and local autoloader bundles by 29 and 31 gzip bytes, to 1,705,414 and 1,705,218 bytes. Advance only their exceeded ceilings to the next 64-byte boundary; passing bundle limits and measurement inputs stay unchanged.

  Together with the stale map-scene report guard, the required runtime artifacts measure 22,534,149 unpacked bytes. Advance the exceeded unpacked package ceiling to 22,534,208 bytes, the next 64-byte boundary; the download and file-count limits stay unchanged.

  The packed core consumer measures 5,664,357 raw bytes across the same 64 files, a 37-byte increase. Advance that exceeded ceiling to the next 64-byte boundary, 5,664,384 bytes, with its exclusions and binary accounting unchanged.
- 644b1f2: Release deferred positioning and rectangle-tracking subscriptions when their owner is disposed from a synchronous setup callback. Repeated or reentrant disposal releases each subscription once, while retained placement sessions continue to support invalidation and geometry refresh.

  The ownership checks add 108 unpacked package bytes and 55 raw bytes to the complete packed core bundle. Only exceeded package, core-consumer, library, and initial-route ceilings advance to the next 64-byte boundary above their recorded measurements, retaining all passing limits and optional-peer exclusions.
- a76b936: Refresh stylesheet providers when explicitly adopting theme tokens so CSSOM edits restore missing tokens and withdraw duplicate fallbacks in documents and application shadow roots.
- 79d296f: Prevent indexed and ranged data operations from invoking providers retired while their capabilities are being read. Replacing the source or disconnecting its host stops obsolete row and key callbacks before they run. Superseded binding and range work also stops before inspecting more capabilities or consuming replacement pages, while subsequent requests can use the current source normally.

  The complete provider ownership checks measure 22,539,040 unpacked UI bytes; the exceeded package ceiling advances to 22,539,072 bytes. Eleven exceeded direct and aggregate gzip ceilings advance only to the next 64-byte boundary above the exact measurements recorded in the bundle budgets. The guards prevent obsolete callbacks and replacement-page loss; measurement inputs, optional-peer exclusions and passing limits remain fixed.

  The packed core consumer measures 5,666,569 raw bytes across the same 64 files, an increase of 716 bytes from the initial lookup fix. Its exceeded ceiling advances to 5,666,624 bytes, the next 64-byte boundary. The explicit Oniguruma binary requirement remains unchanged.
- 2229e1a: Keep text-quote searches consistent across inline element boundaries by collapsing whitespace before combining characters that expand during Unicode normalization.

  Preserve emoji in Firefox when a UTF-16 surrogate pair is split across text nodes or streaming updates.

  Normalize copied quotes after removing soft hyphens so accented text still matches its source.
- 50f634b: Recognize mixed-case and CSS-escaped cascade-layer keywords when flattening stylesheets for Happy DOM. Preserve unrelated at-rules whose names extend the layer prefix, so their ignored contents cannot become active CSS rules.

  The keyword decoder adds 509 unpacked bytes. Together with the date-input placement correction (36 fewer bytes), the package estimate grows from 22,542,868 to 22,543,341 bytes; the verified archive grows from 22,542,246 to 22,542,719 bytes. Raise only the unpacked package ceiling to 22,543,360 bytes, leaving 19 bytes above the estimate.
- 88e7806: Close locale-picker popups and tooltips when positioning fails, including replacement geometry after a successful opening. Allow fresh openings and preserve newer placements when an obsolete operation fails.
- 2060c47: Update the map style-spec dependency and refresh browser testing, DOM, and AI integration tooling. Preserve accurate coverage for unexecuted callbacks when merging results with the updated browser test runner.

  Keep the supported PapaParse peer range when refreshing development dependencies.

  The updated map style specification adds OKLCH color parsing and interpolation. Its verified archive grows by 2,185 compressed bytes and 5,365 unpacked bytes, with the same 677 files. Advance only the exceeded map size limits to the next 64-byte boundaries.
- b43b4dc: Refresh workspace dependencies, including DOMPurify 3.4.18, and rebuild the reviewed DOCX engine against fast-xml-parser 5.12.1 and fast-xml-builder 1.3.2.
- ccb0d35: Refresh native constraint validity after `required` changes on `lr-input`, `lr-number-input`, and
  `lr-native-time-input`, so owning forms validate and submit correctly without a manual validity refresh.
  Correct the dropdown menu example to supply its fallback accessible name through `aria-label`.
- 57fb2a3: Refresh dependency versions and generated package artifacts. Qualify the latest optional peers while preserving supported consumer ranges, and update the map style specification dependency to 26.6.0. Rebuild the document engine with Vite 8.3.8 and the reviewed ProseMirror model 1.25.13 dependency.

  Retain coverage counter safeguards and the dev-server dependency security patch with the upgraded test runner.

  The map dependency rebuild changes the archive from 1,051,147 to 1,051,391 packed bytes while reducing unpacked bytes from 4,295,831 to 4,295,701, with the same 677 files. Advance only the exceeded packed ceiling to the next 64-byte boundary, 1,051,392 bytes.
- f7ccc57: Release the clock subscription when a sequence playback binding is aborted during synchronous catch-up, so a retired binding cannot keep scheduling animation frames.
- fbbfdda: Restore keyboard focus from interactive tooltip content when positioning failure closes the popup. Preserve focus on unrelated controls, including when the tooltip has a virtual anchor and an explicit return target.

  Review the shared build growth with clock signal validation: the packed core remains 64 files at 5,667,789 raw bytes, the npm UI estimate is 22,545,330 unpacked bytes, and three direct gzip ceilings are exceeded. Advance only these limits to their next 64-byte boundaries.
- f916304: Keep small finite chart domains from rounding to zero and preserve the positions of nearby values on logarithmic axes.
- 7b1badf: Keep map feature clicks available while unchanged overlay layers prepare an in-place GeoJSON data
  refresh. Changes to source options, layers, interaction rules, or other map resources retain the
  preparation guard, as do disabled and inert maps.
- fdee86f: Apply and restore theme scopes in standalone SVG and XML documents. Color probes use the HTML namespace in their owning document, and elements without inline CSS support retain scoped attributes without attempting to paint tokens.
- f282fc2: Close navigation-menu disclosures when positioning fails, restore trigger focus when needed, and allow a fresh opening. Preserve newer floating or in-flow disclosures when an obsolete placement fails.
- a49df38: Ignore queued spatial graph visibility and resize deliveries after their observer is retired. Reconnecting a graph or switching between list and 3D views can no longer let an old hidden notification suspend the replacement renderer. The current observers still suspend and restore rendering as visibility changes.

  The ownership checks add 246 runtime bytes. The unpacked UI package estimate is 22,549,986 bytes, so its exceeded ceiling advances to the next 64-byte boundary, 22,550,016 bytes. The SSR aggregate measures 1,729,615 gzip bytes, with its exceeded ceiling advancing to 1,729,664 bytes. The packed graph consumer measures 460,762 raw bytes across the same 14 files, so its exceeded ceiling advances to 460,800 bytes. Passing limits and measurement inputs stay unchanged.
- 353292c: Discard heatmap pointer selection when its grid, controlled selection or interaction mode is replaced before the next render. Recheck gesture ownership after focus, hit-testing and pointer-capture callbacks so obsolete interactions cannot overwrite a new selection or activate a retired cell. Accepting the normal controlled selection proposal still preserves cell activation.

  The ownership checks advance five exceeded aggregate gzip ceilings, the unpacked UI archive ceiling and the packed core raw-byte ceiling only to their next 64-byte boundaries. The archive measures 22,546,461 unpacked bytes (22,547,083 in the npm packaging estimate) across the same 3,289 files; the packed core measures 5,669,098 raw bytes across the same 64 emitted files. Passing size limits remain unchanged.
- 922d2d3: Retry incomplete map point icon rasterization on later declarative paint updates. Failed recoloring keeps the previous palette intact and no longer caches an unapplied color, allowing icons to recover when canvas allocation becomes available again.
- 52fafa4: Report a map custom layer as unavailable when an optional bridge handle throws during capability validation. Attempt disposal independently and contain cleanup failures so a broken bridge cannot leave the layer loading or cause an unhandled promise rejection; a replacement layer can still install.

  The fix adds 99 unpacked bytes, measuring 22,546,560 bytes in the UI archive and 22,547,182 in the npm estimate across the same 3,289 files. Only the exceeded unpacked ceiling advances to the next 64-byte boundary; all bundle gzip limits remain unchanged.
- 45063a8: Let smooth virtual-list navigation finish before correcting estimated row and group sizes. Intermediate measurements no longer repeatedly restart native scrolling, and measured destinations settle after the animation. New navigation, replacement data, keyboard scrolling and disconnect retire stale corrections; reduced-motion navigation remains immediate.

  Measure Window viewports from the document's scrolling root so lists remain virtualized in both standards and quirks mode. Documents without a doctype no longer render the entire collection or misalign distant scroll targets.

  The fixes add 808 unpacked package bytes and 146 standalone virtual-list gzip bytes. The package estimate is 22,544,227 bytes and the verified archive is 22,543,605 bytes; advance the exceeded unpacked ceiling to 22,544,256 bytes, with 29 bytes of headroom. Advance only the 13 exceeded gzip ceilings to their next 64-byte boundaries. The complete packed core graph measures 5,667,406 raw bytes across the same 64 files, so its ceiling advances to 5,667,456 bytes, with 50 bytes of headroom.
- 711b1fa: Ignore chart and box-plot activation hits when native hit testing or hit-result validation disconnects or replaces the chart instance. A reconnected chart accepts fresh clicks without emitting stale activation events. Box plots also contain native hit-testing failures so subsequent valid clicks still work.
- f4ffb25: Preserve the latest workbook sheet when a source metadata callback switches sheets. Ignore obsolete dimensions and errors, and cancel navigation belonging to the superseded selection.

  Discard column metadata and render errors from superseded sheet callbacks so the latest sheet keeps its own headers and cells.
- 40780b4: Keep synchronized compare-panel scroll positions stable when panes have different content heights. Native scroll events that differ only by pixel rounding no longer feed back into the other pane after the animation frame completes.

  The fix adds 45 unpacked UI bytes (22,539,085 total); the exceeded package ceiling advances to 22,539,136 bytes. The autoloader measures 1,706,255 gzip bytes, so its exceeded ceiling advances to 1,706,304 bytes. Both limits use the next 64-byte boundary; other passing limits and measurement inputs remain unchanged.
- bac361a: Preserve newer searches and clears started by provider cancellation callbacks in CSV, dataset,
  and spreadsheet viewers. Superseded operations no longer cancel the newer request or overwrite
  its query label, including when reading a provider's search capability starts another search.

  The shared fix adds 226 unpacked runtime bytes. The three exceeded aggregate gzip ceilings and
  the unpacked package and complete core-consumer ceilings advance only to the next 64-byte boundary above their reviewed
  measurements; passing limits and optional-peer exclusions are unchanged.
- d867044: Data-source CSV, dataset and spreadsheet viewers no longer leave the visible rows blank when a cell reveal is cancelled (for example by `clearSearch()`) after it has started loading the target rows but before the list scrolled to them; the cell window returns to the rows on screen.
- 6a24221: Restore ArrowUp, ArrowDown, Home and End navigation between slotted thread-list rows, skipping unavailable rows and respecting keys handled by row actions.

  Keep rows assigned to named slots out of default-list navigation and `itemElement()` lookup until they join the default slot.

  The default-slot filtering and keyboard listener add 13 gzip bytes to the component measurement. The full-library entry measures 1,483,084 gzip bytes, 12 bytes above its prior ceiling; its reviewed ceiling advances by 64 bytes to 1,483,136. Other bundle limits and optional-peer exclusions are unchanged.
- f251b0d: Keep animated images, app-rail groups, and tooltips usable after their source, heading, or content attribute is removed. Clear the corresponding image or text and accept later replacements without throwing during rendering.
- ee91edf: Preserve newer map legend, gradient, tick, hidden-category and style assignments when older caller-owned input reenters during normalization. Keep legend counts and visibility aligned with the winning input, and safely reject revoked tick arrays without preventing later updates. Assigning an explicit empty tick list now immediately removes already-rendered derived ticks.
- 38b99fa: Keep an installed map scene ready when its active renderer delivers a delayed status report for an older scene revision. Reject reports for future revisions as well, and recheck ownership after reading renderer-controlled report fields.

  The revision and ownership checks add 15 gzip bytes to the media barrel (382,597 bytes measured). Its ceiling advances from 382,592 to the next 64-byte boundary, 382,656 bytes; all other bundle ceilings and coverage settings stay unchanged.
- cf16424: `lr-tooltip` now paints its `content` property, and describes the trigger with it, when the default slot holds only whitespace beside a `slot="trigger"` element written across lines. Previously the template indentation counted as slotted content, so the bubble opened empty and the trigger had no accessible description. Slotted elements or non-whitespace text still take precedence over `content`.
- ecaebc3: Keep deeply nested declarative trees responsive in Chromium by assigning child slots before rendering instead of during connection.
- c8b457a: Preserve descriptions and badge names in provider-backed tree rows, separate adjacent display text,
  and give otherwise unnamed rows their stable ID. Explicit accessible labels retain precedence.

  The complete packed core graph grows by 138 raw bytes across the same 64 files. Generated naming
  references and declarations add 428 bytes alongside the 178-byte emitted module change. Only
  exceeded package and bundle ceilings advance to their next 64-byte boundary; passing limits and
  optional-peer exclusions are unchanged.

  The companion editor manifest grows by 137 bytes. Its unpacked ceiling likewise advances only to
  the next 64-byte boundary, retaining 12 bytes of headroom above the verified archive.
- 31a13bc: Validate bulk flag resolver factory results and contain asynchronous initialization failures, returning the documented unavailable result with a version mismatch diagnostic.
- fbbfdda: Reject present invalid simulation-clock subscription signals with the typed validation error before scheduling or retaining a listener. Keep an omitted or undefined signal valid.
- 5b86df0: Keep video fullscreen and picture-in-picture controls synchronized with their native shadow-root state. Observe picture-in-picture events on the internal video so mode names and exit actions update correctly, including after reconnect. Browser permission refusals leave controls available for retry.

  The CDN and local autoloaders measure 1,708,481 and 1,708,293 gzip bytes. Their exceeded ceilings move to the next 64-byte boundaries, 1,708,544 and 1,708,352 bytes. All other bundle ceilings remain unchanged.
- 4ba3e5e: Respect search changes made by `lr-search-change` listeners in CSV, dataset, spreadsheet,
  PDF, and DOCX viewers. Clearing results during next/previous navigation no longer throws or
  reports a successful navigation, and interrupted searches no longer restore cleared highlights
  or override a newer navigation started by the listener.

  The fix adds 268 unpacked bytes across four runtime modules. Four exceeded aggregate gzip
  limits, the unpacked package limit, and the complete core-consumer limit advance only to the
  next 64-byte boundary above their reviewed measurements. Passing limits and optional-peer
  exclusions remain unchanged.
- 2279caf: Prevent ResizeObserver loop errors when a virtual list's local viewport follows its content, including slotted transcripts in an agent workspace. Row and group measurements now apply together on the next frame in both local and external scrolling modes, preserving scroll-anchor corrections while avoiding size writes during observer delivery.

  Resolve queued row measurements against the current array membership so removal cannot read a missing row and reordering updates offsets from the row's new position.

  The membership check adds 117 unpacked runtime bytes. Reviewed size ceilings advance only for the two exceeded measurements: the package measures 22,553,125 unpacked bytes (ceiling 22,553,152), and the agent-tools aggregate measures 508,549 gzip bytes (ceiling 508,608). Both use the next 64-byte boundary; other size limits are unchanged.
- Updated dependencies [2060c47]
- Updated dependencies [57fb2a3]
- Updated dependencies [303f750]
  - @aceshooting/lyra-map@1.5.1
  - @aceshooting/lyra-translations@31.0.0

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
