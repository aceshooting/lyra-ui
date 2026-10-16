# @aceshooting/lyra-map

## 1.1.0

### Minor Changes

- cb8c8c5: Refresh dependency resolutions and security overrides, and bound nested pattern processing and numeric formatting in development dependencies. The dependency upgrade command now refreshes transitive dependencies and verifies that required security patches are installed.

  Update the map renderer's GeoJSON tiling dependency, including its optional `worldCoordinates` option and clipping fixes.

  Refresh the document editor's bundled numeric parsing dependency for corrected nonnumeric and leading-zero handling.

## 1.0.0

- Initial modular renderer based on MapLibre GL JS 6.14.0, with dynamically loaded source, layer, projection and terrain features.
- Prepare imperative mutations with `Map.prepareFeatures()` and standalone styles with `prepareStyle()`.
- Preserve synchronous map mutations after preparation and guard asynchronous style changes against replacement and disposal.
- Share feature modules between the renderer and its module worker. Configure the Vite worker plugin or provide an explicit worker URL.
- Export the renderer API, individual controls, stylesheet and worker, with TypeScript declarations and source provenance.
