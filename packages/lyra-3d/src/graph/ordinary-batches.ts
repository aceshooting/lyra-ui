import { Color, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Sphere, SphereGeometry, Vector3 } from 'three';
import type { Lyra3dState } from '../core/contract.js';
import { disposeAll } from '../core/dispose.js';
import { markAttributeFull, markAttributeRows } from '../core/attribute-updates.js';
import { projectOrbitPoint } from '../core/orbit.js';
import { createPaintColors, type PaintColors } from '../core/paint-colors.js';
import { createPickColors, createPickMaterial, encodePickId } from '../core/picking.js';
import type { ResolvedLyra3dStyle } from '../core/style.js';
import type { Lyra3dViewport } from '../core/viewport.js';
import type { VisualStateRows } from '../core/visual-state.js';
import type { GraphPreparedDataColumns } from './data-preparation.js';
import { graphItemColor } from './decorations.js';

export type GraphOrdinaryView = Pick<Lyra3dViewport, 'width' | 'height' | 'orbit' | 'style'>;
export interface GraphOrdinaryPresentation extends GraphOrdinaryView {
  readonly state: Lyra3dState;
  readonly revision: number;
}
/** Native owners only; columns, state and viewports never enter a retirement record. */
export interface GraphOrdinaryResources {
  readonly nodes: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  readonly nodePick: InstancedMesh<SphereGeometry, MeshBasicMaterial>;
  readonly edges: InstancedMesh<CylinderGeometry, MeshBasicMaterial>;
  readonly edgePick: InstancedMesh<CylinderGeometry, MeshBasicMaterial>;
  nodeSubmitted: boolean;
  nodePickSubmitted: boolean;
  edgeSubmitted: boolean;
  edgePickSubmitted: boolean;
  disposed: boolean;
}
export interface GraphOrdinaryBatch {
  updateTransforms(view: GraphOrdinaryView, positions: Float32Array, revision: number): void;
  paint(style: ResolvedLyra3dStyle, state: Lyra3dState, rows?: VisualStateRows): void;
  allocationBuffers(): readonly ArrayBufferLike[];
  quiesce(): void;
  dispose(): void;
}
export interface GraphPreparedOrdinaryBatch {
  readonly batch: GraphOrdinaryBatch;
  readonly resources: GraphOrdinaryResources;
  readonly ownedBuffers: readonly ArrayBufferLike[];
  readonly borrowedBuffers: readonly ArrayBufferLike[];
  readonly storage: { readonly cpuBytes: number; readonly gpuAttributeBytes: number };
}
export interface GraphOrdinaryBatchWorkStep {
  readonly done: boolean;
  readonly operations: number;
  readonly allocatedBytes: number;
  readonly initializedNodes: number;
  readonly initializedEdges: number;
  readonly boundedInstances: number;
  readonly value?: GraphPreparedOrdinaryBatch;
}
export interface GraphOrdinaryBatchWork { step(maxOperations: number): GraphOrdinaryBatchWorkStep; dispose(): void; }

