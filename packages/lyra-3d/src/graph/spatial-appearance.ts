import { admitGraphNodeMeshes, createGraphNodeMeshWork, type GraphNodeMesh, type GraphNodeMeshData } from './node-mesh.js';
import { createGraphDashAdmission, graphCurvatureValue, graphSpatialDimmedOpacity, graphSpatialLabelLimit, graphSpatialSizeLimit, graphSpatialSizeUnits, GRAPH_DASH_LENGTH_LIMIT, isGraphCurvatureValue, isGraphDashValue, isGraphSpatialFloatValue, isGraphSpatialMaskValue, isGraphSpatialSizeValue, type GraphSpatialColumnName } from './spatial-appearance-admission.js';

const meshData = new WeakMap<GraphSpatialAppearance, GraphNodeMeshData>();
/** Internal owned geometry associated with an admitted appearance. */
export function graphSpatialNodeMeshData(appearance: GraphSpatialAppearance): GraphNodeMeshData | undefined { return meshData.get(appearance); }

/** Resolved spatial graph paint. All colors are interleaved sRGB RGBA in [0,1]. */
export interface GraphSpatialAppearance {
  /** Optional bounded triangle bodies in original node row order. Null keeps the ordinary glyph. */
  readonly nodeMeshes?: readonly (GraphNodeMesh | null)[];
  /** Node sizes remain diameters (CSS up to 1024, world up to 20,000,000); world mode preserves perspective scaling. */
  readonly sizeUnits?: 'css' | 'world';
  /** 0 circle, 1 square, 2 diamond. Squares and diamonds have the circle's area. */
  readonly nodeShapes?: Uint8Array;
  readonly nodeColors?: Float32Array;
  readonly expandable?: Uint8Array;
  readonly edgeColors?: Float32Array;
  /** CSS-pixel widths in [0,1000]; zero removes line, label, arrow and pick geometry. */
  readonly edgeWidths?: Float32Array;
  /** Signed world-space quadratic bow per edge, clamped to [-1,1]. Zero is straight; loops and dangling stubs ignore it. */
  readonly edgeCurvatures?: Float32Array;
  /** One CSS-pixel dash sequence per edge, each at most 32 entries; empty means solid. At most 65,534 authored distinct patterns. */
  readonly edgeDashes?: readonly (readonly number[])[];
  /** Dangling rows draw a non-pickable stub; their layout target must equal their source. */
  readonly dangling?: Uint8Array;
  readonly dimmedOpacity?: number;
  /** Painted text rows, 0..20,000. Defaults to the companion's bounded 256-label policy. */
  readonly labelLimit?: number;
}
/** Validates and copies all appearance columns before a live graph revision changes. */
export function admitGraphSpatialAppearance(value: GraphSpatialAppearance, nodes: number, edges: number, isCurrent?: () => boolean): GraphSpatialAppearance {
  if (value === null || typeof value !== 'object') throw new TypeError('Invalid graph spatial appearance');
  const bytes = (array: Uint8Array | undefined, count: number, name: GraphSpatialColumnName) => {
    if (array === undefined) return undefined;
    if (!(array instanceof Uint8Array) || !(array.buffer instanceof ArrayBuffer) || array.length !== count || !array.every((item) => isGraphSpatialMaskValue(name, item))) throw new RangeError('Invalid graph appearance mask');
    return array.slice();
  };
  const floats = (array: Float32Array | undefined, count: number, name: GraphSpatialColumnName) => {
    if (array === undefined) return undefined;
    if (!(array instanceof Float32Array) || !(array.buffer instanceof ArrayBuffer) || array.length !== count || !array.every((item) => isGraphSpatialFloatValue(name, item))) throw new RangeError('Invalid graph appearance values');
    return array.slice();
  };
  // Signed curvature has its own admission rule; paint widths and colors stay nonnegative.
  const curvatureDescriptor = Object.getOwnPropertyDescriptor(value, 'edgeCurvatures');
  if (curvatureDescriptor && !('value' in curvatureDescriptor)) throw new TypeError('Invalid graph curvature column');
  const rawCurvatures: unknown = curvatureDescriptor?.value;
  let edgeCurvatures: Float32Array | undefined;
  if (rawCurvatures !== undefined) {
    if (!(rawCurvatures instanceof Float32Array) || !(rawCurvatures.buffer instanceof ArrayBuffer) || rawCurvatures.length !== edges || !rawCurvatures.every(isGraphCurvatureValue)) throw new RangeError('Invalid graph curvature values');
    edgeCurvatures = rawCurvatures.map(graphCurvatureValue);
  }
  const rawSizeUnits = value.sizeUnits, rawDimmedOpacity = value.dimmedOpacity;
  const sizeUnits = graphSpatialSizeUnits(rawSizeUnits);
  const labelLimit = graphSpatialLabelLimit(value.labelLimit);
  const dimmedOpacity = graphSpatialDimmedOpacity(rawDimmedOpacity);
  let edgeDashes: readonly (readonly number[])[] | undefined;
  if (value.edgeDashes !== undefined) {
    if (!Array.isArray(value.edgeDashes) || value.edgeDashes.length !== edges) throw new RangeError('Invalid graph dash rows');
    const admitDash = createGraphDashAdmission();
    edgeDashes = Array.from(value.edgeDashes, (dash) => {
      if (!Array.isArray(dash) || dash.length > GRAPH_DASH_LENGTH_LIMIT || !Array.from(dash).every(isGraphDashValue)) throw new RangeError('Invalid graph dash pattern');
      admitDash(dash);
      return Object.freeze([...dash]);
    });
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, 'nodeMeshes');
  if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid graph node meshes');
  const meshes = admitGraphNodeMeshes(descriptor?.value, nodes, isCurrent);
  const result: GraphSpatialAppearance = { ...(meshes ? { nodeMeshes: meshes.nodeMeshes } : {}), sizeUnits, dimmedOpacity, labelLimit, nodeShapes: bytes(value.nodeShapes, nodes, 'nodeShapes'), nodeColors: floats(value.nodeColors, nodes * 4, 'nodeColors'), expandable: bytes(value.expandable, nodes, 'expandable'), edgeColors: floats(value.edgeColors, edges * 4, 'edgeColors'), edgeWidths: floats(value.edgeWidths, edges, 'edgeWidths'), edgeCurvatures, dangling: bytes(value.dangling, edges, 'dangling'), edgeDashes };
  if (meshes) meshData.set(result, meshes);
  return result;
}

