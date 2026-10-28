import type {
  MapCustom3dLayer, MapGeographicFrame, MapGeographicOrigin, MapGeographicServices,
  MapGeographicShader, MapLayerContext, MapLayerFrame, MapLayerInstance, MapPosition,
  MapProjectedPosition, MapProjectionSnapshot, MapResolvedPosition, MapSceneAllocation, MapSceneAllocationPlan,
  MapSceneLimits, MapSceneResourceLedger
} from '../types/scene.js';

const absolute: MapPosition = { lngLat: [6, 49], altitude: 100, altitudeReference: 'sea-level' };
const relative: MapPosition = { lngLat: [6, 49], altitude: 10, altitudeReference: 'terrain' };
const resolved: MapResolvedPosition = { status: 'resolved', lngLat: [6, 49], altitude: 110 };
const pending: MapResolvedPosition = { status: 'terrain-pending', lngLat: [6, 49] };
const projected: MapProjectedPosition = { status: 'visibility-pending', visible: false, point: [100, 200] };
const origin: MapGeographicOrigin = { tile: { z: 4, x: 8, y: 5, wrap: 0 }, key: 'tile' };
const shader: MapGeographicShader = {
  key: 'projection', vertexPrelude: '', fragmentPrelude: '', defines: '',
  positionEncoding: 'tile-xy-meters-z', projectFunction: 'lrProjectPosition',
  horizonPositionFunction: 'lrHorizonPosition', horizonOccludedFunction: 'lrHorizonOccluded',
  horizonMode: 'sphere', uniforms: [
    { name: 'transition', type: 'float', value: 0.5 },
    { name: 'camera', type: 'vec4', value: [0, 0, 3, 1] }
  ]
};
declare const limits: MapSceneLimits;
declare const snapshot: MapProjectionSnapshot;
const services: MapGeographicServices = {
  limits, resolve: () => resolved, frameFor: () => origin, fromEnu: () => absolute
};
const geographic: MapGeographicFrame = {
  resolve: () => pending, project: () => projected, encode: () => [0, 0, 100], shader: () => shader,
  captureProjection: () => snapshot
};
declare const gl: WebGL2RenderingContext;
declare const signal: AbortSignal;
const context: MapLayerContext = { gl, signal, geographic: services, requestRender() {}, reportState() {} };
const frame: MapLayerFrame = {
  revision: 1, time: 1, width: 640, height: 480, pixelRatio: 1, reducedMotion: false, geographic,
  projectionStamp: { viewRevision: 1, contextEpoch: 1, layout: { revision: 1, tileZoom: 4, centerLongitude: 0 } }
};
const instance: MapLayerInstance = {
  prerender(current) { current.geographic.resolve(relative); },
  render(current) { current.geographic.shader(origin); },
  dispose() {},
  items: () => [{ id: 'object', label: 'Object', position: absolute }],
  pick: async () => ({ id: 'object', position: absolute }),
  setInteraction() {}
};
const layer: MapCustom3dLayer = { id: 'layer', label: 'Layer', create: () => instance };
layer.create(context).render(frame);
services.fromEnu(resolved, [1, 2, 3]);

// @ts-expect-error Geographic coordinate pairs are readonly snapshots.
absolute.lngLat[0] = 20;
// @ts-expect-error Resolved placement requires a meter altitude.
const incomplete: MapResolvedPosition = { status: 'resolved', lngLat: [6, 49] };
// @ts-expect-error A pending terrain position is not a resolved ENU origin.
services.fromEnu(pending, [1, 2, 3]);
// @ts-expect-error Shader function names belong to the supported geographic contract.
const wrongShader: MapGeographicShader = { ...shader, projectFunction: 'projectTileFor3D' };
// @ts-expect-error Projection matrices and uniforms cannot be edited through the frame.
shader.uniforms.push({ name: 'changed', type: 'float', value: 1 });

const bytes: MapSceneAllocation = { kind: 'bytes', key: 'backing', pool: 'cpu-buffer', byteLength: 16 };
const texture: MapSceneAllocation = {
  kind: 'texture', key: 'texture', pool: 'gpu-texture', width: 3, height: 5,
  layers: 1, faces: 1, bytesPerPixel: 4, mipLevels: 3
};
declare const allocationPlan: MapSceneAllocationPlan;
declare const ledger: MapSceneResourceLedger;
const reservation = ledger.reserve([bytes, texture]);
reservation.release();
const knownPayloadBytes: number = ledger.usage.knownBytes + allocationPlan.pools['gpu-texture'];
// @ts-expect-error A native image is not an exact owned byte allocation.
const nativeImage: MapSceneAllocation = { kind: 'image', key: 'bitmap', pool: 'cpu-image', width: 3, height: 5 };
// @ts-expect-error Reported resource usage is immutable.
ledger.usage.knownBytes = 0;
void [incomplete, wrongShader, nativeImage, knownPayloadBytes];
