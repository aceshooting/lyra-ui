# Lyra Map

`@aceshooting/lyra-map` provides a modular renderer derived from MapLibre GL JS. It keeps the
Map, Marker, Popup, control, source, event, and helper APIs available while loading rendering
features as a style needs them. The renderer and its module worker share content-addressed
JavaScript modules.

## Vite setup

Install the package and add its worker plugin to the application build:

```ts
import { defineConfig } from 'vite';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';

export default defineConfig({ plugins: [lyraMapWorkerPlugin()] });
```

The plugin supports Vite 8 development and production builds. It disables Vite's document-based
module preload helper because the same modules also execute in workers. It excludes this package
from development dependency optimization and uses Vite's worker URL handling during development.

```ts
import { Map } from '@aceshooting/lyra-map';
import { NavigationControl } from '@aceshooting/lyra-map/controls/navigation';
import '@aceshooting/lyra-map/map.css';

const map = new Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] }
});
map.addControl(new NavigationControl());
```

Object and URL styles, including `transformStyle` results, automatically prepare their required
features before loading or replacing the active style. Continue using `load` and `style.load`
events to observe completion. A failed feature import leaves the previous style active.

## Imperative feature preparation

Before adding a new source or layer family, prepare its descriptors on the map. The promise waits
for both renderer and worker registration. It also initializes an empty style for maps constructed
with `style: null`.

```ts
const source = { type: 'geojson', data: featureCollection } as const;
const layer = { id: 'points', type: 'circle', source: 'points' } as const;
await map.prepareFeatures({ sources: { points: source }, layers: [layer] });
map.addSource('points', source);
map.addLayer(layer);
```

Prepare again before introducing a different layer/source family, projection, or terrain. Already
prepared mutations and ordinary camera, query, image, and interaction methods stay synchronous.
`prepareFeatures(requirements, { signal })` accepts an AbortSignal. Removal or style replacement
also cancels pending map preparations. Global `prepareStyle(style)` only warms renderer modules;
use the per-map method for worker and empty-style readiness.

Canvas source objects keep their canvas identity. Style snapshots copy plain containers so caller
mutation during loading cannot change the admitted style. A replacement diff is calculated from
the current style after preparation, including imperative edits made while modules were loading.

## Compatibility and worker delivery

All upstream runtime exports remain available from the root. Granular control entries include
`attribution`, `navigation`, `geolocate`, `scale`, `fullscreen`, `terrain`, `globe`, and `logo`.
Controls that introduce a new projection or terrain require those features to be prepared first.
The root can be imported during server rendering; map construction requires a browser.

The asynchronous boundary changes `Style.setState()` to return `Promise<boolean>`. The internal
`Style._load()` and `Map._updateDiff()` methods return `Promise<void>`. Published declarations
describe these changes. Native synchronous `Map.addSource()`, `Map.addLayer()`, `Map.setProjection()`
and `Map.setTerrain()` require prior preparation when introducing a new feature family.

The plugin resolves this package's worker entry automatically. `setWorkerUrl()` remains available
for an explicitly managed compatible worker graph. Deploy every transitive hashed worker module
together with its renderer version. Without the plugin or an override, worker creation reports a
configuration error; it does not load a different engine automatically.

`lr-map` in `@aceshooting/lyra-ui` uses this companion by default. Its explicit `engine="maplibre"`
mode uses the separate native `maplibre-gl` peer and retains that engine's full payload.

## Source and licensing

This package is generated from pinned `maplibre-gl` source using reviewed transformations. The
build verifies the source-tree and license hashes before modifying feature registries and worker
ordering. Generated modules live under owned distribution paths; no upstream source tree is
committed. `UPSTREAM.json`, the generated provenance manifest, `LICENSE`, and
`THIRD_PARTY_NOTICES.md` identify the source, modifications, and included licenses. MapLibre and
its contributors do not endorse this derivative.