/** Explicit spatial glyph bounds keep derived loop coordinates finite in GPU attributes. */
export function validateGraphSpatialSizes(sizes: Float32Array | undefined, count: number, appearance: GraphSpatialAppearance): void {
  if (sizes === undefined) return;
  const limit = graphSpatialSizeLimit(appearance.sizeUnits);
  if (!(sizes instanceof Float32Array) || !(sizes.buffer instanceof ArrayBuffer) || sizes.length !== count || !sizes.every((size) => isGraphSpatialSizeValue(size, limit))) throw new RangeError('Graph spatial diameters exceed the supported range');
}

export interface GraphSpatialAppearanceWorkStep {
  readonly done: boolean;
  readonly operations: number;
  /** Owned typed column and custom mesh backing; excludes JavaScript storage. */
  readonly allocatedBytes: number;
  /** Native keys materialized by the composed custom mesh admission. */
  readonly reflectedKeys: number;
  /** Owned numeric dash entries, not heap bytes. */
  readonly copiedDashValues: number;
  readonly value?: GraphSpatialAppearance;
}
export interface GraphSpatialAppearanceWork {
  step(maxOperations: number): GraphSpatialAppearanceWorkStep;
  dispose(): void;
}
type AppearanceColumn = Uint8Array | Float32Array;
type AppearanceColumnKind = 'Uint8Array' | 'Float32Array';
type AppearanceColumnName = GraphSpatialColumnName | 'edgeCurvatures';
interface BorrowedAppearanceColumn { readonly value: AppearanceColumn; readonly kind: AppearanceColumnKind; readonly name: AppearanceColumnName; readonly length: number }
interface AppearanceWorkState {
  input: unknown;
  guard: (() => boolean) | undefined;
  active: boolean;
  column: BorrowedAppearanceColumn | undefined;
}
interface AppearanceWorkCost { readonly allocatedBytes: number; readonly reflectedKeys: number; readonly copiedDashValues: number }
type AppearanceGenerator<Value> = Generator<AppearanceWorkCost | undefined, Value>;
type AppearanceRefusal = () => never;
const appearanceFields = ['edgeCurvatures', 'sizeUnits', 'dimmedOpacity', 'labelLimit', 'edgeDashes', 'nodeMeshes', 'nodeShapes', 'nodeColors', 'expandable', 'edgeColors', 'edgeWidths', 'dangling'] as const;
type CapturedAppearance = Record<typeof appearanceFields[number], unknown>;
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const typedName = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const bufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const typedValues = Uint8Array.prototype.values;

