/** A bounded, node-local triangle mesh. Normals are one outward unit vector per face. */
export interface GraphNodeMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** sRGB RGBA in [0,1]; omission inherits the node's resolved fill. */
  readonly color?: readonly [number, number, number, number];
}

/** An owned presentation snapshot. Null rows retain the ordinary node body. */
export interface GraphNodeMeshData {
  readonly nodeMeshes: readonly (GraphNodeMesh | null)[];
  readonly triangleCount: number;
  readonly customNodeCount: number;
  /** Reserved geometry and color storage: 48 bytes per face and 16 bytes per custom row. */
  readonly payloadBytes: number;
}

export type GraphNodeMeshAdmissionReason = 'invalid' | 'budget';

/** A bounded admission failure without application exception text. */
export class GraphNodeMeshAdmissionError extends Error {
  readonly code = 'graph-node-mesh';
  constructor(readonly reason: GraphNodeMeshAdmissionReason, readonly nodeIndex?: number) {
    super(reason === 'budget' ? 'Graph node mesh budget exceeded' : 'Invalid graph node mesh');
    this.name = 'GraphNodeMeshAdmissionError';
  }
}

const typedPrototype = Object.getPrototypeOf(Float32Array.prototype) as object;
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const typedName = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const bufferResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const copyFloats = Float32Array.prototype.set;
const NODE_LIMIT = 200_000;
const CUSTOM_NODE_LIMIT = 16_384;
const FACE_LIMIT = 65_536;
const NODE_FACE_LIMIT = 64;
const PAYLOAD_LIMIT = 4_194_304;

interface PendingMesh {
  readonly row: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly positionLength: number;
  readonly normalLength: number;
  readonly color?: readonly [number, number, number, number];
}

/** Deterministic admission accounting; native enumeration and freezing are indivisible. */
export interface GraphNodeMeshWorkStep {
  readonly done: boolean;
  /** Explicit visits, allocations and fixed-size checkpoints completed by this step. */
  readonly operations: number;
  /** Owned typed backing bytes allocated by this step; excludes JavaScript row storage. */
  readonly allocatedBytes: number;
  /** Keys materialized by native enumeration before incremental key inspection. */
  readonly reflectedKeys: number;
  readonly value?: GraphNodeMeshData;
}
export interface GraphNodeMeshWork {
  step(maxOperations: number): GraphNodeMeshWorkStep;
  dispose(): void;
}
interface MeshWorkState {
  value: unknown;
  guard: (() => boolean) | undefined;
  active: boolean;
  current: PendingMesh | undefined;
}
interface MeshWorkCost { readonly allocatedBytes: number; readonly reflectedKeys: number }
type MeshWorkGenerator<Value> = Generator<MeshWorkCost | undefined, Value>;

