import { Group, InstancedMesh, type BufferAttribute, type BufferGeometry, type Material, type Mesh, type Texture, type Vector2, type Vector4 } from 'three';
import { fitOrbitCamera, type Lyra3dOrbitCamera } from '../core/orbit.js';
import type { GraphPreparedData } from './data-preparation.js';
import { createGraphSceneFactsWork, type GraphSceneFacts } from './scene-facts-work.js';
import { commitGraphPresentationSwap, createGraphPresentationRoots, createGraphPresentationSlots, prepareGraphPresentationSwap,
  type GraphPresentationRootSet, type GraphPresentationSlots, type GraphPresentationSwap } from './presentation-roots.js';
import { createGraphOrdinaryBatchWork, disposeGraphOrdinaryResources, type GraphPreparedOrdinaryBatch, type GraphOrdinaryResources } from './ordinary-batches.js';
import { createGraphSpatialNodesWork, disposeGraphSpatialNodeResources, type GraphPreparedSpatialNodes, type GraphSpatialNodeResources } from './spatial-nodes.js';
import { createGraphSpatialEdgesWork, disposeGraphSpatialEdgeResources, type GraphPreparedSpatialEdges, type GraphSpatialEdgeResources } from './spatial-edges.js';
import { createGraphSpatialCompositeWork, disposeGraphSpatialCompositeResources, preflightGraphSpatialMeshes,
  type GraphPreparedSpatialComposite, type GraphSpatialCompositeResources } from './spatial-composite.js';
import { createGraphDecorationsWork, disposeGraphDecorationResources, type GraphPreparedDecorations, type GraphDecorationResources } from './decorations.js';
import { graphSpatialNodeMeshData } from './spatial-appearance.js';
import { graphSpatialView } from './spatial-paths.js';
import type { Lyra3dState } from '../core/contract.js';
import { parseCssColor, resolveLyra3dStyle, type Lyra3dRgba, type ResolvedLyra3dStyle } from '../core/style.js';

export interface GraphPresentationSnapshotInput {
  readonly presentation?: unknown;
  readonly inheritedStyle: ResolvedLyra3dStyle;
  readonly inheritedState: Lyra3dState;
}
export interface GraphPresentationSnapshot {
  readonly style: ResolvedLyra3dStyle;
  readonly state: Lyra3dState;
  readonly inheritsStyle: boolean;
  readonly inheritsState: boolean;
}
export interface GraphPresentationSnapshotStep {
  readonly done: boolean;
  readonly operations: number;
  readonly visitedPaletteEntries: number;
  readonly copiedStateEntries: number;
  readonly value?: GraphPresentationSnapshot;
}
export interface GraphPresentationSnapshotWork {
  step(maxOperations: number): GraphPresentationSnapshotStep;
  dispose(): void;
}

const STYLE_FIELDS = ['palette', 'fontFamily', 'background', 'foreground', 'muted', 'accent', 'focus',
  'fontSize', 'pointSize', 'lineWidth', 'devicePixelRatio', 'reducedMotion', 'forcedColors'] as const;
const STATE_FIELDS = ['selected', 'dimmed', 'hover', 'focus'] as const;
type SnapshotPhase = 'setup' | 'presentation' | 'style' | 'palette-header' | 'palette' | 'resolve'
  | 'style-finish' | 'state' | 'open' | 'advance' | 'finish';
interface SnapshotState {
  input: GraphPresentationSnapshotInput | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  phase: SnapshotPhase;
  row: number;
  presentation: object | undefined;
  rawStyle: unknown;
  rawState: object | undefined;
  inheritsStyle: boolean;
  inheritsState: boolean;
  styleFields: Partial<Record<typeof STYLE_FIELDS[number], unknown>> | undefined;
  stateFields: Partial<Record<typeof STATE_FIELDS[number], unknown>> | undefined;
  paletteSource: unknown[] | undefined;
  paletteLength: number;
  palette: Lyra3dRgba[] | undefined;
  style: ResolvedLyra3dStyle | undefined;
  selected: Set<number> | undefined;
  dimmed: Set<number> | undefined;
  collection: 0 | 1;
  iterator: object | undefined;
  next: ((...args: unknown[]) => unknown) | undefined;
  add: ((...args: unknown[]) => unknown) | undefined;
}

