import { buildGraphOctree, graphChargeForces, graphCoincidentDirection } from './octree.js';
import type { GraphLayoutInput, GraphLayoutKernel, GraphLayoutOptions, GraphLayoutOutput, GraphLayoutPinUpdate } from './types.js';

const MAX_NODES = 200_000;
const MAX_EDGES = 1_000_000;
const FLOAT32_MAX = 3.4028234663852886e38;

function parameter(value: number | undefined, fallback: number, min: number, max: number, integer = false): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) {
    throw new RangeError('Invalid graph layout option');
  }
  return result;
}

function settings(input: GraphLayoutOptions = {}): Required<GraphLayoutOptions> {
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

function coordinates(value: Float32Array, count: number): Float32Array {
  if (!(value instanceof Float32Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== count * 3 || !value.every(Number.isFinite)) {
    throw new TypeError('Graph positions must contain finite xyz coordinates for every node');
  }
  return value.slice();
}

function pinMask(value: Uint8Array, count: number): Uint8Array {
  if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== count || !value.every((pin) => pin === 0 || pin === 1)) {
    throw new TypeError('Graph pinned mask must contain one 0 or 1 per node');
  }
  return value.slice();
}

/**
 * Original deterministic 3D force solver. Each step rebuilds a bounded octree, applies repulsion
 * and degree-normalized springs, then integrates capped damped velocities. Input buffers are
 * copied once; output buffers are fresh so a worker can transfer them without detaching state.
 * Replace topology by stopping the owning task and creating a new kernel.
 */
export function createGraphLayoutKernel(input: GraphLayoutInput): GraphLayoutKernel {
  const count = input.nodeCount;
  if (!Number.isInteger(count) || count < 0 || count > MAX_NODES) throw new RangeError('Invalid graph node count');
  const options = settings(input.options);
  if (!(input.source instanceof Uint32Array) || !(input.source.buffer instanceof ArrayBuffer) || !(input.target instanceof Uint32Array) || !(input.target.buffer instanceof ArrayBuffer) ||
    input.source.length !== input.target.length || input.source.length > MAX_EDGES ||
    !input.source.every((index) => index < count) || !input.target.every((index) => index < count)) {
    throw new RangeError('Graph edge index or length is invalid');
  }
  const source = input.source.slice();
  const target = input.target.slice();
  const positions = input.positions ? coordinates(input.positions, count) : new Float32Array(count * 3);
  const pins = input.pinned ? pinMask(input.pinned, count) : new Uint8Array(count).fill(input.positions ? 1 : 0);
  if (!input.positions) {
    let seed = options.seed;
    const radius = Math.max(10, Math.cbrt(count) * 10);
    for (let index = 0; index < positions.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      positions[index] = (seed / 4294967296 - 0.5) * radius;
    }
  }
  const velocities = new Float64Array(positions.length);
  const degrees = new Uint32Array(count);
  for (let edge = 0; edge < source.length; edge += 1) {
    degrees[source[edge]!] = degrees[source[edge]!]! + 1;
    degrees[target[edge]!] = degrees[target[edge]!]! + 1;
  }
  let iteration = 0;
  let stable = 0;
  let alpha = 1;
  let maxSpeed = 0;
  let done = count === 0;
  const snapshot = (): GraphLayoutOutput => ({ positions: positions.slice(), iteration, alpha, maxSpeed });
  const update = (input: GraphLayoutPinUpdate): void => {
    if (!(input.indices instanceof Uint32Array) || !(input.indices.buffer instanceof ArrayBuffer) || input.indices.length > count) throw new RangeError('Invalid graph pin index');
    const indices = input.indices.slice();
    const nextPositions = coordinates(input.positions, indices.length);
    const nextPins = pinMask(input.pinned, indices.length);
    const unique = new Set<number>();
    for (const index of indices) {
      if (index >= count || unique.has(index)) throw new RangeError('Invalid graph pin index');
      unique.add(index);
    }
    if (indices.length === 0) return;
    for (let item = 0; item < indices.length; item += 1) {
      const index = indices[item]!;
      pins[index] = nextPins[item]!;
      for (let axis = 0; axis < 3; axis += 1) {
        positions[index * 3 + axis] = nextPositions[item * 3 + axis]!;
        velocities[index * 3 + axis] = 0;
      }
    }
    iteration = 0;
    stable = 0;
    alpha = 1;
    maxSpeed = 0;
    done = false;
  };
  return {
    update,
    step() {
      if (done) return { done, output: snapshot() };
      const force = graphChargeForces(buildGraphOctree(positions), options.charge, options.theta, options.softening);
      for (let edge = 0; edge < source.length; edge += 1) {
        const a = source[edge]!;
        const b = target[edge]!;
        if (a === b) continue;
        const dx = positions[b * 3]! - positions[a * 3]!;
        const dy = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
        const dz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
        const distance = Math.hypot(dx, dy, dz);
        const magnitude = options.linkStrength * (distance - options.linkDistance) / Math.max(1, degrees[a]!, degrees[b]!);
        const direction = distance === 0 ? graphCoincidentDirection(b, a) : [dx / distance, dy / distance, dz / distance];
        for (let axis = 0; axis < 3; axis += 1) {
          const value = magnitude * direction[axis]!;
          force[a * 3 + axis] = force[a * 3 + axis]! + value;
          force[b * 3 + axis] = force[b * 3 + axis]! - value;
        }
      }
      maxSpeed = 0;
      let movable = 0;
      for (let index = 0; index < count; index += 1) {
        if (pins[index]) continue;
        movable += 1;
        for (let axis = 0; axis < 3; axis += 1) {
          const offset = index * 3 + axis;
          velocities[offset] = (velocities[offset]! + alpha * (force[offset]! - positions[offset]! * options.centerStrength)) * options.damping;
        }
        const speed = Math.hypot(velocities[index * 3]!, velocities[index * 3 + 1]!, velocities[index * 3 + 2]!);
        const scale = speed > options.maxSpeed ? options.maxSpeed / speed : 1;
        maxSpeed = Math.max(maxSpeed, Math.min(speed, options.maxSpeed));
        for (let axis = 0; axis < 3; axis += 1) {
          const offset = index * 3 + axis;
          velocities[offset] = velocities[offset]! * scale;
          positions[offset] = Math.max(-FLOAT32_MAX, Math.min(FLOAT32_MAX, positions[offset]! + velocities[offset]!));
        }
      }
      iteration += 1;
      alpha *= options.cooling;
      stable = maxSpeed <= options.tolerance ? stable + 1 : 0;
      done = movable === 0 || iteration >= options.maxSteps || alpha <= options.minAlpha || stable >= options.stableSteps;
      return { done, output: snapshot() };
    },
  };
}
