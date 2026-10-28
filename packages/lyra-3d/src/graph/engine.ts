import { disposeAll } from '../core/dispose.js';
import { Group, Scene, Color, CylinderGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3, type Object3D, type Texture } from 'three';
import { LYRA_3D_CONTRACT, type Lyra3dEngine, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle } from '../core/contract.js';
import { boundsOfPositions, DEFAULT_ORBIT_CAMERA, LYRA_3D_WORLD_LIMIT, fitOrbitCamera, focusOrbitCamera, normalizeOrbitCamera, panBy, type Lyra3dOrbitCamera } from '../core/orbit.js';
import { createPickColors, createPickMaterial } from '../core/picking.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { DEFAULT_LYRA_3D_STYLE } from '../core/style.js';
import { startLyra3dTask, type Lyra3dTask, type Lyra3dTaskOptions } from '../core/worker.js';
import { validateGraphLayoutInput } from './layout-admission.js';
import { createGraphIncrementalTaskKernel, type GraphTaskInput, type GraphTaskOutput } from './layout-task.js';
import type { GraphLayoutInput, GraphLayoutPinUpdate } from './types.js';
import { admitGraphSpatialAppearance, graphSpatialNodeMeshData, validateGraphSpatialSizes, type GraphSpatialAppearance } from './spatial-appearance.js';
import type { GraphNodeMesh } from './node-mesh.js';
import { createGraphSpatialNodes } from './spatial-nodes.js';
import { spatialCurveExtrema, spatialPrimitiveCount } from './spatial-paths.js';
import { createGraphSpatialEdges } from './spatial-edges.js';
import { createGraphSpatialComposite, preflightGraphSpatialMeshes } from './spatial-composite.js';
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
/** Presentation replacements for an admitted spatial graph, including curved strokes and arrows.
 * Layout, positions, sizes, categories and topology are not accepted. Omitted top-level fields
 * retain their values; a supplied spatialAppearance replaces that entire appearance object. */
export interface GraphEngineAppearance extends GraphDecorationData {
  readonly spatialAppearance?: GraphSpatialAppearance;
}
export interface GraphEngine extends Lyra3dEngine<GraphEngineData, Lyra3dOrbitCamera> {
  /** Applies pins atomically. Coordinates outside ±10,000,000 throw without changing positions or pins. */
  setPins(update: GraphLayoutPinUpdate): void;
  /** Replaces spatial presentation atomically without restarting layout, changing pins or fitting the camera. */
  setAppearance(appearance: GraphEngineAppearance): void;
  /** Replaces bounded custom spatial node bodies without restarting layout. Undefined clears. */
  setNodeMeshes(meshes: readonly (GraphNodeMesh | null)[] | undefined): void;
  /** Enables a lazily loaded static glow; false cancels setup and releases effect attachments. */
  setGlow(enabled: boolean): Promise<void>;
}
export interface GraphEngineServices {
  viewport?: typeof createLyra3dViewport;
  labelCanvas?: () => HTMLCanvasElement;
  task?: (options: Lyra3dTaskOptions<GraphTaskInput, GraphTaskOutput>) => Lyra3dTask<GraphTaskInput>;
  /** Receives byte-addressable presentation storage at a custom replacement boundary. */
  storage?: (snapshot: GraphPresentationStorage) => void;
}