function objectLike(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function invalidStateValue(): TypeError { return new TypeError('Invalid graph presentation state'); }

/**
 * Owns prospective style and numeric row state without publishing either. Inputs stay unchanged
 * while borrowed. Palette positions and iterator advances are individually budgeted; string
 * parsing and native iterator calls remain indivisible. Completion transfers the owned snapshot.
 */
export function createGraphPresentationSnapshotWork(input: GraphPresentationSnapshotInput, isCurrent?: () => boolean): GraphPresentationSnapshotWork {
  const state: SnapshotState = {
    input, guard: isCurrent, active: true, phase: 'setup', row: 0, presentation: undefined,
    rawStyle: undefined, rawState: undefined, inheritsStyle: true, inheritsState: true,
    styleFields: undefined, stateFields: undefined, paletteSource: undefined, paletteLength: 0,
    palette: undefined, style: undefined, selected: undefined, dimmed: undefined, collection: 0,
    iterator: undefined, next: undefined, add: undefined,
  };
  input = undefined as never; isCurrent = undefined;
  let running = false;

  const dropIterator = (): void => { state.iterator = undefined; state.next = undefined; state.add = undefined; };
  const close = (): void => {
    // Detach first: return getters/calls may reenter dispose or step.
    const iterator = state.iterator;
    dropIterator(); state.active = false; state.input = undefined; state.guard = undefined;
    state.presentation = undefined; state.rawStyle = undefined; state.rawState = undefined;
    state.styleFields = undefined; state.stateFields = undefined; state.paletteSource = undefined;
    state.palette = undefined; state.style = undefined; state.selected = undefined; state.dimmed = undefined;
    if (iterator) {
      try {
        const method: unknown = Reflect.get(iterator, 'return');
        if (typeof method === 'function') Reflect.apply(method, iterator, []);
      } catch { /* Cleanup cannot replace the preparation failure. */ }
    }
  };
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) throw new DOMException('Graph presentation preparation was superseded', 'AbortError');
  };
  const boundary = <T>(action: () => T): T => {
    checkpoint(); const value = action(); checkpoint(); return value;
  };
  const own = (source: object | undefined, key: PropertyKey, rejectAccessor: boolean): unknown => {
    const descriptor = source === undefined ? undefined : boundary(() => Object.getOwnPropertyDescriptor(source, key));
    if (descriptor && !('value' in descriptor)) {
      if (rejectAccessor) throw new TypeError('Graph presentation requires own data properties');
      return undefined;
    }
    return descriptor?.value;
  };
  const paletteLength = (raw: unknown): number => {
    // ToPrimitive(number) is explicit so cancellation also fences coercion hooks.
    let primitive = raw;
    if (objectLike(primitive)) {
      const source = primitive;
      const exotic: unknown = boundary(() => Reflect.get(source, Symbol.toPrimitive));
      if (exotic !== undefined && exotic !== null) {
        if (typeof exotic !== 'function') throw new TypeError('Invalid palette length');
        primitive = boundary(() => Reflect.apply(exotic, source, ['number']));
        if (objectLike(primitive)) throw new TypeError('Invalid palette length');
      } else {
        let converted = false;
        for (const key of ['valueOf', 'toString']) {
          const method: unknown = boundary(() => Reflect.get(source, key));
          if (typeof method !== 'function') continue;
          primitive = boundary(() => Reflect.apply(method, source, []));
          if (!objectLike(primitive)) { converted = true; break; }
        }
        if (!converted) throw new TypeError('Invalid palette length');
      }
    }
    // Unary conversion retains native rejection of symbols and bigints.
    const length = +(primitive as number);
    return Number.isNaN(length) || length <= 0 ? 0 : Math.min(256, Math.floor(length));
  };
  const nativeIterator = <T>(action: () => T): T => {
    checkpoint();
    let value: T;
    try { value = action(); }
    catch (error) {
      // Native acquisition/advance failures do not perform IteratorClose.
      dropIterator(); throw error;
    }
    checkpoint(); return value;
  };
  const openIterator = (): void => {
    const source = state.stateFields![state.collection === 0 ? 'selected' : 'dimmed'];
    if (source === undefined || source === null) return;
    const target = state.collection === 0 ? state.selected! : state.dimmed!;
    state.add = boundary(() => target.add) as (...args: unknown[]) => unknown;
    if (typeof state.add !== 'function') throw invalidStateValue();
    const method: unknown = nativeIterator(() => Reflect.get(Object(source) as object, Symbol.iterator));
    if (typeof method !== 'function') throw invalidStateValue();
    // Adopt the returned iterator before the post-call fence, even if the call disposed work.
    nativeIterator(() => {
      const iterator: unknown = Reflect.apply(method, source, []);
      if (!objectLike(iterator)) throw invalidStateValue();
      state.iterator = iterator;
    });
    state.next = nativeIterator(() => {
      const next: unknown = Reflect.get(state.iterator!, 'next');
      if (typeof next !== 'function') throw invalidStateValue();
      return next as (...args: unknown[]) => unknown;
    });
  };
  const advanceIterator = (): boolean => {
    if (!state.iterator) return false;
    const result = nativeIterator(() => {
      const value: unknown = Reflect.apply(state.next!, state.iterator, []);
      if (!objectLike(value)) throw invalidStateValue();
      return value;
    });
    const done = nativeIterator(() => {
      const value: unknown = Reflect.get(result, 'done');
      // A terminal iterator is no longer open at the following currentness fence.
      if (value) dropIterator();
      return Boolean(value);
    });
    if (done) return false;
    const value: unknown = nativeIterator(() => Reflect.get(result, 'value'));
    if (typeof value !== 'number') throw invalidStateValue();
    boundary(() => Reflect.apply(state.add!, state.collection === 0 ? state.selected : state.dimmed, [value]));
    return true;
  };

  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph presentation preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph presentation preparation budget');
      let operations = 0, visitedPaletteEntries = 0, copiedStateEntries = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint();
          if (state.phase === 'palette' && state.row === state.paletteLength) state.phase = 'resolve';
          switch (state.phase) {
            case 'setup': {
              const presentation = boundary(() => state.input!.presentation);
              if (presentation !== undefined && (presentation === null || typeof presentation !== 'object')) {
                throw new TypeError('Invalid graph presentation');
              }
              state.presentation = presentation;
              state.styleFields = {}; state.stateFields = {}; state.palette = [];
              state.selected = boundary(() => new Set<number>()); state.dimmed = boundary(() => new Set<number>());
              state.phase = 'presentation'; break;
            }
            case 'presentation': {
              const key = state.row++ === 0 ? 'style' : 'state';
              const value = own(state.presentation, key, true);
              if (key === 'style') {
                state.inheritsStyle = value === undefined;
                state.rawStyle = state.inheritsStyle ? boundary(() => state.input!.inheritedStyle) : value;
              } else {
                state.inheritsState = value === undefined;
                const source = state.inheritsState ? boundary(() => state.input!.inheritedState) : value;
                if (!objectLike(source)) throw invalidStateValue();
                state.rawState = source; state.presentation = undefined; state.input = undefined;
                state.row = 0; state.phase = 'style';
              }
              break;
            }
            case 'style': {
              const key = STYLE_FIELDS[state.row++]!;
              const source = typeof state.rawStyle === 'object' && state.rawStyle !== null ? state.rawStyle : undefined;
              state.styleFields![key] = own(source, key, false);
              if (state.row === STYLE_FIELDS.length) { state.rawStyle = undefined; state.phase = 'palette-header'; }
              break;
            }
            case 'palette-header': {
              const source = state.styleFields!.palette;
              if (Array.isArray(source)) {
                state.paletteSource = source;
                state.paletteLength = paletteLength(boundary(() => source.length));
              }
              state.styleFields!.palette = undefined; state.row = 0; state.phase = 'palette'; break;
            }
            case 'palette': {
              const source = state.paletteSource!, index = state.row++;
              if (boundary(() => index in source)) {
                const raw: unknown = boundary(() => source[index]);
                const color = state.inheritsStyle ? raw as Lyra3dRgba : parseCssColor(raw);
                if (color) state.palette!.push(color);
              }
              visitedPaletteEntries++; break;
            }
            case 'resolve':
              state.style = state.inheritsStyle ? state.styleFields as unknown as ResolvedLyra3dStyle : resolveLyra3dStyle(state.styleFields);
              state.paletteSource = undefined; state.phase = 'style-finish'; break;
            case 'style-finish':
              state.style = Object.freeze({ ...state.style!, palette: Object.freeze(state.palette!.length ? state.palette! : [...state.style!.palette]) });
              state.palette = undefined; state.styleFields = undefined; state.row = 0; state.phase = 'state'; break;
            case 'state': {
              const key = STATE_FIELDS[state.row++]!;
              const value = own(state.rawState, key, true);
              if ((key === 'hover' || key === 'focus') && typeof value !== 'number') throw invalidStateValue();
              state.stateFields![key] = value;
              if (state.row === STATE_FIELDS.length) { state.rawState = undefined; state.phase = 'open'; }
              break;
            }
            case 'open':
              openIterator(); state.phase = 'advance'; break;
            case 'advance':
              if (advanceIterator()) copiedStateEntries++;
              else {
                dropIterator(); state.stateFields![state.collection === 0 ? 'selected' : 'dimmed'] = undefined;
                if (state.collection === 0) { state.collection = 1; state.phase = 'open'; }
                else state.phase = 'finish';
              }
              break;
            case 'finish': {
              const value: GraphPresentationSnapshot = {
                style: state.style!, state: { selected: state.selected!, dimmed: state.dimmed!,
                  hover: state.stateFields!.hover as number, focus: state.stateFields!.focus as number },
                inheritsStyle: state.inheritsStyle, inheritsState: state.inheritsState,
              };
              operations++; checkpoint(); close();
              return { done: true, operations, visitedPaletteEntries, copiedStateEntries, value };
            }
          }
          operations++; checkpoint();
        }
        return { done: false, operations, visitedPaletteEntries, copiedStateEntries };
      } catch (error) { close(); throw error; }
      finally { running = false; }
    },
    dispose: close,
  };
}

export type GraphPresentationViewName = 'primary' | 'fitted';
export interface GraphPresentationIdentitySets {
  readonly cpuBackings: Set<ArrayBufferLike>;
  readonly gpuAttributes: Set<BufferAttribute>;
  readonly textures: Set<Texture>;
  readonly canvases: Set<HTMLCanvasElement>;
}
export interface GraphPresentationCustomStorage {
  cpuBytes: number;
  gpuBytes: number;
  accountedBytes: number;
}
export interface GraphPresentationStorage extends GraphPresentationIdentitySets {
  cpuBytes: number;
  gpuAttributeBytes: number;
  gpuTextureBytes: number;
  canvasBackingEstimateBytes: number;
  customPreflight: GraphPresentationCustomStorage;
  customActual: GraphPresentationCustomStorage;
  hostReservationBytes: number;
  semantic: {
    selectedRows: number;
    dimmedRows: number;
    labelRows: number;
    labelTextUnits: number;
    dashRows: number;
    dashValues: number;
    customRows: number;
  };
  admissionPeakCustomBytes: number;
  peak: {
    cpuBytes: number;
    gpuAttributeBytes: number;
    gpuTextureBytes: number;
    canvasBackingEstimateBytes: number;
    customAccountedBytes: number;
    hostReservationBytes: number;
  };
}
export interface GraphPresentationScopeStorage extends GraphPresentationIdentitySets {
  readonly textureBytes: Map<Texture, number>;
  readonly canvasBytes: Map<HTMLCanvasElement, number>;
  customPreflight: GraphPresentationCustomStorage;
  customActual: GraphPresentationCustomStorage;
}
export interface GraphPresentationScopeLedgers {
  readonly base: GraphPresentationScopeStorage;
  primary?: GraphPresentationScopeStorage;
  fitted?: GraphPresentationScopeStorage;
}
export interface GraphPresentationPickWrite {
  readonly target: object;
  readonly key: 'x' | 'y' | 'z' | 'w' | 'uniformsNeedUpdate';
  readonly primary: number | boolean;
  readonly fitted?: number | boolean;
}
export interface GraphPresentationView {
  readonly name: GraphPresentationViewName;
  readonly orbit: Lyra3dOrbitCamera;
  readonly fittedDistance: number;
  readonly revision: number;
  readonly roots: GraphPresentationRootSet;
  readonly ordinary?: GraphPreparedOrdinaryBatch;
  readonly composite?: GraphPreparedSpatialComposite;
  readonly decorations: GraphPreparedDecorations;
}
export interface GraphPresentationRecord {
  readonly prepared: GraphPreparedData;
  readonly presentation: GraphPresentationSnapshot;
  readonly facts: GraphSceneFacts;
  readonly dependencies: object;
  readonly roots: GraphPresentationRootSet;
  readonly slots: GraphPresentationSlots;
  primary?: GraphPresentationView;
  fitted?: GraphPresentationView;
  fittedSwap?: GraphPresentationSwap;
  selectedView: GraphPresentationView;
  readonly shared?: { readonly nodes: GraphPreparedSpatialNodes; readonly edges: GraphPreparedSpatialEdges };
  readonly storage: GraphPresentationStorage;
  readonly pickWrites: readonly GraphPresentationPickWrite[];
  readonly pendingRetirements: GraphPresentationRetirementWork[];
  readonly scopeStorage: GraphPresentationScopeLedgers;
}
declare const graphPresentationCandidateBrand: unique symbol;
export interface GraphPresentationCandidate { readonly [graphPresentationCandidateBrand]: true; }
export interface GraphPresentationRetirementStorage extends GraphPresentationIdentitySets {
  cpuBytes: number;
  gpuAttributeBytes: number;
  gpuTextureBytes: number;
  canvasBackingEstimateBytes: number;
}
export interface GraphPresentationRetirementStep {
  readonly done: boolean;
  readonly operations: number;
}
export interface GraphPresentationRetirementWork {
  readonly done: boolean;
  readonly storage: GraphPresentationRetirementStorage;
  step(maxOperations: number): GraphPresentationRetirementStep;
  dispose(): void;
}
type GraphPresentationOwner =
  | { readonly kind: 'ordinary'; readonly value: GraphPreparedOrdinaryBatch }
  | { readonly kind: 'nodes'; readonly value: GraphPreparedSpatialNodes }
  | { readonly kind: 'edges'; readonly value: GraphPreparedSpatialEdges }
  | { readonly kind: 'composite'; readonly value: GraphPreparedSpatialComposite }
  | { readonly kind: 'decorations'; readonly value: GraphPreparedDecorations };