type OrdinaryGeometry = SphereGeometry | CylinderGeometry;
type OrdinaryMesh = InstancedMesh<OrdinaryGeometry, MeshBasicMaterial>;
type OrdinaryProjection = GraphOrdinaryView & Pick<Lyra3dViewport, 'project'>;
type OrdinaryColumns = Pick<GraphPreparedDataColumns, 'nodeCount' | 'source' | 'target' | 'sizes' | 'categories'>;
type SubmittedFlag = 'nodeSubmitted' | 'nodePickSubmitted' | 'edgeSubmitted' | 'edgePickSubmitted';
function ordinaryColumns(data: OrdinaryColumns): OrdinaryColumns {
  return { nodeCount: data.nodeCount, source: data.source, target: data.target, sizes: data.sizes, categories: data.categories };
}
function ordinaryProjection(view: GraphOrdinaryView): OrdinaryProjection {
  const { width, height, orbit, style } = view;
  return { width, height, orbit, style, project: point => projectOrbitPoint(point, orbit, { width, height }) };
}
function resourceMeshes(resources: GraphOrdinaryResources): OrdinaryMesh[] {
  return [resources.nodes, resources.nodePick, resources.edges, resources.edgePick];
}
function ordinaryBuffers(meshes: readonly OrdinaryMesh[]): ArrayBufferLike[] {
  const buffers = new Set<ArrayBufferLike>();
  for (const mesh of meshes) {
    for (const attribute of Object.values(mesh.geometry.attributes)) buffers.add(attribute.array.buffer);
    if (mesh.geometry.index) buffers.add(mesh.geometry.index.array.buffer);
    buffers.add(mesh.instanceMatrix.array.buffer);
    if (mesh.instanceColor) buffers.add(mesh.instanceColor.array.buffer);
  }
  return [...buffers];
}
function ordinaryResources(meshes: readonly OrdinaryMesh[]): GraphOrdinaryResources {
  return { nodes: meshes[0] as GraphOrdinaryResources['nodes'], nodePick: meshes[1] as GraphOrdinaryResources['nodePick'],
    edges: meshes[2] as GraphOrdinaryResources['edges'], edgePick: meshes[3] as GraphOrdinaryResources['edgePick'],
    nodeSubmitted: false, nodePickSubmitted: false, edgeSubmitted: false, edgePickSubmitted: false, disposed: false };
}
/** Attempts all native releases, even when parent removal or a disposal listener throws. */
export function disposeGraphOrdinaryResources(resources: GraphOrdinaryResources): void {
  if (resources.disposed) return;
  resources.disposed = true;
  disposeAll([...resourceMeshes(resources).flatMap(mesh => [() => mesh.removeFromParent(), () => mesh.material.dispose(), () => mesh.dispose()]),
    () => resources.nodes.geometry.dispose(), () => resources.edges.geometry.dispose()]);
}
function submitted(resources: GraphOrdinaryResources, flag: SubmittedFlag): () => void {
  return () => { resources[flag] = true; };
}
function prepareBounds(resources: GraphOrdinaryResources): void {
  const flags: SubmittedFlag[] = ['nodeSubmitted', 'nodePickSubmitted', 'edgeSubmitted', 'edgePickSubmitted'];
  for (const [index, mesh] of resourceMeshes(resources).entries()) {
    mesh.boundingSphere = new Sphere().makeEmpty(); mesh.onBeforeRender = submitted(resources, flags[index]!);
  }
}

