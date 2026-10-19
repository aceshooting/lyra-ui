# Changelog

## 29.2.1

### Patch Changes

- b7262ed: The `lr-map` guide now documents that, on WebKit, a paint change made directly on the `map` engine instance can stay unpresented until another frame is requested (a MapLibre and WebKit behavior, reproducible without `lr-map`), and that calling the engine's `triggerRepaint()` once afterwards presents it.
- 0ef480e: The README and `llms.txt` now explain why pnpm 12.14 and later list `@aceshooting/lyra-ui` under "Agent skills awaiting approval" after an install: the package ships its agent skills. Nothing runs at install time and `npx lyra-ui init-agents` works either way; `pnpm approve @aceshooting/lyra-ui` (or `pnpm approve '!@aceshooting/lyra-ui'`) records the decision once.
- @aceshooting/lyra-translations@29.2.1

## 29.2.0

### Minor Changes

- 58eb5b2: Add four regional locale catalogs as small difference catalogs: `en-GB` (British English, over the built-in English), `es-419` (Latin American Spanish, over `es`), `fr-CA` (Canadian French, over `fr`) and `zh-HK` (Hong Kong Traditional Chinese, over `zh-TW`). Each registers only the messages that differ for the region and resolves every other message through its parent, so importing one also loads its parent catalog. They ship in `@aceshooting/lyra-translations` as `en-GB.js`, `es-419.js`, `fr-CA.js` and `zh-HK.js` (plus per-family slices), appear in `locales.json` and the optional locale loader, and are recorded as AI-assisted reviews with no human or native-speaker claim. An exact `zh-HK` tag now selects the `zh-HK` catalog instead of falling back to `zh-TW`.

### Patch Changes

- d756bce: `lr-code-block` and `lr-code-block-core` no longer throw in DOM implementations without `Element.part`, such as Happy DOM test environments, so consumers need no shim; highlighted lines keep their `line-highlight` part wherever CSS parts exist.
- 2fd9f5c: Moving an `lr-conversation-item` (for example inside `lr-thread-list`) into another document or iframe before it has rendered no longer throws from `adoptedCallback`. The same guard now protects every component that mirrors an authored `aria-describedby` onto its inner control (`lr-image-viewer`, `lr-map`, `lr-lightbox`, `lr-textarea`, `lr-input` and others).

  `lr-avatar-group` also no longer throws when moved into another document before its first render.
- d3725d2: Pressing Tab on a control that has an open keyboard-focus `lr-tooltip` (or an open `lr-popover`) inside an `lr-dialog` or `lr-drawer` now moves focus to the next control instead of getting stuck. While such a hint was open, the other controls in the dialog were made inert; they stay interactive now. Focus also no longer jumps back to the first control of the dialog when the tooltip closes as focus moves on.
- 5dd23d3: Anchored surfaces (`lr-tooltip`, `lr-popover`, `lr-dropdown`, `lr-popup`, `lr-select`, `lr-combobox` and the other popup users) now take the resolved positioning strategy, such as `--lr-positioning-strategy: fixed`, the moment they open instead of after the first placement pass, so a tooltip that opens or closes quickly no longer lays out at an unresolved position or briefly widens an `overflow: auto` ancestor and makes the page horizontally scrollable.
- Updated dependencies [5112ff8]
  - @aceshooting/lyra-map@1.2.0
  - @aceshooting/lyra-translations@29.2.0

## 29.1.0

### Minor Changes

- 3807e35: Improve large-collection rendering, search, interaction and streaming.

  - Cache unchanged projections, indexes, geometry and content; limit focus, selection, pointer and scroll work to affected or visible content.
  - Expose bounded limits and omitted-content notices. Tail feeds retain newest entries; virtual lists support large logical scroll extents.
  - Add host-owned collection sources, bounded tabular access and staged numeric preparation preserving counts, domains, distributions and source indices.
  - Reuse markdown/highlighting, bound viewer input before parsing and accept in-memory tabular data.
  - Load optional graph features on demand; add `lr-map.updateSourceData()` for source diffs.
  - Add scale-regression checks alongside behavior and accessibility tests.
  - Preserve styles when elements change documents.

  Paging, hierarchy, graph/spatial controllers and numeric utilities expand bundles, alongside localized loading/error/coverage messages. Declarations, docs and locale catalogs increase unpacked size; see component references for limits and input ownership.

  Matched Chromium benchmarks (software rendering, 15 workloads, seven samples each) against 29.0.2 found 12/150 phase/control series above both 15% and 1 ms; no operation-total median or p95 did. Queue projection shifts cost from assignment to update, reducing their combined cost. Table sort/filter settlement rose; totals stayed near 44 ms. Frame waits and no-op controls also rose; they include scheduling, not only CPU work. One chart tail raised update/settlement p95; its cause is unresolved. With seven samples, p95 is the maximum, not a field tail-latency estimate.

### Patch Changes