function invalidAppearance(): never { throw new TypeError('Invalid graph spatial appearance'); }
function invalidDashRows(): never { throw new RangeError('Invalid graph dash rows'); }
function invalidDashPattern(): never { throw new RangeError('Invalid graph dash pattern'); }
function invalidColumn(name: AppearanceColumnName, kind: AppearanceColumnKind): never {
  throw new RangeError(name === 'edgeCurvatures' ? 'Invalid graph curvature values' : kind === 'Uint8Array' ? 'Invalid graph appearance mask' : 'Invalid graph appearance values');
}
function appearanceCheckpoint(state: AppearanceWorkState): void {
  const guard = state.guard;
  if (!state.active || (guard && !guard()) || !state.active) {
    const error = new Error('Graph spatial appearance admission was superseded'); error.name = 'AbortError'; throw error;
  }
}
function appearanceRead<Value>(state: AppearanceWorkState, operation: () => Value, refuse: AppearanceRefusal): Value {
  appearanceCheckpoint(state);
  let result: Value;
  try { result = operation(); } catch { appearanceCheckpoint(state); return refuse(); }
  appearanceCheckpoint(state); return result;
}
function appearanceField(state: AppearanceWorkState, input: object, key: string, refuse: AppearanceRefusal): unknown {
  const descriptor = appearanceRead(state, () => Object.getOwnPropertyDescriptor(input, key), refuse);
  if (!descriptor || !('value' in descriptor)) return refuse();
  return descriptor.value as unknown;
}
function* captureAppearance(state: AppearanceWorkState): AppearanceGenerator<CapturedAppearance> {
  const input = state.input;
  if (input === null || typeof input !== 'object' || appearanceRead(state, () => Array.isArray(input), invalidAppearance)) return invalidAppearance();
  const captured = {} as CapturedAppearance;
  for (const name of appearanceFields) {
    const descriptor = appearanceRead(state, () => Object.getOwnPropertyDescriptor(input, name), invalidAppearance);
    if (descriptor && !('value' in descriptor)) {
      if (name === 'edgeCurvatures') throw new TypeError('Invalid graph curvature column');
      if (name === 'nodeMeshes') throw new TypeError('Invalid graph node meshes');
      return invalidAppearance();
    }
    captured[name] = descriptor?.value as unknown;
    yield;
  }
  return captured;
}
function appearanceColumnLength(state: AppearanceWorkState, value: unknown, name: AppearanceColumnName, kind: AppearanceColumnKind): number {
  return appearanceRead(state, () => {
    if (typedName.call(value) !== kind) return invalidColumn(name, kind);
    const buffer: unknown = typedBuffer.call(value);
    bufferLength.call(buffer);
    if (bufferResizable?.call(buffer)) return invalidColumn(name, kind);
    typedValues.call(value as Uint8Array);
    return typedLength.call(value) as number;
  }, () => invalidColumn(name, kind));
}
function checkAppearanceColumn(state: AppearanceWorkState): void {
  const column = state.column;
  if (column && appearanceColumnLength(state, column.value, column.name, column.kind) !== column.length) return invalidColumn(column.name, column.kind);
}
function* copyAppearanceColumn(state: AppearanceWorkState, input: unknown, count: number, name: AppearanceColumnName, kind: AppearanceColumnKind): AppearanceGenerator<AppearanceColumn | undefined> {
  if (input === undefined) return undefined;
  if (appearanceColumnLength(state, input, name, kind) !== count) return invalidColumn(name, kind);
  const source = input as AppearanceColumn;
  state.column = { value: source, kind, name, length: count };
  const owned = kind === 'Uint8Array' ? new Uint8Array(count) : new Float32Array(count);
  yield { allocatedBytes: owned.byteLength, reflectedKeys: 0, copiedDashValues: 0 };
  for (let index = 0; index < count; index++) {
    const value = source[index];
    const valid = name === 'edgeCurvatures' ? isGraphCurvatureValue(value) : kind === 'Uint8Array' ? isGraphSpatialMaskValue(name, value!) : isGraphSpatialFloatValue(name, value!);
    if (!valid) return invalidColumn(name, kind);
    // Validate the source before assignment; undefined detached reads must not become zeroes.
    owned[index] = name === 'edgeCurvatures' ? graphCurvatureValue(value!) : value!;
    yield;
  }
  state.column = undefined;
  return owned;
}
function* copyAppearanceBytes(state: AppearanceWorkState, input: unknown, count: number, name: GraphSpatialColumnName): AppearanceGenerator<Uint8Array | undefined> {
  return (yield* copyAppearanceColumn(state, input, count, name, 'Uint8Array')) as Uint8Array | undefined;
}
function* copyAppearanceFloats(state: AppearanceWorkState, input: unknown, count: number, name: AppearanceColumnName): AppearanceGenerator<Float32Array | undefined> {
  return (yield* copyAppearanceColumn(state, input, count, name, 'Float32Array')) as Float32Array | undefined;
}
function* copyAppearanceDashes(state: AppearanceWorkState, input: unknown, edges: number): AppearanceGenerator<readonly (readonly number[])[] | undefined> {
  if (input === undefined) return undefined;
  if (!appearanceRead(state, () => Array.isArray(input), invalidDashRows)) return invalidDashRows();
  const source = input as unknown[];
  if (appearanceField(state, source, 'length', invalidDashRows) !== edges) return invalidDashRows();
  const owned = new Array<readonly number[]>(edges);
  const admitDash = createGraphDashAdmission();
  yield;
  for (let row = 0; row < edges; row++) {
    const value = appearanceField(state, source, String(row), invalidDashRows);
    if (!appearanceRead(state, () => Array.isArray(value), invalidDashPattern)) return invalidDashPattern();
    const dash = value as unknown[];
    const length = appearanceField(state, dash, 'length', invalidDashPattern);
    if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > GRAPH_DASH_LENGTH_LIMIT) return invalidDashPattern();
    const pattern = new Array<number>(length);
    yield;
    for (let index = 0; index < length; index++) {
      const component = appearanceField(state, dash, String(index), invalidDashPattern);
      if (!isGraphDashValue(component)) return invalidDashPattern();
      pattern[index] = component as number;
      yield { allocatedBytes: 0, reflectedKeys: 0, copiedDashValues: 1 };
    }
    // Joining/freezing is bounded by the per-pattern ceiling, never the outer edge count.
    admitDash(pattern); owned[row] = Object.freeze(pattern);
    yield;
  }
  return owned;
}
function* prepareAppearance(state: AppearanceWorkState, nodes: number, edges: number): AppearanceGenerator<GraphSpatialAppearance> {
  appearanceCheckpoint(state);
  if (!Number.isSafeInteger(nodes) || nodes < 0 || nodes > 200_000 || !Number.isSafeInteger(edges) || edges < 0 || edges > 1_000_000) {
    throw new RangeError('Invalid graph spatial appearance counts');
  }
  const input = yield* captureAppearance(state);
  state.input = undefined;
  const edgeCurvatures = yield* copyAppearanceFloats(state, input.edgeCurvatures, edges, 'edgeCurvatures');
  const sizeUnits = graphSpatialSizeUnits(input.sizeUnits);
  const labelLimit = graphSpatialLabelLimit(input.labelLimit);
  const dimmedOpacity = graphSpatialDimmedOpacity(input.dimmedOpacity);
  yield;
  const edgeDashes = yield* copyAppearanceDashes(state, input.edgeDashes, edges);
  const child = createGraphNodeMeshWork(input.nodeMeshes, nodes, () => { appearanceCheckpoint(state); return true; });
  let meshes: GraphNodeMeshData | undefined;
  try {
    for (;;) {
      const step = child.step(1);
      if (step.done) meshes = step.value;
      // One child operation is one outer operation; propagate its costs exactly once.
      yield { allocatedBytes: step.allocatedBytes, reflectedKeys: step.reflectedKeys, copiedDashValues: 0 };
      if (step.done) break;
    }
  } finally { child.dispose(); }
  const nodeShapes = yield* copyAppearanceBytes(state, input.nodeShapes, nodes, 'nodeShapes');
  const nodeColors = yield* copyAppearanceFloats(state, input.nodeColors, nodes * 4, 'nodeColors');
  const expandable = yield* copyAppearanceBytes(state, input.expandable, nodes, 'expandable');
  const edgeColors = yield* copyAppearanceFloats(state, input.edgeColors, edges * 4, 'edgeColors');
  const edgeWidths = yield* copyAppearanceFloats(state, input.edgeWidths, edges, 'edgeWidths');
  const dangling = yield* copyAppearanceBytes(state, input.dangling, edges, 'dangling');
  const result: GraphSpatialAppearance = { ...(meshes ? { nodeMeshes: meshes.nodeMeshes } : {}), sizeUnits, dimmedOpacity, labelLimit,
    nodeShapes, nodeColors, expandable, edgeColors, edgeWidths, edgeCurvatures, dangling, edgeDashes };
  appearanceCheckpoint(state);
  if (meshes) meshData.set(result, meshes);
  return result;
}