function invalid(row?: number): never { throw new GraphNodeMeshAdmissionError('invalid', row); }
function checkpoint(state: MeshWorkState): void {
  const guard = state.guard;
  if (!state.active || (guard && !guard()) || !state.active) {
    const error = new Error('Graph node mesh admission was superseded'); error.name = 'AbortError'; throw error;
  }
}
function read<T>(state: MeshWorkState, operation: () => T, row?: number): T {
  checkpoint(state);
  let result: T;
  try { result = operation(); } catch { checkpoint(state); return invalid(row); }
  checkpoint(state); return result;
}
function field(state: MeshWorkState, input: object, key: PropertyKey, row?: number, required = true): unknown {
  const descriptor = read(state, () => Object.getOwnPropertyDescriptor(input, key), row);
  if (!descriptor) return required ? invalid(row) : undefined;
  if (!('value' in descriptor)) return invalid(row);
  return descriptor.value as unknown;
}
function* exactArray(state: MeshWorkState, input: unknown, length: number, row?: number): MeshWorkGenerator<unknown[]> {
  if (!read(state, () => Array.isArray(input), row)) return invalid(row);
  const array = input as unknown[];
  if (field(state, array, 'length', row) !== length) return invalid(row);
  const keys = read(state, () => Reflect.ownKeys(array), row);
  // Native key enumeration is indivisible; individual returned keys are visited incrementally.
  yield { allocatedBytes: 0, reflectedKeys: keys.length };
  if (keys.length !== length + 1) return invalid(row);
  for (const key of keys) {
    if (key !== 'length') {
      if (typeof key !== 'string') return invalid(row);
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) return invalid(row);
    }
    yield;
  }
  return array;
}
function floats(state: MeshWorkState, input: unknown, row: number): { array: Float32Array; length: number } {
  if (!read(state, () => ArrayBuffer.isView(input), row) || read(state, () => typedName.call(input) as unknown, row) !== 'Float32Array') return invalid(row);
  const length = read(state, () => typedLength.call(input) as number, row);
  const buffer = read(state, () => typedBuffer.call(input) as ArrayBuffer, row);
  // Intrinsic getters reject shared/proxied buffers without reading shadowed public properties.
  read(state, () => bufferLength.call(buffer) as number, row);
  if (bufferResizable && read(state, () => bufferResizable.call(buffer) as boolean, row)) return invalid(row);
  read(state, () => new Uint8Array(buffer, 0, 0), row);
  return { array: input as Float32Array, length };
}
function checkCurrentBuffers(state: MeshWorkState): void {
  const entry = state.current;
  if (!entry) return;
  if (floats(state, entry.positions, entry.row).length !== entry.positionLength ||
      floats(state, entry.normals, entry.row).length !== entry.normalLength) return invalid(entry.row);
}
function* colorOf(state: MeshWorkState, input: unknown, row: number): MeshWorkGenerator<readonly [number, number, number, number] | undefined> {
  if (input === undefined) return undefined;
  const array = yield* exactArray(state, input, 4, row);
  const components: number[] = [];
  for (let index = 0; index < 4; index++) {
    const component = field(state, array, String(index), row);
    if (typeof component !== 'number' || !Number.isFinite(component) || component < 0 || component > 1) return invalid(row);
    components.push(component);
    yield;
  }
  return Object.freeze([components[0]!, components[1]!, components[2]!, components[3]!] as const);
}

function* admitWork(state: MeshWorkState, nodeCount: number): MeshWorkGenerator<GraphNodeMeshData | undefined> {
  checkpoint(state);
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 0 || nodeCount > NODE_LIMIT) return invalid();
  if (state.value === undefined) return undefined;
  const rows = yield* exactArray(state, state.value, nodeCount);
  const pending: PendingMesh[] = [];
  let triangleCount = 0;
  for (let row = 0; row < nodeCount; row++) {
    const entry = field(state, rows, String(row), row);
    if (entry === null) { yield; continue; }
    if (!entry || typeof entry !== 'object') return invalid(row);
    const prototype = read(state, () => Object.getPrototypeOf(entry) as unknown, row);
    if (prototype !== null && prototype !== Object.prototype) return invalid(row);
    const keys = read(state, () => Reflect.ownKeys(entry), row);
    yield { allocatedBytes: 0, reflectedKeys: keys.length };
    for (const key of keys) {
      if (key !== 'positions' && key !== 'normals' && key !== 'color') return invalid(row);
      yield;
    }
    const positions = floats(state, field(state, entry, 'positions', row), row);
    const normals = floats(state, field(state, entry, 'normals', row), row);
    if (positions.length === 0 || positions.length % 9 !== 0 || normals.length !== positions.length / 3) return invalid(row);
    const faces = positions.length / 9;
    if (faces > NODE_FACE_LIMIT || triangleCount + faces > FACE_LIMIT || pending.length + 1 > CUSTOM_NODE_LIMIT) {
      throw new GraphNodeMeshAdmissionError('budget', row);
    }
    const nextPayload = (triangleCount + faces) * 48 + (pending.length + 1) * 16;
    if (!Number.isSafeInteger(nextPayload) || nextPayload > PAYLOAD_LIMIT) throw new GraphNodeMeshAdmissionError('budget', row);
    const color = yield* colorOf(state, field(state, entry, 'color', row, false), row);
    pending.push({ row, positions: positions.array, normals: normals.array, positionLength: positions.length, normalLength: normals.length, ...(color === undefined ? {} : { color }) });
    triangleCount += faces;
    yield;
  }
  if (pending.length === 0) { checkpoint(state); return undefined; }

  const copy = (source: Float32Array, length: number, row: number) => read(state, () => {
    if (floats(state, source, row).length !== length) return invalid(row);
    const result = new Float32Array(length); copyFloats.call(result, source); return result;
  }, row);
  const owned = new Array<GraphNodeMesh | null>(nodeCount);
  yield;
  for (let row = 0; row < nodeCount; row++) { owned[row] = null; yield; }
  for (const entry of pending) {
    state.current = entry;
    checkCurrentBuffers(state);
    const positions = copy(entry.positions, entry.positionLength, entry.row);
    yield { allocatedBytes: positions.byteLength, reflectedKeys: 0 };
    const normals = copy(entry.normals, entry.normalLength, entry.row);
    yield { allocatedBytes: normals.byteLength, reflectedKeys: 0 };
    for (let offset = 0; offset < positions.length; offset += 3) {
      const x = positions[offset]!, y = positions[offset + 1]!, z = positions[offset + 2]!;
      if (![x, y, z].every(Number.isFinite) || x * x + y * y + z * z > 1 + 1e-6) return invalid(entry.row);
      yield;
    }
    for (let face = 0; face < normals.length; face += 3) {
      const nx = normals[face]!, ny = normals[face + 1]!, nz = normals[face + 2]!;
      if (![nx, ny, nz].every(Number.isFinite) || Math.abs(nx * nx + ny * ny + nz * nz - 1) > 1e-3) return invalid(entry.row);
      const offset = face * 3;
      const ax = positions[offset]!, ay = positions[offset + 1]!, az = positions[offset + 2]!;
      const bx = positions[offset + 3]! - ax, by = positions[offset + 4]! - ay, bz = positions[offset + 5]! - az;
      const cx = positions[offset + 6]! - ax, cy = positions[offset + 7]! - ay, cz = positions[offset + 8]! - az;
      const x = by * cz - bz * cy, y = bz * cx - bx * cz, z = bx * cy - by * cx;
      if (x * x + y * y + z * z <= 1e-12 || x * nx + y * ny + z * nz <= 0) return invalid(entry.row);
      yield;
    }
    checkpoint(state);
    owned[entry.row] = Object.freeze({ positions, normals, ...(entry.color === undefined ? {} : { color: entry.color }) });
    state.current = undefined;
    yield;
  }
  checkpoint(state);
  // Freezing the owned row array is another input-sized, indivisible native operation.
  return Object.freeze({ nodeMeshes: Object.freeze(owned), triangleCount, customNodeCount: pending.length, payloadBytes: triangleCount * 48 + pending.length * 16 });
}

