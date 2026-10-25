import { Group, Scene, Color, CylinderGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { LYRA_3D_CONTRACT, type Lyra3dEngine, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle } from '../core/contract.js';
import { boundsOfPositions, DEFAULT_ORBIT_CAMERA, LYRA_3D_WORLD_LIMIT, fitOrbitCamera, focusOrbitCamera, normalizeOrbitCamera, panBy, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { createPickColors, createPickMaterial } from '../core/picking.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { DEFAULT_LYRA_3D_STYLE } from '../core/style.js';
import { startLyra3dTask, type Lyra3dTask, type Lyra3dTaskOptions } from '../core/worker.js';
import { validateGraphLayoutInput } from './layout-admission.js';
import { createGraphIncrementalTaskKernel, type GraphTaskInput, type GraphTaskOutput } from './layout-task.js';
import type { GraphLayoutInput, GraphLayoutPinUpdate } from './types.js';
import { admitGraphSpatialAppearance, validateGraphSpatialSizes, type GraphSpatialAppearance } from './spatial-appearance.js';
import { createGraphSpatialNodes } from './spatial-nodes.js';
import { spatialPrimitiveCount } from './spatial-paths.js';
import { createGraphSpatialEdges } from './spatial-edges.js';
import { createGraphSpatialComposite } from './spatial-composite.js';
import { admitGraphDecorations, createGraphDecorations, graphItemColor, type GraphDecorationData } from './decorations.js';
import { changedVisualRows, snapshotVisualState, type VisualStateRows } from '../core/visual-state.js';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import { createPaintColors } from '../core/paint-colors.js';

/** Renderable graph inputs use the core world range: every coordinate is within ±10,000,000.
 * The standalone numerical layout kernel accepts a wider finite Float32 range. */
export interface GraphEngineData extends GraphLayoutInput, GraphDecorationData {
  /** Interleaved xyz coordinates within ±10,000,000; invalid replacements leave current data intact. */
  readonly positions?: Float32Array;
  /** Node diameters in CSS pixels. */
  sizes?: Float32Array;
  /** Optional screen-facing glyph and stroke paint for spatial diagram presentation. */
  spatialAppearance?: GraphSpatialAppearance;
  categories?: Uint16Array;
}
/** Paint-only replacements for an already admitted spatial graph. Layout, positions, sizes,
 * categories and topology are not accepted; omitted fields retain their current values. */
export interface GraphEngineAppearance extends GraphDecorationData {
  readonly spatialAppearance?: GraphSpatialAppearance;
}
export interface GraphEngine extends Lyra3dEngine<GraphEngineData, Lyra3dOrbitCamera> {
  /** Applies pins atomically. Coordinates outside ±10,000,000 throw without changing positions or pins. */
  setPins(update: GraphLayoutPinUpdate): void;
  /** Validates and replaces spatial paint atomically without restarting layout or changing pins. */
  setAppearance(appearance: GraphEngineAppearance): void;
}
export interface GraphEngineServices {
  viewport?: typeof createLyra3dViewport;
  labelCanvas?: () => HTMLCanvasElement;
  task?: (options: Lyra3dTaskOptions<GraphTaskInput, GraphTaskOutput>) => Lyra3dTask<GraphTaskInput>;
}

function renderablePositions(positions: Float32Array): boolean {
  return positions.every((value) => Number.isFinite(value) && Math.abs(value) <= LYRA_3D_WORLD_LIMIT);
}

/** Owns one scene and one replaceable layout task; host item order is nodes followed by edges.
 * A layout frame outside the core world range stops layout and reports an error while retaining
 * the last valid rendered positions. */
export function createGraphEngine(services: GraphEngineServices = {}): GraphEngine {
  let viewport: Lyra3dViewport | undefined;
  let host: Lyra3dHost | undefined;
  let disposed = false;
  let mounted = false;
  let revision = -1;
  let generation = 0;
  let epoch = 0;
  let data: GraphEngineData | undefined;
  let positions: Float32Array = new Float32Array();
  let pins: Uint8Array = new Uint8Array();
  let style: Lyra3dStyle = DEFAULT_LYRA_3D_STYLE;
  let camera = DEFAULT_ORBIT_CAMERA;
  let state: Lyra3dState = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  let task: Lyra3dTask<GraphTaskInput> | undefined;
  let meshes: InstancedMesh[] = [];
  let spatialNodes: ReturnType<typeof createGraphSpatialNodes> | undefined;
  let spatialComposite: ReturnType<typeof createGraphSpatialComposite> | undefined;
  let spatialEdges: ReturnType<typeof createGraphSpatialEdges> | undefined;
  let lastTransformState: Lyra3dState | undefined;
  let lastSpatialRevision = -1;
  let decorations: ReturnType<typeof createGraphDecorations> | undefined;
  let positionRevision = 0;
  let fittedDistance = DEFAULT_ORBIT_CAMERA.distance;
  let lastTransforms = '';
  let lastTransformStyle: Lyra3dViewport['style'] | undefined;
  let unframe: (() => void) | undefined;
  let detach: (() => void) | undefined;
  const matrix = new Matrix4();
  const point = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const direction = new Vector3();
  const up = new Vector3(0, 1, 0);
  const color = new Color();
  const stop = () => { generation += 1; const old = task; task = undefined; old?.stop(); };
  const clear = () => {
    spatialComposite?.dispose(); spatialComposite = undefined;
    spatialNodes?.dispose(); spatialNodes = undefined; spatialEdges?.dispose(); spatialEdges = undefined; lastTransformState = undefined; lastSpatialRevision = -1;
    decorations?.dispose(); decorations = undefined; lastTransforms = ''; lastTransformStyle = undefined;
    const geometries = new Set(meshes.map((mesh) => mesh.geometry));
    for (const mesh of meshes) { mesh.removeFromParent(); (mesh.material as MeshBasicMaterial).dispose(); mesh.dispose(); }
    for (const geometry of geometries) geometry.dispose();
    meshes = [];
  };
  const positionOf = (item: number) => {
    if (!data || !Number.isInteger(item) || item < 0 || item >= data.nodeCount) return null;
    return { x: positions[item * 3]!, y: positions[item * 3 + 1]!, z: positions[item * 3 + 2]! };
  };
  const paint = (rows?: VisualStateRows) => {
    if (!viewport || !data) return;
    if (spatialNodes) { transforms(rows); viewport.invalidate(); return; }
    if (meshes.length === 0) return;
    const resolved = viewport.style;
    const paintColor = createPaintColors(resolved);
    const currentData = data;
    for (let kind = 0; kind < 2; kind += 1) {
      const mesh = meshes[kind * 2]!;
      const changed: number[] = [];
      const paintRow = (index: number) => {
        const item = kind === 0 ? index : currentData.nodeCount + index;
        const base = kind === 0 ? resolved.palette[(currentData.categories?.[index] ?? 0) % resolved.palette.length]! : resolved.muted;
        mesh.setColorAt(index, graphItemColor(resolved, state, item, base, color, paintColor));
      };
      if (rows === undefined || rows === null) for (let index = 0; index < mesh.count; index++) paintRow(index);
      else for (const item of rows) {
        const index = kind === 0 ? item : item - currentData.nodeCount;
        if (index < 0 || index >= mesh.count) continue;
        paintRow(index); changed.push(index);
      }
      if (mesh.instanceColor) {
        if (rows === undefined || rows === null) markAttributeFull(mesh.instanceColor);
        else markAttributeRows(mesh.instanceColor, changed);
      }
    }
    viewport.invalidate();
  };
  const transforms = (stateRows?: VisualStateRows) => {
    if (!viewport || !data || (!spatialNodes && meshes.length === 0)) return;
    if (spatialNodes && spatialEdges) {
      // Geometry, style and visual state have independent invalidations. Camera-only frames
      // update uniforms and may reorder translucent payloads without repainting source batches.
      if (lastTransformState === undefined) {
        spatialNodes.update(viewport, positions, state); spatialEdges.update(viewport, positionOf, state);
      } else {
        if (lastSpatialRevision !== positionRevision) {
          spatialNodes.updatePositions(viewport, positions); spatialEdges.updatePositions(viewport, positionOf);
        }
        if (lastTransformStyle !== viewport.style) {
          spatialNodes.updateStyle(viewport, state);
          spatialEdges.updateStyle(viewport, state, lastSpatialRevision === positionRevision);
        } else if (lastTransformState !== state) {
          const rows = stateRows === undefined ? changedVisualRows(lastTransformState, state, data.nodeCount + data.source.length) : stateRows;
          spatialNodes.updateState(viewport, state, rows); spatialEdges.updateState(viewport, state, rows);
        }
        spatialNodes.setView(viewport); spatialEdges.setView(viewport);
      }
      lastSpatialRevision = positionRevision; lastTransformStyle = viewport.style; lastTransformState = state;
      spatialComposite?.update(viewport); return;
    }
    const orbit = viewport.orbit;
    const key = [positionRevision, viewport.width, viewport.height, orbit.yaw, orbit.pitch, orbit.distance, orbit.target.x, orbit.target.y, orbit.target.z].join('|');
    if (lastTransforms === key && lastTransformStyle === viewport.style) return;
    lastTransforms = key; lastTransformStyle = viewport.style;
    for (let kind = 0; kind < 2; kind += 1) {
      const mesh = meshes[kind * 2]!;
      const pick = meshes[kind * 2 + 1]!;
      for (let i = 0; i < mesh.count; i += 1) {
        const a = positionOf(kind === 0 ? i : data.source[i]!)!;
        if (kind === 0) {
          point.set(a.x, a.y, a.z); rotation.identity();
          const projection = viewport.project(a);
          const radius = projection ? (data.sizes?.[i] ?? viewport.style.pointSize) / (2 * projection.scale) : 0;
          scale.setScalar(radius);
        } else {
          const b = positionOf(data.target[i]!)!;
          point.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
          const length = direction.length();
          rotation.setFromUnitVectors(up, length ? direction.divideScalar(length) : up);
          const projection = viewport.project(point);
          const radius = projection ? viewport.style.lineWidth / (2 * projection.scale) : 0;
          scale.set(radius, length, radius);
        }
        matrix.compose(point, rotation, scale);
        mesh.setMatrixAt(i, matrix); pick.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; pick.instanceMatrix.needsUpdate = true;
    }
  };
  const build = () => {
    clear();
    if (!viewport || !data) return;
    if (data.spatialAppearance) {
      const spatialData = { ...data, spatialAppearance: data.spatialAppearance };
      spatialNodes = createGraphSpatialNodes(spatialData); spatialEdges = createGraphSpatialEdges(spatialData);
      spatialNodes.pick.renderOrder = 1;
      spatialComposite = createGraphSpatialComposite(spatialNodes, spatialEdges);
      viewport.world.add(spatialComposite.mesh); viewport.pickWorld.add(spatialEdges.pick, spatialNodes.pick);
      decorations = createGraphDecorations(viewport, data, services.labelCanvas); transforms(); paint(); return;
    }
    const colors = createPickColors(data.nodeCount + data.source.length);
    for (let kind = 0; kind < 2; kind += 1) {
      const geometry = kind === 0 ? new SphereGeometry(1, 8, 6) : new CylinderGeometry(1, 1, 1, 6);
      const count = kind === 0 ? data.nodeCount : data.source.length;
      const mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), count);
      const pick = new InstancedMesh(geometry, createPickMaterial(), count);
      mesh.frustumCulled = pick.frustumCulled = false;
      for (let index = 0; index < count; index += 1) {
        const offset = (kind === 0 ? index : data.nodeCount + index) * 3;
        color.setRGB(colors[offset]!, colors[offset + 1]!, colors[offset + 2]!);
        pick.setColorAt(index, color);
      }
      meshes.push(mesh, pick); viewport.world.add(mesh); viewport.pickWorld.add(pick);
    }
    decorations = createGraphDecorations(viewport, data, services.labelCanvas);
    transforms(); paint();
  };
  const setAppearance = (appearance: GraphEngineAppearance) => {
    if (disposed) return;
    if (!data?.spatialAppearance) throw new Error('Graph appearance requires spatial data');
    const previousData = data, previousViewport = viewport;
    if (!appearance || typeof appearance !== 'object') throw new TypeError('Invalid graph appearance');
    const allowed = new Set(['spatialAppearance', 'labels', 'edgeLabels', 'nodeLabels', 'withEdgeLabels', 'edgeLabelMinZoom', 'directed', 'particlesPerEdge', 'particleSpeed']);
    const values: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(appearance)) {
      if (typeof key !== 'string' || !allowed.has(key)) throw new TypeError('Invalid graph appearance field');
      const descriptor = Object.getOwnPropertyDescriptor(appearance, key);
      if (!descriptor || !('value' in descriptor)) throw new TypeError('Invalid graph appearance field');
      values[key] = descriptor.value;
    }
    if (disposed || data !== previousData || viewport !== previousViewport) return;
    const merged = { ...previousData, ...values } as GraphEngineData;
    if (!merged.spatialAppearance) throw new TypeError('Invalid graph appearance');
    const spatialAppearance = admitGraphSpatialAppearance(merged.spatialAppearance, previousData.nodeCount, previousData.source.length);
    const next = { ...merged, ...admitGraphDecorations(merged, previousData.nodeCount, previousData.source.length), spatialAppearance };
    validateGraphSpatialSizes(next.sizes, next.nodeCount, spatialAppearance); spatialPrimitiveCount(next);
    if (spatialAppearance.dangling) for (let edge = 0; edge < next.source.length; edge++) if (spatialAppearance.dangling[edge] && next.source[edge] !== next.target[edge]) throw new RangeError('Dangling layout endpoints must share the source row');
    if (disposed || data !== previousData || viewport !== previousViewport) return;
    if (!viewport) { data = next; return; }
    const current = viewport;
    // Build against detached roots; inherited camera/style dimensions stay live after commit.
    const staging = Object.assign(Object.create(current) as Lyra3dViewport, { world: new Group(), pickWorld: new Group(), scene: new Scene() });
    let nodes: ReturnType<typeof createGraphSpatialNodes> | undefined;
    let edges: ReturnType<typeof createGraphSpatialEdges> | undefined;
    let composite: ReturnType<typeof createGraphSpatialComposite> | undefined;
    let ornaments: ReturnType<typeof createGraphDecorations> | undefined;
    try {
      nodes = createGraphSpatialNodes(next); edges = createGraphSpatialEdges(next); composite = createGraphSpatialComposite(nodes, edges);
      nodes.pick.renderOrder = 1; nodes.update(current, positions, state); edges.update(current, positionOf, state); composite.update(current);
      ornaments = createGraphDecorations(staging, next, services.labelCanvas);
      if (!disposed && viewport === current && data === previousData) ornaments.update({ positionOf, state, fittedDistance, revision: positionRevision, time: 0 });
    } catch (error) { ornaments?.dispose(); composite?.dispose(); edges?.dispose(); nodes?.dispose(); throw error; }
    if (disposed || viewport !== current || data !== previousData) { ornaments.dispose(); composite.dispose(); edges.dispose(); nodes.dispose(); return; }
    const previous = { nodes: spatialNodes, edges: spatialEdges, composite: spatialComposite, decorations };
    data = next; spatialNodes = nodes; spatialEdges = edges; spatialComposite = composite; decorations = ornaments;
    lastTransforms = ''; lastTransformStyle = undefined; lastTransformState = undefined; lastSpatialRevision = -1;
    current.world.add(composite.mesh, ...staging.world.children); current.pickWorld.add(edges.pick, nodes.pick, ...staging.pickWorld.children);
    if (staging.scene.children.length) current.scene.add(...staging.scene.children);
    previous.decorations?.dispose(); previous.composite?.dispose(); previous.edges?.dispose(); previous.nodes?.dispose();
    if (!disposed && viewport === current) current.invalidate();
  };
  const start = () => {
    stop(); epoch = 0;
    if (!viewport || viewport.lost || !data || disposed) return;
    const active = generation;
    const current = viewport;
    const next = (services.task ?? startLyra3dTask)({
      input: { type: 'start', data: { nodeCount: data.nodeCount, source: data.source, target: data.target, options: data.options, positions: positions.slice(), pinned: pins.slice() } },
      kernel: createGraphIncrementalTaskKernel,
      worker: () => new Worker(new URL('./layout.worker.js', import.meta.url), { type: 'module' }),
      onOutput(output) {
        if (disposed || generation !== active || viewport !== current || output.epoch !== epoch) return;
        if (!renderablePositions(output.positions)) {
          stop(); host?.lost('error', 'Graph layout exceeded the supported world range'); return;
        }
        positions = output.positions; positionRevision += 1; transforms(); current.invalidate();
      },
      onError() { if (!disposed && generation === active) { stop(); host?.lost('error', 'Graph layout failed'); } },
    });
    if (disposed || generation !== active) next.stop(); else task = next;
  };
  const setPins = (update: GraphLayoutPinUpdate) => {
    if (disposed || !data) return;
    // Validate only the transaction; a drag must not copy the entire graph to validate one node.
    if (!(update.indices instanceof Uint32Array) || !(update.indices.buffer instanceof ArrayBuffer) || update.indices.length > data.nodeCount ||
      !(update.positions instanceof Float32Array) || !(update.positions.buffer instanceof ArrayBuffer) || update.positions.length !== update.indices.length * 3 ||
      !update.positions.every(Number.isFinite) || !(update.pinned instanceof Uint8Array) || !(update.pinned.buffer instanceof ArrayBuffer) ||
      update.pinned.length !== update.indices.length || !update.pinned.every((value) => value === 0 || value === 1)) {
      throw new RangeError('Invalid graph pin transaction');
    }
    if (!renderablePositions(update.positions)) throw new RangeError('Graph pin coordinates exceed the supported world range');
    const copy = { indices: update.indices.slice(), positions: update.positions.slice(), pinned: update.pinned.slice() };
    const seen = new Set<number>();
    for (const index of copy.indices) {
      if (index >= data.nodeCount || seen.has(index)) throw new RangeError('Invalid graph pin index');
      seen.add(index);
    }
    for (let i = 0; i < copy.indices.length; i += 1) {
      const index = copy.indices[i]!;
      positions.set(copy.positions.subarray(i * 3, i * 3 + 3), index * 3); pins[index] = copy.pinned[i]!;
    }
    epoch += 1; positionRevision += 1;
    task?.update({ type: 'pins', update: copy });
    transforms(); viewport?.invalidate();
  };
  const attachDrag = (current: Lyra3dViewport) => {
    let drag: { id: number; item: number; x: number; y: number; position: { x: number; y: number; z: number }; pinned: number; moved: boolean } | undefined;
    const down = (event: PointerEvent) => {
      if (drag) { event.stopImmediatePropagation(); return; }
      if (event.button !== 0 || !event.isPrimary) return;
      const rect = current.canvas.getBoundingClientRect();
      const item = current.pickAt(event.clientX - rect.left, event.clientY - rect.top);
      const position = item === null ? null : positionOf(item);
      if (!position || item === null) return;
      event.stopImmediatePropagation();
      drag = { id: event.pointerId, item, x: event.clientX, y: event.clientY, position, pinned: pins[item]!, moved: false };
      current.canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      event.stopImmediatePropagation();
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) <= 5) return;
      drag.moved = true;
      const nodeProjection = current.project(drag.position);
      const targetProjection = current.project(current.orbit.target);
      if (!nodeProjection || !targetProjection) return;
      const depthScale = targetProjection.scale / nodeProjection.scale;
      const shifted = panBy(current.orbit, -dx * depthScale, -dy * depthScale, current);
      const target = current.orbit.target;
      setPins({ indices: new Uint32Array([drag.item]), positions: new Float32Array([drag.position.x + shifted.target.x - target.x, drag.position.y + shifted.target.y - target.y, drag.position.z + shifted.target.z - target.z]), pinned: new Uint8Array([1]) });
    };
    const end = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      event.stopImmediatePropagation();
      const previous = drag; drag = undefined;
      if (event.type !== 'pointerup' && previous.moved) setPins({ indices: new Uint32Array([previous.item]), positions: new Float32Array(Object.values(previous.position)), pinned: new Uint8Array([previous.pinned]) });
      if (current.canvas.hasPointerCapture(event.pointerId)) current.canvas.releasePointerCapture(event.pointerId);
      if (event.type === 'pointerup' && !previous.moved) host?.pick(previous.item, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, double: false });
    };
    current.canvas.addEventListener('pointerdown', down, true);
    current.canvas.addEventListener('pointermove', move, true);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) current.canvas.addEventListener(name, end as EventListener, true);
    return () => {
      const previous = drag; drag = undefined;
      if (previous && current.canvas.hasPointerCapture(previous.id)) current.canvas.releasePointerCapture(previous.id);
      current.canvas.removeEventListener('pointerdown', down, true); current.canvas.removeEventListener('pointermove', move, true);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) current.canvas.removeEventListener(name, end as EventListener, true);
    };
  };
  return {
    contract: LYRA_3D_CONTRACT,
    async mount(container, nextHost) {
      if (disposed || mounted) throw new Error('Graph engine cannot be mounted twice');
      mounted = true;
      host = nextHost;
      const current = (services.viewport ?? createLyra3dViewport)(container, {
        hover: (item) => { if (!disposed) host?.hover(item); },
        pick: (item, modifiers) => { if (!disposed) host?.pick(item, modifiers); },
        camera: (value) => { if (!disposed) host?.camera(value); },
        rendering: (info) => { if (!disposed) host?.rendering?.(info); },
        lost: (reason, detail) => { stop(); if (!disposed) host?.lost(reason, detail); },
        restored: () => { if (!disposed) { start(); host?.restored?.(); } },
      });
      if (disposed) { current.dispose(); return; }
      viewport = current; current.setStyle(style); current.setOrbit(camera);
      unframe = current.onFrame((time) => {
        transforms();
        if (decorations?.update({ positionOf, state, fittedDistance, revision: positionRevision, time })) current.invalidate();
      }); detach = attachDrag(current); build(); start();
    },
    setData(input, nextRevision) {
      if (disposed) return;
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Graph revision must increase');
      validateGraphLayoutInput(input);
      if (input.positions && !renderablePositions(input.positions)) throw new RangeError('Graph positions exceed the supported world range');
      const decorationData = admitGraphDecorations(input, input.nodeCount, input.source.length);
      const spatialAppearance = input.spatialAppearance === undefined ? undefined : admitGraphSpatialAppearance(input.spatialAppearance, input.nodeCount, input.source.length);
      if (spatialAppearance) validateGraphSpatialSizes(input.sizes, input.nodeCount, spatialAppearance);
      if (spatialAppearance) spatialPrimitiveCount({ ...input, directed: decorationData.directed, spatialAppearance });
      if (spatialAppearance?.dangling) for (let edge = 0; edge < input.source.length; edge++) {
        if (spatialAppearance.dangling[edge] && input.source[edge] !== input.target[edge]) throw new RangeError('Dangling layout endpoints must share the source row');
      }
      if (input.sizes && (!(input.sizes instanceof Float32Array) || !(input.sizes.buffer instanceof ArrayBuffer) || input.sizes.length !== input.nodeCount || !input.sizes.every((value) => Number.isFinite(value) && value >= 0))) throw new RangeError('Invalid graph node sizes');
      if (input.categories && (!(input.categories instanceof Uint16Array) || !(input.categories.buffer instanceof ArrayBuffer) || input.categories.length !== input.nodeCount)) throw new RangeError('Invalid graph categories');
      const nextPositions = input.positions?.slice() ?? new Float32Array(input.nodeCount * 3);
      if (!input.positions) {
        let seed = input.options?.seed ?? 1;
        const radius = Math.max(10, Math.cbrt(input.nodeCount) * 10);
        for (let i = 0; i < nextPositions.length; i += 1) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; nextPositions[i] = (seed / 4294967296 - 0.5) * radius; }
      }
      detach?.(); detach = undefined; stop(); revision = nextRevision;
      data = { ...input, ...decorationData, spatialAppearance, source: input.source.slice(), target: input.target.slice(), options: { ...input.options }, sizes: input.sizes?.slice(), categories: input.categories?.slice() };
      positionRevision += 1;
      positions = nextPositions; pins = input.pinned?.slice() ?? new Uint8Array(input.nodeCount).fill(input.positions ? 1 : 0);
      build(); if (viewport) detach = attachDrag(viewport); start();
    },
    setStyle(next) { if (!disposed) { style = next; viewport?.setStyle(next); transforms(); paint(); } },
    setState(next) {
      if (disposed) return;
      const update = snapshotVisualState(next, state, data ? data.nodeCount + data.source.length : 0);
      if (!update.changed) return;
      state = update.state; paint(update.rows);
    },
    setCamera(next) { if (!disposed) { camera = normalizeOrbitCamera(next); viewport?.setOrbit(camera); } },
    fit(padding) { camera = fitOrbitCamera(boundsOfPositions(positions, data?.spatialAppearance?.sizeUnits === 'world' ? Array.from({ length: data.nodeCount }, (_, row) => (data?.sizes?.[row] ?? viewport?.style.pointSize ?? 6) / 2) : undefined), viewport ?? { width: 1, height: 1 }, padding); fittedDistance = camera.distance; viewport?.setOrbit(camera); return camera; },
    focus(item, zoom) { const point = positionOf(item); if (!point) return null; camera = focusOrbitCamera(viewport?.orbit ?? camera, point, zoom); viewport?.setOrbit(camera); return camera; },
    pick: (x, y) => viewport?.pickAt(x, y) ?? null,
    project(item) { const point = positionOf(item); return point ? viewport?.project(point) ?? null : null; },
    positionOf,
    setPins,
    setAppearance,
    resize(width, height) { viewport?.resize(width, height); },
    dispose() { if (disposed) return; disposed = true; stop(); detach?.(); unframe?.(); clear(); viewport?.dispose(); viewport = undefined; host = undefined; data = undefined; positions = new Float32Array(); pins = new Uint8Array(); },
  };
}