/**
 * Borrows unchanged appearance inputs until completion/disposal. Explicit visits are chunked;
 * native allocations/reflection and the mesh work's native enumeration remain indivisible.
 */
export function createGraphSpatialAppearanceWork(input: unknown, nodeCount: number, edgeCount: number, isCurrent?: () => boolean): GraphSpatialAppearanceWork {
  const state: AppearanceWorkState = { input, guard: isCurrent, active: true, column: undefined };
  input = undefined; isCurrent = undefined;
  let iterator: AppearanceGenerator<GraphSpatialAppearance> | undefined = prepareAppearance(state, nodeCount, edgeCount);
  let running = false;
  const close = (): void => {
    state.active = false; state.input = undefined; state.guard = undefined; state.column = undefined;
    if (!running) { iterator?.return(undefined as never); iterator = undefined; }
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph spatial appearance work is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph spatial appearance work budget');
      let operations = 0, allocatedBytes = 0, reflectedKeys = 0, copiedDashValues = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          appearanceCheckpoint(state); checkAppearanceColumn(state);
          const step = iterator!.next(); operations++;
          if (step.done) {
            const value = step.value; close();
            return { done: true, operations, allocatedBytes, reflectedKeys, copiedDashValues, value };
          }
          allocatedBytes += step.value?.allocatedBytes ?? 0;
          reflectedKeys += step.value?.reflectedKeys ?? 0;
          copiedDashValues += step.value?.copiedDashValues ?? 0;
        }
        return { done: false, operations, allocatedBytes, reflectedKeys, copiedDashValues };
      } catch (error) { close(); throw error; }
      finally { running = false; if (!state.active) close(); }
    },
    dispose: close,
  };
}