/**
 * Borrows unchanged input until completion/disposal. Native key enumeration and freezing
 * cannot be interrupted; operations bound explicit visits, not elapsed time or proxy work.
 */
export function createGraphNodeMeshWork(value: unknown, nodeCount: number, isCurrent?: () => boolean): GraphNodeMeshWork {
  const state: MeshWorkState = { value, guard: isCurrent, active: true, current: undefined };
  value = undefined; isCurrent = undefined;
  let iterator: MeshWorkGenerator<GraphNodeMeshData | undefined> | undefined = admitWork(state, nodeCount);
  let running = false;
  const close = (): void => {
    state.active = false;
    state.value = undefined;
    state.guard = undefined;
    state.current = undefined;
    if (!running) { iterator?.return(undefined); iterator = undefined; }
  };
  return {
    step(maxOperations) {
      if (!state.active || running) throw new DOMException('Graph node mesh work is closed or running', 'InvalidStateError');
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph node mesh work budget');
      let operations = 0, allocatedBytes = 0, reflectedKeys = 0;
      running = true;
      try {
        while (operations < maxOperations) {
          checkpoint(state);
          checkCurrentBuffers(state);
          const step = iterator!.next();
          operations++;
          if (step.done) {
            const result = step.value;
            close();
            return { done: true, operations, allocatedBytes, reflectedKeys, value: result };
          }
          allocatedBytes += step.value?.allocatedBytes ?? 0;
          reflectedKeys += step.value?.reflectedKeys ?? 0;
        }
        return { done: false, operations, allocatedBytes, reflectedKeys };
      } catch (error) { close(); throw error; }
      finally { running = false; if (!state.active) close(); }
    },
    dispose: close,
  };
}

/**
 * Validates descriptors, preflights scene limits and owns all mesh bytes before returning.
 * `isCurrent` lets a presentation transaction abort after reflective application reentrancy.
 * Undefined and all-null inputs preserve the ordinary path without retained custom row storage.
 */
export function admitGraphNodeMeshes(value: unknown, nodeCount: number, isCurrent?: () => boolean): GraphNodeMeshData | undefined {
  const work = createGraphNodeMeshWork(value, nodeCount, isCurrent);
  for (;;) {
    const step = work.step(4096);
    if (step.done) return step.value;
  }
}
