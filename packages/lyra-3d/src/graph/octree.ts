interface Cell {
  readonly min: readonly number[];
  readonly max: readonly number[];
  readonly center: readonly number[];
  readonly count: number;
  readonly width: number;
  readonly children?: readonly Cell[];
  readonly bodies?: readonly number[];
}

/** Owned tree snapshot; coordinates are copied from the input before partitioning. */
export interface GraphOctree {
  readonly positions: Float32Array;
  readonly root: Cell | undefined;
  readonly nodeCount: number;
}

/** Shared remaining primitive work across delegated generators. */
export interface GraphProgressBudget { remaining: number }

const LEAF_SIZE = 8;
const MAX_DEPTH = 48;

/** Builds an octree with bounded depth and a terminal bucket for coincident coordinates. */
export function buildGraphOctree(input: Float32Array): GraphOctree {
  return drainGraphProgress(buildGraphOctreeProgress(input, { remaining: Infinity }));
}

/** Drains the same bounded work used by asynchronous layout tasks. */
export function drainGraphProgress<T>(work: Generator<void, T>): T {
  let result = work.next();
  while (!result.done) result = work.next();
  return result.value;
}

/** Counts each coordinate, index, or bounded cell; suspends only when its shared budget expires. */
export function* buildGraphOctreeProgress(input: Float32Array, budget?: GraphProgressBudget): Generator<void, GraphOctree> {
  if (!(input instanceof Float32Array) || input.length > 600_000 || input.length % 3 !== 0) {
    throw new TypeError('Graph positions must be finite interleaved Float32 coordinates');
  }
  const positions = new Float32Array(input.length);
  for (let offset = 0; offset < input.length; offset += 1) {
    if (!Number.isFinite(input[offset])) throw new TypeError('Graph positions must be finite interleaved Float32 coordinates');
    positions[offset] = input[offset]!;
    if (!budget || --budget.remaining === 0) yield;
  }
  let nodeCount = 0;
  const build = function* (indices: number[], depth: number): Generator<void, Cell> {
    nodeCount += 1;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const center = [0, 0, 0];
    for (const index of indices) for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index * 3 + axis]!;
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
      center[axis] = center[axis]! + value;
      if (!budget || --budget.remaining === 0) yield;
    }
    for (let axis = 0; axis < 3; axis += 1) center[axis] = center[axis]! / indices.length;
    const width = Math.max(...max.map((value, axis) => value - min[axis]!));
    const base = { min, max, center, count: indices.length, width };
    if (indices.length <= LEAF_SIZE || width === 0 || depth >= MAX_DEPTH) return { ...base, bodies: indices };
    const middle = min.map((value, axis) => value + (max[axis]! - value) / 2);
    const buckets: number[][] = Array.from({ length: 8 }, () => []);
    for (const index of indices) {
      let octant = 0;
      for (let axis = 0; axis < 3; axis += 1) if (positions[index * 3 + axis]! >= middle[axis]!) octant |= 1 << axis;
      buckets[octant]!.push(index);
      if (!budget || --budget.remaining === 0) yield;
    }
    const children: Cell[] = [];
    for (const bucket of buckets) if (bucket.length > 0) children.push(yield* build(bucket, depth + 1));
    return { ...base, children };
  };
  const count = positions.length / 3;
  const indices: number[] = [];
  for (let index = 0; index < count; index += 1) { indices.push(index); if (!budget || --budget.remaining === 0) yield; }
  const root = count === 0 ? undefined : yield* build(indices, 0);
  return { positions, root, nodeCount };
}

/** Deterministic antisymmetric unit displacement for two coincident node indices. */
export function graphCoincidentDirection(first: number, second: number): readonly [number, number, number] {
  const index = Math.min(first, second);
  const sign = first < second ? -1 : 1;
  const z = 1 - 2 * ((Math.imul(index + 1, 2654435761) >>> 0) / 4294967296);
  const angle = index * 2.399963229728653;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return [sign * radius * Math.cos(angle), sign * radius * Math.sin(angle), sign * z];
}

/**
 * Repulsive forces using softened inverse-square distance. Cells containing the target are never
 * approximated. Large terminal buckets subtract the target's mass and position before evaluation,
 * bounding work for coincident points; a deterministic direction separates exact coincidences.
 */
export function graphChargeForces(tree: GraphOctree, strength: number, theta: number, softening: number): Float64Array {
  const work = createGraphChargeWork(tree, strength, theta, softening);
  work.advance({ remaining: Infinity });
  return work.result;
}

/** Traversal can suspend inside a target, including exact-force leaf evaluation. */
export function* graphChargeForcesProgress(tree: GraphOctree, strength: number, theta: number, softening: number, budget?: GraphProgressBudget): Generator<void, Float64Array> {
  const work = createGraphChargeWork(tree, strength, theta, softening);
  const quota = budget ?? { remaining: 1 };
  while (!work.advance(quota)) {
    yield;
    if (!budget) quota.remaining = 1;
  }
  return work.result;
}

