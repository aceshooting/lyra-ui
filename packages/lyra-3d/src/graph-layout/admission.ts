import { GraphDagLayoutError } from './types.js';
import type { GraphDagDirection, GraphDagLayoutInput, GraphDagLayoutOptions } from './types.js';

export interface GraphDagLimits { readonly nodeCount: number; readonly edgeCount: number; }
export const SYNC_LIMITS: GraphDagLimits = { nodeCount: 10000, edgeCount: 100000 };
export const ASYNC_LIMITS: GraphDagLimits = { nodeCount: 200000, edgeCount: 1000000 };
export interface GraphDagAdmission {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly direction: GraphDagDirection;
  readonly layerGap: number;
  readonly nodeGap: number;
}
const typedPrototype = Object.getPrototypeOf(Uint32Array.prototype) as object;
const lengthGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const tagGetter = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const bufferLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const typedValues = Uint32Array.prototype.values;

function fail(): never { throw new GraphDagLayoutError('invalid-input'); }
function object(value: unknown, code: 'invalid-input' | 'invalid-options'): object {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new GraphDagLayoutError(code);
    return value;
  } catch { throw new GraphDagLayoutError(code); }
}
function field(value: object, name: string, code: 'invalid-input' | 'invalid-options'): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new GraphDagLayoutError(code);
    return descriptor?.value as unknown;
  } catch { throw new GraphDagLayoutError(code); }
}
/** Uses native brand/state checks, including detached and resizable backing buffers. */
export function graphDagColumnLength(value: unknown): number {
  try {
    if (tagGetter.call(value) !== 'Uint32Array') return fail();
    const buffer: unknown = bufferGetter.call(value);
    bufferLengthGetter.call(buffer);
    if (resizableGetter?.call(buffer)) return fail();
    // Iterator creation validates attachment even for an empty detached view.
    typedValues.call(value as Uint32Array);
    return lengthGetter.call(value) as number;
  } catch { return fail(); }
}
export function admitGraphDag(input: GraphDagLayoutInput, options: GraphDagLayoutOptions | undefined, limits: GraphDagLimits): GraphDagAdmission {
  const dto = object(input, 'invalid-input');
  const nodeCount = field(dto, 'nodeCount', 'invalid-input');
  const source = field(dto, 'source', 'invalid-input');
  const target = field(dto, 'target', 'invalid-input');
  if (typeof nodeCount !== 'number' || !Number.isSafeInteger(nodeCount) || nodeCount < 0) return fail();
  const edgeCount = graphDagColumnLength(source);
  if (graphDagColumnLength(target) !== edgeCount) return fail();
  if (nodeCount > limits.nodeCount || edgeCount > limits.edgeCount) throw new GraphDagLayoutError('limit-exceeded');
  const normalized = admitGraphDagOptions(options);
  return { nodeCount, edgeCount, source: source as Uint32Array, target: target as Uint32Array, direction: normalized.direction, layerGap: normalized.layerGap, nodeGap: normalized.nodeGap };
}

export interface GraphDagNormalizedOptions { readonly direction: GraphDagDirection; readonly layerGap: number; readonly nodeGap: number; }
export function admitGraphDagOptions(options: GraphDagLayoutOptions | undefined): GraphDagNormalizedOptions {
  const opts = options === undefined ? {} : object(options, 'invalid-options');
  const rawDirection = field(opts, 'direction', 'invalid-options');
  const direction = rawDirection === undefined ? 'y' : rawDirection;
  if (direction !== 'x' && direction !== '-x' && direction !== 'y' && direction !== '-y' && direction !== 'z' && direction !== '-z') throw new GraphDagLayoutError('invalid-options');
  const gap = (name: string, fallback: number): number => {
    const raw = field(opts, name, 'invalid-options');
    const value = raw === undefined ? fallback : raw;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.001 || value > 1000000) throw new GraphDagLayoutError('invalid-options');
    return value;
  };
  return { direction, layerGap: gap('layerGap', 100), nodeGap: gap('nodeGap', 50) };
}