- b603b71: Correct and tighten the shipped documentation and agent skills.

  - The README upgrade guidance is one table covering every major release since v22, with the matching `lyra-ui-migrate` profile for each.
  - The exported TypeScript contracts in `llms/shared/events-and-types.md` now print their real member, parameter and return types instead of `unknown` placeholders.
  - Relative links in generated `llms/shared.md`, `llms/components/<tag>.md` and `llms-full.txt` now resolve from their published location.
  - Accessible-name guidance no longer describes `accessibleLabel` compatibility properties that were already removed.
  - `lyra-ui-migrate --help` describes the `lyra-v25` profile.
  - The bundled agent skills drop guidance for past upgrades, list `@aceshooting/lyra-map` among independently versioned companions, name every rename profile, and prefer the installed package's `llms/` reference over the plugin copy.
- 88c3542: Reduce remaining large-collection costs.

  - `lr-tool-timeline` keeps the processed form of every unchanged call when a replaced collection appends or updates a few calls, instead of rebuilding all retained calls.
  - Currency and unit pickers resolve a new locale's names and symbols without evicting number formatters other components share.
  - Theme-aware components no longer receive style and class mutations from inside their own shadow root, such as map marker movement, unless a nested theme-aware component needs them.

  These changes add up to 128 gzip bytes to the complete registration, family barrels, root entry and scoped-registry loader route, and 295 raw bytes to the packed core bundle. Only the breached size ceilings advance, each to the next 64-byte boundary above its measurement (raw core: 40 bytes of headroom).
- @aceshooting/lyra-translations@29.1.0

## 29.0.2

### Patch Changes

- Keep color-format, subagent retry, and memory action names aligned with their visible labels while retaining localized context in accessible descriptions.

- cb8c8c5: Refresh dependency resolutions and security overrides, and bound nested pattern processing and numeric formatting in development dependencies. The dependency upgrade command now refreshes transitive dependencies and verifies that required security patches are installed.

  Update the map renderer's GeoJSON tiling dependency, including its optional `worldCoordinates` option and clipping fixes.

  Refresh the document editor's bundled numeric parsing dependency for corrected nonnumeric and leading-zero handling.
- Updated dependencies [cb8c8c5]
  - @aceshooting/lyra-map@1.1.0
  - @aceshooting/lyra-translations@29.0.2

## 29.0.1

### Patch Changes

- 6590e5d: Keep labeled controls in widget headers readable at narrow widths by wrapping header items before scrolling actions that genuinely overflow.

  The fix adds 18 gzip bytes to the complete registration barrel. The six affected bundle-size limits advance to the next 64-byte boundary; passing limits remain unchanged.
- @aceshooting/lyra-translations@29.0.1

## 29.0.0

### Major Changes

- 919bd25: Load map and document editing features on demand while preserving their rendering capabilities.

  `lr-map` now defaults to the optional `@aceshooting/lyra-map` companion. Install the companion and configure `lyraMapWorkerPlugin()` from `@aceshooting/lyra-map/vite`, or provide an explicit worker URL. Applications retaining the full `maplibre-gl` engine must set `engine="maplibre"` before connecting the component and keep their existing worker configuration. Before imperative mutations on the modular engine, await `map.prepareFeatures()` with the required source and layer descriptors. Declarative map properties prepare their features automatically.

  The document editor now bundles its reviewed engine internally, so applications no longer need the `@docx-editor.dev/core` runtime peer. Import editor styles from `@aceshooting/lyra-docs/docx/editor.css`. Document editing commands now return promises: await `execute()` before reading the resulting revision or issuing a dependent command. Selection ownership remains held during feature loading, and commands from replaced or disconnected sessions cannot update the current editor.

  Table and data-grid collection setters now track caller identities weakly. Repeated bindings still preserve their owned snapshots, while original arrays and any rows excluded by the table's processing limit can be collected when no other owner retains them.

  Explicit option-label updates avoid unchanged option renders and state writes while preserving change notifications and accessible-label observation. Closed selects skip navigation scans when they have no active option or single-option shortcut. Sampled charts normalize only plotted values and reuse admitted semantic data while keeping full summaries and exports. Table filtering reuses per-query serialization bookkeeping without caching mutable row text across queries.

  Scroll-driven popup positioning now runs in the owning window's animation frame and cancels obsolete placements and queued work. Initial and resize positioning remain immediate. This prevents tooltip and arrow layout writes during Firefox scroll dispatch.

  Bundle limits account for the added map-engine selection and feature-loading adapter, frame-scheduled popup positioning, accessible-label updates, weak collection identity tracking, and chart/table preprocessing changes. Only the 28 breached JavaScript entry, component aggregate, and initial-route ceilings advance to their exact measured gzip sizes, with no added headroom. The increases range from 1 to 1,458 bytes; passing ceilings, CSS budgets, shell imports, optional-peer exclusions, and measurement settings remain unchanged.

### Patch Changes

- @aceshooting/lyra-translations@29.0.0

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
