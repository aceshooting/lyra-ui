import { snapshotGraphLayoutPins, validateGraphLayoutInputProgress } from './layout-admission.js';
import { buildGraphOctreeProgress, drainGraphProgress, graphChargeForcesProgress, graphCoincidentDirection, type GraphProgressBudget } from './octree.js';
import type { GraphLayoutInput, GraphLayoutOptions, GraphLayoutOutput, GraphLayoutPinUpdate } from './types.js';

type Phase = 'initialize' | 'tree' | 'charge' | 'springs' | 'integrate' | 'snapshot';
export interface GraphLayoutProgress {
  readonly phase: Phase;
  readonly operations: number;
  readonly committedIteration: number;
}
const FLOAT32_MAX = 3.4028234663852886e38;

/**
 * Internal task solver. Input must be an exclusively owned start snapshot: initialization
 * may inspect it across yields. Iterations write a separate pair of buffers and commit only
 * after integration completes. The shared budget counts each scalar, node, edge, or cell before yielding.
 */
export function createGraphLayoutProgress(input: GraphLayoutInput) {
  const count = input.nodeCount;
  let phase: Phase = 'initialize';
  const budget: GraphProgressBudget = { remaining: 0 };
  let operations = 0;
  let initialized = false;
  let options: Required<GraphLayoutOptions>;
  let positions: Float32Array;
  let nextPositions: Float32Array;
  let pins: Uint8Array;
  let velocities: Float64Array;
  let nextVelocities: Float64Array;
  let degrees: Uint32Array;
  let source: Uint32Array;
  let target: Uint32Array;
  let iteration = 0;
  let stable = 0;
  let alpha = 1;
  let maxSpeed = 0;
  let done = false;
  const queuedPins: GraphLayoutPinUpdate[] = [];

  function applyPin(input: GraphLayoutPinUpdate, item: number): void {
    const index = input.indices[item]!;
    pins[index] = input.pinned[item]!;
    for (let axis = 0; axis < 3; axis += 1) {
      positions[index * 3 + axis] = input.positions[item * 3 + axis]!;
      velocities[index * 3 + axis] = 0;
    }
  }

  function resetConvergence(): void {
    iteration = 0;
    stable = 0;
    alpha = 1;
    maxSpeed = 0;
    done = false;
  }

  function* initialize(): Generator<void, undefined> {
    options = yield* validateGraphLayoutInputProgress(input, budget);
    positions = new Float32Array(count * 3);
    if (--budget.remaining === 0) yield;
    nextPositions = new Float32Array(count * 3);
    if (--budget.remaining === 0) yield;
    velocities = new Float64Array(count * 3);
    if (--budget.remaining === 0) yield;
    nextVelocities = new Float64Array(count * 3);
    if (--budget.remaining === 0) yield;
    pins = new Uint8Array(count);
    if (--budget.remaining === 0) yield;
    degrees = new Uint32Array(count);
    if (--budget.remaining === 0) yield;
    // Topology belongs to the task and is never written by the numerical solver.
    source = input.source;
    target = input.target;
    let seed = options.seed;
    const radius = Math.max(10, Math.cbrt(count) * 10);
    for (let offset = 0; offset < positions.length; offset += 1) {
      if (input.positions) positions[offset] = input.positions[offset]!;
      else {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        positions[offset] = (seed / 4294967296 - 0.5) * radius;
      }
      if (--budget.remaining === 0) yield;
    }
    for (let index = 0; index < count; index += 1) {
      pins[index] = input.pinned ? input.pinned[index]! : input.positions ? 1 : 0;
      if (--budget.remaining === 0) yield;
    }
    for (let edge = 0; edge < source.length; edge += 1) {
      degrees[source[edge]!] = degrees[source[edge]!]! + 1;
      degrees[target[edge]!] = degrees[target[edge]!]! + 1;
      if (--budget.remaining === 0) yield;
    }
    done = count === 0;
    for (const update of queuedPins) {
      for (let item = 0; item < update.indices.length; item += 1) { applyPin(update, item); if (--budget.remaining === 0) yield; }
      resetConvergence();
    }
    queuedPins.length = 0;
    initialized = true;
    return undefined;
  }

  function* advanceIteration(): Generator<void, GraphLayoutOutput> {
    if (!done) {
      phase = 'tree';
      const tree = yield* buildGraphOctreeProgress(positions, budget);
      phase = 'charge';
      const force = yield* graphChargeForcesProgress(tree, options.charge, options.theta, options.softening, budget);
      phase = 'springs';
      for (let edge = 0; edge < source.length; edge += 1) {
        const a = source[edge]!;
        const b = target[edge]!;
        if (a !== b) {
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
        if (--budget.remaining === 0) yield;
      }
      phase = 'integrate';
      let nextMaxSpeed = 0;
      let movable = 0;
      for (let index = 0; index < count; index += 1) {
        if (pins[index]) {
          for (let axis = 0; axis < 3; axis += 1) {
            const offset = index * 3 + axis;
            nextPositions[offset] = positions[offset]!;
            nextVelocities[offset] = velocities[offset]!;
          }
        } else {
          movable += 1;
          for (let axis = 0; axis < 3; axis += 1) {
            const offset = index * 3 + axis;
            nextVelocities[offset] = (velocities[offset]! + alpha * (force[offset]! - positions[offset]! * options.centerStrength)) * options.damping;
          }
          const speed = Math.hypot(nextVelocities[index * 3]!, nextVelocities[index * 3 + 1]!, nextVelocities[index * 3 + 2]!);
          const scale = speed > options.maxSpeed ? options.maxSpeed / speed : 1;
          nextMaxSpeed = Math.max(nextMaxSpeed, Math.min(speed, options.maxSpeed));
          for (let axis = 0; axis < 3; axis += 1) {
            const offset = index * 3 + axis;
            nextVelocities[offset] = nextVelocities[offset]! * scale;
            nextPositions[offset] = Math.max(-FLOAT32_MAX, Math.min(FLOAT32_MAX, positions[offset]! + nextVelocities[offset]!));
          }
        }
        if (--budget.remaining === 0) yield;
      }
      [positions, nextPositions] = [nextPositions, positions];
      [velocities, nextVelocities] = [nextVelocities, velocities];
      maxSpeed = nextMaxSpeed;
      iteration += 1;
      alpha *= options.cooling;
      stable = maxSpeed <= options.tolerance ? stable + 1 : 0;
      done = movable === 0 || iteration >= options.maxSteps || alpha <= options.minAlpha || stable >= options.stableSteps;
    }
    phase = 'snapshot';
    const snapshot = new Float32Array(positions.length);
    for (let offset = 0; offset < positions.length; offset += 1) { snapshot[offset] = positions[offset]!; if (--budget.remaining === 0) yield; }
    return { positions: snapshot, iteration, alpha, maxSpeed };
  }

  let work: Generator<void, GraphLayoutOutput | undefined> | undefined = initialize();
  return {
    get progress(): GraphLayoutProgress { return { phase, operations, committedIteration: iteration }; },
    initialize(): void {
      if (!initialized) { budget.remaining = Infinity; drainGraphProgress(work!); work = undefined; }
    },
    advance(maxOperations: number): { done: boolean; output?: GraphLayoutOutput } {
      if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) throw new RangeError('Invalid graph operation budget');
      let remaining = maxOperations;
      while (remaining > 0) {
        work ??= advanceIteration();
        budget.remaining = remaining;
        const result = work.next();
        operations += remaining - budget.remaining;
        remaining = budget.remaining;
        if (result.done) {
          work = undefined;
          if (result.value) return { done, output: result.value };
        }
      }
      return { done: false };
    },
    update(input: GraphLayoutPinUpdate): void {
      const update = snapshotGraphLayoutPins(input, count);
      if (update.indices.length === 0) return;
      if (!initialized) { queuedPins.push(update); return; }
      // Discard the suspended iteration, whose writes live only in the next buffers.
      work = undefined;
      for (let item = 0; item < update.indices.length; item += 1) applyPin(update, item);
      resetConvergence();
      phase = 'tree';
    },
  };
}
