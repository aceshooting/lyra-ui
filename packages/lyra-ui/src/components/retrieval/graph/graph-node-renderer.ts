import type { LyraGraphNode } from './graph-model.js';

/** Frozen identity shell supplied to the synchronous renderer. */
export interface LyraGraphNodeRenderContext {
  readonly id: string;
  readonly index: number;
  readonly node?: Readonly<LyraGraphNode>;
}

/** Bounded node-local triangles with one outward unit normal per face. */
export interface LyraGraphNodeMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly color?: readonly [number, number, number, number];
}

export type LyraGraphNodeRenderer = (context: Readonly<LyraGraphNodeRenderContext>) => LyraGraphNodeMesh | null | undefined;

export interface LyraGraphNodeRenderErrorDetail {
  readonly reason: 'callback' | 'invalid' | 'budget';
  readonly nodeId?: string;
}

/** Sanitized failure that never retains an application exception. */
export class GraphNodeRendererError extends Error {
  constructor(readonly reason: LyraGraphNodeRenderErrorDetail['reason'], readonly nodeId?: string) {
    super('Graph node renderer admission failed');
    this.name = 'GraphNodeRendererError';
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

/** Await a scheduler without making an obsolete admission depend on its settlement. */
function abortableNodeRendererYield(task: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return task;
  return new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new DOMException('Graph node admission was superseded.', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    void task.then(() => { signal.removeEventListener('abort', abort); resolve(); }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

/**
 * Validates descriptors, preflights scene limits and owns all mesh bytes before returning.
 * `isCurrent` lets a presentation transaction abort after reflective application reentrancy.
 * Undefined and all-null inputs preserve the ordinary path without retained custom row storage.
 */
export async function admitGraphNodeRenderer(renderer: unknown, nodeCount: number,
  context: (index: number) => Readonly<LyraGraphNodeRenderContext>,
  isCurrent: () => boolean, yieldTask: () => Promise<void>, signal?: AbortSignal,
): Promise<readonly (LyraGraphNodeMesh | null)[] | undefined> {
  let nodeId: string | undefined;
  const invalid = (): never => { throw new GraphNodeRendererError('invalid', nodeId); };
  const checkpoint = () => {
    if (signal?.aborted || !isCurrent()) {
      const error = new Error('Graph node mesh admission was superseded'); error.name = 'AbortError'; throw error;
    }
  };
  const read = <T>(operation: () => T): T => {
    checkpoint();
    let result: T;
    try { result = operation(); } catch { checkpoint(); return invalid(); }
    checkpoint(); return result;
  };
  const field = (input: object, key: PropertyKey, required = true): unknown => {
    const descriptor = read(() => Object.getOwnPropertyDescriptor(input, key));
    if (!descriptor) return required ? invalid() : undefined;
    if (!('value' in descriptor)) return invalid();
    return descriptor.value as unknown;
  };
  const exactArray = (input: unknown, length: number): unknown[] => {
    if (!read(() => Array.isArray(input))) return invalid();
    const array = input as unknown[];
    if (field(array, 'length') !== length) return invalid();
    const keys = read(() => Reflect.ownKeys(array));
    if (keys.length !== length + 1) return invalid();
    for (const key of keys) {
      if (key === 'length') continue;
      if (typeof key !== 'string') return invalid();
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) return invalid();
    }
    return array;
  };
  const floats = (input: unknown): { array: Float32Array; length: number } => {
    if (!read(() => ArrayBuffer.isView(input)) || read(() => typedName.call(input) as unknown) !== 'Float32Array') return invalid();
    const length = read(() => typedLength.call(input) as number);
    const buffer = read(() => typedBuffer.call(input) as ArrayBuffer);
    // Intrinsic getters reject shared/proxied buffers without reading shadowed public properties.
    read(() => bufferLength.call(buffer) as number);
    if (bufferResizable && read(() => bufferResizable.call(buffer) as boolean)) return invalid();
    read(() => new Uint8Array(buffer, 0, 0));
    return { array: input as Float32Array, length };
  };
  const colorOf = (input: unknown): readonly [number, number, number, number] | undefined => {
    if (input === undefined) return undefined;
    const array = exactArray(input, 4);
    const components: number[] = [];
    for (let index = 0; index < 4; index++) {
      const component = field(array, String(index));
      if (typeof component !== 'number' || !Number.isFinite(component) || component < 0 || component > 1) return invalid();
      components.push(component);
    }
    return Object.freeze([components[0]!, components[1]!, components[2]!, components[3]!] as const);
  };

  checkpoint();
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 0 || nodeCount > NODE_LIMIT) return invalid();
  if (renderer === undefined || renderer === null) return undefined;
  if (typeof renderer !== 'function') return invalid();
  const owned = new Array<LyraGraphNodeMesh | null>(nodeCount).fill(null);
  let triangleCount = 0, customCount = 0, callbacks = 0, copiedFloats = 0;
  const yieldSlice = async () => {
    await abortableNodeRendererYield(yieldTask(), signal);
    checkpoint(); callbacks = 0; copiedFloats = 0;
  };
  let committed = false;
  try {
    for (let row = 0; row < nodeCount; row++) {
      if (callbacks >= 128) await yieldSlice();
      checkpoint();
      const shell = context(row); checkpoint(); nodeId = shell.id;
      let entry: unknown;
      try { entry = renderer(shell) as unknown; } catch { checkpoint(); throw new GraphNodeRendererError('callback', nodeId); }
      checkpoint(); callbacks++;
      if (entry === null || entry === undefined) continue;
      if (!entry || typeof entry !== 'object') return invalid();
      const prototype = read(() => Object.getPrototypeOf(entry) as unknown);
      if (prototype !== null && prototype !== Object.prototype) return invalid();
      const keys = read(() => Reflect.ownKeys(entry as object));
      if (keys.some(key => key !== 'positions' && key !== 'normals' && key !== 'color')) return invalid();
      const positions = floats(field(entry, 'positions'));
      const normals = floats(field(entry, 'normals'));
      if (positions.length === 0 || positions.length % 9 !== 0 || normals.length !== positions.length / 3) return invalid();
      const faces = positions.length / 9;
      if (faces > NODE_FACE_LIMIT || triangleCount + faces > FACE_LIMIT || customCount + 1 > CUSTOM_NODE_LIMIT) {
        throw new GraphNodeRendererError('budget', nodeId);
      }
      const nextPayload = (triangleCount + faces) * 48 + (customCount + 1) * 16;
      if (!Number.isSafeInteger(nextPayload) || nextPayload > PAYLOAD_LIMIT) throw new GraphNodeRendererError('budget', nodeId);
      const color = colorOf(field(entry, 'color', false));
      if (copiedFloats + positions.length + normals.length > 4096) await yieldSlice();
      checkpoint();
      const copy = (source: Float32Array, length: number) => read(() => {
        if (typedLength.call(source) !== length) return invalid();
        const result = new Float32Array(length); copyFloats.call(result, source); return result;
      });
      const copiedPositions = copy(positions.array, positions.length);
      const copiedNormals = copy(normals.array, normals.length);
      copiedFloats += positions.length + normals.length;
      entry = undefined;
      triangleCount += faces; customCount++;
      for (let offset = 0; offset < copiedPositions.length; offset += 3) {
        const x = copiedPositions[offset]!, y = copiedPositions[offset + 1]!, z = copiedPositions[offset + 2]!;
        if (![x, y, z].every(Number.isFinite) || x * x + y * y + z * z > 1 + 1e-6) return invalid();
      }
      for (let face = 0; face < copiedNormals.length; face += 3) {
        const nx = copiedNormals[face]!, ny = copiedNormals[face + 1]!, nz = copiedNormals[face + 2]!;
        if (![nx, ny, nz].every(Number.isFinite) || Math.abs(nx * nx + ny * ny + nz * nz - 1) > 1e-3) return invalid();
        const offset = face * 3;
        const ax = copiedPositions[offset]!, ay = copiedPositions[offset + 1]!, az = copiedPositions[offset + 2]!;
        const bx = copiedPositions[offset + 3]! - ax, by = copiedPositions[offset + 4]! - ay, bz = copiedPositions[offset + 5]! - az;
        const cx = copiedPositions[offset + 6]! - ax, cy = copiedPositions[offset + 7]! - ay, cz = copiedPositions[offset + 8]! - az;
        const x = by * cz - bz * cy, y = bz * cx - bx * cz, z = bx * cy - by * cx;
        if (x * x + y * y + z * z <= 1e-12 || x * nx + y * ny + z * nz <= 0) return invalid();
      }
      checkpoint();
      owned[row] = Object.freeze({ positions: copiedPositions, normals: copiedNormals, ...(color === undefined ? {} : { color }) });
    }
    checkpoint();
    committed = true;
    return customCount === 0 ? undefined : Object.freeze(owned);
  } finally {
    if (!committed) owned.fill(null);
  }
}
