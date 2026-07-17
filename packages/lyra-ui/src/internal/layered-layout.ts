export interface LayeredLayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayeredLayoutEdge {
  source: string;
  target: string;
}

export interface LayeredLayoutOptions {
  /** Kept verbatim, excluded from computed assignment -- still participates in layering/ordering
   *  (occupies a slot, contributes to in-layer spacing) so later boxes don't overlap it. */
  fixedPositions?: Map<string, { x: number; y: number }>;
  /** In-layer gap between adjacent box edges (not centers). Default 24. */
  gapX?: number;
  /** Gap between layers (block axis). Default 100. */
  gapY?: number;
}

function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = init();
    map.set(key, value);
  }
  return value;
}

/**
 * A deterministic Sugiyama-lite layered ("DAG-ish") layout, dependency-free: (1) DFS-based cycle
 * handling (back edges reversed internally for layering only, the caller's own edge array is
 * never mutated); (2) longest-path layering; (3) four barycenter sweeps for crossing reduction,
 * routing any edge spanning more than one layer through synthetic virtual waypoints that
 * participate in ordering only and are never returned; (4) coordinates assigned top -> bottom
 * (block axis, RTL-neutral), left -> right within a layer by stable input order on ties.
 * `fixedPositions` entries keep their given coordinates verbatim while still occupying a layer
 * slot for spacing purposes. The caller is responsible for centering the returned drawing within
 * its own canvas -- this function returns raw box centers with layer 0 starting at y=0.
 *
 * A single, shared, dependency-free implementation -- suitable for any future layered-diagram
 * consumer beyond `<lyra-graph>`'s own `layout="layered"` mode, not just this component.
 */
export function layeredLayout(input: {
  nodes: LayeredLayoutNode[];
  edges: LayeredLayoutEdge[];
  options?: LayeredLayoutOptions;
}): Map<string, { x: number; y: number }> {
  const { nodes, edges } = input;
  const gapX = input.options?.gapX ?? 24;
  const gapY = input.options?.gapY ?? 100;
  const fixed = input.options?.fixedPositions;

  const positions = new Map<string, { x: number; y: number }>();
  if (!nodes.length) return positions;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id); // stable input order, for every tie-break below

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

  function dfs(id: string): void {
    state.set(id, ON_STACK);
    for (const target of adjacency.get(id) ?? []) {
      const targetState = state.get(target);
      if (targetState === UNVISITED) {
        dagEdges.push({ source: id, target });
        dfs(target);
      } else if (targetState === ON_STACK) {
        dagEdges.push({ source: target, target: id }); // back edge -- reversed
      } else {
        dagEdges.push({ source: id, target });
      }
    }
    state.set(id, DONE);
  }
  for (const id of order) if (state.get(id) === UNVISITED) dfs(id);

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
  const maxLayer = Math.max(0, ...order.map((id) => layer.get(id) ?? 0));
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
  const waypointChains = new Map<string, string[]>();
  for (const e of dagEdges) {
    const sourceLayer = layer.get(e.source) ?? 0;
    const targetLayer = layer.get(e.target) ?? 0;
    if (targetLayer - sourceLayer <= 1) continue;
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

  // 5. Coordinates: layers stack top -> bottom; within a layer, boxes lay out left -> right with
  //    gapX between edges. fixedPositions entries keep their given coordinates verbatim but still
  //    advance the running x offset so later boxes in the same layer don't overlap them.
  let y = 0;
  for (const slots of layers) {
    const layerHeight = Math.max(0, ...slots.map((s) => s.height));
    let x = 0;
    for (const slot of slots) {
      if (!slot.virtual) {
        const fixedPos = fixed?.get(slot.id);
        positions.set(slot.id, fixedPos ?? { x: x + slot.width / 2, y: y + layerHeight / 2 });
      }
      x += slot.width + gapX;
    }
    y += layerHeight + gapY;
  }
  return positions;
}