/** Shared scalar kernels for legacy initialization, live updates and detached row work. */
function createOrdinaryController(data: OrdinaryColumns, meshes: readonly OrdinaryMesh[], resources?: GraphOrdinaryResources) {
  let columns: OrdinaryColumns | undefined = ordinaryColumns(data);
  data = undefined as never;
  const color = new Color(), matrix = new Matrix4(), point = new Vector3(), scale = new Vector3();
  const rotation = new Quaternion(), direction = new Vector3(), up = new Vector3(0, 1, 0), bound = new Sphere();
  let lastTransforms = '', lastStyle: ResolvedLyra3dStyle | undefined;
  const key = (view: GraphOrdinaryView, revision: number) => {
    const orbit = view.orbit;
    return [revision, view.width, view.height, orbit.yaw, orbit.pitch, orbit.distance, orbit.target.x, orbit.target.y, orbit.target.z].join('|');
  };
  const writeRow = (kind: number, row: number, view: OrdinaryProjection, positions: Float32Array) => {
    const data = columns!, index = kind === 0 ? row : data.source[row]!;
    const a = { x: positions[index * 3]!, y: positions[index * 3 + 1]!, z: positions[index * 3 + 2]! };
    if (kind === 0) {
      point.set(a.x, a.y, a.z); rotation.identity();
      const projection = view.project(a);
      const radius = projection ? (data.sizes?.[row] ?? view.style.pointSize) / (2 * projection.scale) : 0;
      scale.setScalar(radius);
    } else {
      const target = data.target[row]!, b = { x: positions[target * 3]!, y: positions[target * 3 + 1]!, z: positions[target * 3 + 2]! };
      point.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const length = direction.length();
      rotation.setFromUnitVectors(up, length ? direction.divideScalar(length) : up);
      const projection = view.project(point), radius = projection ? view.style.lineWidth / (2 * projection.scale) : 0;
      scale.set(radius, length, radius);
    }
    matrix.compose(point, rotation, scale);
    meshes[kind * 2]!.setMatrixAt(row, matrix); meshes[kind * 2 + 1]!.setMatrixAt(row, matrix);
  };
  const paintRow = (kind: number, row: number, style: ResolvedLyra3dStyle, state: Lyra3dState, paintColor?: PaintColors) => {
    const data = columns!, item = kind === 0 ? row : data.nodeCount + row;
    const base = kind === 0 ? style.palette[(data.categories?.[row] ?? 0) % style.palette.length]! : style.muted;
    meshes[kind * 2]!.setColorAt(row, graphItemColor(style, state, item, base, color, paintColor));
  };
  const pickRow = (kind: number, row: number, colors?: Float32Array) => {
    const item = kind === 0 ? row : columns!.nodeCount + row;
    if (colors) color.setRGB(colors[item * 3]!, colors[item * 3 + 1]!, colors[item * 3 + 2]!);
    else { const rgb = encodePickId(item)!; color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); }
    meshes[kind * 2 + 1]!.setColorAt(row, color);
  };
  const boundRow = (mesh: OrdinaryMesh, row: number) => {
    matrix.fromArray(mesh.instanceMatrix.array, row * 16);
    bound.copy(mesh.geometry.boundingSphere!).applyMatrix4(matrix); mesh.boundingSphere!.union(bound);
  };
  return {
    writeRow, paintRow, pickRow, boundRow,
    seed(view: GraphOrdinaryView, revision: number) { lastTransforms = key(view, revision); lastStyle = view.style; },
    quiesce() { columns = undefined; lastTransforms = ''; lastStyle = undefined; },
    updateTransforms(view: OrdinaryProjection, positions: Float32Array, revision: number) {
      if (!columns || resources?.disposed) return;
      const currentKey = key(view, revision);
      if (lastTransforms === currentKey && lastStyle === view.style) return;
      lastTransforms = currentKey; lastStyle = view.style;
      const flags: SubmittedFlag[] = ['nodeSubmitted', 'nodePickSubmitted', 'edgeSubmitted', 'edgePickSubmitted'];
      for (let kind = 0; kind < 2; kind++) {
        const mesh = meshes[kind * 2]!, pick = meshes[kind * 2 + 1]!;
        const visualBounds = resources && !resources[flags[kind * 2]!], pickBounds = resources && !resources[flags[kind * 2 + 1]!];
        if (visualBounds) mesh.boundingSphere!.makeEmpty();
        if (pickBounds) pick.boundingSphere!.makeEmpty();
        for (let row = 0; row < mesh.count; row++) {
          writeRow(kind, row, view, positions);
          if (visualBounds) boundRow(mesh, row);
          if (pickBounds) boundRow(pick, row);
        }
        mesh.instanceMatrix.needsUpdate = true; pick.instanceMatrix.needsUpdate = true;
      }
    },
    paint(style: ResolvedLyra3dStyle, state: Lyra3dState, rows?: VisualStateRows) {
      if (!columns || resources?.disposed) return;
      const paintColor = createPaintColors(style);
      for (let kind = 0; kind < 2; kind++) {
        const mesh = meshes[kind * 2]!, changed: number[] = [];
        if (rows === undefined || rows === null) for (let row = 0; row < mesh.count; row++) paintRow(kind, row, style, state, paintColor);
        else for (const item of rows) {
          const row = kind === 0 ? item : item - columns.nodeCount;
          if (row < 0 || row >= mesh.count) continue;
          paintRow(kind, row, style, state, paintColor); changed.push(row);
        }
        if (mesh.instanceColor) {
          if (rows === undefined || rows === null) markAttributeFull(mesh.instanceColor);
          else markAttributeRows(mesh.instanceColor, changed);
        }
      }
    },
  };
}
type OrdinaryController = ReturnType<typeof createOrdinaryController>;
function preparedBatch(resources: GraphOrdinaryResources, controller: OrdinaryController): GraphOrdinaryBatch {
  let active = true;
  return {
    updateTransforms(view, positions, revision) { if (active && !resources.disposed) controller.updateTransforms(ordinaryProjection(view), positions, revision); },
    paint: controller.paint,
    allocationBuffers() { return ordinaryBuffers(resourceMeshes(resources)); },
    quiesce() { active = false; controller.quiesce(); },
    dispose() { active = false; controller.quiesce(); disposeGraphOrdinaryResources(resources); },
  };
}
interface OrdinaryAssembly {
  geometries: OrdinaryGeometry[];
  materials: MeshBasicMaterial[];
  meshes: OrdinaryMesh[];
  resources?: GraphOrdinaryResources;
  controller?: OrdinaryController;
}
function retireAssembly(owner: OrdinaryAssembly): void {
  const { resources, geometries, materials, meshes, controller } = owner;
  owner.resources = undefined; owner.geometries = []; owner.materials = []; owner.meshes = []; owner.controller = undefined;
  controller?.quiesce();
  if (resources) disposeGraphOrdinaryResources(resources);
  else disposeAll([...meshes.flatMap(mesh => [() => mesh.removeFromParent(), () => mesh.material.dispose(), () => mesh.dispose()]),
    ...materials.filter(material => !meshes.some(mesh => mesh.material === material)).map(material => () => material.dispose()),
    ...geometries.map(geometry => () => geometry.dispose())]);
}