type GraphPresentationNativeOwner =
  | { readonly kind: 'ordinary'; readonly resources: GraphOrdinaryResources }
  | { readonly kind: 'nodes'; readonly resources: GraphSpatialNodeResources }
  | { readonly kind: 'edges'; readonly resources: GraphSpatialEdgeResources }
  | { readonly kind: 'composite'; readonly resources: GraphSpatialCompositeResources }
  | { readonly kind: 'decorations'; readonly resources: GraphDecorationResources };
type PresentationNativeMesh = Mesh<BufferGeometry, Material | Material[]>;
interface PresentationNativeInventory {
  readonly cpu: Map<ArrayBufferLike, number>;
  readonly gpu: Map<BufferAttribute, number>;
  readonly textures: Map<Texture, number>;
  readonly canvases: Map<HTMLCanvasElement, number>;
}
type PresentationNativeSlot =
  | { readonly kind: 'native'; readonly owner: GraphPresentationNativeOwner; readonly inventory: PresentationNativeInventory }
  | { readonly kind: 'group'; readonly group: Group };
interface PresentationReferenceCount { count: number; readonly bytes: number; }
interface PresentationLeaseState {
  slots: (PresentationNativeSlot | undefined)[];
  index: number;
  running: boolean;
  closed: boolean;
  disposeRequested: boolean;
  readonly storage: GraphPresentationRetirementStorage;
  readonly cpu: Map<ArrayBufferLike, PresentationReferenceCount>;
  readonly gpu: Map<BufferAttribute, PresentationReferenceCount>;
  readonly textures: Map<Texture, PresentationReferenceCount>;
  readonly canvases: Map<HTMLCanvasElement, PresentationReferenceCount>;
}

const graphPresentationCandidates = new WeakMap<GraphPresentationCandidate, GraphPresentationRecord>();
const issuedGraphPresentationCandidates = new WeakSet<GraphPresentationCandidate>();
function invalidGraphPresentation(): never { throw new TypeError('Invalid graph presentation candidate'); }
function closedGraphPresentation(): never { throw new DOMException('Graph presentation is unavailable', 'InvalidStateError'); }

