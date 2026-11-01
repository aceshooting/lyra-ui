import {
  compileProjectionSnapshot, evaluateSceneProjection, projectionOriginFor,
  type MapCompiledProjection, type MapGeographicOrigin, type MapLayerFrame,
  type MapProjectionSnapshot, type MapProjectionStamp, type MapRawProjection
} from '../types/scene.js';

declare const frame: MapLayerFrame;
declare const origin: MapGeographicOrigin;
const stamp: MapProjectionStamp = frame.projectionStamp;
const snapshot: MapProjectionSnapshot = frame.geographic.captureProjection(origin);
const compiled: MapCompiledProjection = compileProjectionSnapshot(snapshot);
const result: MapRawProjection = evaluateSceneProjection({ lngLat: [0, 0], altitude: 100 }, compiled);
const request = projectionOriginFor({ lngLat: [0, 0] }, stamp.layout);
const contract: 1 = snapshot.contract;
if (result.status === 'projected') {
  const clip: readonly [number, number, number, number] = result.clip;
  void clip;
} else {
  const wrap: number = result.request.tile.wrap;
  void wrap;
}
// @ts-expect-error Snapshots are immutable owned values.
snapshot.mainMatrix[0] = 2;
// @ts-expect-error Compiled handles cannot be fabricated from plain snapshot data.
const forged: MapCompiledProjection = { snapshot, effectiveProjection: 'mercator' };
void [request, contract, forged];