/** An inert owner must be published before initializeLive can dispatch any Three add event. */
export function createGraphOrdinaryBatch(viewport: Lyra3dViewport, data: OrdinaryColumns): GraphOrdinaryBatch & {
  readonly meshes: OrdinaryMesh[];
  initializeLive(): void;
  initializeStaging(positions: Float32Array, state: Lyra3dState): void;
} {
  let columns: OrdinaryColumns | undefined = ordinaryColumns(data);
  const owner: OrdinaryAssembly = { geometries: [], materials: [], meshes: [] };
  let current: Lyra3dViewport | undefined = viewport;
  viewport = undefined as never; data = undefined as never;
  let closed = false, running = false, initialized = false, atLiveAdd = false;
  owner.controller = createOrdinaryController(columns, owner.meshes);
  const checkpoint = () => { if (closed) throw new DOMException('Graph ordinary initialization was closed', 'AbortError'); };
  const dispose = () => {
    closed = true;
    // A constructor must return its handle before retirement. An add event already has a
    // registered pair, so synchronous engine disposal must release it before that event returns.
    if (running && !atLiveAdd) return;
    columns = undefined; current = undefined; retireAssembly(owner);
  };
  const initialize = (positions?: Float32Array, state?: Lyra3dState) => {
    if (closed || running || initialized) throw new DOMException('Graph ordinary initialization is closed or running', 'InvalidStateError');
    running = true;
    try {
      const view = current!, input = columns!, controller = owner.controller!, colors = createPickColors(input.nodeCount + input.source.length);
      const paintColor = positions ? createPaintColors(view.style) : undefined;
      for (let kind = 0; kind < 2; kind++) {
        owner.geometries.push(kind === 0 ? new SphereGeometry(1, 8, 6) : new CylinderGeometry(1, 1, 1, 6)); checkpoint();
        const geometry = owner.geometries[kind]!, count = kind === 0 ? input.nodeCount : input.source.length;
        owner.materials.push(new MeshBasicMaterial()); checkpoint();
        const mesh = new InstancedMesh(geometry, owner.materials[kind * 2]!, count); owner.meshes.push(mesh); checkpoint();
        owner.materials.push(createPickMaterial()); checkpoint();
        const pick = new InstancedMesh(geometry, owner.materials[kind * 2 + 1]!, count); owner.meshes.push(pick); checkpoint();
        mesh.frustumCulled = pick.frustumCulled = false;
        for (let row = 0; row < count; row++) {
          if (positions) controller.writeRow(kind, row, view, positions);
          controller.pickRow(kind, row, colors);
          if (positions) controller.paintRow(kind, row, view.style, state!, paintColor);
          checkpoint();
        }
        if (!positions) {
          atLiveAdd = true;
          try { view.world.add(mesh); } finally { atLiveAdd = false; }
          checkpoint(); atLiveAdd = true;
          try { view.pickWorld.add(pick); } finally { atLiveAdd = false; }
          checkpoint();
        }
      }
      owner.resources = ordinaryResources(owner.meshes); initialized = true;
    } catch (error) {
      running = false;
      try { dispose(); } catch { /* Preserve construction failure after attempting all native releases. */ }
      throw error;
    } finally { running = false; }
  };
  return {
    meshes: owner.meshes,
    initializeLive() { initialize(); },
    initializeStaging(positions, state) { initialize(positions, state); },
    updateTransforms(view, positions, revision) {
      if (closed || !initialized || !current) return;
      const viewport = current;
      owner.controller!.updateTransforms({ width: view.width, height: view.height, orbit: view.orbit, style: view.style,
        project: point => viewport.project(point) }, positions, revision);
    },
    paint(style, state, rows) { if (!closed && initialized) owner.controller!.paint(style, state, rows); },
    allocationBuffers() { return ordinaryBuffers(owner.meshes); },
    quiesce() { closed = true; columns = undefined; current = undefined; owner.controller?.quiesce(); },
    dispose,
  };
}

