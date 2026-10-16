# Changelog

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
