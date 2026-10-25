import { drainGraphProgress, type GraphProgressBudget } from './octree.js';
import type { GraphLayoutInput, GraphLayoutOptions, GraphLayoutPinUpdate } from './types.js';

function parameter(value: number | undefined, fallback: number, min: number, max: number, integer = false): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw new RangeError('Invalid graph layout option');
  }
  return result;
}

function graphLayoutSettings(input: GraphLayoutOptions = {}): Required<GraphLayoutOptions> {
  return {
    seed: parameter(input.seed, 1, 0, 0xffffffff, true),
    charge: parameter(input.charge, 80, 0, 1e6),
    linkStrength: parameter(input.linkStrength, 0.03, 0, 1),
    linkDistance: parameter(input.linkDistance, 30, 0, 1e12),
    centerStrength: parameter(input.centerStrength, 0.002, 0, 1),
    theta: parameter(input.theta, 0.7, 0, 2),
    softening: parameter(input.softening, 1, 1e-6, 1e12),
    damping: parameter(input.damping, 0.75, 0, 0.999),
    maxSpeed: parameter(input.maxSpeed, 10, 1e-6, 1e12),
    maxSteps: parameter(input.maxSteps, 500, 1, 100_000, true),
    cooling: parameter(input.cooling, 0.98, 0, 1),
    minAlpha: parameter(input.minAlpha, 0.001, 0, 1),
    tolerance: parameter(input.tolerance, 0.01, 0, 1e12),
    stableSteps: parameter(input.stableSteps, 10, 1, 1000, true),
  };
}

function* coordinates(value: Float32Array, count: number, budget?: GraphProgressBudget): Generator<void, void> {
  if (!(value instanceof Float32Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== count * 3) {
    throw new TypeError('Graph positions must contain finite xyz coordinates for every node');
  }
  for (const coordinate of value) {
    if (!Number.isFinite(coordinate)) throw new TypeError('Graph positions must contain finite xyz coordinates for every node');
    if (!budget || --budget.remaining === 0) yield;
  }
}

function* pinMask(value: Uint8Array, count: number, budget?: GraphProgressBudget): Generator<void, void> {
  if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== count) {
    throw new TypeError('Graph pinned mask must contain one 0 or 1 per node');
  }
  for (const pin of value) {
    if (pin !== 0 && pin !== 1) throw new TypeError('Graph pinned mask must contain one 0 or 1 per node');
    if (!budget || --budget.remaining === 0) yield;
  }
}

/** Validation can be drained synchronously or sliced over an exclusively owned input. */
export function* validateGraphLayoutInputProgress(input: GraphLayoutInput, budget?: GraphProgressBudget): Generator<void, Required<GraphLayoutOptions>> {
  const count = input.nodeCount;
  if (!Number.isInteger(count) || count < 0 || count > 200_000) throw new RangeError('Invalid graph node count');
  const options = graphLayoutSettings(input.options);
  if (!(input.source instanceof Uint32Array) || !(input.source.buffer instanceof ArrayBuffer) || !(input.target instanceof Uint32Array) || !(input.target.buffer instanceof ArrayBuffer) ||
    input.source.length !== input.target.length || input.source.length > 1_000_000) {
    throw new RangeError('Graph edge index or length is invalid');
  }
  for (const indices of [input.source, input.target]) for (const index of indices) {
    if (index >= count) throw new RangeError('Graph edge index or length is invalid');
    if (!budget || --budget.remaining === 0) yield;
  }
  if (input.positions) yield* coordinates(input.positions, count, budget);
  if (input.pinned) yield* pinMask(input.pinned, count, budget);
  return options;
}

/** Preserves synchronous rejection without constructing a numerical solver. */
export function validateGraphLayoutInput(input: GraphLayoutInput): void {
  drainGraphProgress(validateGraphLayoutInputProgress(input, { remaining: Infinity }));
}

/** Validate and own the whole transaction before altering numerical state or epochs. */
export function snapshotGraphLayoutPins(input: GraphLayoutPinUpdate, count: number): GraphLayoutPinUpdate {
  if (!(input.indices instanceof Uint32Array) || !(input.indices.buffer instanceof ArrayBuffer) || input.indices.length > count) throw new RangeError('Invalid graph pin index');
  const indices = input.indices.slice();
  drainGraphProgress(coordinates(input.positions, indices.length, { remaining: Infinity }));
  const positions = input.positions.slice();
  drainGraphProgress(pinMask(input.pinned, indices.length, { remaining: Infinity }));
  const pinned = input.pinned.slice();
  const unique = new Set<number>();
  for (const index of indices) {
    if (index >= count || unique.has(index)) throw new RangeError('Invalid graph pin index');
    unique.add(index);
  }
  return { indices, positions, pinned };
}