interface OrdinaryWorkOwner extends OrdinaryAssembly {
  data: OrdinaryColumns;
  positions: Float32Array;
  view: OrdinaryProjection;
  state: Lyra3dState;
  revision: number;
}
function workOwner(data: GraphPreparedDataColumns, presentation: GraphOrdinaryPresentation): OrdinaryWorkOwner {
  return { data: ordinaryColumns(data), positions: data.positions, view: ordinaryProjection(presentation), state: presentation.state,
    revision: presentation.revision, geometries: [], materials: [], meshes: [] };
}
function constructNative(owner: OrdinaryAssembly, stage: number): number {
  if (stage < 2) {
    owner.geometries.push(stage === 0 ? new SphereGeometry(1, 8, 6) : new CylinderGeometry(1, 1, 1, 6));
    return stage === 0 ? 2496 : 1424;
  }
  if (stage < 6) owner.materials.push(stage % 2 === 0 ? new MeshBasicMaterial() : createPickMaterial());
  else {
    const index = stage - 6, mesh = new InstancedMesh(owner.geometries[Math.floor(index / 2)]!, owner.materials[index]!, 0);
    owner.meshes.push(mesh); mesh.frustumCulled = false;
    if (index === 3) owner.resources = ordinaryResources(owner.meshes);
  }
  return 0;
}
function preparedResult(owner: OrdinaryWorkOwner): GraphPreparedOrdinaryBatch {
  const resources = owner.resources!, ownedBuffers = ordinaryBuffers(owner.meshes), data = owner.data;
  const borrowed = [owner.positions, data.source, data.target, data.sizes, data.categories];
  const borrowedBuffers = [...new Set(borrowed.filter((array): array is Float32Array | Uint32Array | Uint16Array => array !== undefined).map(array => array.buffer))];
  const bytes = ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  return { batch: preparedBatch(resources, owner.controller!), resources, ownedBuffers, borrowedBuffers,
    storage: { cpuBytes: bytes, gpuAttributeBytes: bytes } };
}
type OrdinaryPhase = 'setup' | 'native' | 'matrices' | 'colors' | 'geometry-bounds' | 'nodes' | 'edges' | 'node-bounds' | 'edge-bounds' | 'finish';

