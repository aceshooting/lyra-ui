import { isPlainDataRecord, readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { isRuntimeArray } from '../../../internal/object-guards.js';

/** A named vertex in a weighted, directed acyclic graph. */
export interface LyraSankeyNode {
  readonly id: string;
  readonly label: string;
}

/** A positive weighted flow between two node IDs. Parallel flows are supported. */
export interface LyraSankeyLink {
  readonly id?: string;
  readonly label?: string;
  readonly source: string;
  readonly target: string;
  readonly value: number;
}

export interface SankeyNodeRect extends LyraSankeyNode {
  value: number;
  stage: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SankeyRibbon {
  id: string;
  label: string;
  source: string;
  target: string;
  value: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

export interface SankeyLayoutResult {
  status: 'empty' | 'cycle' | 'ready';
  truncated: boolean;
  nodes: SankeyNodeRect[];
  links: SankeyRibbon[];
}

interface Vertex {
  rect: SankeyNodeRect;
  incoming: Edge[];
  outgoing: Edge[];
  mass: number;
  desired: number;
}

interface Edge {
  id: string;
  label: string;
  from: Vertex;
  to: Vertex;
  value: number;
  weight: number;
  thickness: number;
  start: number;
  end: number;
}

const MAX_NODES = 1000;
const MAX_LINKS = 4000;

function readRows(rows: unknown, limit: number, visit: (row: object, index: number) => void): boolean {
  if (!isRuntimeArray(rows)) return false;
  const length = readOwnArrayLength(rows) ?? 0;
  for (let i = 0; i < Math.min(length, limit); i++) {
    const row = readOwnDataValue(rows, i);
    if (isPlainDataRecord(row)) visit(row, i);
  }
  return length > limit;
}

/** Kahn ordering assigns every vertex its longest distance from any source. */
function stages(vertices: Vertex[]): Vertex[][] | undefined {
  const pending = new Map(vertices.map(v => [v, v.incoming.length]));
  const queue = vertices.filter(v => v.incoming.length === 0);
  const columns: Vertex[][] = [];
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i]!;
    (columns[v.rect.stage] ??= []).push(v);
    for (const edge of v.outgoing) {
      const target = edge.to;
      target.rect.stage = Math.max(target.rect.stage, v.rect.stage + 1);
      const count = pending.get(target)! - 1;
      pending.set(target, count);
      if (!count) queue.push(target);
    }
  }
  return queue.length === vertices.length ? columns : undefined;
}

function center(v: Vertex): number {
  return v.rect.y + v.rect.height / 2;
}

/** Relax toward weighted neighbor centers, then pack downward and correct bottom overflow upward. */
function relax(column: Vertex[], forward: boolean, gap: number, strength: number): void {
  for (const v of column) {
    const neighbors = forward ? v.incoming : v.outgoing;
    let weighted = 0;
    let total = 0;
    for (const edge of neighbors) {
      weighted += edge.weight * center(forward ? edge.from : edge.to);
      total += edge.weight;
    }
    v.desired = total > 0 ? weighted / total : center(v);
  }
  column.sort((a, b) => a.desired - b.desired);
  let bottom = 0;
  for (const v of column) {
    const box = v.rect;
    box.y = Math.max(bottom, box.y + (v.desired - center(v)) * strength);
    bottom = box.y + box.height + gap;
  }
  bottom = 1;
  for (let i = column.length - 1; i >= 0; i--) {
    const box = column[i]!.rect;
    box.y = Math.max(0, Math.min(box.y, bottom - box.height));
    bottom = box.y - gap;
  }
}

/** Returns proportional ribbons and collision-separated columns in caller coordinate units. */
export function layoutSankey(
  nodes: readonly LyraSankeyNode[], links: readonly LyraSankeyLink[], width = 1, height = 1,
): SankeyLayoutResult {
  const result: SankeyLayoutResult = { status: 'empty', truncated: false, nodes: [], links: [] };
  if (finiteNumber(width, 0) <= 0 || finiteNumber(height, 0) <= 0) return result;
  const byId = new Map<string, Vertex>();
  result.truncated = readRows(nodes, MAX_NODES, row => {
    const id = readOwnDataValue(row, 'id');
    if (typeof id !== 'string' || !id || byId.has(id)) return;
    const name = readOwnDataValue(row, 'label');
    const rect = { id, label: typeof name === 'string' ? name : id, value: 0, stage: 0, x: 0, y: 0, width: 0, height: 0 };
    byId.set(id, { rect, incoming: [], outgoing: [], mass: 0, desired: 0 });
  });
  if (!byId.size) return result;
  const edges: Edge[] = [];
  const ids = new Set<string>();
  let largest = 0;
  const linksTruncated = readRows(links, MAX_LINKS, row => {
    const source = readOwnDataValue(row, 'source');
    const target = readOwnDataValue(row, 'target');
    const value = readOwnDataValue(row, 'value');
    if (typeof source !== 'string' || typeof target !== 'string' || typeof value !== 'number' || finiteNumber(value, 0) <= 0) return;
    const from = byId.get(source);
    const to = byId.get(target);
    if (!from || !to) return;
    const supplied = readOwnDataValue(row, 'id');
    if (supplied !== undefined && (typeof supplied !== 'string' || !supplied || ids.has(supplied))) return;
    const id = typeof supplied === 'string' ? supplied : '';
    if (id) ids.add(id);
    const name = readOwnDataValue(row, 'label');
    const edge = { id, label: typeof name === 'string' ? name : '', from, to, value, weight: 0, thickness: 0, start: 0, end: 0 };
    from.outgoing.push(edge);
    to.incoming.push(edge);
    edges.push(edge);
    largest = Math.max(largest, value);
  });
  result.truncated ||= linksTruncated;
  const vertices = [...byId.values()];
  const columns = stages(vertices);
  if (!columns) {
    result.status = 'cycle';
    return result;
  }
  let sequence = 0;
  for (const edge of edges) {
    if (!edge.id) {
      do { edge.id = `flow-${sequence++}`; } while (ids.has(edge.id));
      ids.add(edge.id);
    }
    edge.weight = edge.value / largest;
  }
  for (const v of vertices) {
    const sum = (items: Edge[], weighted: boolean) => items.reduce((n, edge) => n + (weighted ? edge.weight : edge.value), 0);
    v.mass = Math.max(sum(v.incoming, true), sum(v.outgoing, true));
    v.rect.value = Math.min(Number.MAX_VALUE, Math.max(sum(v.incoming, false), sum(v.outgoing, false)));
  }
  const count = Math.max(...columns.map(column => column.length));
  const gap = Math.min(0.035, 0.25 / count);
  const minimum = Math.min(0.035, 0.25 / count);
  let scale = 1;
  let constrained = false;
  for (const column of columns) {
    const mass = column.reduce((n, v) => n + v.mass, 0);
    if (!mass) continue;
    const empty = column.filter(v => v.mass === 0).length;
    const capacity = (1 - gap * (column.length - 1) - minimum * empty) / mass;
    scale = constrained ? Math.min(scale, capacity) : capacity;
    constrained = true;
  }
  const bar = Math.min(0.025, 0.4 / columns.length);
  for (const [stage, column] of columns.entries()) {
    let top = 0;
    for (const v of column) {
      const box = v.rect;
      box.x = columns.length === 1 ? (1 - bar) / 2 : stage / (columns.length - 1) * (1 - bar);
      box.width = bar;
      box.height = v.mass > 0 ? v.mass * scale : minimum;
      box.y = top;
      top += box.height + gap;
    }
    for (const v of column) v.rect.y += Math.max(0, (1 - top + gap) / 2);
  }
  for (let pass = 0; pass < 6; pass++) {
    const strength = 1 / (1 + pass / 2);
    for (let i = 1; i < columns.length; i++) relax(columns[i]!, true, gap, strength);
    for (let i = columns.length - 2; i >= 0; i--) relax(columns[i]!, false, gap, strength);
  }
  for (const edge of edges) edge.thickness = edge.weight * scale;
  for (const v of vertices) {
    for (const outgoing of [true, false]) {
      const list = outgoing ? v.outgoing : v.incoming;
      list.sort((a, b) => center(outgoing ? a.to : a.from) - center(outgoing ? b.to : b.from));
      const total = list.reduce((n, e) => n + e.thickness, 0);
      let offset = v.rect.y + Math.max(0, v.rect.height - total) / 2;
      for (const edge of list) {
        const middle = Math.min(1, offset + edge.thickness / 2);
        if (outgoing) edge.start = middle;
        else edge.end = middle;
        offset += edge.thickness;
      }
    }
  }
  const visible = new Set<Vertex>();
  for (const v of vertices) {
    const box = v.rect;
    box.x *= width;
    box.y *= height;
    box.width *= width;
    box.height *= height;
    if (!(box.x + box.width > box.x && box.y + box.height > box.y)) {
      result.truncated = true;
      continue;
    }
    visible.add(v);
    result.nodes.push(box);
  }
  for (const e of edges) {
    const thickness = e.thickness * height;
    const y1 = e.start * height;
    const y2 = e.end * height;
    if (!visible.has(e.from) || !visible.has(e.to) || !(y1 + thickness / 2 > y1 - thickness / 2 && y2 + thickness / 2 > y2 - thickness / 2)) {
      result.truncated = true;
      continue;
    }
    result.links.push({ id: e.id, label: e.label, source: e.from.rect.id, target: e.to.rect.id, value: e.value,
      x1: e.from.rect.x + e.from.rect.width, y1, x2: e.to.rect.x, y2, thickness });
  }
  result.status = result.nodes.length ? 'ready' : 'empty';
  return result;
}
