import { finiteInteger } from './numbers.js';

export interface LayeredLayoutNode {
  id: string;
  /** Finite, non-negative box width. */
  width: number;
  /** Finite, non-negative box height. */
  height: number;
}

export interface LayeredLayoutEdge {
  source: string;
  target: string;
}

export interface LayeredLayoutOptions {
  /**
   * Finite, non-negative box-center coordinates kept verbatim and excluded from computed
   * assignment. Their combined inline extent is reserved before computed boxes, and each fixed
   * layer's block extent advances later layers. Conflicts between two caller-fixed boxes are kept
   * verbatim and remain the caller's responsibility.
   */
  fixedPositions?: ReadonlyMap<string, Readonly<{ x: number; y: number }>>;
  /** Finite, non-negative in-layer gap between adjacent box edges (not centers). Default 24. */
  gapX?: number;
  /** Finite, non-negative gap between layers (block axis). Default 100. */
  gapY?: number;
  /** Maximum synthetic ordering waypoints. Invalid values use the 10,000 default; negative
   *  values clamp to zero and fractional values truncate. */
  maxVirtualWaypoints?: number;
}

/** The bounded output of `layeredLayout()`. */
export interface LayeredLayoutResult {
  /** Raw box-center coordinates for every real input node. */
  readonly positions: ReadonlyMap<string, Readonly<{ x: number; y: number }>>;
  /** Whether one or more long-edge waypoint chains were omitted because the budget was exhausted. */
  readonly truncated: boolean;
  /** Number of synthetic ordering waypoints actually allocated. */
  readonly virtualWaypointCount: number;
}

function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = init();
    map.set(key, value);
  }
  return value;
}

// Crossing reduction is a presentation heuristic, not permission to let a dense graph allocate a
// waypoint for every edge/layer pair. Ordinary diagrams stay on the exact Sugiyama-lite path;
// after this global budget, long edges constrain their real endpoints directly during barycenter
// sweeps. Runtime and memory then remain O(nodes + edges + this fixed budget).
const DEFAULT_MAX_VIRTUAL_WAYPOINTS = 10_000;
const MAX_LAYOUT_VALUE = Number.MAX_SAFE_INTEGER;

function checkedLayoutValue(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_LAYOUT_VALUE) {
    throw new RangeError(
      `layeredLayout(): ${label} must be a finite, non-negative number no greater than Number.MAX_SAFE_INTEGER.`,
    );
  }
  return value;
}

function checkedLayoutSum(label: string, ...values: number[]): number {
  const result = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(result) || result > MAX_LAYOUT_VALUE) {
    throw new RangeError(`layeredLayout(): ${label} exceeds the supported numeric range.`);
  }
  return result;
}

function nextRepresentableNumber(value: number): number {
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}

function checkedGapAfter(edge: number, gap: number, label: string): number {
  let next = checkedLayoutSum(label, edge, gap);
  while (next - edge < gap) {
    next = nextRepresentableNumber(next);
    if (!Number.isFinite(next) || next > MAX_LAYOUT_VALUE) {
      throw new RangeError(`layeredLayout(): ${label} exceeds the supported numeric range.`);
    }
  }
  return next;
}

function checkedBoxFromStart(
  start: number,
  size: number,
  label: string,
): Readonly<{ center: number; end: number }> {
  const half = size / 2;
  let center = checkedLayoutSum(`${label} center`, start, half);
  while (center - half < start) {
    center = nextRepresentableNumber(center);
    if (!Number.isFinite(center) || center > MAX_LAYOUT_VALUE) {
      throw new RangeError(`layeredLayout(): ${label} exceeds the supported numeric range.`);
    }
  }
  return Object.freeze({
    center,
    end: checkedLayoutSum(`${label} end`, center, half),
  });
}

