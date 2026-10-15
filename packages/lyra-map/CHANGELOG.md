# @aceshooting/lyra-map

## 1.0.0

- Initial modular renderer based on MapLibre GL JS 6.14.0, with dynamically loaded source, layer, projection and terrain features.
- Prepare imperative mutations with `Map.prepareFeatures()` and standalone styles with `prepareStyle()`.
- Preserve synchronous map mutations after preparation and guard asynchronous style changes against replacement and disposal.
- Share feature modules between the renderer and its module worker. Configure the Vite worker plugin or provide an explicit worker URL.
- Export the renderer API, individual controls, stylesheet and worker, with TypeScript declarations and source provenance.
