---
'@aceshooting/lyra-ui': major
'@aceshooting/lyra-docs': minor
---

Load map and document editing features on demand while preserving their rendering capabilities.

`lr-map` now defaults to the optional `@aceshooting/lyra-map` companion. Install the companion and configure `lyraMapWorkerPlugin()` from `@aceshooting/lyra-map/vite`, or provide an explicit worker URL. Applications retaining the full `maplibre-gl` engine must set `engine="maplibre"` before connecting the component and keep their existing worker configuration. Before imperative mutations on the modular engine, await `map.prepareFeatures()` with the required source and layer descriptors. Declarative map properties prepare their features automatically.

The document editor now bundles its reviewed engine internally, so applications no longer need the `@docx-editor.dev/core` runtime peer. Import editor styles from `@aceshooting/lyra-docs/docx/editor.css`. Document editing commands now return promises: await `execute()` before reading the resulting revision or issuing a dependent command. Selection ownership remains held during feature loading, and commands from replaced or disconnected sessions cannot update the current editor.

Table and data-grid collection setters now track caller identities weakly. Repeated bindings still preserve their owned snapshots, while original arrays and any rows excluded by the table's processing limit can be collected when no other owner retains them.

Explicit option-label updates avoid unchanged option renders and state writes while preserving change notifications and accessible-label observation. Closed selects skip navigation scans when they have no active option or single-option shortcut. Sampled charts normalize only plotted values and reuse admitted semantic data while keeping full summaries and exports. Table filtering reuses per-query serialization bookkeeping without caching mutable row text across queries.

Scroll-driven popup positioning now runs in the owning window's animation frame and cancels obsolete placements and queued work. Initial and resize positioning remain immediate. This prevents tooltip and arrow layout writes during Firefox scroll dispatch.
