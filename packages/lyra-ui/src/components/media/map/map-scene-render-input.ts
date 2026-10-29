import { isPlainDataRecord, readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import type { SceneSessionStateSnapshot, SceneTargetFact, SceneViewportNotice } from '../../../internal/map-scene-contract.js';
import type { SceneAcceptedSnapshot, ScenePresentationPhase, SceneRenderInput, SceneRenderMarker, SceneResolvedPresentation, SceneViewportInput } from './map-scene-render-contract.js';

const MAX_MARKERS = 2000;
const EMPTY_MARKERS: readonly SceneRenderMarker[] = Object.freeze([]);

/** Revision exhaustion is a refusal, never a wrapped or imprecise counter. */
export function nextSceneRenderRevision(value: number): number | undefined {
  return Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER ? value + 1 : undefined;
}

function finite(value: unknown, minimum: number, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

/** Snapshot callback-bearing presentation reflection before an owner's final currency check. */
export function snapshotScenePresentation(value: unknown): SceneResolvedPresentation | undefined {
  try {
    if (!isPlainDataRecord(value)) return undefined;
    const rows = readOwnDataValue(value, 'markers'), reducedMotion = readOwnDataValue(value, 'reducedMotion');
    if (!Array.isArray(rows) || typeof reducedMotion !== 'boolean') return undefined;
    const length = readOwnArrayLength(rows);
    if (length === undefined || length > MAX_MARKERS) return undefined;
    const markers: SceneResolvedPresentation['markers'][number][] = [], ids = new Set<string>();
    for (let index = 0; index < length; index++) {
      const row = readOwnDataValue(rows, String(index));
      if (!isPlainDataRecord(row)) return undefined;
      const id = readOwnDataValue(row, 'id'), color = readOwnDataValue(row, 'rgba');
      if (typeof id !== 'string' || id.length === 0 || id.length > 1024 || id.trim().length === 0 ||
        ids.has(id) || !Array.isArray(color) || readOwnArrayLength(color) !== 4) return undefined;
      const red = readOwnDataValue(color, '0'), green = readOwnDataValue(color, '1');
      const blue = readOwnDataValue(color, '2'), alpha = readOwnDataValue(color, '3');
      if (!finite(red, 0, 1) || !finite(green, 0, 1) || !finite(blue, 0, 1) || !finite(alpha, 0, 1)) return undefined;
      ids.add(id);
      markers.push(Object.freeze({ id, rgba: Object.freeze([red, green, blue, alpha] as const) }));
    }
    return Object.freeze({ markers: Object.freeze(markers), reducedMotion });
  } catch { return undefined; }
}

/** Copies physical allocation only; the connection owner assigns its revision. */
export function snapshotSceneViewport(value: unknown): SceneViewportInput | undefined {
  try {
    if (!isPlainDataRecord(value)) return undefined;
    const width = readOwnDataValue(value, 'width'), height = readOwnDataValue(value, 'height');
    const pixelRatio = readOwnDataValue(value, 'pixelRatio'), padding = readOwnDataValue(value, 'padding');
    if (!finite(width, 0) || width === 0 || !finite(height, 0) || height === 0 ||
      !finite(pixelRatio, 0) || pixelRatio === 0 || !isPlainDataRecord(padding)) return undefined;
    const backingWidth = Math.round(width * pixelRatio), backingHeight = Math.round(height * pixelRatio);
    if (!Number.isSafeInteger(backingWidth) || backingWidth <= 0 || !Number.isSafeInteger(backingHeight) || backingHeight <= 0) return undefined;
    const top = readOwnDataValue(padding, 'top'), right = readOwnDataValue(padding, 'right');
    const bottom = readOwnDataValue(padding, 'bottom'), left = readOwnDataValue(padding, 'left');
    if (!finite(top, 0) || !finite(right, 0) || !finite(bottom, 0) || !finite(left, 0)) return undefined;
    return Object.freeze({ width, height, pixelRatio, padding: Object.freeze({ top, right, bottom, left }) });
  } catch { return undefined; }
}

function allocation(viewport: SceneViewportNotice | undefined): SceneRenderInput['allocation'] {
  return viewport === undefined ? undefined : Object.freeze({ revision: viewport.allocationRevision,
    width: viewport.width, height: viewport.height, pixelRatio: viewport.pixelRatio,
    padding: Object.freeze({ top: viewport.padding.top, right: viewport.padding.right,
      bottom: viewport.padding.bottom, left: viewport.padding.left }) });
}

/** Callback-free composition from an owner's already validated scalar snapshots. */
export function emptySceneRenderInput(
  acceptedSceneRevision: number, presentationRevision: number, viewport: SceneViewportNotice | undefined,
): SceneRenderInput {
  return Object.freeze({ acceptedSceneRevision, presentationRevision, allocation: allocation(viewport),
    reducedMotion: true, markers: EMPTY_MARKERS });
}

/** Projects existing admitted/registry snapshots; it does not admit source data or read DOM. */
export function buildSceneRenderInput(options: {
  readonly accepted: SceneAcceptedSnapshot;
  readonly state: SceneSessionStateSnapshot;
  readonly phase: ScenePresentationPhase;
  readonly presentationRevision: number;
  readonly presentation?: SceneResolvedPresentation;
}): SceneRenderInput | undefined {
  try {
    const { accepted, state, phase, presentationRevision } = options;
    if (!Number.isSafeInteger(accepted.acceptedSceneRevision) || accepted.acceptedSceneRevision < 0 ||
      accepted.acceptedSceneRevision !== state.acceptedSceneRevision || !Number.isSafeInteger(presentationRevision) ||
      presentationRevision <= 0 || accepted.objects.length > MAX_MARKERS || state.targets.length > MAX_MARKERS ||
      (phase !== 'pending' && phase !== 'resolved' && phase !== 'unavailable')) return undefined;
    let viewport: SceneViewportNotice | undefined;
    if (state.viewport !== undefined) {
      const copied = snapshotSceneViewport(state.viewport), revision = state.viewport.allocationRevision;
      if (!copied || !Number.isSafeInteger(revision) || revision <= 0) return undefined;
      viewport = Object.freeze({ ...copied, allocationRevision: revision });
    }
    if (phase !== 'resolved') return emptySceneRenderInput(accepted.acceptedSceneRevision, presentationRevision, viewport);
    const objects = accepted.objects.filter(object => object.kind === 'marker');
    if (objects.length === 0 && options.presentation === undefined) {
      return emptySceneRenderInput(accepted.acceptedSceneRevision, presentationRevision, viewport);
    }
    const presentation = snapshotScenePresentation(options.presentation);
    if (!presentation || presentation.markers.length !== objects.length) return undefined;
    const colors = new Map(presentation.markers.map(marker => [marker.id, marker.rgba]));
    const targets = new Map<string, SceneTargetFact>();
    const allIds = new Set<string>();
    for (const target of state.targets) {
      if (allIds.has(target.id)) return undefined;
      allIds.add(target.id);
      if (target.kind === 'marker' || target.kind === 'model') targets.set(target.id, target);
    }
    const markers: SceneRenderMarker[] = [], seen = new Set<string>();
    for (const object of objects) {
      const target = targets.get(object.id), color = colors.get(object.id);
      if (seen.has(object.id) || !target || target.kind !== 'marker' || !color ||
        !Number.isSafeInteger(target.acceptedPositionRevision) || target.acceptedPositionRevision <= 0 ||
        target.position.lngLat[0] !== object.position.lngLat[0] || target.position.lngLat[1] !== object.position.lngLat[1] ||
        target.position.altitude !== object.position.altitude || target.position.altitudeReference !== object.position.altitudeReference ||
        !finite(object.radius, 0) || object.radius === 0 || !finite(object.opacity, 0, 1)) return undefined;
      seen.add(object.id);
      markers.push(Object.freeze({ id: object.id, position: Object.freeze({
        lngLat: Object.freeze([object.position.lngLat[0], object.position.lngLat[1]] as const),
        altitude: object.position.altitude, altitudeReference: object.position.altitudeReference }),
        acceptedPositionRevision: target.acceptedPositionRevision, radiusCss: object.radius,
        rgba: Object.freeze([color[0], color[1], color[2], color[3] * object.opacity] as const) }));
    }
    return Object.freeze({ acceptedSceneRevision: accepted.acceptedSceneRevision, presentationRevision,
      allocation: allocation(viewport), reducedMotion: presentation.reducedMotion, markers: Object.freeze(markers) });
  } catch { return undefined; }
}
