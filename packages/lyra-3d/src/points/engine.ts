import { LYRA_3D_CONTRACT, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle } from '../core/contract.js';
import { boundsOfPositions, DEFAULT_ORBIT_CAMERA, fitOrbitCamera, focusOrbitCamera, normalizeOrbitCamera, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../core/style.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { admitPointsData, type AdmittedPointsData } from './data.js';
import { createLineBatch, createPointBatch } from './batches.js';
import { createPointsLabels, pointsAxes } from './axes.js';
import type { PointsEngine } from './types.js';
import { snapshotVisualState } from '../core/visual-state.js';
import { acquireXrPreparation, releaseXrPreparation, type XrPreparationLease } from '../xr/coordinator.js';
import { xrDocumentScope } from '../xr/document-scope.js';
import { observeXrRelease } from '../xr/release-observer.js';
import { Lyra3dXrError, type Lyra3dXrErrorCode, type Lyra3dXrOptions, type Lyra3dXrPresentation } from '../xr/types.js';
import { captureViewportXrPreparation, getViewportXrLifetimeStamp, getViewportXrResources, handoffViewportXr,
  isViewportXrPreparationCurrent, releaseViewportXrPreparation, type ViewportXrLifetimeStamp, type ViewportXrPreparation } from '../core/viewport-xr.js';
import type { PointsXrDrawGate, PointsXrEntryCell } from './xr.js';
import type { PointsXrProfile } from './xr-profile.js';
import type { PointsXrLabelPreparation, PreparedPointsXrLabels } from './xr-labels.js';

type PointsXrModule = typeof import('./xr.js');
interface PreparationCell {
  inspect: ((module: PointsXrModule) => void) | undefined;
  beginLabels: ((module: PointsXrModule) => PointsXrLabelPreparation | undefined) | undefined;
  complete: ((module: PointsXrModule, labels?: PreparedPointsXrLabels) => Lyra3dXrPresentation) | undefined;
  validate: (() => Lyra3dXrErrorCode | null) | undefined;
  failure: Lyra3dXrErrorCode;
  job: PointsXrLabelPreparation | undefined;
  labels: PreparedPointsXrLabels | undefined;
  options: Lyra3dXrOptions | undefined;
  entry: PointsXrEntryCell | undefined;
}
interface PointsPreparation {
  cell: PreparationCell;
  lease: XrPreparationLease;
  viewport: Lyra3dViewport | undefined;
  snapshot: ViewportXrPreparation | undefined;
  stamp: ViewportXrLifetimeStamp | undefined;
  mount: number;
  epoch: number;
  identity: object;
  hasLabels: boolean;
  profile: PointsXrProfile | undefined;
  gate: PointsXrDrawGate;
  presentation: Lyra3dXrPresentation | undefined;
  removeRelease: (() => void) | undefined;
}
function reportApplicationError(error: unknown): void {
  try { globalThis.reportError?.(error); } catch { /* Application reporting cannot interrupt cleanup. */ }
}
function clearPreparationCell(cell: PreparationCell, reason = cell.failure): void {
  const job = cell.job, labels = cell.labels;
  cell.failure = reason; cell.job = undefined; cell.labels = undefined;
  cell.inspect = undefined; cell.beginLabels = undefined; cell.complete = undefined; cell.validate = undefined; cell.options = undefined;
  if (cell.entry) { cell.entry.commitApplication = undefined; cell.entry.viewport = undefined; cell.entry.preparation = undefined; }
  cell.entry = undefined;
  try { job?.cancel(reason); } catch (error) { reportApplicationError(error); }
  try { labels?.dispose(); } catch (error) { reportApplicationError(error); }
}
function snapshotXrOptions(options: Lyra3dXrOptions | undefined): Lyra3dXrOptions | undefined {
  if (options === undefined) return undefined;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Invalid XR presentation options');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'onStateChange');
  if (descriptor && (!Object.hasOwn(descriptor, 'value') || (descriptor.value !== undefined && typeof descriptor.value !== 'function'))) throw new TypeError('Invalid XR presentation options');
  return { onStateChange: descriptor?.value as Lyra3dXrOptions['onStateChange'] };
}
function preparationValidator(cell: PreparationCell): () => Lyra3dXrErrorCode | null {
  return () => cell.validate ? cell.validate() : cell.failure;
}
function preparedEntryValidator(cell: PreparationCell): () => Lyra3dXrErrorCode | null {
  return () => {
    const invalid = cell.validate ? cell.validate() : cell.failure;
    return invalid ?? cell.labels?.validate() ?? null;
  };
}
function labelContinuation(cell: PreparationCell, module: PointsXrModule): (labels: PreparedPointsXrLabels) => Lyra3dXrPresentation {
  return labels => {
    const complete = cell.complete;
    cell.complete = undefined; cell.job = undefined;
    if (!complete) {
      try { labels.dispose(); } catch (error) { reportApplicationError(error); }
      throw new Lyra3dXrError(cell.failure);
    }
    cell.labels = labels;
    return complete(module, labels);
  };
}
function supportContinuation(cell: PreparationCell, module: PointsXrModule): (supported: boolean) => Lyra3dXrPresentation | Promise<Lyra3dXrPresentation> {
  return supported => {
    const complete = cell.complete, beginLabels = cell.beginLabels;
    cell.inspect = undefined; cell.beginLabels = undefined;
    if (!complete) throw new Lyra3dXrError(cell.failure);
    if (!supported) throw new Lyra3dXrError('unavailable');
    const job = beginLabels?.(module);
    if (job) return job.done.then(labelContinuation(cell, module));
    cell.complete = undefined;
    return complete(module);
  };
}
function importContinuation(cell: PreparationCell): (module: PointsXrModule) => Promise<Lyra3dXrPresentation> {
  return module => {
    if (!cell.inspect) throw new Lyra3dXrError(cell.failure);
    cell.inspect(module);
    return module.isLyra3dXrSupported().then(supportContinuation(cell, module));
  };
}
function preparationFailure(cell: PreparationCell, lease: XrPreparationLease): (error: unknown) => never {
  return error => { clearPreparationCell(cell); releaseXrPreparation(lease); throw error; };
}
function loadPresentation(cell: PreparationCell, lease: XrPreparationLease): Promise<Lyra3dXrPresentation> {
  return import('./xr.js').then(importContinuation(cell)).catch(preparationFailure(cell, lease));
}
function scheduleLabelWork(task: () => void): () => void {
  const timer = setTimeout(task, 0);
  return () => { clearTimeout(timer); };
}
function drawRestoredViewport(viewport: Lyra3dViewport): void {
  const renderer = viewport.renderer, render = renderer.render;
  let submitted = false;
  // The viewport contains ordinary render errors. Observe this one synchronous
  // draw so a restored notification requires a completed default-target render.
  const observed: typeof render = (scene, camera) => {
    render.call(renderer, scene, camera);
    if (renderer.getRenderTarget() === null && !renderer.getContext().isContextLost()) submitted = true;
  };
  renderer.render = observed;
  try { viewport.renderNow(); }
  finally { if (renderer.render === observed) renderer.render = render; }
  if (!submitted || viewport.lost || viewport.disposed || renderer.getContext().isContextLost()) throw new Lyra3dXrError('failed');
}
function releaseContinuation(record: PointsPreparation, released: (record: PointsPreparation) => void): () => void {
  return () => { released(record); };
}

export interface PointsEngineServices { viewport?: typeof createLyra3dViewport; labelCanvas?: () => HTMLCanvasElement }

/** Immutable full-row point rendering. IDs always match the original point-row order. */
export function createPointsEngine(services: PointsEngineServices = {}): PointsEngine {
  let viewport: Lyra3dViewport | undefined; let host: Lyra3dHost | undefined;
  let mounted = false; let disposed = false; let revision = -1;
  let container: HTMLElement | undefined;
  let width = 1, height = 1, mountEpoch = 0, profileEpoch = 0;
  const engineScope = Object.freeze({});
  let preparation: PointsPreparation | undefined;
  let awaitingRestoredDraw = false;
  let data: AdmittedPointsData | undefined;
  let style: Lyra3dStyle = DEFAULT_LYRA_3D_STYLE;
  let camera = DEFAULT_ORBIT_CAMERA;
  let state: Lyra3dState = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  let points: ReturnType<typeof createPointBatch> | undefined;
  let lines: ReturnType<typeof createLineBatch>[] = [];
  let labels: ReturnType<typeof createPointsLabels> | undefined;
  let unframe: (() => void) | undefined;
  const constrain = (value: Lyra3dOrbitCamera): Lyra3dOrbitCamera => {
    const next = normalizeOrbitCamera(value);
    return data?.mode === '2d' ? { ...next, yaw: 0, pitch: 0, target: { ...next.target, z: 0 } } : next;
  };
  const clear = () => {
    const previousLabels = labels, previousPoints = points, previousLines = lines;
    labels = undefined; points = undefined; lines = [];
    let failed = false, failure: unknown;
    const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
    cleanup(() => { previousLabels?.dispose(); });
    cleanup(() => { previousPoints?.dispose(); });
    for (const line of previousLines) cleanup(() => { line.dispose(); });
    if (failed) throw failure;
  };
  const retireInline = (): void => {
    const stopFrame = unframe, previousViewport = viewport;
    unframe = undefined; viewport = undefined; awaitingRestoredDraw = false;
    let failed = false, failure: unknown;
    const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
    cleanup(() => { stopFrame?.(); });
    cleanup(clear);
    cleanup(() => { previousViewport?.dispose(); });
    if (failed) throw failure;
  };
  const frame = () => {
    if (!viewport || disposed) return;
    points?.resize(viewport.width, viewport.height);
    for (let index = 0; index < lines.length; index += 1) lines[index]!.update(viewport.style, viewport.width, viewport.height, lines[index]!.mesh.userData['axis'] === true);
    labels?.update(state);
  };
  const paint = () => { if (viewport) { points?.paint(viewport.style, state); frame(); viewport.invalidate(); } };
  const build = () => {
    clear(); if (!viewport || !data) return;
    points = createPointBatch(data); viewport.world.add(points.mesh); viewport.pickWorld.add(points.pick);
    const addLines = (positions: Float32Array, axis: boolean) => {
      if (!positions.length) return;
      const batch = createLineBatch(positions); batch.mesh.userData['axis'] = axis; lines.push(batch); viewport!.world.add(batch.mesh);
    };
    if (data.segments) {
      const positions = new Float32Array(data.segments.length * 3);
      for (let i = 0; i < data.segments.length; i += 1) positions.set(data.positions.subarray(data.segments[i]! * 3, data.segments[i]! * 3 + 3), i * 3);
      addLines(positions, false);
    }
    const axes = pointsAxes(data); addLines(axes.lines, true); addLines(axes.grid, false);
    labels = createPointsLabels(viewport, data, axes.labels, services.labelCanvas);
    paint();
  };
  const positionOf = (item: number) => {
    if (!data || !Number.isInteger(item) || item < 0 || item >= data.positions.length / 3) return null;
    return { x: data.positions[item * 3]!, y: data.positions[item * 3 + 1]!, z: data.positions[item * 3 + 2]! };
  };
  const openViewport = (recover = false): Lyra3dViewport | undefined => {
    if (disposed || !container || !host) return undefined;
    const current = (services.viewport ?? createLyra3dViewport)(container, {
      hover: item => { if (!disposed) host?.hover(item); },
      pick: (item, modifiers) => { if (!disposed) host?.pick(item, modifiers); },
      camera: value => { if (!disposed) { camera = constrain(normalizeOrbitCamera(value)); host?.camera(value); } },
      lost: (reason, detail) => { if (!disposed) host?.lost(reason, detail); },
      restored: () => { if (!disposed) { frame(); host?.restored?.(); } },
      rendering: info => { if (!disposed) host?.rendering?.(info); },
    }, { constrain, primaryPan: () => data?.mode === '2d' });
    if (disposed) { current.dispose(); return undefined; }
    viewport = current; current.setStyle(style); current.setOrbit(constrain(camera));
    if (recover) current.resize(width, height);
    unframe = current.onFrame(frame); build();
    return current;
  };
  const validatePreparation = (): Lyra3dXrErrorCode | null => {
    const record = preparation;
    if (!record || disposed || record.mount !== mountEpoch || !record.viewport || record.viewport !== viewport || record.viewport.disposed) return 'aborted';
    if (record.epoch !== profileEpoch) return 'unsupported-scene';
    if (!record.snapshot || !record.stamp || record.stamp.phase !== 'inline' || getViewportXrLifetimeStamp(record.viewport) !== record.stamp || !isViewportXrPreparationCurrent(record.snapshot)) return 'aborted';
    if (record.viewport.lost) return 'context-lost';
    if (getViewportXrResources(record.snapshot).glow) return 'unsupported-scene';
    return null;
  };
  const inspectPreparation = (module: PointsXrModule): void => {
    const invalid = validatePreparation(); if (invalid) throw new Lyra3dXrError(invalid);
    const record = preparation!, currentData = data ?? admitPointsData({ positions: new Float32Array() });
    if (currentData.mode !== '3d' || currentData.positions.length / 3 > 100_000 || (currentData.segments?.length ?? 0) / 2 > 100_000) {
      throw new Lyra3dXrError('unsupported-scene');
    }
    record.hasLabels = Boolean(currentData.labels?.some(label => label.length > 0) ||
      currentData.axes.some(axis => Boolean(axis.label) || axis.ticks.some(tick => tick.label.length > 0)));
    if (!record.hasLabels) record.profile = module.createPointsXrProfile(currentData, record.viewport!.style);
  };
  const beginLabelPreparation = (module: PointsXrModule): PointsXrLabelPreparation | undefined => {
    const invalid = validatePreparation(); if (invalid) throw new Lyra3dXrError(invalid);
    const record = preparation!;
    if (!record.hasLabels) return undefined;
    if (!data || !container) throw new Lyra3dXrError('aborted');
    const current = record.viewport!;
    const job = module.preparePointsXrLabels({
      identity: record.identity, data, style: current.style, state, pointResources: points?.resources,
      ownerDocument: container.ownerDocument, container, maxTextureSize: current.renderer.capabilities.maxTextureSize,
      account: module.createPointsXrAllocationAccount(), validate: preparationValidator(record.cell),
      schedule: scheduleLabelWork, report: reportApplicationError,
    });
    record.cell.job = job;
    return job;
  };
  const commitApplication = (previous: Lyra3dViewport, snapshot: ViewportXrPreparation): void => {
    const record = preparation!;
    camera = constrain(previous.orbit);
    const stopFrame = unframe, candidate = record.cell.labels;
    record.cell.labels = undefined; record.cell.job = undefined;
    unframe = undefined; viewport = undefined; points = undefined; lines = []; labels = undefined;
    record.viewport = undefined; record.snapshot = undefined; record.stamp = undefined; record.profile = undefined;
    clearPreparationCell(record.cell);
    let failed = false, failure: unknown;
    try { candidate?.move(); } catch (error) { failed = true; failure = error; }
    try { stopFrame?.(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    try { handoffViewportXr(previous, snapshot, false); } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
  };
  const completePreparation = (module: PointsXrModule, candidate?: PreparedPointsXrLabels): Lyra3dXrPresentation => {
    const invalid = validatePreparation(); if (invalid) throw new Lyra3dXrError(invalid);
    const record = preparation!, current = record.viewport!, snapshot = record.snapshot!;
    if (candidate) {
      const labelInvalid = candidate.validate(); if (labelInvalid) throw new Lyra3dXrError(labelInvalid);
      if (!candidate.profile || !candidate.resources) throw new Lyra3dXrError('aborted');
      record.profile = candidate.profile;
    }
    if (!record.profile) throw new Lyra3dXrError('unsupported-scene');
    const entry: PointsXrEntryCell = { commitApplication, viewport: current, preparation: snapshot };
    record.cell.entry = entry;
    record.presentation = module.createPointsXrPresentation({
      preparationLease: record.lease, documentKey: xrDocumentScope(current.canvas.ownerDocument),
      validatePrepared: preparedEntryValidator(record.cell), options: record.cell.options, entry,
      scene: { viewportResources: getViewportXrResources(snapshot), world: current.world,
        pointResources: points?.resources, lineResources: lines.map(line => line.resources), profile: record.profile,
        labels: candidate?.resources, ordinaryLabels: labels?.resources,
        placement: { matrix: undefined, yaw: current.orbit.yaw }, drawAllowed: record.gate },
    });
    record.cell.options = undefined;
    return record.presentation;
  };
  const finishPreparation = (record: PointsPreparation): void => {
    clearPreparationCell(record.cell);
    if (record.snapshot) releaseViewportXrPreparation(record.snapshot);
    record.snapshot = undefined; record.viewport = undefined; record.stamp = undefined; record.profile = undefined;
    record.removeRelease = undefined; record.presentation = undefined;
    if (preparation !== record) return;
    preparation = undefined;
    if (!record.gate.transferred || disposed || record.mount !== mountEpoch) return;
    try {
      const current = openViewport(true);
      if (!current || disposed) return;
      awaitingRestoredDraw = true;
      completeRestoredDraw();
    } catch (error) { failRecovery(error); }
  };
  const failRecovery = (error: unknown): void => {
    reportApplicationError(error);
    try { retireInline(); } catch (cleanupError) { reportApplicationError(cleanupError); }
    try { if (!disposed) host?.lost('error'); } catch (callbackError) { reportApplicationError(callbackError); }
  };
  const completeRestoredDraw = (): void => {
    if (!awaitingRestoredDraw || !viewport || disposed || width === 0 || height === 0) return;
    drawRestoredViewport(viewport);
    awaitingRestoredDraw = false;
    try { if (!disposed) host?.restored?.(); } catch (error) { reportApplicationError(error); }
  };
  const closeNativeDraw = (): void => { if (preparation?.gate.transferred) preparation.gate.allowed = false; };
  const exitNative = (): void => {
    if (preparation?.gate.transferred && preparation.presentation) void preparation.presentation.exit().catch(reportApplicationError);
  };
  const cancelPendingLabels = (): void => {
    const record = preparation;
    if (record?.cell.job && !record.presentation) clearPreparationCell(record.cell, 'unsupported-scene');
  };
  return {
    contract: LYRA_3D_CONTRACT,
    async mount(nextContainer, nextHost) {
      if (disposed || mounted) throw new Error('Points engine cannot be mounted twice');
      mounted = true; mountEpoch++; container = nextContainer; host = nextHost;
      openViewport();
    },
    prepareXrPresentation(options) {
      try {
        if (disposed || !viewport || viewport.disposed || viewport.lost) throw new Lyra3dXrError('aborted');
        if (awaitingRestoredDraw) throw new Lyra3dXrError('busy');
        const capturedOptions = snapshotXrOptions(options);
        const lease = acquireXrPreparation(engineScope);
        try {
          const snapshot = captureViewportXrPreparation(viewport, false);
          const cell: PreparationCell = { inspect: inspectPreparation, beginLabels: beginLabelPreparation, complete: completePreparation,
            validate: validatePreparation, failure: 'aborted', job: undefined, labels: undefined, options: capturedOptions, entry: undefined };
          const record: PointsPreparation = { cell, lease, viewport, snapshot, stamp: getViewportXrLifetimeStamp(viewport), mount: mountEpoch,
            epoch: profileEpoch, identity: Object.freeze({}), hasLabels: false, profile: undefined,
            gate: { allowed: true, transferred: false }, presentation: undefined, removeRelease: undefined };
          preparation = record;
          record.removeRelease = observeXrRelease(lease.released, releaseContinuation(record, finishPreparation), reportApplicationError);
          return loadPresentation(cell, lease);
        } catch (error) { releaseXrPreparation(lease); throw error; }
      } catch (error) { return Promise.reject(error); }
    },
    setData(input, nextRevision) {
      if (disposed) return;
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Points revision must increase');
      const admitted = admitPointsData(input);
      closeNativeDraw();
      data = admitted; revision = nextRevision; profileEpoch++;
      try { camera = constrain(viewport?.orbit ?? camera); viewport?.setOrbit(camera); build(); }
      finally { cancelPendingLabels(); }
      exitNative();
    },
    setStyle(next) {
      if (disposed) return;
      resolveLyra3dStyle(next);
      closeNativeDraw(); style = next; profileEpoch++;
      try { viewport?.setStyle(next); paint(); }
      finally { cancelPendingLabels(); }
      exitNative();
    },
    setState(next) {
      if (disposed) return;
      const update = snapshotVisualState(next, state, (data?.positions.length ?? 0) / 3);
      if (!update.changed) return;
      closeNativeDraw(); state = update.state; profileEpoch++;
      try { if (viewport) { points?.paintState(viewport.style, state, update.rows); frame(); viewport.invalidate(); } }
      finally { cancelPendingLabels(); }
      exitNative();
    },
    setCamera(next) { if (!disposed) { camera = constrain(next); viewport?.setOrbit(camera); } },
    fit(padding) {
      const positions = data?.positions ?? new Float32Array();
      let bounds = boundsOfPositions(positions);
      const axes = data ? boundsOfPositions(pointsAxes(data).lines) : null;
      if (axes) bounds = bounds ? {
        min: { x: Math.min(bounds.min.x, axes.min.x), y: Math.min(bounds.min.y, axes.min.y), z: Math.min(bounds.min.z, axes.min.z) },
        max: { x: Math.max(bounds.max.x, axes.max.x), y: Math.max(bounds.max.y, axes.max.y), z: Math.max(bounds.max.z, axes.max.z) },
      } : axes;
      camera = constrain(fitOrbitCamera(bounds, viewport ?? { width, height }, padding));
      viewport?.setOrbit(camera); return camera;
    },
    focus(item, distance) { const point = positionOf(item); if (!point) return null; camera = constrain(focusOrbitCamera(viewport?.orbit ?? camera, point, distance)); viewport?.setOrbit(camera); return camera; },
    pick: (x, y) => viewport?.pickAt(x, y) ?? null,
    project(item) { const point = positionOf(item); return point ? viewport?.project(point) ?? null : null; },
    positionOf,
    resize(nextWidth, nextHeight) {
      if (disposed) return;
      if (Number.isFinite(nextWidth)) width = Math.max(0, Math.round(nextWidth));
      if (Number.isFinite(nextHeight)) height = Math.max(0, Math.round(nextHeight));
      viewport?.resize(nextWidth, nextHeight); frame();
      try { completeRestoredDraw(); } catch (error) { failRecovery(error); }
    },
    dispose() {
      if (disposed) return;
      disposed = true; mountEpoch++;
      const pending = preparation; preparation = undefined;
      if (pending) {
        pending.gate.allowed = false; clearPreparationCell(pending.cell, 'aborted'); pending.removeRelease?.(); pending.removeRelease = undefined;
        pending.viewport = undefined; pending.stamp = undefined; pending.profile = undefined;
        if (pending.snapshot) { releaseViewportXrPreparation(pending.snapshot); pending.snapshot = undefined; }
        if (pending.presentation) pending.presentation.dispose(); else releaseXrPreparation(pending.lease);
        pending.presentation = undefined;
      }
      host = undefined; container = undefined; data = undefined;
      retireInline();
    },
  };
}
