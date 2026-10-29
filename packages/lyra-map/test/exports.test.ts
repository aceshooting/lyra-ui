import { Map, Style, prepareStyle, type MapFeatureRequirements } from '@aceshooting/lyra-map';
import { NavigationControl } from '@aceshooting/lyra-map/controls/navigation';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
import { createSceneBridge, type SceneBridge, type SceneBridgeHost, type SceneBridgeNativeMap,
  type SceneRenderInput, type SceneMarker, type SceneBridgeStatus } from '@aceshooting/lyra-map/scene';
// @ts-expect-error The optional entry exports the bridge factory, not resource allocation helpers.
import { planSceneAllocations } from '@aceshooting/lyra-map/scene';
// @ts-expect-error Ledger construction remains an internal implementation detail.
import { createSceneResourceLedger } from '@aceshooting/lyra-map/scene';
// @ts-expect-error The public entry does not export a projection origin implementation.
import { projectionOriginFor } from '@aceshooting/lyra-map/scene';
// @ts-expect-error Snapshot compiler implementation is not a scene entry runtime export.
import { compileProjectionSnapshot } from '@aceshooting/lyra-map/scene';
// @ts-expect-error Projection evaluation implementation is not a scene entry runtime export.
import { evaluateSceneProjection } from '@aceshooting/lyra-map/scene';
// @ts-expect-error Chart evaluation implementation is not a scene entry runtime export.
import { evaluateSceneChartBoundary } from '@aceshooting/lyra-map/scene';
void [planSceneAllocations, createSceneResourceLedger, projectionOriginFor, compileProjectionSnapshot,
  evaluateSceneProjection, evaluateSceneChartBoundary];

declare const map: Map;
declare const style: Style;
const requirements: MapFeatureRequirements = {
  sources: { points: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
  layers: [{ id: 'points', source: 'points', type: 'circle' }]
};
const ready: Promise<void> = map.prepareFeatures(requirements, { signal: new AbortController().signal });
const added: Promise<Map> = map.addPreparedFeatures({
  sources: requirements.sources, layers: [{ layer: { id: 'prepared', type: 'circle', source: 'points' } }]
});
const synchronous: Map = map.addSource('sync', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
const warmed: Promise<void> = prepareStyle({ version: 8, sources: {}, layers: [] });
const changed: Promise<boolean> = style.setState({ version: 8, sources: {}, layers: [] });
map.addControl(new NavigationControl());
lyraMapWorkerPlugin();
void [ready, added, synchronous, warmed, changed];

declare const sceneMap: SceneBridgeNativeMap;
declare const mapWithoutPreparation: Omit<Map, 'prepareFeatures' | 'addPreparedFeatures'>;
declare const sceneHost: SceneBridgeHost;
declare const sceneInput: SceneRenderInput;
declare const sceneMarker: SceneMarker;
declare const sceneStatus: SceneBridgeStatus;
const sceneBridge: SceneBridge = createSceneBridge(sceneMap, sceneHost);
createSceneBridge(map, sceneHost);
createSceneBridge(mapWithoutPreparation, sceneHost);
sceneBridge.requestFrame();
sceneBridge.setVisible(false);
sceneBridge.invalidateStyle();
sceneBridge.dispose();
// @ts-expect-error Native authority is not part of the scene bridge lifecycle port.
sceneBridge.authority;
// @ts-expect-error A caller cannot run arbitrary GL work through the scene bridge.
sceneBridge.run(() => {});
void [sceneInput, sceneMarker, sceneStatus];

const markerInput: SceneMarker = { id: 'marker', position: { lngLat: [6, 49] },
  acceptedPositionRevision: 1, radiusCss: 6, rgba: [0.2, 0.4, 0.8, 0.5] };
const pendingInput: SceneRenderInput = { acceptedSceneRevision: 1, presentationRevision: 1,
  allocation: undefined, reducedMotion: false, markers: [markerInput] };
// @ts-expect-error The allocation field is required even while its value is unavailable.
const missingAllocation: SceneRenderInput = { acceptedSceneRevision: 1, presentationRevision: 1,
  reducedMotion: false, markers: [] };
// @ts-expect-error Presentation resolves a complete RGBA tuple before publishing a marker.
const missingAlpha: SceneMarker['rgba'] = [0.2, 0.4, 0.8];
void [pendingInput, missingAllocation, missingAlpha];
