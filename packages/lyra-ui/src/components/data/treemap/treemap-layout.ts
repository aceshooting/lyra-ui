import { isPlainDataRecord, readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { isRuntimeArray } from '../../../internal/object-guards.js';
import { finiteNumber } from '../../../internal/numbers.js';

/** Branches derive their weight from descendants. Leaves use a positive finite value. */
export interface LyraTreemapNode {
  readonly id: string;
  readonly label: string;
  readonly value?: number;
  readonly children?: readonly LyraTreemapNode[];
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreemapRect extends Bounds {
  id: string;
  label: string;
  value: number;
  parentId: string | null;
  depth: number;
}

interface WeightedNode {
  id: string;
  label: string;
  children: WeightedNode[];
  value: number;
  logWeight: number;
}

const MAX_NODES = 10000;
const MAX_DEPTH = 64;

function collect(roots: readonly LyraTreemapNode[], onTruncate?: () => void): WeightedNode[] {
  let truncated = false;
  let visited = 0;
  const ids = new Set<string>();

  function accept(node: object, id: string, depth: number): WeightedNode | undefined {
    const name = readOwnDataValue(node, 'label');
    const label = typeof name === 'string' ? name : id;
    const descendants = readOwnDataValue(node, 'children');
    if (isRuntimeArray(descendants) && readOwnArrayLength(descendants)) {
      if (depth >= MAX_DEPTH) {
        truncated = true;
        return undefined;
      }
      const children = read(descendants, depth + 1);
      if (!children.length) return undefined;
      const max = children[0]!.logWeight;
      const scaled = children.reduce((sum, child) => sum + Math.exp(child.logWeight - max), 0);
      const value = Math.min(Number.MAX_VALUE, children.reduce((sum, child) => sum + child.value, 0));
      return { id, label, children, value, logWeight: max + Math.log(scaled) };
    }
    const value = readOwnDataValue(node, 'value');
    return typeof value === 'number' && finiteNumber(value, 0) > 0
      ? { id, label, value, children: [], logWeight: Math.log(value) }
      : undefined;
  }

  function read(nodes: readonly unknown[], depth: number): WeightedNode[] {
    const output: WeightedNode[] = [];
    const length = readOwnArrayLength(nodes) ?? 0;
    for (let index = 0; index < length; index++) {
      if (++visited > MAX_NODES) {
        truncated = true;
        break;
      }
      const node = readOwnDataValue(nodes, index);
      if (!isPlainDataRecord(node)) continue;
      const id = readOwnDataValue(node, 'id');
      if (typeof id !== 'string' || !id || ids.has(id)) continue;
      // Hold the ID while descendants are read, so a descendant cannot reuse it, and release it
      // when the node is rejected so a later valid node with the same ID is still accepted.
      ids.add(id);
      const accepted = accept(node, id, depth);
      if (accepted) output.push(accepted);
      else ids.delete(id);
    }
    return output.sort((a, b) => b.logWeight - a.logWeight);
  }

  const result = read(roots, 0);
  if (truncated) onTruncate?.();
  return result;
}

/** Why a layout omitted nodes: an input limit, or tiles too small to occupy any area. */
export type TreemapOmission = 'input' | 'size';

/**
 * Squarifies each sibling group in the supplied bounds and returns parent-first rectangles.
 * Nodes too small to occupy any area are returned with zero width and height.
 */
export function layoutTreemap(
  nodes: readonly LyraTreemapNode[],
  width = 1,
  height = 1,
  onTruncate?: (reason: TreemapOmission) => void,
): TreemapRect[] {
  if (!isRuntimeArray(nodes) || finiteNumber(width, 0) <= 0 || finiteNumber(height, 0) <= 0) return [];
  const result: TreemapRect[] = [];
  let truncated = false;

  // A node too small to occupy any area keeps a zero-size entry, as do its descendants, so a
  // data table can still list every value the plot cannot draw.
  function omit(node: WeightedNode, x: number, y: number, parentId: string | null, depth: number): void {
    result.push({ x, y, width: 0, height: 0, id: node.id, label: node.label, value: node.value, parentId, depth });
    for (const child of node.children) omit(child, x, y, node.id, depth + 1);
  }

  function tile(group: WeightedNode[], bounds: Bounds, parentId: string | null, depth: number): void {
    if (!group.length) return;
    const largest = group[0]!.logWeight;
    const weights = group.map(node => Math.exp(node.logWeight - largest));
    const suffix = Array<number>(group.length + 1).fill(0);
    for (let i = group.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + weights[i]!;
    let { x, y, width: w, height: h } = bounds;
    for (let start = 0; start < group.length;) {
      const vertical = w >= h;
      const long = vertical ? w : h;
      const short = vertical ? h : w;
      const remaining = suffix[start]!;
      if (!(short > 0 && remaining > 0)) {
        truncated = true;
        for (let i = start; i < group.length; i++) omit(group[i]!, x, y, parentId, depth);
        break;
      }
      const first = weights[start]!;
      // Compare the worst short-to-long and long-to-short ratios in log space.
      const factor = Math.log(long) - Math.log(short) - Math.log(remaining);
      const score = (total: number, last: number) => {
        const strip = factor + 2 * Math.log(total);
        return Math.max(Math.log(first) - strip, strip - Math.log(last));
      };
      let end = start + 1;
      let sum = first;
      let worst = score(sum, first);
      while (end < group.length) {
        const next = weights[end]!;
        const candidate = score(sum + next, next);
        if (candidate > worst) break;
        worst = candidate;
        sum += next;
        end++;
      }
      const thickness = long * Math.min(1, sum / remaining);
      let offset = 0;
      for (let i = start; i < end; i++) {
        const available = Math.max(0, short - offset);
        const span = i + 1 === end ? available : Math.min(available, short * (weights[i]! / sum));
        const cell = vertical
          ? { x, y: y + offset, width: thickness, height: span }
          : { x: x + offset, y, width: span, height: thickness };
        const node = group[i]!;
        offset += span;
        if (!(cell.x + cell.width > cell.x && cell.y + cell.height > cell.y)) {
          truncated = true;
          omit(node, cell.x, cell.y, parentId, depth);
          continue;
        }
        result.push({ ...cell, id: node.id, label: node.label, value: node.value, parentId, depth });
        tile(node.children, cell, node.id, depth + 1);
      }
      if (vertical) {
        x += thickness;
        w -= thickness;
      } else {
        y += thickness;
        h -= thickness;
      }
      start = end;
    }
  }

  tile(collect(nodes, () => onTruncate?.('input')), { x: 0, y: 0, width, height }, null, 0);
  if (truncated) onTruncate?.('size');
  return result;
}