/**
 * A deterministic Sugiyama-lite layered ("DAG-ish") layout, dependency-free: (1) iterative
 * depth-first cycle handling (back edges reversed internally for layering only; the caller's own
 * edge array is never mutated); (2) longest-path layering; (3) four barycenter sweeps for crossing
 * reduction,
 * routing any edge spanning more than one layer through synthetic virtual waypoints that
 * participate in ordering only and are never returned. Virtual routing is capped globally; once
 * the cap is exhausted, a long edge participates through its real endpoints rather than allocating
 * every intermediate waypoint. The returned resource metadata makes that degradation explicit.
 * (4) Computed coordinates are assigned top -> bottom (block axis, RTL-neutral), left -> right
 * within a layer by stable input order on ties. Fixed anchors are excluded from that computed
 * ordering and may appear anywhere in the caller's coordinate space.
 * `fixedPositions` entries keep their given coordinates verbatim. Computed boxes begin after the
 * combined fixed inline extent, and a fixed layer's block extent advances every later layer, so a
 * fixed box cannot collide with a computed one. Two conflicting caller-fixed boxes are not moved.
 * The caller is responsible for centering the returned drawing within its own canvas -- this
 * function returns raw box centers with layer 0 starting at y=0.
 *
 * Node dimensions, gaps, and fixed coordinates must be finite, non-negative values no greater
 * than `Number.MAX_SAFE_INTEGER`; invalid geometry throws before graph traversal begins. The
 * waypoint budget is normalized as described by `LayeredLayoutOptions.maxVirtualWaypoints`.
 *
 * A single, shared, dependency-free implementation -- suitable for any future layered-diagram
 * consumer beyond `<lr-graph>`'s own `layout="layered"` mode, not just this component.
 *
 * @throws {RangeError} When node geometry, gaps, fixed coordinates, or their required extents are
 * outside the supported numeric range.
 */
