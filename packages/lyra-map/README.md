# Lyra Map

[![Coverage](https://img.shields.io/endpoint?url=https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-map.json)](https://codecov.io/gh/aceshooting/lyra-ui)

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

Configure one plugin instance in the application build, including when a workspace package
re-exports this setup. Its worker chunk name defaults to `map-worker`; Vite controls the final
hashed filename. Advanced `workerEntry` and `packageName` options retain their documented defaults.
Watch rebuilds start a fresh bridge count; multiple bridges in one build remain an error.

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

For an awaited add-only batch, use actual source/layer descriptors:

```ts
await map.addPreparedFeatures({
  sources: { points: source },
  layers: [{ layer, before: 'labels' }]
}, { signal: new AbortController().signal });
```

The shorthand snapshots bounded plain data before preparation, waits for renderer and worker
registration, then calls native synchronous source/layer methods. Source dependencies and `before`
anchors may refer to existing resources or entries in the same batch. Forward anchors are ordered
automatically; missing anchors, cycles, duplicate IDs and existing ID collisions reject. Input order
is preserved where constraints permit. Canvas handles and plain custom-layer `render`, `prerender`,
`onAdd` and `onRemove` callbacks retain identity; other non-data handles/accessors are rejected.
Limits are 64 sources, 256 layers, 1024 code units per ID, 100000 copied nodes, depth 32 and 4194304 UTF-16
code units across string values and keys; batches adding layers cap existing and new layers together at 4096 for ordering.
Source-only batches do not inspect or cap unrelated native layer order. Only a
native-brand-checked AbortSignal in an own data property is accepted for options. This is a descriptor bound, not an engine-network byte limit.

A newer shorthand, any style replacement intent, map removal or the caller signal cancels pending
work. Preparation failure leaves native resources unchanged. Synchronous commit failure attempts
to remove newly added layers and sources in reverse order only while the map/style/intent is still
current. Native worker/network failures after return, callback/event side effects and mutations
made by reentrant newer code are outside rollback; cancellation during commit can leave additions.
This is not an ownership registry or general transaction. Use ordinary native APIs to update/remove.

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

## Optional scene markers

`@aceshooting/lyra-map/scene` exports `createSceneBridge(map, host)` and the types `SceneBridge`,
`SceneBridgeHost`, `SceneBridgeNativeMap`, `SceneRenderInput`, `SceneMarker`, and `SceneBridgeStatus`.
Import this entry only where scene markers are needed; the default map entry does not load its
bridge or glyph renderer. The bridge owns one native custom layer for geographic circle markers.
It does not provide models, Three rendering, labels, picking, clustering, or whole-scene readiness.

The host supplies a synchronous snapshot and subscription. Keep each accepted packet immutable,
return the same object until replacing it, and notify subscribers after replacement. Host methods
must be own data properties; getters are not accepted. The bridge subscribes before its initial
capture. All host-supplied revision fields are positive safe integers; advance the corresponding revision when
accepted positions, presentation, or allocation changes.

```ts
import { createSceneBridge, type SceneRenderInput } from '@aceshooting/lyra-map/scene';

const lifetime = new AbortController();
const listeners = new Set<() => void>();
let input: SceneRenderInput = {
  acceptedSceneRevision: 1,
  presentationRevision: 1,
  allocation: undefined,
  reducedMotion: false,
  markers: [{
    id: 'place',
    acceptedPositionRevision: 1,
    position: { lngLat: [6.13, 49.61], altitude: 0, altitudeReference: 'sea-level' },
    radiusCss: 6,
    rgba: [0.1, 0.4, 0.8, 1]
  }]
};

const bridge = createSceneBridge(map, {
  signal: lifetime.signal,
  isCurrent: () => !lifetime.signal.aborted,
  captureRenderInput: () => input,
  subscribeRenderInput: changed => {
    listeners.add(changed);
    return () => { listeners.delete(changed); };
  },
  onState: status => { console.log(status.state); },
  onError: code => { console.warn(code); }
});

function replaceInput(next: SceneRenderInput) {
  input = next;
  for (const changed of listeners) changed();
}
```

Publish an `allocation` object with `revision`, positive finite CSS `width` and `height`, positive
finite `pixelRatio`, and nonnegative finite `padding: { top, right, bottom, left }` matching the
current map allocation. The `allocation` field is required even when its value is `undefined`;
nonempty input remains pending until an allocation is available. Publish `reducedMotion` with the
current user preference. Replace packets and nested values instead of mutating a captured packet.

Each marker needs a unique nonblank `id`, `acceptedPositionRevision`, geographic `position`, positive
finite `radiusCss`, and an RGBA tuple whose four values lie between zero and one. Supply straight RGB;
the alpha value must already include authored opacity. The renderer applies edge coverage and
premultiplication. Resolve presentation defaults and theme colors before publishing the packet.
There are at most 2000 markers per packet. Altitude is meters; omitted altitude and reference mean
zero above sea level. With `altitudeReference: 'terrain'`, the bridge waits for current displayed
terrain height and adds the authored altitude once. Pending or unavailable terrain never substitutes
a sea-level marker. Terrain must be configured on the native map; the bridge does not add a DEM source.

`requestFrame()` requests a repaint, and `setVisible(false)` pauses the owned layer. Call
`invalidateStyle()` before `map.setStyle(...)`; the bridge waits for `style.load` before reinstalling.
Call the idempotent `dispose()` before `map.remove()`. Aborting the host signal also disposes the
bridge. The subscription must return a function that removes its listener.

Status reports contain `state` (`pending`, `installed`, `empty`, or `unavailable`),
`acceptedSceneRevision`, `presentationRevision`, `allocationRevision` (possibly `undefined`), and
`markerInstallationRevision`. Optional status codes and `onError` use `engine`, `limit`, `render`,
or `context-lost`. `installed` describes accepted marker-layer installation; it does not establish
that terrain has resolved, a marker passed native depth/horizon tests, or pixels are visible.

The current bridge uses the full terrain GL state profile. No reduced UBO profile is enabled.
Package build, export, graph, and declaration checks establish the optional entry boundary; they do
not establish native terrain pixels, cross-browser rendering, or application-adapter behavior.

## Right-to-left labels

The pinned renderer includes Arabic shaping and bidirectional text layout. Mixed Arabic, Latin
and numeric labels do not require `setRTLTextPlugin()` or an external CDN script. Supply fonts
covering the label characters through the style's glyph/font configuration. The browser fixture
uses a local font and a mixed-direction label; visual shaping/font coverage still need inspection
on the supported browsers.

## Source and licensing

This package is generated from pinned `maplibre-gl` source using reviewed transformations. The
build verifies the source-tree and license hashes before modifying feature registries and worker
ordering. Generated modules live under owned distribution paths; no upstream source tree is
committed. `UPSTREAM.json`, the generated provenance manifest, `LICENSE`, and
`THIRD_PARTY_NOTICES.md` identify the source, modifications, and included licenses. MapLibre and
its contributors do not endorse this derivative.