/** One numerical implementation for synchronous drains and resumable force traversal. */
function createGraphChargeWork(tree: GraphOctree, strength: number, theta: number, softening: number) {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1e6 || !Number.isFinite(theta) || theta < 0 ||
    !Number.isFinite(softening) || softening < 1e-6) throw new RangeError('Invalid graph charge options');
  const result = new Float64Array(tree.positions.length);
  const root = tree.root;
  const count = root && strength !== 0 ? tree.positions.length / 3 : 0;
  // Float32 coordinate differences can be squared safely in Number. Keep the scaled
  // norm for softening values whose square could overflow the Number range.
  const directSoftening = softening <= 1e150;
  const softeningSquared = directSoftening ? softening * softening : 0;
  const positions = tree.positions;
  const cursor = {
    target: 0, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0,
    stack: undefined as Cell[] | undefined,
    bodies: undefined as readonly number[] | undefined,
    bodyIndex: 0,
  };
  return {
    result,
    advance(budget: GraphProgressBudget): boolean {
      // Keep numerical accumulators local during a chunk; only chunk exit publishes the cursor.
      let { target, x, y, z, fx, fy, fz, stack, bodies, bodyIndex } = cursor;
      let remaining = budget.remaining;
      work: while (target < count) {
        if (!stack) {
          x = positions[target * 3]!;
          y = positions[target * 3 + 1]!;
          z = positions[target * 3 + 2]!;
          fx = 0; fy = 0; fz = 0;
          stack = [root!];
        }
        for (;;) {
          let cx = 0, cy = 0, cz = 0, mass = 0, salt = 0;
          if (bodies) {
            if (bodyIndex === bodies.length) {
              // The last body and its cell completion remain separate quota units.
              bodies = undefined;
              if (--remaining === 0) break work;
              continue;
            }
            const body = bodies[bodyIndex++]!;
            if (body === target) {
              if (--remaining === 0) break work;
              continue;
            }
            cx = positions[body * 3]!; cy = positions[body * 3 + 1]!; cz = positions[body * 3 + 2]!;
            mass = 1; salt = body;
          } else if (stack.length > 0) {
            const cell = stack.pop()!;
            if (cell.bodies && cell.bodies.length <= LEAF_SIZE) {
              bodies = cell.bodies; bodyIndex = 0;
              continue;
            }
            const contains = x >= cell.min[0]! && x <= cell.max[0]! &&
              y >= cell.min[1]! && y <= cell.max[1]! && z >= cell.min[2]! && z <= cell.max[2]!;
            if (cell.bodies) {
              // A large terminal bucket contributes once, excluding the target's own mass.
              const own = contains ? 1 : 0;
              mass = cell.count - own;
              if (!(mass > 0)) {
                if (--remaining === 0) break work;
                continue;
              }
              cx = (cell.center[0]! * cell.count - own * x) / mass;
              cy = (cell.center[1]! * cell.count - own * y) / mass;
              cz = (cell.center[2]! * cell.count - own * z) / mass;
            } else {
              const distance = Math.hypot(x - cell.center[0]!, y - cell.center[1]!, z - cell.center[2]!);
              if (contains || !(cell.width < theta * distance)) {
                stack.push(...cell.children!);
                if (--remaining === 0) break work;
                continue;
              }
              cx = cell.center[0]!; cy = cell.center[1]!; cz = cell.center[2]!; mass = cell.count;
            }
            salt = count + target;
          } else {
            result[target * 3] = fx;
            result[target * 3 + 1] = fy;
            result[target * 3 + 2] = fz;
            target++; stack = undefined;
            if (--remaining === 0) break work;
            break;
          }
          // Exact bodies and aggregate cells share the same ordered force arithmetic.
          let dx = x - cx;
          let dy = y - cy;
          let dz = z - cz;
          const coincident = dx === 0 && dy === 0 && dz === 0;
          let distanceSquared = dx * dx + dy * dy + dz * dz;
          if (coincident) {
            const direction = graphCoincidentDirection(target, salt);
            dx = direction[0] * softening;
            dy = direction[1] * softening;
            dz = direction[2] * softening;
            distanceSquared = softeningSquared;
          }
          const denominator = directSoftening
            ? Math.sqrt(distanceSquared + softeningSquared)
            : Math.hypot(coincident ? softening : Math.hypot(dx, dy, dz), softening);
          const force = strength * mass / (denominator * denominator);
          fx += force * dx / denominator;
          fy += force * dy / denominator;
          fz += force * dz / denominator;
          if (--remaining === 0) break work;
        }
      }
      cursor.target = target; cursor.x = x; cursor.y = y; cursor.z = z;
      cursor.fx = fx; cursor.fy = fy; cursor.fz = fz;
      cursor.stack = stack; cursor.bodies = bodies; cursor.bodyIndex = bodyIndex;
      budget.remaining = remaining;
      return remaining !== 0;
    },
  };
}