export function layeredLayout(input: {
  nodes: readonly LayeredLayoutNode[];
  edges: readonly LayeredLayoutEdge[];
  options?: LayeredLayoutOptions;
}): LayeredLayoutResult {
  const { edges } = input;
  const gapX = checkedLayoutValue(input.options?.gapX ?? 24, 'options.gapX');
  const gapY = checkedLayoutValue(input.options?.gapY ?? 100, 'options.gapY');
  const nodes = input.nodes.map((node, index) => ({
    id: node.id,
    width: checkedLayoutValue(node.width, `nodes[${index}].width`),
    height: checkedLayoutValue(node.height, `nodes[${index}].height`),
  }));
  const fixed = input.options?.fixedPositions
    ? new Map(
        [...input.options.fixedPositions].map(([id, position]) => [
          id,
          Object.freeze({
            x: checkedLayoutValue(position.x, `options.fixedPositions["${id}"].x`),
            y: checkedLayoutValue(position.y, `options.fixedPositions["${id}"].y`),
          }),
        ] as const),
      )
    : undefined;
  const maxVirtualWaypoints = finiteInteger(
    input.options?.maxVirtualWaypoints ?? DEFAULT_MAX_VIRTUAL_WAYPOINTS,
    DEFAULT_MAX_VIRTUAL_WAYPOINTS,
    0,
  );

  const positions = new Map<string, Readonly<{ x: number; y: number }>>();
  if (!nodes.length) {
    return Object.freeze({ positions, truncated: false, virtualWaypointCount: 0 });
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id); // stable input order, for every tie-break below

  // Fixed nodes are immutable anchors. Reserve their full combined inline envelope before any
  // computed slot rather than advancing from an unrelated zero-based cursor. This works for a
  // fixed node at any stable-order position and guarantees the configured edge gap without moving
  // caller-owned coordinates.
  let fixedInlineRight: number | undefined;
  for (const node of nodes) {
    const fixedPosition = fixed?.get(node.id);
    if (!fixedPosition) continue;
    const right = checkedLayoutSum(
      `fixed inline extent for "${node.id}"`,
      fixedPosition.x,
      node.width / 2,
    );
    checkedLayoutSum(
      `fixed block extent for "${node.id}"`,
      fixedPosition.y,
      node.height / 2,
    );
    fixedInlineRight = Math.max(fixedInlineRight ?? 0, right);
  }

  const rawEdges = edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target) && e.source !== e.target);

  // 1. Cycle handling: DFS from every unvisited node in stable input order; a back edge (into a
  //    node still on the current DFS stack) is reversed for layering purposes only.
  const adjacency = new Map<string, string[]>(order.map((id) => [id, []]));
  for (const e of rawEdges) adjacency.get(e.source)!.push(e.target);

  const UNVISITED = 0;
  const ON_STACK = 1;
  const DONE = 2;
  const state = new Map<string, number>(order.map((id) => [id, UNVISITED]));
  const dagEdges: LayeredLayoutEdge[] = [];

  interface DfsFrame {
    id: string;
    nextTarget: number;
  }
  for (const root of order) {
    if (state.get(root) !== UNVISITED) continue;
    state.set(root, ON_STACK);
    const stack: DfsFrame[] = [{ id: root, nextTarget: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const targets = adjacency.get(frame.id) ?? [];
      const target = targets[frame.nextTarget];
      if (target === undefined) {
        state.set(frame.id, DONE);
        stack.pop();
        continue;
      }
      frame.nextTarget += 1;
      const targetState = state.get(target);
      if (targetState === UNVISITED) {
        dagEdges.push({ source: frame.id, target });
        state.set(target, ON_STACK);
        stack.push({ id: target, nextTarget: 0 });
      } else if (targetState === ON_STACK) {
        dagEdges.push({ source: target, target: frame.id }); // back edge -- reversed
      } else {
        dagEdges.push({ source: frame.id, target });
      }
    }
  }

  // 2. Longest-path layering over the now-acyclic dagEdges (Kahn's algorithm, tracking the max
  //    distance from any source instead of simply visiting each node once).
  const dagAdjacency = new Map<string, string[]>(order.map((id) => [id, []]));
  const indegree = new Map<string, number>(order.map((id) => [id, 0]));
  for (const e of dagEdges) {
    dagAdjacency.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const layer = new Map<string, number>(order.map((id) => [id, 0]));
  const remaining = new Map(indegree);
  const queue = order.filter((id) => indegree.get(id) === 0);
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi]!;
    for (const target of dagAdjacency.get(id) ?? []) {
      layer.set(target, Math.max(layer.get(target) ?? 0, (layer.get(id) ?? 0) + 1));
      const left = (remaining.get(target) ?? 0) - 1;
      remaining.set(target, left);
      if (left === 0) queue.push(target);
    }
  }

  // 3. Per-layer slot lists (stable input order) plus virtual waypoints for any edge spanning
  //    more than one layer -- waypoints occupy intermediate layers for ordering purposes only.
  let maxLayer = 0;
  for (const id of order) maxLayer = Math.max(maxLayer, layer.get(id) ?? 0);
  interface Slot {
    id: string;
    virtual: boolean;
    width: number;
    height: number;
  }
  const layers: Slot[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of order) {
    const node = nodeById.get(id)!;
    layers[layer.get(id) ?? 0]!.push({ id, virtual: false, width: node.width, height: node.height });
  }

  let waypointCounter = 0;
  let truncated = false;
  const waypointChains = new Map<string, string[]>();
  for (const e of dagEdges) {
    const sourceLayer = layer.get(e.source) ?? 0;
    const targetLayer = layer.get(e.target) ?? 0;
    const waypointCount = targetLayer - sourceLayer - 1;
    if (waypointCount <= 0) continue;
    if (waypointCounter + waypointCount > maxVirtualWaypoints) {
      truncated = true;
      continue;
    }
    const chain: string[] = [];
    for (let l = sourceLayer + 1; l < targetLayer; l++) {
      const waypointId = `__waypoint_${waypointCounter++}__`;
      layers[l]!.push({ id: waypointId, virtual: true, width: 1, height: 1 });
      chain.push(waypointId);
    }
    waypointChains.set(`${e.source}->${e.target}`, chain);
  }

  const orderingDown = new Map<string, string[]>();
  const orderingUp = new Map<string, string[]>();
  const addOrderingEdge = (a: string, b: string): void => {
    getOrInit(orderingDown, a, () => []).push(b);
    getOrInit(orderingUp, b, () => []).push(a);
  };
  for (const e of dagEdges) {
    const span = (layer.get(e.target) ?? 0) - (layer.get(e.source) ?? 0);
    if (span === 1) {
      addOrderingEdge(e.source, e.target);
    } else if (span > 1) {
      const hops = [e.source, ...(waypointChains.get(`${e.source}->${e.target}`) ?? []), e.target];
      for (let i = 0; i < hops.length - 1; i++) addOrderingEdge(hops[i]!, hops[i + 1]!);
    }
  }

  // 4. Four barycenter sweeps (down, up, down, up): each reorders every layer by the mean
  //    position of its already-ordered neighbors in the just-swept adjacent layer. A slot with no
  //    positioned neighbor keeps its current index (stable).
  const positionInLayer = new Map<string, number>();
  layers.forEach((slots) => slots.forEach((s, i) => positionInLayer.set(s.id, i)));

  function sweep(forward: boolean): void {
    const range = forward
      ? Array.from({ length: layers.length - 1 }, (_, i) => i + 1)
      : Array.from({ length: layers.length - 1 }, (_, i) => layers.length - 2 - i);
    const neighborsOf = forward ? orderingUp : orderingDown;
    for (const l of range) {
      const withBary = layers[l]!.map((slot, idx) => {
        const neighborPositions = (neighborsOf.get(slot.id) ?? [])
          .map((id) => positionInLayer.get(id))
          .filter((p): p is number => p != null);
        const bary = neighborPositions.length
          ? neighborPositions.reduce((sum, p) => sum + p, 0) / neighborPositions.length
          : idx;
        return { slot, bary, idx };
      });
      withBary.sort((a, b) => a.bary - b.bary || a.idx - b.idx);
      layers[l] = withBary.map((w) => w.slot);
      layers[l]!.forEach((s, i) => positionInLayer.set(s.id, i));
    }
  }
  sweep(true);
  sweep(false);
  sweep(true);
  sweep(false);

  // 5. Coordinates: layers stack top -> bottom; within a layer, computed boxes lay out left ->
  //    right with gapX between edges after the full fixed-node inline envelope. Fixed entries keep
  //    their coordinates verbatim, while their block extents advance the next layer lane.
  let previousLayerBottom: number | undefined;
  for (const slots of layers) {
    let layerHeight = 0;
    let fixedLayerBottom = 0;
    for (const slot of slots) {
      const fixedPosition = slot.virtual ? undefined : fixed?.get(slot.id);
      if (fixedPosition) {
        fixedLayerBottom = Math.max(
          fixedLayerBottom,
          checkedLayoutSum(
            `fixed block extent for "${slot.id}"`,
            fixedPosition.y,
            slot.height / 2,
          ),
        );
      } else {
        layerHeight = Math.max(layerHeight, slot.height);
      }
    }
    const layerTop =
      previousLayerBottom === undefined
        ? 0
        : checkedGapAfter(previousLayerBottom, gapY, 'layer block gap');
    const layerBox = checkedBoxFromStart(layerTop, layerHeight, 'computed layer');
    let previousInlineRight = fixedInlineRight;
    for (const slot of slots) {
      const fixedPos = slot.virtual ? undefined : fixed?.get(slot.id);
      if (fixedPos) {
        positions.set(
          slot.id,
          Object.freeze({ x: fixedPos.x, y: fixedPos.y }),
        );
        continue;
      }
      const slotStart =
        previousInlineRight === undefined
          ? 0
          : checkedGapAfter(previousInlineRight, gapX, `inline gap before "${slot.id}"`);
      const slotBox = checkedBoxFromStart(slotStart, slot.width, `inline box for "${slot.id}"`);
      if (!slot.virtual) {
        positions.set(slot.id, Object.freeze({ x: slotBox.center, y: layerBox.center }));
      }
      previousInlineRight = slotBox.end;
    }
    previousLayerBottom = Math.max(layerBox.end, fixedLayerBottom);
  }
  return Object.freeze({ positions, truncated, virtualWaypointCount: waypointCounter });
}
