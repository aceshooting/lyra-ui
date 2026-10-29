import type { Group } from 'three';
import type { Lyra3dViewport } from '../core/viewport.js';
import { restoreViewportContextMethods, retireViewportExtras, type ViewportResourceRecord } from '../core/viewport-resources.js';
import type { ViewportXrPreparation } from '../core/viewport-xr.js';
import { createXrPresentationController } from '../xr/controller.js';
import type { XrPreparationLease } from '../xr/coordinator.js';
import { createThreeXrNativeOwner } from '../xr/three-native-owner.js';
import { Lyra3dXrError, type Lyra3dXrErrorCode, type Lyra3dXrOptions, type Lyra3dXrPresentation } from '../xr/types.js';
import { configureLineBatchXr, configurePointBatchXr } from './batches.js';
import { disposeLineBatchResources, disposePointBatchResources, type LineBatchResources, type PointBatchResources } from './resources.js';
import { createPointsXrPlacement, validatePointsXrPose, type PointsXrProfile } from './xr-profile.js';
import { disposePointsLabelResources, type PointsLabelResources } from './label-resources.js';
import { disposePointsXrLabelResources, type PointsXrLabelResources } from './xr-label-resources.js';

export { createPointsXrProfile } from './xr-profile.js';
export { isLyra3dXrSupported } from '../xr/support.js';
export { createPointsXrAllocationAccount } from './xr-label-layout.js';
export { preparePointsXrLabels } from './xr-labels.js';

export interface PointsXrDrawGate { allowed: boolean; transferred: boolean }
export interface PointsXrEntryCell {
  commitApplication: ((this: void, viewport: Lyra3dViewport, preparation: ViewportXrPreparation) => void) | undefined;
  viewport: Lyra3dViewport | undefined;
  preparation: ViewportXrPreparation | undefined;
}
export interface PointsNativeScene {
  viewportResources: ViewportResourceRecord;
  world: Group;
  pointResources: PointBatchResources | undefined;
  lineResources: LineBatchResources[];
  labels: PointsXrLabelResources | undefined;
  ordinaryLabels: PointsLabelResources | undefined;
  profile: PointsXrProfile;
  placement: { matrix: readonly number[] | undefined; yaw: number };
  drawAllowed: PointsXrDrawGate;
}
export interface PointsXrPresentationInput {
  scene: PointsNativeScene;
  entry: PointsXrEntryCell;
  preparationLease: XrPreparationLease;
  documentKey: object;
  validatePrepared(this: void): Lyra3dXrErrorCode | null;
  options: Lyra3dXrOptions | undefined;
}

/** Reports application failures without retaining an application callback or propagating it. */
export function reportPointsXrError(error: unknown): void {
  try { globalThis.reportError?.(error); } catch { /* Error reporting cannot interrupt resource retirement. */ }
}

function enqueueRetirement(job: () => void): void { setTimeout(job, 0); }

function clearEntry(entry: PointsXrEntryCell): void {
  entry.commitApplication = undefined; entry.viewport = undefined; entry.preparation = undefined;
}
function entryCommit(entry: PointsXrEntryCell, scene: PointsNativeScene): () => void {
  return () => {
    const commit = entry.commitApplication, viewport = entry.viewport, preparation = entry.preparation;
    clearEntry(entry);
    if (!commit || !viewport || !preparation) throw new DOMException('Presentation ownership is unavailable.', 'InvalidStateError');
    scene.placement.yaw = viewport.orbit.yaw;
    // Mark the attempt before the fallible, irreversible application handoff.
    scene.drawAllowed.transferred = true;
    commit(viewport, preparation);
    if (scene.ordinaryLabels?.mesh) { scene.ordinaryLabels.mesh.visible = false; scene.ordinaryLabels.mesh.removeFromParent(); }
    if (scene.labels?.meshes) for (const mesh of scene.labels.meshes) scene.world.add(mesh);
    if (scene.pointResources) configurePointBatchXr(scene.pointResources, scene.profile.units);
    for (const line of scene.lineResources) configureLineBatchXr(line, scene.profile.units);
    scene.viewportResources.camera.near = scene.profile.near;
    scene.viewportResources.camera.far = scene.profile.far;
  };
}
function nativeFrame(scene: PointsNativeScene): (frame: XRFrame, space: XRReferenceSpace) => boolean {
  return (frame, space) => {
    if (!scene.drawAllowed.allowed) return false;
    const pose = frame.getViewerPose(space);
    if (!pose || pose.views.length === 0) return false;
    const eyes = pose.views.map(view => view.transform.matrix);
    validatePointsXrPose(pose.transform.matrix, eyes);
    if (!scene.placement.matrix) {
      scene.placement.matrix = createPointsXrPlacement(scene.profile, pose.transform.matrix, scene.placement.yaw);
      scene.world.matrixAutoUpdate = false;
      scene.world.matrix.fromArray(scene.placement.matrix);
      scene.world.matrixWorldNeedsUpdate = true;
    }
    validatePointsXrPose(pose.transform.matrix, eyes, scene.placement.matrix);
    return true;
  };
}
function nativeDetach(scene: PointsNativeScene, entry: PointsXrEntryCell): () => void {
  return () => { scene.drawAllowed.allowed = false; clearEntry(entry); };
}
function nativeRetirement(scene: PointsNativeScene): () => void {
  return () => {
    scene.drawAllowed.allowed = false;
    const points = scene.pointResources, lines = scene.lineResources, labels = scene.labels, ordinaryLabels = scene.ordinaryLabels;
    scene.pointResources = undefined; scene.lineResources = []; scene.labels = undefined; scene.ordinaryLabels = undefined;
    let failed = false, failure: unknown;
    const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
    cleanup(() => { if (labels) disposePointsXrLabelResources(labels); });
    cleanup(() => { if (ordinaryLabels) disposePointsLabelResources(ordinaryLabels); });
    cleanup(() => { if (points) disposePointBatchResources(points); });
    for (const line of lines) cleanup(() => { disposeLineBatchResources(line); });
    cleanup(() => { retireViewportExtras(scene.viewportResources); });
    cleanup(() => { scene.world.removeFromParent(); });
    if (failed) throw failure;
  };
}
function afterRenderer(resources: ViewportResourceRecord): () => void {
  return () => { restoreViewportContextMethods(resources); };
}

/** All native callbacks are constructed in resource-only scopes. */
export function createPointsXrPresentation(input: PointsXrPresentationInput): Lyra3dXrPresentation {
  const resources = input.scene.viewportResources;
  const xr = navigator.xr;
  if (!xr || typeof xr.requestSession !== 'function') throw new Lyra3dXrError('unavailable');
  const owner = createThreeXrNativeOwner({
    xr, renderer: resources.renderer, canvas: resources.canvas, scene: resources.scene, camera: resources.camera,
    stopInline: entryCommit(input.entry, input.scene), prepareFrame: nativeFrame(input.scene),
    detachApplication: nativeDetach(input.scene, input.entry), retireResources: nativeRetirement(input.scene),
    afterRendererDispose: afterRenderer(resources),
  });
  return createXrPresentationController({
    preparationLease: input.preparationLease, documentKey: input.documentKey, nativeOwner: owner,
    validatePrepared: input.validatePrepared, enqueueFinalizer: enqueueRetirement, reportApplicationError: reportPointsXrError,
  }, input.options);
}