function registerGraphPresentationCandidate(record: GraphPresentationRecord): GraphPresentationCandidate {
  const candidate = Object.freeze({}) as GraphPresentationCandidate;
  graphPresentationCandidates.set(candidate, record); issuedGraphPresentationCandidates.add(candidate);
  return candidate;
}
export function readGraphPresentationCandidate(candidate: GraphPresentationCandidate): GraphPresentationRecord {
  const record = graphPresentationCandidates.get(candidate);
  if (record) return record;
  return issuedGraphPresentationCandidates.has(candidate) ? closedGraphPresentation() : invalidGraphPresentation();
}
function graphPresentationViews(record: GraphPresentationRecord): GraphPresentationView[] {
  return [record.primary, record.fitted].filter((view): view is GraphPresentationView => view !== undefined);
}
function graphPresentationViewOwners(view: GraphPresentationView): GraphPresentationOwner[] {
  const owners: GraphPresentationOwner[] = [];
  if (view.ordinary) owners.push({ kind: 'ordinary', value: view.ordinary });
  else if (view.composite) owners.push({ kind: 'composite', value: view.composite });
  else closedGraphPresentation();
  owners.push({ kind: 'decorations', value: view.decorations });
  return owners;
}
function graphPresentationOwners(record: GraphPresentationRecord): GraphPresentationOwner[] {
  const owners = graphPresentationViews(record).flatMap(graphPresentationViewOwners);
  if (record.shared) owners.push({ kind: 'edges', value: record.shared.edges }, { kind: 'nodes', value: record.shared.nodes });
  return owners;
}
function graphPresentationGroups(record: GraphPresentationRecord): Group[] {
  return [record.roots, record.slots, ...graphPresentationViews(record).map(view => view.roots)]
    .flatMap(roots => [roots.world, roots.pick, roots.overlay]);
}
function nativeGraphPresentationOwner(owner: GraphPresentationOwner): GraphPresentationNativeOwner {
  switch (owner.kind) {
    case 'ordinary': return { kind: owner.kind, resources: owner.value.resources };
    case 'nodes': return { kind: owner.kind, resources: owner.value.resources };
    case 'edges': return { kind: owner.kind, resources: owner.value.resources };
    case 'composite': return { kind: owner.kind, resources: owner.value.resources };
    case 'decorations': return { kind: owner.kind, resources: owner.value.resources };
  }
}
function quiesceGraphPresentationOwner(owner: GraphPresentationOwner): void {
  switch (owner.kind) {
    case 'ordinary': case 'composite': case 'decorations': owner.value.batch.quiesce(); break;
    case 'nodes': case 'edges': break;
  }
}
function disposeGraphPresentationNativeOwner(owner: GraphPresentationNativeOwner): void {
  switch (owner.kind) {
    case 'ordinary': disposeGraphOrdinaryResources(owner.resources); break;
    case 'nodes': disposeGraphSpatialNodeResources(owner.resources); break;
    case 'edges': disposeGraphSpatialEdgeResources(owner.resources); break;
    case 'composite': disposeGraphSpatialCompositeResources(owner.resources); break;
    case 'decorations': disposeGraphDecorationResources(owner.resources); break;
  }
}
function presentationNativeMeshes(owner: GraphPresentationNativeOwner): PresentationNativeMesh[] {
  const resources = owner.resources;
  switch (owner.kind) {
    case 'ordinary': {
      const r = resources as GraphOrdinaryResources; return [r.nodes, r.nodePick, r.edges, r.edgePick];
    }
    case 'nodes': {
      const r = resources as GraphSpatialNodeResources; return [r.mesh, r.pick];
    }
    case 'edges': {
      const r = resources as GraphSpatialEdgeResources; return [r.mesh, r.pick];
    }
    case 'composite': {
      const r = resources as GraphSpatialCompositeResources; return [r.mesh, ...(r.customPick ? [r.customPick] : [])];
    }
    case 'decorations': {
      const r = resources as GraphDecorationResources; return [r.arrows, r.arrowPick, r.particles, ...(r.labelMesh ? [r.labelMesh] : [])];
    }
  }
}
function snapshotPresentationNativeInventory(owner: GraphPresentationNativeOwner, eligible: GraphPresentationIdentitySets,
  scope: GraphPresentationScopeStorage): PresentationNativeInventory {
  const inventory: PresentationNativeInventory = { cpu: new Map(), gpu: new Map(), textures: new Map(), canvases: new Map() };
  const attribute = (value: BufferAttribute): void => {
    inventory.cpu.set(value.array.buffer, value.array.buffer.byteLength);
    if (eligible.gpuAttributes.has(value)) inventory.gpu.set(value, value.array.byteLength);
  };
  for (const mesh of presentationNativeMeshes(owner)) {
    if (mesh.geometry.index) attribute(mesh.geometry.index);
    for (const value of Object.values(mesh.geometry.attributes)) attribute(value as BufferAttribute);
    if (mesh instanceof InstancedMesh) {
      attribute(mesh.instanceMatrix); if (mesh.instanceColor) attribute(mesh.instanceColor);
    }
  }
  const texture = (value: Texture): void => {
    const image: unknown = value.image;
    const data: unknown = image && typeof image === 'object' && 'data' in image ? image.data : undefined;
    if (ArrayBuffer.isView(data)) inventory.cpu.set(data.buffer, data.buffer.byteLength);
    if (eligible.textures.has(value)) {
      const bytes = scope.textureBytes.get(value);
      if (bytes === undefined) closedGraphPresentation();
      inventory.textures.set(value, bytes);
    }
  };
  if (owner.kind === 'edges') texture(owner.resources.texture);
  if (owner.kind === 'decorations') {
    if (owner.resources.labelTexture) texture(owner.resources.labelTexture);
    if (owner.resources.canvas) {
      const bytes = scope.canvasBytes.get(owner.resources.canvas);
      if (bytes === undefined) closedGraphPresentation();
      inventory.canvases.set(owner.resources.canvas, bytes);
    }
  }
  return inventory;
}
function nativePresentationSlot(owner: GraphPresentationOwner, eligible: GraphPresentationIdentitySets,
  scope: GraphPresentationScopeStorage): PresentationNativeSlot {
  const native = nativeGraphPresentationOwner(owner);
  return { kind: 'native', owner: native, inventory: snapshotPresentationNativeInventory(native, eligible, scope) };
}
function graphPresentationNativeSlots(record: GraphPresentationRecord): PresentationNativeSlot[] {
  const slots: PresentationNativeSlot[] = [];
  for (const view of graphPresentationViews(record)) {
    const scope = record.scopeStorage[view.name];
    if (!scope) closedGraphPresentation();
    for (const owner of graphPresentationViewOwners(view)) slots.push(nativePresentationSlot(owner, record.storage, scope));
  }
  if (record.shared) {
    slots.push(nativePresentationSlot({ kind: 'edges', value: record.shared.edges }, record.storage, record.scopeStorage.base),
      nativePresentationSlot({ kind: 'nodes', value: record.shared.nodes }, record.storage, record.scopeStorage.base));
  }
  for (const group of graphPresentationGroups(record)) slots.push({ kind: 'group', group });
  return slots;
}
function presentationAddReference<T>(refs: Map<T, PresentationReferenceCount>, objects: Set<T>, object: T, bytes: number): number {
  const reference = refs.get(object);
  if (reference) { reference.count++; return 0; }
  refs.set(object, { count: 1, bytes }); objects.add(object); return bytes;
}
function presentationDropReference<T>(refs: Map<T, PresentationReferenceCount>, objects: Set<T>, object: T): number {
  const reference = refs.get(object);
  if (!reference) return 0;
  reference.count--;
  if (reference.count) return 0;
  refs.delete(object); objects.delete(object); return reference.bytes;
}
function createGraphPresentationNativeLease(slots: PresentationNativeSlot[]): GraphPresentationRetirementWork {
  const storage: GraphPresentationRetirementStorage = { cpuBackings: new Set(), gpuAttributes: new Set(), textures: new Set(), canvases: new Set(),
    cpuBytes: 0, gpuAttributeBytes: 0, gpuTextureBytes: 0, canvasBackingEstimateBytes: 0 };
  const state: PresentationLeaseState = { slots, index: 0, running: false, closed: false, disposeRequested: false,
    storage, cpu: new Map(), gpu: new Map(), textures: new Map(), canvases: new Map() };
  for (const slot of slots) if (slot.kind === 'native') {
    for (const [object, bytes] of slot.inventory.cpu) storage.cpuBytes += presentationAddReference(state.cpu, storage.cpuBackings, object, bytes);
    for (const [object, bytes] of slot.inventory.gpu) storage.gpuAttributeBytes += presentationAddReference(state.gpu, storage.gpuAttributes, object, bytes);
    for (const [object, bytes] of slot.inventory.textures) storage.gpuTextureBytes += presentationAddReference(state.textures, storage.textures, object, bytes);
    for (const [object, bytes] of slot.inventory.canvases) storage.canvasBackingEstimateBytes += presentationAddReference(state.canvases, storage.canvases, object, bytes);
  }
  // These closures retain native slots and their fixed identity ledgers only.
  const releaseOne = (): void => {
    const slot = state.slots[state.index]!;
    state.slots[state.index++] = undefined;
    try {
      if (slot.kind === 'group') slot.group.removeFromParent();
      else disposeGraphPresentationNativeOwner(slot.owner);
    } finally {
      if (slot.kind === 'native') {
        for (const object of slot.inventory.cpu.keys()) storage.cpuBytes -= presentationDropReference(state.cpu, storage.cpuBackings, object);
        for (const object of slot.inventory.gpu.keys()) storage.gpuAttributeBytes -= presentationDropReference(state.gpu, storage.gpuAttributes, object);
        for (const object of slot.inventory.textures.keys()) storage.gpuTextureBytes -= presentationDropReference(state.textures, storage.textures, object);
        for (const object of slot.inventory.canvases.keys()) storage.canvasBackingEstimateBytes -= presentationDropReference(state.canvases, storage.canvases, object);
      }
    }
  };
  const finish = (): void => { state.closed = true; state.disposeRequested = false; state.slots = []; state.index = 0; };
  const drain = (): void => {
    let failed = false, failure: unknown;
    while (state.index < state.slots.length) {
      try { releaseOne(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    }
    finish(); if (failed) throw failure;
  };
  return {
    get done() { return state.closed; },
    get storage() { return storage; },
    step(maxOperations) {
      if (state.closed || state.running) return closedGraphPresentation();
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph presentation retirement budget');
      let operations = 0;
      state.running = true;
      try {
        while (operations < maxOperations && state.index < state.slots.length) {
          let failed = false, failure: unknown;
          try { releaseOne(); } catch (error) { failed = true; failure = error; }
          operations++;
          if (failed) { try { drain(); } catch { /* Preserve the originating release failure. */ } throw failure; }
          if (state.disposeRequested) { drain(); break; }
        }
        if (!state.closed && state.index === state.slots.length) finish();
        return { done: state.closed, operations };
      } finally { state.running = false; }
    },
    dispose() {
      if (state.closed) return;
      if (state.running) { state.disposeRequested = true; return; }
      state.running = true;
      try { drain(); } finally { state.running = false; }
    },
  };
}
function quiescePresentationOwners(owners: readonly GraphPresentationOwner[]): void {
  let failed = false, failure: unknown;
  for (const owner of owners) try { quiesceGraphPresentationOwner(owner); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}
function requireDetachedPresentationRoots(roots: GraphPresentationRootSet): void {
  if (roots.world.parent !== null || roots.pick.parent !== null || roots.overlay.parent !== null) closedGraphPresentation();
}
function refreshGraphPresentationStorage(record: GraphPresentationRecord, removed: GraphPresentationScopeStorage): void {
  const scopes = record.scopeStorage, storage = record.storage;
  const keeps = (key: keyof GraphPresentationIdentitySets, object: unknown): boolean => {
    const has = (scope: GraphPresentationScopeStorage | undefined): boolean => scope !== undefined && (scope[key] as Set<unknown>).has(object);
    return has(scopes.base) || has(scopes.primary) || has(scopes.fitted);
  };
  for (const buffer of removed.cpuBackings) if (!keeps('cpuBackings', buffer) && storage.cpuBackings.delete(buffer)) storage.cpuBytes -= buffer.byteLength;
  for (const attribute of removed.gpuAttributes) if (!keeps('gpuAttributes', attribute) && storage.gpuAttributes.delete(attribute)) storage.gpuAttributeBytes -= attribute.array.byteLength;
  for (const texture of removed.textures) if (!keeps('textures', texture) && storage.textures.delete(texture)) storage.gpuTextureBytes -= removed.textureBytes.get(texture)!;
  for (const canvas of removed.canvases) if (!keeps('canvases', canvas) && storage.canvases.delete(canvas)) storage.canvasBackingEstimateBytes -= removed.canvasBytes.get(canvas)!;
  for (const key of ['customPreflight', 'customActual'] as const) {
    storage[key].cpuBytes -= removed[key].cpuBytes; storage[key].gpuBytes -= removed[key].gpuBytes;
    storage[key].accountedBytes -= removed[key].accountedBytes;
  }
}
export function prepareGraphPresentationRetirement(candidate: GraphPresentationCandidate): GraphPresentationRetirementWork {
  const record = readGraphPresentationCandidate(candidate);
  if (record.pendingRetirements.some(lease => !lease.done)) closedGraphPresentation();
  requireDetachedPresentationRoots(record.roots);
  const owners = graphPresentationOwners(record);
  const lease = createGraphPresentationNativeLease(graphPresentationNativeSlots(record));
  graphPresentationCandidates.delete(candidate);
  try { quiescePresentationOwners(owners); }
  catch (error) { try { lease.dispose(); } catch { /* Preserve the originating quiesce failure. */ } throw error; }
  return lease;
}
export function prepareGraphPresentationViewRetirement(candidate: GraphPresentationCandidate, name: GraphPresentationViewName): GraphPresentationRetirementWork {
  const record = readGraphPresentationCandidate(candidate);
  if (name !== 'primary' && name !== 'fitted') invalidGraphPresentation();
  const view = record[name], scope = record.scopeStorage[name];
  if (!view || !scope || record.selectedView === view) closedGraphPresentation();
  requireDetachedPresentationRoots(view.roots);
  const owners = graphPresentationViewOwners(view);
  const slots = owners.map(owner => nativePresentationSlot(owner, record.storage, scope));
  slots.push({ kind: 'group', group: view.roots.world }, { kind: 'group', group: view.roots.pick }, { kind: 'group', group: view.roots.overlay });
  const lease = createGraphPresentationNativeLease(slots);
  record[name] = undefined; record.fittedSwap = undefined; record.scopeStorage[name] = undefined;
  refreshGraphPresentationStorage(record, scope);
  record.pendingRetirements.push(lease);
  try { quiescePresentationOwners(owners); }
  catch (error) { try { lease.dispose(); } catch { /* Preserve the originating quiesce failure. */ } throw error; }
  return lease;
}
function retireGraphPresentationParts(owners: GraphPresentationOwner[], groups: Group[]): void {
  const semantic = owners.splice(0), native = semantic.map(nativeGraphPresentationOwner), knownGroups = [...new Set(groups.splice(0))];
  const ordered = [...native.filter(owner => owner.kind === 'composite'),
    ...native.filter(owner => owner.kind === 'ordinary' || owner.kind === 'decorations'),
    ...native.filter(owner => owner.kind === 'edges'), ...native.filter(owner => owner.kind === 'nodes')];
  let failed = false, failure: unknown;
  try { quiescePresentationOwners(semantic); } catch (error) { failed = true; failure = error; }
  semantic.length = 0;
  for (const owner of ordered) try { disposeGraphPresentationNativeOwner(owner); } catch (error) { if (!failed) { failed = true; failure = error; } }
  for (const group of knownGroups) try { group.removeFromParent(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
}


export interface GraphPresentationWorkInput {
  readonly prepared: GraphPreparedData;
  readonly presentation: GraphPresentationSnapshot;
  readonly width: number;
  readonly height: number;
  readonly orbit: Lyra3dOrbitCamera;
  readonly fittedDistance: number;
  readonly revision: number;
  readonly firstOwner: boolean;
  readonly dependencies: object;
  readonly retainedHostBuffers?: readonly ArrayBufferLike[];
  readonly previousStorage?: GraphPresentationStorage;
}
export interface GraphPresentationWorkStep {
  done: boolean;
  operations: number;
  allocatedBytes: number;
  childOperations: number;
  coordinatorOperations: number;
  inventoryEntries: number;
  rootLinks: number;
  registeredCpuBackings: number;
  registeredCpuBytes: number;
  registeredGpuAttributes: number;
  registeredGpuAttributeBytes: number;
  registeredTextures: number;
  registeredGpuTextureBytes: number;
  registeredCanvases: number;
  registeredCanvasEstimateBytes: number;
  value?: GraphPresentationCandidate;
}
export interface GraphPresentationWork {
  step(maxOperations: number): GraphPresentationWorkStep;
  dispose(): void;
}
type PresentationChildValue = GraphSceneFacts | GraphPreparedOrdinaryBatch | GraphPreparedSpatialNodes
  | GraphPreparedSpatialEdges | GraphPreparedSpatialComposite | GraphPreparedDecorations;
interface PresentationChildWork {
  step(maxOperations: number): { readonly done: boolean; readonly operations: number; readonly allocatedBytes?: number; readonly value?: PresentationChildValue };
  dispose(): void;
}
type PresentationChildKind = GraphPresentationOwner['kind'] | 'facts';
type PresentationCost = Partial<Omit<GraphPresentationWorkStep, 'done' | 'value'>>;
const PRESENTATION_FIXED: PresentationCost = { coordinatorOperations: 1 };
const PRESENTATION_LINK: PresentationCost = { rootLinks: 1 };
const PRESENTATION_TRANSFER = Symbol('presentation transfer');
const PRESENTATION_COST_FIELDS = ['registeredCpuBackings', 'registeredCpuBytes', 'registeredGpuAttributes', 'registeredGpuAttributeBytes',
  'registeredTextures', 'registeredGpuTextureBytes', 'registeredCanvases', 'registeredCanvasEstimateBytes'] as const;
interface PresentationPreparation {
  input: GraphPresentationWorkInput | undefined;
  createCanvas: (() => HTMLCanvasElement) | undefined;
  guard: (() => boolean) | undefined;
  active: boolean;
  child: PresentationChildWork | undefined;
  childKind: PresentationChildKind;
  awaitingChild: boolean;
  pending: PresentationChildValue | undefined;
  owners: GraphPresentationOwner[];
  groups: Group[];
  generator: Generator<PresentationCost | typeof PRESENTATION_TRANSFER, void> | undefined;
  candidate: GraphPresentationCandidate | undefined;
  consumeNodes: (() => unknown) | undefined;
  consumeEdges: (() => unknown) | undefined;
}
function presentationBudget(): never { throw Object.assign(new RangeError('Graph presentation storage budget exceeded'), { reason: 'budget' as const }); }
function checkedPresentationBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) return presentationBudget();
  return value;
}
function presentationPolicy(cpuBytes = 0, gpuBytes = 0): GraphPresentationCustomStorage {
  return { cpuBytes, gpuBytes, accountedBytes: checkedPresentationBytes(cpuBytes + gpuBytes) };
}
function emptyPresentationScope(): GraphPresentationScopeStorage {
  return { cpuBackings: new Set(), gpuAttributes: new Set(), textures: new Set(), canvases: new Set(), textureBytes: new Map(), canvasBytes: new Map(),
    customPreflight: presentationPolicy(), customActual: presentationPolicy() };
}
function emptyGraphPresentationStorage(): GraphPresentationStorage {
  return { cpuBackings: new Set(), gpuAttributes: new Set(), textures: new Set(), canvases: new Set(),
    cpuBytes: 0, gpuAttributeBytes: 0, gpuTextureBytes: 0, canvasBackingEstimateBytes: 0,
    customPreflight: presentationPolicy(), customActual: presentationPolicy(), hostReservationBytes: 0,
    semantic: { selectedRows: 0, dimmedRows: 0, labelRows: 0, labelTextUnits: 0, dashRows: 0, dashValues: 0, customRows: 0 },
    admissionPeakCustomBytes: 0, peak: { cpuBytes: 0, gpuAttributeBytes: 0, gpuTextureBytes: 0, canvasBackingEstimateBytes: 0, customAccountedBytes: 0, hostReservationBytes: 0 } };
}
function presentationViewMeshes(view: GraphPresentationView): Mesh[] {
  const result: Mesh[] = [], base = view.ordinary?.resources, composite = view.composite?.resources, decorations = view.decorations.resources;
  if (base) result.push(base.nodes, base.edges, base.nodePick, base.edgePick);
  if (composite) result.push(composite.mesh, ...(composite.customPick ? [composite.customPick] : []));
  if (decorations.arrows.count) result.push(decorations.arrows, decorations.arrowPick);
  if (decorations.particles.count) result.push(decorations.particles);
  if (decorations.labelMesh) result.push(decorations.labelMesh);
  return result;
}

/** Prepares a complete detached generation; only the owner manager may later publish its roots. */
export function createGraphPresentationWork(input: GraphPresentationWorkInput, createCanvas?: () => HTMLCanvasElement, isCurrent?: () => boolean): GraphPresentationWork {
  const state: PresentationPreparation = { input, createCanvas, guard: isCurrent, active: true, child: undefined, childKind: 'facts', awaitingChild: false,
    pending: undefined, owners: [], groups: [], generator: undefined, candidate: undefined, consumeNodes: undefined, consumeEdges: undefined };
  input = undefined as never; createCanvas = undefined; isCurrent = undefined;
  const releasedOwners: GraphPresentationOwner[] = [], releasedGroups: Group[] = [];
  let running = false;
  const checkpoint = (): void => {
    const current = state.active && (!state.guard || state.guard());
    if (!current || !state.active) throw new DOMException('Graph presentation preparation was superseded', 'AbortError');
  };
  const current = (): boolean => { checkpoint(); return true; };
  const boundary = <T>(action: () => T): T => { checkpoint(); const value = action(); checkpoint(); return value; };
  const release = (): void => {
    state.input = undefined; state.createCanvas = undefined; state.guard = undefined; state.child = undefined; state.pending = undefined;
    state.generator = undefined; state.candidate = undefined; state.consumeNodes = undefined; state.consumeEdges = undefined;
    state.owners = releasedOwners; state.groups = releasedGroups;
  };
  const pendingOwner = (): void => {
    if (state.pending && state.childKind !== 'facts') state.owners.push({ kind: state.childKind, value: state.pending } as GraphPresentationOwner);
    state.pending = undefined;
  };
  const close = (): void => {
    state.active = false; state.guard = undefined;
    if (running) { state.child?.dispose(); return; }
    let failed = false, failure: unknown;
    try { state.child?.dispose(); } catch (error) { failed = true; failure = error; }
    pendingOwner();
    const candidate = state.candidate, owners = state.owners, groups = state.groups;
    release();
    try {
      if (candidate) prepareGraphPresentationRetirement(candidate).dispose();
      else retireGraphPresentationParts(owners, groups);
    } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
  };
  function* child<T extends PresentationChildValue>(kind: PresentationChildKind, factory: () => PresentationChildWork): Generator<PresentationCost, T> {
    state.childKind = kind; state.child = factory(); state.awaitingChild = true;
    yield PRESENTATION_FIXED;
    // The driver already owns the completed value, including at a budget boundary.
    const value = state.pending as T, handle = state.child!;
    pendingOwner(); state.child = undefined; handle.dispose();
    yield PRESENTATION_FIXED;
    return value;
  }
  function* prepare(): Generator<PresentationCost | typeof PRESENTATION_TRANSFER, void> {
    const source = state.input!;
    const prepared = boundary(() => source.prepared), presentation = boundary(() => source.presentation);
    const width = boundary(() => source.width), height = boundary(() => source.height), rawOrbit = boundary(() => source.orbit);
    const orbit: Lyra3dOrbitCamera = { yaw: rawOrbit.yaw, pitch: rawOrbit.pitch, distance: rawOrbit.distance,
      target: { x: rawOrbit.target.x, y: rawOrbit.target.y, z: rawOrbit.target.z } };
    const fittedDistance = boundary(() => source.fittedDistance), revision = boundary(() => source.revision);
    const firstOwner = boundary(() => source.firstOwner), dependencies = boundary(() => source.dependencies);
    const previous = boundary(() => source.previousStorage), hostBuffers = boundary(() => source.retainedHostBuffers);
    if (!Number.isFinite(width) || width < 0 || !Number.isFinite(height) || height < 0 || !Number.isFinite(fittedDistance) || fittedDistance <= 0
      || !Number.isSafeInteger(revision) || revision < 0 || typeof firstOwner !== 'boolean' || !objectLike(dependencies)) {
      throw new RangeError('Invalid graph presentation inputs');
    }
    if (previous) {
      const amounts = [previous.cpuBytes, previous.gpuAttributeBytes, previous.gpuTextureBytes, previous.canvasBackingEstimateBytes,
        previous.customActual.cpuBytes, previous.customActual.gpuBytes, previous.customActual.accountedBytes, previous.hostReservationBytes];
      if (amounts.some(value => !Number.isSafeInteger(value) || value < 0)) throw new RangeError('Invalid previous graph presentation storage');
    }
    const data = prepared.data, spatial = data.spatialAppearance !== undefined, m = firstOwner ? 2 : 1;
    const storage = emptyGraphPresentationStorage(), baseScope = emptyPresentationScope();
    const scopeStorage: GraphPresentationScopeLedgers = { base: baseScope };
    const reservedCanvases = new Set<HTMLCanvasElement>(), peakBuffers = new Set<ArrayBufferLike>();
    storage.semantic.selectedRows = presentation.state.selected.size; storage.semantic.dimmedRows = presentation.state.dimmed.size;
    yield PRESENTATION_FIXED;

    const facts = yield* child<GraphSceneFacts>('facts', () => createGraphSceneFactsWork(data, presentation.style.pointSize, current));
    const descriptions: { name: GraphPresentationViewName; orbit: Lyra3dOrbitCamera; fittedDistance: number }[] = [{ name: 'primary', orbit, fittedDistance }];
    yield PRESENTATION_FIXED;
    if (firstOwner) {
      const fitted = fitOrbitCamera(facts.bounds, { width, height }, 24, undefined, { preserveDerivedBounds: facts.preserveDerivedBounds });
      descriptions.push({ name: 'fitted', orbit: fitted, fittedDistance: fitted.distance });
      yield PRESENTATION_FIXED;
    }
    const custom = data.spatialAppearance && graphSpatialNodeMeshData(data.spatialAppearance);
    const hasCustom = custom !== undefined && custom.customNodeCount > 0;
    const sharedAllowance = hasCustom ? 2 * custom.payloadBytes + 16 * data.nodeCount : 0;
    const preflight = hasCustom ? preflightGraphSpatialMeshes(data.nodeCount, facts.spatialEdgePrimitiveCount!, custom) : undefined;
    if (preflight) {
      storage.customPreflight = presentationPolicy(checkedPresentationBytes(sharedAllowance + m * (preflight.cpuBytes - sharedAllowance)), checkedPresentationBytes(m * preflight.gpuBytes));
      storage.hostReservationBytes = checkedPresentationBytes(custom!.payloadBytes + 16 * custom!.customNodeCount + 16 * data.nodeCount);
    }
    storage.admissionPeakCustomBytes = checkedPresentationBytes((previous?.customActual.accountedBytes ?? 0) + storage.customPreflight.accountedBytes);
    if (storage.customPreflight.cpuBytes > 32 * 1024 * 1024 || storage.customPreflight.gpuBytes > 16 * 1024 * 1024
      || storage.admissionPeakCustomBytes > 96 * 1024 * 1024) presentationBudget();
    yield PRESENTATION_FIXED;

    const outer = createGraphPresentationRoots(); state.groups.push(outer.world, outer.pick, outer.overlay);
    yield PRESENTATION_FIXED;
    let shared: GraphPresentationRecord['shared'];
    const primaryPresentation = { width, height, orbit, style: presentation.style, state: presentation.state, fittedDistance, revision };
    if (spatial) {
      const nodes = yield* child<GraphPreparedSpatialNodes>('nodes', () => createGraphSpatialNodesWork(data, primaryPresentation, current));
      const edges = yield* child<GraphPreparedSpatialEdges>('edges', () => createGraphSpatialEdgesWork(data, facts, primaryPresentation, current));
      shared = { nodes, edges }; nodes.resources.pick.renderOrder = 1;
      outer.pick.add(nodes.resources.pick); yield PRESENTATION_LINK;
      outer.pick.add(edges.resources.pick); yield PRESENTATION_LINK;
    }
    let slots: GraphPresentationSlots;
    try { slots = createGraphPresentationSlots(outer); }
    catch (error) {
      // These roots were empty except for the two known shared picks. A failed slots
      // constructor can leave only its own fixed wrapper Groups among those children.
      for (const root of [outer.world, outer.pick, outer.overlay]) for (const item of root.children) if (item instanceof Group) state.groups.push(item);
      throw error;
    }
    state.groups.push(slots.world, slots.pick, slots.overlay);
    yield PRESENTATION_FIXED;
    const variants: GraphPresentationView[] = [];
    const canvasFactory = (): HTMLCanvasElement => {
      if (!state.createCanvas) throw new TypeError('A canvas factory is required for graph labels');
      const canvas = state.createCanvas();
      if (previous?.canvases.has(canvas) || reservedCanvases.has(canvas)) throw new TypeError('Graph presentation requires a distinct label canvas');
      reservedCanvases.add(canvas);
      // The child must adopt a fresh return before its own post-call currentness fence.
      return canvas;
    };
    for (const description of descriptions) {
      const roots = createGraphPresentationRoots(); state.groups.push(roots.world, roots.pick, roots.overlay);
      const scope = emptyPresentationScope(); scopeStorage[description.name] = scope;
      if (preflight) scope.customPreflight = presentationPolicy(preflight.cpuBytes - sharedAllowance, preflight.gpuBytes);
      yield PRESENTATION_FIXED;
      const viewPresentation = { ...primaryPresentation, orbit: description.orbit, fittedDistance: description.fittedDistance };
      let ordinary: GraphPreparedOrdinaryBatch | undefined, composite: GraphPreparedSpatialComposite | undefined;
      if (shared) composite = yield* child<GraphPreparedSpatialComposite>('composite', () => createGraphSpatialCompositeWork(shared!.nodes, shared!.edges, viewPresentation, custom, current, true));
      else ordinary = yield* child<GraphPreparedOrdinaryBatch>('ordinary', () => createGraphOrdinaryBatchWork(data, viewPresentation, current));
      const decorations = yield* child<GraphPreparedDecorations>('decorations', () => createGraphDecorationsWork(data, viewPresentation, canvasFactory, current));
      const view: GraphPresentationView = { ...description, revision, roots, ordinary, composite, decorations }; variants.push(view);
      if (ordinary) {
        roots.world.add(ordinary.resources.nodes); yield PRESENTATION_LINK;
        roots.world.add(ordinary.resources.edges); yield PRESENTATION_LINK;
        roots.pick.add(ordinary.resources.nodePick); yield PRESENTATION_LINK;
        roots.pick.add(ordinary.resources.edgePick); yield PRESENTATION_LINK;
      }
      if (composite) {
        roots.world.add(composite.resources.mesh); yield PRESENTATION_LINK;
        if (composite.resources.customPick) { composite.resources.customPick.renderOrder = 1; roots.pick.add(composite.resources.customPick); yield PRESENTATION_LINK; }
      }
      const resources = decorations.resources;
      if (resources.arrows.count) {
        roots.world.add(resources.arrows); yield PRESENTATION_LINK;
        roots.pick.add(resources.arrowPick); yield PRESENTATION_LINK;
      }
      if (resources.particles.count) { roots.world.add(resources.particles); yield PRESENTATION_LINK; }
      if (resources.labelMesh) { roots.overlay.add(resources.labelMesh); yield PRESENTATION_LINK; }
    }
    const primarySwap = prepareGraphPresentationSwap(slots, variants[0]!.roots); yield PRESENTATION_FIXED;
    commitGraphPresentationSwap(primarySwap); yield PRESENTATION_FIXED;
    let fittedSwap: GraphPresentationSwap | undefined;
    if (firstOwner) { fittedSwap = prepareGraphPresentationSwap(slots, variants[1]!.roots); yield PRESENTATION_FIXED; }

    const pickWrites: GraphPresentationPickWrite[] = [];
    if (shared) {
      const nodes = shared.nodes.resources, edges = shared.edges.resources;
      const targets: { target: Vector2 | Vector4; keys: readonly ('x' | 'y' | 'z' | 'w')[]; kind: 'size' | 'window' | 'view' }[] = [
        { target: nodes.material.uniforms['viewportSize']!.value as Vector2, keys: ['x', 'y'], kind: 'size' },
        { target: nodes.pickMaterial.uniforms['viewportSize']!.value as Vector2, keys: ['x', 'y'], kind: 'size' },
        { target: nodes.material.uniforms['lyraView']!.value as Vector4, keys: ['x', 'y', 'z', 'w'], kind: 'view' },
        { target: edges.material.uniforms['viewWindow']!.value as Vector4, keys: ['x', 'y', 'z', 'w'], kind: 'window' },
        { target: edges.pickMaterial.uniforms['viewWindow']!.value as Vector4, keys: ['x', 'y', 'z', 'w'], kind: 'window' },
        { target: edges.material.uniforms['lyraView']!.value as Vector4, keys: ['x', 'y', 'z', 'w'], kind: 'view' },
      ];
      for (const item of targets) for (const [index, key] of item.keys.entries()) {
        const values = descriptions.map(description => {
          const view = graphSpatialView(width, height, description.orbit);
          return item.kind === 'window' ? [0, 0, width, height][index]! : item.kind === 'size'
            ? [view.width, view.height][index]! : [view.width, view.height, view.near, view.far][index]!;
        });
        const descriptor = Object.getOwnPropertyDescriptor(item.target, key);
        if (!descriptor || !('value' in descriptor) || descriptor.writable !== true) throw new DOMException('Graph pick targets are unavailable', 'InvalidStateError');
        pickWrites.push({ target: item.target, key, primary: values[0]!, ...(firstOwner ? { fitted: values[1]! } : {}) });
        yield PRESENTATION_FIXED;
      }
      for (const target of [nodes.material, nodes.pickMaterial, edges.material, edges.pickMaterial]) {
        const descriptor = Object.getOwnPropertyDescriptor(target, 'uniformsNeedUpdate');
        if (!descriptor || !('value' in descriptor) || descriptor.writable !== true) throw new DOMException('Graph pick targets are unavailable', 'InvalidStateError');
        pickWrites.push({ target, key: 'uniformsNeedUpdate', primary: true, ...(firstOwner ? { fitted: true } : {}) });
        yield PRESENTATION_FIXED;
      }
    }

    // Registries grow by individual visits; even duplicate and absent scheduled slots cost one.
    yield PRESENTATION_FIXED;
    const cost = (): PresentationCost => ({ inventoryEntries: 1 });
    const peak = (buffer: ArrayBufferLike): void => {
      if (!peakBuffers.has(buffer)) { peakBuffers.add(buffer); storage.peak.cpuBytes = checkedPresentationBytes(storage.peak.cpuBytes + buffer.byteLength); }
    };
    const cpu = (value: ArrayBufferLike | undefined, scope: GraphPresentationScopeStorage, visit: PresentationCost): void => {
      if (!value) return;
      scope.cpuBackings.add(value); peak(value);
      if (!storage.cpuBackings.has(value)) {
        storage.cpuBackings.add(value); storage.cpuBytes = checkedPresentationBytes(storage.cpuBytes + value.byteLength);
        visit.registeredCpuBackings = (visit.registeredCpuBackings ?? 0) + 1; visit.registeredCpuBytes = (visit.registeredCpuBytes ?? 0) + value.byteLength;
      }
    };
    const typed = (value: ArrayBufferView | undefined, scope = baseScope): PresentationCost => {
      const visit = cost(); cpu(value?.buffer, scope, visit); return visit;
    };
    for (const key of ['source', 'target', 'positions', 'pinned', 'sizes', 'categories', 'directed'] as const) yield typed(data[key]);
    for (const key of ['source', 'target', 'positions', 'pinned'] as const) yield typed(prepared.start.data[key]);
    if (data.spatialAppearance) {
      const appearance = data.spatialAppearance;
      for (const key of ['nodeShapes', 'nodeColors', 'expandable', 'edgeColors', 'edgeWidths', 'edgeCurvatures', 'dangling'] as const) yield typed(appearance[key]);
      if (appearance.nodeMeshes) for (const body of appearance.nodeMeshes) {
        if (body) storage.semantic.customRows++;
        yield cost();
        if (body) { yield typed(body.positions); yield typed(body.normals); }
      }
    }
    for (const labels of [data.labels, data.edgeLabels]) if (labels) for (const label of labels) {
      storage.semantic.labelRows++; storage.semantic.labelTextUnits = checkedPresentationBytes(storage.semantic.labelTextUnits + label.length); yield cost();
    }
    if (data.spatialAppearance?.edgeDashes) for (const dash of data.spatialAppearance.edgeDashes) {
      storage.semantic.dashRows++; storage.semantic.dashValues += dash.length; yield cost();
    }
    if (hostBuffers) for (const buffer of hostBuffers) { const visit = cost(); cpu(buffer, baseScope, visit); yield visit; }
    if (previous) {
      for (const buffer of previous.cpuBackings) { peak(buffer); yield cost(); }
      for (const canvas of previous.canvases) { reservedCanvases.add(canvas); yield cost(); }
    }
    const inventoryOwners: { owner: GraphPresentationOwner['value']; scope: GraphPresentationScopeStorage }[] = [];
    if (shared) inventoryOwners.push({ owner: shared.nodes, scope: baseScope }, { owner: shared.edges, scope: baseScope });
    for (const view of variants) inventoryOwners.push({ owner: (view.ordinary ?? view.composite)!, scope: scopeStorage[view.name]! }, { owner: view.decorations, scope: scopeStorage[view.name]! });
    for (const { owner, scope } of inventoryOwners) {
      for (const buffer of owner.ownedBuffers) { const visit = cost(); cpu(buffer, scope, visit); yield visit; }
      for (const buffer of owner.borrowedBuffers) { const visit = cost(); cpu(buffer, baseScope, visit); yield visit; }
    }
    const meshScopes: { mesh: Mesh; scope: GraphPresentationScopeStorage }[] = [];
    if (shared) meshScopes.push({ mesh: shared.nodes.resources.pick, scope: baseScope }, { mesh: shared.edges.resources.pick, scope: baseScope });
    for (const view of variants) for (const mesh of presentationViewMeshes(view)) meshScopes.push({ mesh, scope: scopeStorage[view.name]! });
    const attribute = (value: BufferAttribute | null | undefined, scope: GraphPresentationScopeStorage): PresentationCost => {
      const visit = cost(); if (!value) return visit;
      cpu(value.array.buffer, scope, visit); scope.gpuAttributes.add(value);
      if (!storage.gpuAttributes.has(value)) {
        storage.gpuAttributes.add(value); storage.gpuAttributeBytes = checkedPresentationBytes(storage.gpuAttributeBytes + value.array.byteLength);
        visit.registeredGpuAttributes = 1; visit.registeredGpuAttributeBytes = value.array.byteLength;
      }
      return visit;
    };
    for (const { mesh, scope } of meshScopes) {
      yield attribute(mesh.geometry.index, scope);
      // These are the fixed native attribute layouts of the qualified owner types.
      for (const name of Object.keys(mesh.geometry.attributes)) yield attribute(mesh.geometry.attributes[name] as BufferAttribute, scope);
      if (mesh instanceof InstancedMesh) { yield attribute(mesh.instanceMatrix, scope); yield attribute(mesh.instanceColor, scope); }
    }
    const texture = (value: Texture | undefined, scope: GraphPresentationScopeStorage): PresentationCost => {
      const visit = cost(); if (!value) return visit;
      const image = boundary(() => value.image) as { data?: ArrayBufferView; width: number; height: number };
      const bytes = image.data && ArrayBuffer.isView(image.data) ? image.data.byteLength : 4 * boundary(() => image.width) * boundary(() => image.height);
      if (image.data && ArrayBuffer.isView(image.data)) cpu(image.data.buffer, scope, visit);
      checkedPresentationBytes(bytes); scope.textures.add(value); scope.textureBytes.set(value, bytes);
      if (!storage.textures.has(value)) {
        storage.textures.add(value); storage.gpuTextureBytes = checkedPresentationBytes(storage.gpuTextureBytes + bytes);
        visit.registeredTextures = 1; visit.registeredGpuTextureBytes = bytes;
      }
      return visit;
    };
    if (shared) yield texture(shared.edges.resources.texture, baseScope);
    for (const view of variants) {
      const scope = scopeStorage[view.name]!, resources = view.decorations.resources;
      yield texture(resources.labelTexture, scope);
      const visit = cost(), canvas = resources.canvas;
      if (canvas) {
        const bytes = checkedPresentationBytes(4 * boundary(() => canvas.width) * boundary(() => canvas.height));
        scope.canvases.add(canvas); scope.canvasBytes.set(canvas, bytes);
        if (!storage.canvases.has(canvas)) {
          storage.canvases.add(canvas); storage.canvasBackingEstimateBytes = checkedPresentationBytes(storage.canvasBackingEstimateBytes + bytes);
          visit.registeredCanvases = 1; visit.registeredCanvasEstimateBytes = bytes;
        }
      }
      yield visit;
    }

    if (hasCustom) {
      let cpuBytes = sharedAllowance, gpuBytes = 0;
      for (const view of variants) {
        const actual = view.composite!.batch.allocations().customStorage!;
        const contribution = presentationPolicy(checkedPresentationBytes(actual.cpuBytes - sharedAllowance), actual.gpuBytes);
        scopeStorage[view.name]!.customActual = contribution; cpuBytes += contribution.cpuBytes; gpuBytes += contribution.gpuBytes;
      }
      storage.customActual = presentationPolicy(checkedPresentationBytes(cpuBytes), checkedPresentationBytes(gpuBytes));
      if (storage.customActual.cpuBytes > storage.customPreflight.cpuBytes || storage.customActual.gpuBytes > storage.customPreflight.gpuBytes) presentationBudget();
    }
    storage.peak.gpuAttributeBytes = checkedPresentationBytes((previous?.gpuAttributeBytes ?? 0) + storage.gpuAttributeBytes);
    storage.peak.gpuTextureBytes = checkedPresentationBytes((previous?.gpuTextureBytes ?? 0) + storage.gpuTextureBytes);
    storage.peak.canvasBackingEstimateBytes = checkedPresentationBytes((previous?.canvasBackingEstimateBytes ?? 0) + storage.canvasBackingEstimateBytes);
    storage.peak.customAccountedBytes = checkedPresentationBytes((previous?.customActual.accountedBytes ?? 0) + storage.customActual.accountedBytes);
    storage.peak.hostReservationBytes = checkedPresentationBytes((previous?.hostReservationBytes ?? 0) + storage.hostReservationBytes);
    if (storage.peak.customAccountedBytes > 96 * 1024 * 1024) presentationBudget();
    yield PRESENTATION_FIXED;

    const record: GraphPresentationRecord = { prepared, presentation, facts, dependencies, roots: outer, slots, primary: variants[0]!, fitted: variants[1],
      fittedSwap, selectedView: variants[0]!, shared, storage, pickWrites, pendingRetirements: [], scopeStorage };
    state.candidate = registerGraphPresentationCandidate(record);
    if (shared) { state.consumeNodes = shared.nodes.batch.takeChanges.bind(shared.nodes.batch); state.consumeEdges = shared.edges.batch.takeChanges.bind(shared.edges.batch); }
    yield PRESENTATION_FIXED;
    yield PRESENTATION_TRANSFER;
  }
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph presentation preparation is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph presentation preparation budget');
      const result: GraphPresentationWorkStep = { done: false, operations: 0, allocatedBytes: 0, childOperations: 0, coordinatorOperations: 0,
        inventoryEntries: 0, rootLinks: 0, registeredCpuBackings: 0, registeredCpuBytes: 0, registeredGpuAttributes: 0, registeredGpuAttributeBytes: 0,
        registeredTextures: 0, registeredGpuTextureBytes: 0, registeredCanvases: 0, registeredCanvasEstimateBytes: 0, value: undefined };
      running = true;
      try {
        state.generator ??= prepare();
        while (result.operations < maxOperations) {
          checkpoint();
          if (state.awaitingChild) {
            const step = state.child!.step(maxOperations - result.operations);
            if (step.done) { state.pending = step.value; state.awaitingChild = false; }
            result.operations += step.operations; result.childOperations += step.operations; result.allocatedBytes += step.allocatedBytes ?? 0;
            checkpoint(); continue;
          }
          const next = state.generator.next();
          if (next.done) throw new DOMException('Graph presentation preparation ended unexpectedly', 'InvalidStateError');
          if (next.value === PRESENTATION_TRANSFER) {
            const candidate = state.candidate!;
            // Drop the generator and all borrowed admission inputs before the final fence.
            state.generator = undefined; state.input = undefined; state.createCanvas = undefined;
            checkpoint();
            state.consumeNodes?.(); state.consumeEdges?.();
            state.active = false;
            result.coordinatorOperations++; result.operations++; result.done = true; result.value = candidate;
            release(); return result;
          }
          const cost = next.value;
          result.coordinatorOperations += cost.coordinatorOperations ?? 0; result.inventoryEntries += cost.inventoryEntries ?? 0; result.rootLinks += cost.rootLinks ?? 0;
          result.operations += (cost.coordinatorOperations ?? 0) + (cost.inventoryEntries ?? 0) + (cost.rootLinks ?? 0);
          for (const key of PRESENTATION_COST_FIELDS) result[key] += cost[key] ?? 0;
          checkpoint();
        }
        return result;
      } catch (error) {
        running = false;
        try { close(); } catch { /* Preserve the originating failure, including falsey thrown values. */ }
        throw error;
      } finally { running = false; }
    },
    dispose: close,
  };
}
