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

const LEAF_SIZE = 8;
const MAX_DEPTH = 48;

/** Builds an octree with bounded depth and a terminal bucket for coincident coordinates. */
export function buildGraphOctree(input: Float32Array): GraphOctree {
  if (!(input instanceof Float32Array) || input.length > 600_000 || input.length % 3 !== 0 || !input.every(Number.isFinite)) {
    throw new TypeError('Graph positions must be finite interleaved Float32 coordinates');
  }
  const positions = input.slice();
  let nodeCount = 0;
  const build = (indices: number[], depth: number): Cell => {
    nodeCount += 1;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const center = [0, 0, 0];
    for (const index of indices) for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index * 3 + axis]!;
      min[axis] = Math.min(min[axis]!, value);
      max[axis] = Math.max(max[axis]!, value);
      center[axis] = center[axis]! + value;
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
    }
    return { ...base, children: buckets.filter((bucket) => bucket.length > 0).map((bucket) => build(bucket, depth + 1)) };
  };
  const count = positions.length / 3;
  const root = count === 0 ? undefined : build(Array.from({ length: count }, (_, index) => index), 0);
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
  if (!Number.isFinite(strength) || strength < 0 || strength > 1e6 || !Number.isFinite(theta) || theta < 0 ||
    !Number.isFinite(softening) || softening < 1e-6) throw new RangeError('Invalid graph charge options');
  const result = new Float64Array(tree.positions.length);
  if (!tree.root || strength === 0) return result;
  const count = tree.positions.length / 3;
  // Float32 coordinate differences can be squared safely in Number. Keep the scaled
  // norm for softening values whose square could overflow the Number range.
  const directSoftening = softening <= 1e150;
  const softeningSquared = directSoftening ? softening * softening : 0;
  for (let target = 0; target < count; target += 1) {
    const x = tree.positions[target * 3]!;
    const y = tree.positions[target * 3 + 1]!;
    const z = tree.positions[target * 3 + 2]!;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    const add = (cx: number, cy: number, cz: number, mass: number, salt: number) => {
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
    };
    const stack = [tree.root];
    while (stack.length > 0) {
      const cell = stack.pop()!;
      const contains = x >= cell.min[0]! && x <= cell.max[0]! &&
        y >= cell.min[1]! && y <= cell.max[1]! && z >= cell.min[2]! && z <= cell.max[2]!;
      if (cell.bodies) {
        if (cell.bodies.length <= LEAF_SIZE) {
          for (const body of cell.bodies) if (body !== target) add(
            tree.positions[body * 3]!, tree.positions[body * 3 + 1]!, tree.positions[body * 3 + 2]!,
            1, body);
        } else {
          // Sibling bounds are disjoint on their partition axis, so containment identifies
          // membership without scanning a potentially large coincident bucket.
          const own = contains ? 1 : 0;
          const mass = cell.count - own;
          if (mass > 0) add(
            (cell.center[0]! * cell.count - own * x) / mass,
            (cell.center[1]! * cell.count - own * y) / mass,
            (cell.center[2]! * cell.count - own * z) / mass,
            mass, count + target);
        }
      } else {
        const distance = Math.hypot(x - cell.center[0]!, y - cell.center[1]!, z - cell.center[2]!);
        if (!contains && cell.width < theta * distance) add(cell.center[0]!, cell.center[1]!, cell.center[2]!, cell.count, count + target);
        else stack.push(...cell.children!);
      }
    }
    result[target * 3] = fx;
    result[target * 3 + 1] = fy;
    result[target * 3 + 2] = fz;
  }
  return result;
}