export interface GraphPresentationStorage {
  readonly previousCpuBytes: number;
  readonly candidateCpuBytes: number;
  readonly peakCpuBytes: number;
  readonly previousGpuAttributeBytes: number;
  readonly candidateGpuAttributeBytes: number;
  readonly peakGpuAttributeBytes: number;
  readonly previousGpuTextureBytes: number;
  readonly candidateGpuTextureBytes: number;
  readonly peakGpuTextureBytes: number;
  readonly canvasBackingEstimateBytes: number;
  readonly previousNonBufferAllowanceBytes: number;
  readonly candidateNonBufferAllowanceBytes: number;
  readonly peakNonBufferAllowanceBytes: number;
  readonly customAccountedBytes: number;
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
  let glowRequested = false;
  let presentationOwner: { cancelled: boolean; published: boolean } | undefined;
  let presentationGeneration = 0;
  let publicationFailureReported = false;
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
  const abortPresentation = () => { const error = new Error('Graph presentation replacement was superseded'); error.name = 'AbortError'; return error; };
  const refuseNestedPresentation = () => {
    if (!presentationOwner) return;
    if (!presentationOwner.published) { presentationOwner.cancelled = true; presentationGeneration++; }
    throw abortPresentation();
  };
  const failPublication = (current: Lyra3dViewport) => {
    if (disposed || viewport !== current || publicationFailureReported) return;
    publicationFailureReported = true;
    const reportingHost = host;
    // Publication already succeeded. Close the failed renderer before its deferred notification
    // can reenter the host, rather than reporting the accepted data as invalid geometry.
    try { disposeEngine(); } catch { /* Every owner was attempted; report one fixed engine failure. */ }
    queueMicrotask(() => reportingHost?.lost('error', 'Graph presentation cleanup failed'));
  };
  const presentationStorage = (roots: readonly Object3D[], composite: typeof spatialComposite, input: GraphEngineData | undefined, coordinates: Float32Array,
    pinBytes: Uint8Array, owners: readonly { allocationBuffers(): readonly ArrayBufferLike[] }[]) => {
    const buffers = new Set<ArrayBufferLike>(), attributes = new Set<object>(), textures = new Set<object>(); let gpu = 0, textureBytes = 0, canvasBytes = 0;
    const add = (value: unknown) => { if (ArrayBuffer.isView(value)) buffers.add(value.buffer); };
    add(coordinates); add(pinBytes);
    if (input) {
      for (const value of [input.source, input.target, input.sizes, input.categories, input.directed]) add(value);
      if (input.spatialAppearance) {
        for (const value of Object.values(input.spatialAppearance)) add(value);
        for (const body of graphSpatialNodeMeshData(input.spatialAppearance)?.nodeMeshes ?? []) if (body) { add(body.positions); add(body.normals); }
      }
    }
    const visit = (root: Object3D) => root.traverse(object => {
      const geometry = (object as InstancedMesh).geometry;
      if (!geometry) return;
      for (const attribute of [...Object.values(geometry.attributes), ...(geometry.index ? [geometry.index] : [])]) {
        const array = attribute.array;
        add(array);
        if (!attributes.has(attribute)) { attributes.add(attribute); gpu += array.byteLength; }
      }
      if (object instanceof InstancedMesh) for (const attribute of [object.instanceMatrix, object.instanceColor]) if (attribute) {
        add(attribute.array); if (!attributes.has(attribute)) { attributes.add(attribute); gpu += attribute.array.byteLength; }
      }
      const material = (object as InstancedMesh).material;
      for (const item of Array.isArray(material) ? material : material ? [material] : []) {
        const uniforms = (item as MeshBasicMaterial & { uniforms?: Record<string, { value: unknown }> }).uniforms;
        const values: unknown[] = [...Object.values(item), ...Object.values(uniforms ?? {}).map(uniform => uniform.value)];
        for (const value of values) {
          if (!value || typeof value !== 'object' || !('isTexture' in value) || value.isTexture !== true || textures.has(value)) continue;
          textures.add(value);
          const image = (value as Texture).image as { data?: unknown; width?: unknown; height?: unknown } | undefined;
          if (!image) continue;
          if (ArrayBuffer.isView(image.data)) { add(image.data); textureBytes += image.data.byteLength; }
          else if (typeof image.width === 'number' && typeof image.height === 'number' && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height)) {
            const bytes = image.width * image.height * 4; textureBytes += bytes; canvasBytes += bytes;
          }
        }
      }
    });
    for (const root of roots) visit(root);
    for (const owner of owners) for (const buffer of owner.allocationBuffers()) buffers.add(buffer);
    const allocation = composite?.allocations();
    if (allocation) for (const buffer of allocation.buffers) buffers.add(buffer);
    const cpu = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
    if (![cpu, gpu, textureBytes, canvasBytes].every(Number.isSafeInteger)) throw new RangeError('Graph presentation storage exceeds its supported range');
    const custom = input?.spatialAppearance && graphSpatialNodeMeshData(input.spatialAppearance);
    // The host snapshot is outside engine traversal; reserve its payload plus row/color slots
    // explicitly rather than presenting these non-ArrayBuffer quantities as measured heap.
    const allowance = custom ? custom.payloadBytes + 16 * custom.customNodeCount + 16 * input!.nodeCount : 0;
    return { cpu, gpu, textureBytes, canvasBytes, buffers, allowance, custom: allocation?.customStorage?.accountedBytes ?? 0 };
  };
  const recordReplacementStorage = (current: Lyra3dViewport, next: GraphEngineData, coordinates: Float32Array,
    roots: readonly Object3D[], composite: typeof spatialComposite, candidatePins = pins,
    candidateOwners: readonly { allocationBuffers(): readonly ArrayBufferLike[] }[] = []) => {
    if (!(next.spatialAppearance && graphSpatialNodeMeshData(next.spatialAppearance)) && !data?.spatialAppearance?.nodeMeshes) return;
    const previousOwners = [...(spatialNodes ? [spatialNodes] : []), ...(spatialEdges ? [spatialEdges] : []), ...(decorations ? [decorations] : [])];
    const previous = presentationStorage([current.scene, current.pickScene], spatialComposite, data, positions, pins, previousOwners);
    const candidate = presentationStorage(roots, composite, next, coordinates, candidatePins, candidateOwners);
    const unique = new Set([...previous.buffers, ...candidate.buffers]);
    const peakCpuBytes = [...unique].reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const customAccountedBytes = previous.custom + candidate.custom;
    if (!Number.isSafeInteger(peakCpuBytes) || customAccountedBytes > 96 * 1024 * 1024) throw new RangeError('Graph custom replacement storage exceeds its budget');
    services.storage?.({ previousCpuBytes: previous.cpu, candidateCpuBytes: candidate.cpu, peakCpuBytes,
      previousGpuAttributeBytes: previous.gpu, candidateGpuAttributeBytes: candidate.gpu,
      peakGpuAttributeBytes: previous.gpu + candidate.gpu, previousGpuTextureBytes: previous.textureBytes, candidateGpuTextureBytes: candidate.textureBytes,
      peakGpuTextureBytes: previous.textureBytes + candidate.textureBytes, canvasBackingEstimateBytes: previous.canvasBytes + candidate.canvasBytes,
      previousNonBufferAllowanceBytes: previous.allowance, candidateNonBufferAllowanceBytes: candidate.allowance,
      peakNonBufferAllowanceBytes: previous.allowance + candidate.allowance, customAccountedBytes });
  };
  const stop = () => { generation += 1; const old = task; task = undefined; old?.stop(); };
  const clear = () => {
    const previous = { composite: spatialComposite, nodes: spatialNodes, edges: spatialEdges, decorations, meshes };
    spatialComposite = undefined; spatialNodes = undefined; spatialEdges = undefined; decorations = undefined; meshes = [];
    lastTransformState = undefined; lastSpatialRevision = -1; lastTransforms = ''; lastTransformStyle = undefined;
    const geometries = new Set(previous.meshes.map(mesh => mesh.geometry));
    disposeAll([() => previous.composite?.dispose(), () => previous.nodes?.dispose(), () => previous.edges?.dispose(), () => previous.decorations?.dispose(),
      ...previous.meshes.flatMap(mesh => [() => mesh.removeFromParent(), () => (mesh.material as MeshBasicMaterial).dispose(), () => mesh.dispose()]),
      ...[...geometries].map(geometry => () => geometry.dispose())]);
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
  const preparePresentation = (current: Lyra3dViewport, next: GraphEngineData, coordinates: Float32Array, isCurrent: () => boolean, candidatePins = pins) => {
    refuseNestedPresentation();
    const owner = { cancelled: false, published: false }; presentationOwner = owner;
    const live = () => !owner.cancelled && isCurrent();
    let handedOff = false;
    const releaseOwner = () => { if (presentationOwner === owner) presentationOwner = undefined; };
    let staging: Lyra3dViewport;
    let nodes: typeof spatialNodes, edges: typeof spatialEdges, composite: typeof spatialComposite, ornaments: typeof decorations;
    const legacy: InstancedMesh[] = [];
    const nextPositionOf = (row: number) => Number.isInteger(row) && row >= 0 && row < next.nodeCount
      ? { x: coordinates[row * 3]!, y: coordinates[row * 3 + 1]!, z: coordinates[row * 3 + 2]! } : null;
    let retired = false;
    const dispose = () => {
      if (retired) return; retired = true;
      const geometries = new Set(legacy.map(mesh => mesh.geometry));
      try {
        disposeAll([() => ornaments?.dispose(), () => composite?.dispose(), () => edges?.dispose(), () => nodes?.dispose(),
          ...legacy.flatMap(mesh => [() => mesh.removeFromParent(), () => (mesh.material as MeshBasicMaterial).dispose(), () => mesh.dispose()]),
          ...[...geometries].map(geometry => () => geometry.dispose())]);
      } finally { releaseOwner(); }
    };
    try {
      staging = Object.assign(Object.create(current) as Lyra3dViewport, { world: new Group(), pickWorld: new Group(), scene: new Scene() });
      if (next.spatialAppearance) {
        const input = { ...next, spatialAppearance: next.spatialAppearance }, custom = graphSpatialNodeMeshData(next.spatialAppearance);
        nodes = createGraphSpatialNodes(input, custom); edges = createGraphSpatialEdges(input); composite = createGraphSpatialComposite(nodes, edges, custom);
        nodes.pick.renderOrder = 1; nodes.update(current, coordinates, state); edges.update(current, nextPositionOf, state); composite.update(current);
        if (custom) composite.allocations();
      } else {
        const colors = createPickColors(next.nodeCount + next.source.length), paintColor = createPaintColors(current.style);
        for (let kind = 0; kind < 2; kind++) {
          const geometry = kind === 0 ? new SphereGeometry(1, 8, 6) : new CylinderGeometry(1, 1, 1, 6);
          const count = kind === 0 ? next.nodeCount : next.source.length;
          const mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), count), pick = new InstancedMesh(geometry, createPickMaterial(), count);
          mesh.frustumCulled = pick.frustumCulled = false; legacy.push(mesh, pick);
          for (let row = 0; row < count; row++) {
            const item = kind === 0 ? row : next.nodeCount + row, a = nextPositionOf(kind === 0 ? row : next.source[row]!)!;
            if (kind === 0) {
              point.set(a.x, a.y, a.z); rotation.identity(); const projection = current.project(a);
              scale.setScalar(projection ? (next.sizes?.[row] ?? current.style.pointSize) / (2 * projection.scale) : 0);
            } else {
              const b = nextPositionOf(next.target[row]!)!; point.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
              direction.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = direction.length();
              rotation.setFromUnitVectors(up, length ? direction.divideScalar(length) : up);
              const projection = current.project(point), radius = projection ? current.style.lineWidth / (2 * projection.scale) : 0;
              scale.set(radius, length, radius);
            }
            matrix.compose(point, rotation, scale); mesh.setMatrixAt(row, matrix); pick.setMatrixAt(row, matrix);
            color.setRGB(colors[item * 3]!, colors[item * 3 + 1]!, colors[item * 3 + 2]!); pick.setColorAt(row, color);
            const base = kind === 0 ? current.style.palette[(next.categories?.[row] ?? 0) % current.style.palette.length]! : current.style.muted;
            mesh.setColorAt(row, graphItemColor(current.style, state, item, base, color, paintColor));
          }
        }
      }
      const createCanvas = services.labelCanvas ? () => { const canvas = services.labelCanvas!(); if (!live()) throw abortPresentation(); return canvas; } : undefined;
      ornaments = createGraphDecorations(staging, next, createCanvas);
      if (!live()) { dispose(); return undefined; }
      ornaments.update({ positionOf: nextPositionOf, state, fittedDistance, revision: positionRevision + 1, time: 0 });
      recordReplacementStorage(current, next, coordinates, [...legacy, ...(nodes ? [nodes.pick] : []), ...(edges ? [edges.pick] : []),
        ...(composite ? [composite.mesh, ...(composite.customPick ? [composite.customPick] : [])] : []), staging.world, staging.pickWorld, staging.scene], composite, candidatePins,
        [...(nodes ? [nodes] : []), ...(edges ? [edges] : []), ornaments]);
      if (!live()) { dispose(); return undefined; }
      handedOff = true;
      return { staging, nodes, edges, composite, ornaments, legacy, dispose, owner, releaseOwner };
    } catch (error) {
      try { dispose(); } catch { /* Keep the construction error; every owner was attempted. */ }
      if (!live()) return undefined;
      throw error;
    } finally { if (!handedOff) releaseOwner(); }
  };
  const attachPresentation = (current: Lyra3dViewport, prepared: NonNullable<ReturnType<typeof preparePresentation>>) => {
    const previous = { nodes: spatialNodes, edges: spatialEdges, composite: spatialComposite, decorations, meshes };
    spatialNodes = prepared.nodes; spatialEdges = prepared.edges; spatialComposite = prepared.composite; decorations = prepared.ornaments; meshes = prepared.legacy;
    lastTransformState = undefined; lastSpatialRevision = -1; lastTransforms = ''; lastTransformStyle = undefined;
    current.world.add(...prepared.legacy.filter((_, index) => index % 2 === 0), ...(prepared.composite ? [prepared.composite.mesh] : []), ...prepared.staging.world.children);
    current.pickWorld.add(...prepared.legacy.filter((_, index) => index % 2 === 1), ...(prepared.nodes ? [prepared.nodes.pick] : []), ...(prepared.edges ? [prepared.edges.pick] : []), ...prepared.staging.pickWorld.children);
    if (prepared.composite?.customPick) { prepared.composite.customPick.renderOrder = 1; current.pickWorld.add(prepared.composite.customPick); }
    if (prepared.staging.scene.children.length) current.scene.add(...prepared.staging.scene.children);
    current.invalidate();
    const geometries = new Set(previous.meshes.map(mesh => mesh.geometry));
    disposeAll([() => previous.composite?.dispose(), () => previous.nodes?.dispose(), () => previous.edges?.dispose(), () => previous.decorations?.dispose(),
      ...previous.meshes.flatMap(mesh => [() => mesh.removeFromParent(), () => (mesh.material as MeshBasicMaterial).dispose(), () => mesh.dispose()]),
      ...[...geometries].map(geometry => () => geometry.dispose())]);
  };
  const build = () => {
    if (data?.spatialAppearance) {
      const custom = graphSpatialNodeMeshData(data.spatialAppearance);
      if (custom) preflightGraphSpatialMeshes(data.nodeCount, spatialPrimitiveCount({ ...data, spatialAppearance: data.spatialAppearance }), custom);
    }
    if (viewport && data?.spatialAppearance && graphSpatialNodeMeshData(data.spatialAppearance)) {
      const current = viewport, next = data, prepared = preparePresentation(current, next, positions, () => !disposed && viewport === current && data === next);
      if (!prepared) { if (!disposed && viewport === current && data === next) throw abortPresentation(); return; }
      prepared.owner.published = true;
      try { attachPresentation(current, prepared); } catch { failPublication(current); }
      finally { prepared.releaseOwner(); }
      return;
    }
    clear();
    if (!viewport || !data) return;
    if (data.spatialAppearance) {
      const spatialData = { ...data, spatialAppearance: data.spatialAppearance };
      const custom = graphSpatialNodeMeshData(data.spatialAppearance);
      spatialNodes = createGraphSpatialNodes(spatialData, custom); spatialEdges = createGraphSpatialEdges(spatialData);
      spatialNodes.pick.renderOrder = 1;
      spatialComposite = createGraphSpatialComposite(spatialNodes, spatialEdges, custom);
      viewport.world.add(spatialComposite.mesh); viewport.pickWorld.add(spatialEdges.pick, spatialNodes.pick);
      if (spatialComposite.customPick) { spatialComposite.customPick.renderOrder = 1; viewport.pickWorld.add(spatialComposite.customPick); }
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
    refuseNestedPresentation();
    if (!data?.spatialAppearance) throw new Error('Graph appearance requires spatial data');
    const previousData = data, previousViewport = viewport, previousGeneration = presentationGeneration;
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
    const currentTransaction = () => !disposed && data === previousData && viewport === previousViewport && presentationGeneration === previousGeneration;
    let spatialAppearance: GraphSpatialAppearance;
    try { spatialAppearance = admitGraphSpatialAppearance(merged.spatialAppearance, previousData.nodeCount, previousData.source.length, currentTransaction); }
    catch (error) { if (!currentTransaction()) return; throw error; }
    const next = { ...merged, ...admitGraphDecorations(merged, previousData.nodeCount, previousData.source.length), spatialAppearance };
    validateGraphSpatialSizes(next.sizes, next.nodeCount, spatialAppearance);
    const edgePrimitives = spatialPrimitiveCount(next), custom = graphSpatialNodeMeshData(spatialAppearance);
    if (custom) preflightGraphSpatialMeshes(next.nodeCount, edgePrimitives, custom);
    if (spatialAppearance.dangling) for (let edge = 0; edge < next.source.length; edge++) if (spatialAppearance.dangling[edge] && next.source[edge] !== next.target[edge]) throw new RangeError('Dangling layout endpoints must share the source row');
    if (disposed || data !== previousData || viewport !== previousViewport) return;
    if (!viewport) { data = next; return; }
    const current = viewport;
    const prepared = preparePresentation(current, next, positions, currentTransaction);
    if (!prepared) return;
    if (!currentTransaction()) { prepared.dispose(); return; }
    prepared.owner.published = true;
    data = next;
    try { attachPresentation(current, prepared); }
    catch { failPublication(current); }
    finally { prepared.releaseOwner(); }
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
  function disposeEngine(): void {
    if (disposed) return;
    disposed = true; presentationGeneration++; if (presentationOwner) presentationOwner.cancelled = true;
    const current = viewport, previousDetach = detach, previousFrame = unframe;
    viewport = undefined; detach = undefined; unframe = undefined; host = undefined; data = undefined;
    positions = new Float32Array(); pins = new Uint8Array();
    disposeAll([stop, () => previousDetach?.(), () => previousFrame?.(), clear, () => current?.dispose()]);
  }
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
      }); detach = attachDrag(current); build();
      if (glowRequested) await current.setGlow(true);
      if (disposed || viewport !== current) return;
      start();
    },
    setData(input, nextRevision) {
      if (disposed) return;
      refuseNestedPresentation();
      const previousData = data, previousViewport = viewport, previousRevision = revision, previousGeneration = presentationGeneration;
      const currentTransaction = () => !disposed && data === previousData && viewport === previousViewport && revision === previousRevision && presentationGeneration === previousGeneration;
      if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Graph revision must increase');
      validateGraphLayoutInput(input);
      if (!currentTransaction()) return;
      if (input.positions && !renderablePositions(input.positions)) throw new RangeError('Graph positions exceed the supported world range');
      const decorationData = admitGraphDecorations(input, input.nodeCount, input.source.length);
      if (!currentTransaction()) return;
      let spatialAppearance: GraphSpatialAppearance | undefined;
      try { spatialAppearance = input.spatialAppearance === undefined ? undefined : admitGraphSpatialAppearance(input.spatialAppearance, input.nodeCount, input.source.length, currentTransaction); }
      catch (error) { if (!currentTransaction()) return; throw error; }
      if (!currentTransaction()) return;
      if (spatialAppearance) validateGraphSpatialSizes(input.sizes, input.nodeCount, spatialAppearance);
      if (spatialAppearance) {
        const edgePrimitives = spatialPrimitiveCount({ ...input, directed: decorationData.directed, spatialAppearance });
        const custom = graphSpatialNodeMeshData(spatialAppearance);
        if (custom) preflightGraphSpatialMeshes(input.nodeCount, edgePrimitives, custom);
      }
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
      const nextData: GraphEngineData = { ...input, ...decorationData, spatialAppearance, source: input.source.slice(), target: input.target.slice(), options: { ...input.options }, sizes: input.sizes?.slice(), categories: input.categories?.slice() };
      const nextPins = input.pinned?.slice() ?? new Uint8Array(input.nodeCount).fill(input.positions ? 1 : 0);
      if (!currentTransaction()) return;
      const needsStaging = viewport && (spatialAppearance?.nodeMeshes || previousData?.spatialAppearance?.nodeMeshes);
      const prepared = needsStaging ? preparePresentation(viewport!, nextData, nextPositions, currentTransaction, nextPins) : undefined;
      if (!currentTransaction() || (needsStaging && !prepared)) { prepared?.dispose(); return; }
      if (prepared) {
        const current = viewport!, previousDetach = detach, previousTask = task;
        detach = undefined; task = undefined; generation++;
        prepared.owner.published = true;
        revision = nextRevision; data = nextData; positions = nextPositions; pins = nextPins; positionRevision++;
        let failed = false;
        try {
          // New ownership is reachable by dispose before any retired-owner callback runs.
          try { attachPresentation(current, prepared); } catch { failed = true; }
          try { previousDetach?.(); } catch { failed = true; }
          try { previousTask?.stop(); } catch { failed = true; }
          if (!failed && !disposed && viewport === current && data === nextData) {
            try { detach = attachDrag(current); start(); } catch { failed = true; }
          }
        } finally { prepared.releaseOwner(); }
        if (failed) failPublication(current);
        return;
      }
      const previousDetach = detach; detach = undefined; previousDetach?.();
      if (!currentTransaction()) return;
      stop();
      if (!currentTransaction()) return;
      revision = nextRevision;
      data = nextData;
      positionRevision += 1;
      positions = nextPositions; pins = nextPins;
      build();
      if (viewport) detach = attachDrag(viewport); start();
    },
    setStyle(next) { if (!disposed) { style = next; viewport?.setStyle(next); transforms(); paint(); } },
    setState(next) {
      if (disposed) return;
      const update = snapshotVisualState(next, state, data ? data.nodeCount + data.source.length : 0);
      if (!update.changed) return;
      state = update.state; paint(update.rows);
    },
    setCamera(next) { if (!disposed) { camera = normalizeOrbitCamera(next); viewport?.setOrbit(camera); } },
    fit(padding) {
      let bounds = boundsOfPositions(positions, data?.spatialAppearance?.sizeUnits === 'world' ? Array.from({ length: data.nodeCount }, (_, row) => (data?.sizes?.[row] ?? viewport?.style.pointSize ?? 6) / 2) : undefined);
      let curved = false;
      const appearance = data?.spatialAppearance;
      if (data && bounds && appearance?.edgeCurvatures) {
        for (let edge = 0; edge < data.source.length; edge++) {
          const curvature = appearance.edgeCurvatures[edge] ?? 0;
          if (!curvature || appearance.dangling?.[edge] || data.source[edge] === data.target[edge]) continue;
          const a = positionOf(data.source[edge]!), b = positionOf(data.target[edge]!);
          if (!a || !b) continue;
          curved = true;
          for (const point of spatialCurveExtrema(a, b, curvature)) {
            bounds = {
              min: { x: Math.min(bounds.min.x, point.x), y: Math.min(bounds.min.y, point.y), z: Math.min(bounds.min.z, point.z) },
              max: { x: Math.max(bounds.max.x, point.x), y: Math.max(bounds.max.y, point.y), z: Math.max(bounds.max.z, point.z) },
            };
          }
        }
      }
      const size = viewport ?? { width: 1, height: 1 };
      camera = curved ? fitOrbitCamera(bounds, size, padding, undefined, { preserveDerivedBounds: true }) : fitOrbitCamera(bounds, size, padding);
      fittedDistance = camera.distance; viewport?.setOrbit(camera); return camera;
    },
    focus(item, zoom) { const point = positionOf(item); if (!point) return null; camera = focusOrbitCamera(viewport?.orbit ?? camera, point, zoom); viewport?.setOrbit(camera); return camera; },
    pick: (x, y) => viewport?.pickAt(x, y) ?? null,
    project(item) { const point = positionOf(item); return point ? viewport?.project(point) ?? null : null; },
    positionOf,
    setPins,
    setAppearance,
    setNodeMeshes(meshes) {
      if (disposed) return;
      if (!data?.spatialAppearance) throw new Error('Graph node meshes require spatial data');
      setAppearance({ spatialAppearance: { ...data.spatialAppearance, nodeMeshes: meshes } });
    },
    async setGlow(enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('Glow must be a boolean');
      if (disposed) return;
      glowRequested = enabled;
      await viewport?.setGlow(enabled);
    },
    resize(width, height) { viewport?.resize(width, height); },
    dispose: disposeEngine,
  };
}
