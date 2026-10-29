import { LYRA_3D_CONTRACT, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle } from '../core/contract.js';
import { boundsOfPositions, DEFAULT_ORBIT_CAMERA, fitOrbitCamera, focusOrbitCamera, normalizeOrbitCamera, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE } from '../core/style.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { admitPointsData, type AdmittedPointsData } from './data.js';
import { createLineBatch, createPointBatch } from './batches.js';
import { createPointsLabels, pointsAxes } from './axes.js';
import type { PointsEngine } from './types.js';
import { snapshotVisualState } from '../core/visual-state.js';

export interface PointsEngineServices { viewport?: typeof createLyra3dViewport; labelCanvas?: () => HTMLCanvasElement }

/** Immutable full-row point rendering. IDs always match the original point-row order. */
export function createPointsEngine(services: PointsEngineServices = {}): PointsEngine {
  let viewport: Lyra3dViewport | undefined; let host: Lyra3dHost | undefined;
  let mounted = false; let disposed = false; let revision = -1;
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
  return {
    contract: LYRA_3D_CONTRACT,
    async mount(container, nextHost) {
      if (disposed || mounted) throw new Error('Points engine cannot be mounted twice');
      mounted = true; host = nextHost;
      const current = (services.viewport ?? createLyra3dViewport)(container, {
        hover: (item) => { if (!disposed) host?.hover(item); },
        pick: (item, modifiers) => { if (!disposed) host?.pick(item, modifiers); },
        camera: (value) => { if (!disposed) host?.camera(value); },
        lost: (reason, detail) => { if (!disposed) host?.lost(reason, detail); },
        restored: () => { if (!disposed) { frame(); host?.restored?.(); } },
        rendering: (info) => { if (!disposed) host?.rendering?.(info); },
      }, { constrain, primaryPan: () => data?.mode === '2d' });
      if (disposed) { current.dispose(); return; }
      viewport = current; current.setStyle(style); current.setOrbit(constrain(camera));
      unframe = current.onFrame(frame); build();
    },
    setData(input, nextRevision) {
      if (disposed) return;
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Points revision must increase');
      const admitted = admitPointsData(input);
      data = admitted; revision = nextRevision; camera = constrain(viewport?.orbit ?? camera); viewport?.setOrbit(camera); build();
    },
    setStyle(next) { if (!disposed) { style = next; viewport?.setStyle(next); paint(); } },
    setState(next) {
      if (disposed) return;
      const update = snapshotVisualState(next, state, (data?.positions.length ?? 0) / 3);
      if (!update.changed) return;
      state = update.state;
      if (viewport) { points?.paintState(viewport.style, state, update.rows); frame(); viewport.invalidate(); }
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
      camera = constrain(fitOrbitCamera(bounds, viewport ?? { width: 1, height: 1 }, padding));
      viewport?.setOrbit(camera); return camera;
    },
    focus(item, distance) { const point = positionOf(item); if (!point) return null; camera = constrain(focusOrbitCamera(viewport?.orbit ?? camera, point, distance)); viewport?.setOrbit(camera); return camera; },
    pick: (x, y) => viewport?.pickAt(x, y) ?? null,
    project(item) { const point = positionOf(item); return point ? viewport?.project(point) ?? null : null; },
    positionOf,
    resize(width, height) { viewport?.resize(width, height); frame(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      const stopFrame = unframe, previousViewport = viewport;
      unframe = undefined; viewport = undefined; host = undefined; data = undefined;
      let failed = false, failure: unknown;
      const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
      cleanup(() => { stopFrame?.(); });
      cleanup(clear);
      cleanup(() => { previousViewport?.dispose(); });
      if (failed) throw failure;
    },
  };
}