/** Each operation performs fixed native work, allocates one backing, or visits one instance. */
export function createGraphOrdinaryBatchWork(data: GraphPreparedDataColumns, presentation: GraphOrdinaryPresentation,
  isCurrent?: () => boolean): GraphOrdinaryBatchWork {
  const state: { input?: GraphPreparedDataColumns; presentation?: GraphOrdinaryPresentation; guard?: () => boolean;
    active: boolean; owner?: OrdinaryWorkOwner; phase: OrdinaryPhase; row: number } = {
    input: data, presentation, guard: isCurrent, active: true, phase: 'setup', row: 0,
  };
  data = undefined as never; presentation = undefined as never; isCurrent = undefined;
  let running = false;
  const checkpoint = () => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) throw new DOMException('Graph ordinary preparation was superseded', 'AbortError');
  };
  const releaseInputs = () => { state.active = false; state.input = undefined; state.presentation = undefined; state.guard = undefined; };
  const close = () => {
    releaseInputs();
    if (running) return;
    const owner = state.owner; state.owner = undefined;
    if (owner) retireAssembly(owner);
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph ordinary preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph ordinary preparation budget');
      const result = { done: false, operations: 0, allocatedBytes: 0, initializedNodes: 0, initializedEdges: 0, boundedInstances: 0 };
      running = true;
      try {
        while (result.operations < maxOperations) {
          checkpoint();
          const owner = state.owner;
          switch (state.phase) {
            case 'setup':
              state.owner = workOwner(state.input!, state.presentation!); state.input = undefined; state.presentation = undefined;
              state.phase = 'native'; break;
            case 'native':
              if (state.row === 10) { state.phase = 'matrices'; state.row = 0; continue; }
              result.allocatedBytes += constructNative(owner!, state.row++); break;
            case 'matrices': {
              if (state.row === 4) { state.phase = 'colors'; state.row = 0; continue; }
              const index = state.row++, mesh = owner!.meshes[index]!, count = index < 2 ? owner!.data.nodeCount : owner!.data.source.length;
              const array = new Float32Array(count * 16); mesh.instanceMatrix = new InstancedBufferAttribute(array, 16); mesh.count = count;
              result.allocatedBytes += array.byteLength; break;
            }
            case 'colors': {
              if (state.row === 4) { state.phase = 'geometry-bounds'; state.row = 0; continue; }
              const mesh = owner!.meshes[state.row++]!;
              if (!mesh.count) continue;
              const array = new Float32Array(mesh.count * 3); mesh.instanceColor = new InstancedBufferAttribute(array, 3);
              result.allocatedBytes += array.byteLength; break;
            }
            case 'geometry-bounds':
              owner!.geometries[state.row++]!.computeBoundingSphere(); checkpoint();
              if (state.row === 2) {
                prepareBounds(owner!.resources!);
                owner!.controller = createOrdinaryController(owner!.data, owner!.meshes, owner!.resources);
                state.phase = 'nodes'; state.row = 0;
              }
              break;
            case 'nodes':
            case 'edges': {
              const kind = state.phase === 'nodes' ? 0 : 1, count = kind === 0 ? owner!.data.nodeCount : owner!.data.source.length;
              if (state.row === count) { state.phase = kind === 0 ? 'edges' : 'node-bounds'; state.row = 0; continue; }
              const row = state.row++, controller = owner!.controller!;
              controller.writeRow(kind, row, owner!.view, owner!.positions);
              controller.paintRow(kind, row, owner!.view.style, owner!.state); controller.pickRow(kind, row);
              if (kind === 0) result.initializedNodes++; else result.initializedEdges++;
              break;
            }
            case 'node-bounds':
            case 'edge-bounds': {
              const kind = state.phase === 'node-bounds' ? 0 : 1, mesh = owner!.meshes[kind * 2]!;
              if (state.row === mesh.count) { state.phase = kind === 0 ? 'edge-bounds' : 'finish'; state.row = 0; continue; }
              owner!.controller!.boundRow(mesh, state.row++); result.boundedInstances++; break;
            }
            case 'finish': {
              const resources = owner!.resources!;
              resources.nodePick.boundingSphere!.copy(resources.nodes.boundingSphere!); resources.edgePick.boundingSphere!.copy(resources.edges.boundingSphere!);
              for (const mesh of owner!.meshes) mesh.instanceMatrix.needsUpdate = true;
              if (resources.nodes.instanceColor) markAttributeFull(resources.nodes.instanceColor);
              if (resources.edges.instanceColor) markAttributeFull(resources.edges.instanceColor);
              owner!.controller!.seed(owner!.view, owner!.revision);
              const value = preparedResult(owner!);
              checkpoint(); state.owner = undefined; releaseInputs();
              return { ...result, done: true, operations: result.operations + 1, value };
            }
          }
          result.operations++; checkpoint();
        }
        return result;
      } catch (error) {
        running = false;
        try { close(); } catch { /* Preserve the originating failure after attempting every native release. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
