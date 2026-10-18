import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { isPlainRecord } from '../../../internal/object-guards.js';
import type {
  FlowEdge,
  FlowHandle,
  FlowNode,
  FlowRunDecoration,
  FlowRunDecorations,
} from './flow-types.js';

const FLOW_STATUSES = new Set<LyraToolStatus>([
  'pending',
  'running',
  'success',
  'error',
  'denied',
]);
const FLOW_VARIANTS = new Set<LyraVariant>([
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
]);
export const MAX_FLOW_COLLECTION_ENTRIES = 10_000;
export const DEFAULT_FLOW_INPUTS: readonly FlowHandle[] = Object.freeze([Object.freeze({ id: 'in' })]);
export const DEFAULT_FLOW_OUTPUTS: readonly FlowHandle[] = Object.freeze([Object.freeze({ id: 'out' })]);
const MAX_FLOW_COLLECTION_NODES = 50_000;
const MAX_FLOW_COLLECTION_DEPTH = 16;

/** Retain every finite canvas coordinate; the canvas plane permits negative positions. */
function snapshotFlowPosition(value: unknown): Readonly<{ x: number; y: number }> | undefined {
  if (!isPlainRecord(value)) return undefined;
  const x = value['x'];
  const y = value['y'];
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) return undefined;
  return Object.freeze({ x, y });
}

interface FlowDataBudget {
  remaining: number;
  truncated: boolean;
  readonly seen: WeakMap<object, Record<string, unknown> | unknown[]>;
  readonly onTruncate?: () => void;
}

/** Clone JSON-shaped metadata without evaluating getters. One assignment shares both its
 * work budget and identity map across all node data roots; opaque non-plain leaves stay opaque. */
function snapshotFlowData(value: Record<string, unknown>, budget: FlowDataBudget): Readonly<Record<string, unknown>> {
  const previous = budget.seen.get(value);
  if (previous) return previous as Record<string, unknown>;
  const root: Record<string, unknown> = {};
  const work: Array<{
    source: Record<string, unknown> | unknown[];
    target: Record<string, unknown> | unknown[];
    depth: number;
  }> = [{ source: value, target: root, depth: 0 }];
  const owned: Array<Record<string, unknown> | unknown[]> = [root];
  budget.seen.set(value, root);
  const truncate = (): void => {
    if (budget.truncated) return;
    budget.truncated = true;
    budget.onTruncate?.();
  };
  try {
    while (work.length > 0) {
      // Once omission is known, an exhausted budget never enumerates another source merely
      // to rediscover it. Before that point, empty queued/root containers require no fields.
      if (budget.remaining <= 0 && budget.truncated) break;
      const { source, target, depth } = work.pop()!;
      let keys: (string | symbol)[];
      let sourceIsArray: boolean;
      try {
        // JavaScript key enumeration is eager, but descriptors and copied values are bounded.
        keys = Reflect.ownKeys(source);
        sourceIsArray = Array.isArray(source);
      } catch { continue; }
      let inspected = 0;
      for (const key of keys) {
        // Array length is intrinsic container state, not an enumerable JSON field. In
        // particular, an empty array must remain empty without consuming a field budget.
        if (sourceIsArray && key === 'length') continue;
        if (inspected >= MAX_FLOW_COLLECTION_ENTRIES || budget.remaining <= 0) {
          truncate();
          break;
        }
        inspected++;
        budget.remaining--;
        if (typeof key !== 'string') continue;
        let descriptor: PropertyDescriptor | undefined;
        try { descriptor = Object.getOwnPropertyDescriptor(source, key); } catch { continue; }
        if (!descriptor?.enumerable || !('value' in descriptor)) continue;
        const item: unknown = descriptor.value;
        let clone: unknown = item;
        let itemIsArray: boolean;
        let structured: boolean;
        try {
          itemIsArray = Array.isArray(item);
          structured = itemIsArray || isPlainRecord(item);
        } catch { continue; }
        if (structured) {
          const sourceItem = item as Record<string, unknown> | unknown[];
          clone = budget.seen.get(sourceItem);
          if (!clone) {
            if (depth >= MAX_FLOW_COLLECTION_DEPTH) { truncate(); continue; }
            const child: Record<string, unknown> | unknown[] = itemIsArray ? [] : {};
            clone = child;
            budget.seen.set(sourceItem, child);
            owned.push(child);
            work.push({ source: sourceItem, target: child, depth: depth + 1 });
          }
        }
        Object.defineProperty(target, key, { value: clone, enumerable: true, configurable: true, writable: true });
      }
    }
  } finally {
    // Shared entries become visible to later node roots even if a hostile value interrupts
    // this traversal. Never leave provisional root or child objects mutable in that cache.
    for (let index = owned.length - 1; index >= 0; index--) Object.freeze(owned[index]);
  }
  return root;
}

export function normalizeFlowStatus(value: unknown): LyraToolStatus | null {
  return typeof value === 'string' && FLOW_STATUSES.has(value as LyraToolStatus)
    ? (value as LyraToolStatus)
    : null;
}

export function normalizeFlowVariant(value: unknown): LyraVariant | undefined {
  return typeof value === 'string' && FLOW_VARIANTS.has(value as LyraVariant)
    ? (value as LyraVariant)
    : undefined;
}

export function snapshotFlowHandles(
  value: readonly FlowHandle[] | undefined,
): readonly FlowHandle[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: FlowHandle[] = [];
  const seen = new Set<string>();
  for (const handle of value.slice(0, MAX_FLOW_COLLECTION_ENTRIES)) {
    try {
      const id = handle?.id;
      if (typeof id !== 'string' || id.trim() === '' || seen.has(id)) continue;
      const label = handle?.label;
      result.push(
        Object.freeze({
          id,
          ...(typeof label === 'string' ? { label } : {}),
        })
      );
      seen.add(id);
    } catch {
      // A malformed handle cannot reserve its id or suppress a later valid occurrence.
    }
  }
  return Object.freeze(result);
}

export function snapshotFlowNodes(value: readonly FlowNode[], onTruncate?: () => void): readonly FlowNode[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  if (value.length > MAX_FLOW_COLLECTION_ENTRIES) onTruncate?.();
  const budget: FlowDataBudget = { remaining: MAX_FLOW_COLLECTION_NODES, truncated: false, seen: new WeakMap(), onTruncate };
  const nodes: FlowNode[] = [];
  const seen = new Set<string>();
  for (const node of value.slice(0, MAX_FLOW_COLLECTION_ENTRIES)) {
    try {
      const id = node?.id;
      if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) continue;
      const data = isPlainRecord(node?.data) ? snapshotFlowData(node.data, budget) : undefined;
      const position = snapshotFlowPosition(node?.position);
      const inputs = snapshotFlowHandles(node?.inputs);
      const outputs = snapshotFlowHandles(node?.outputs);
      const snapshot = Object.freeze({
        id,
        ...(typeof node?.type === 'string' ? { type: node.type } : {}),
        ...(position ? { position } : {}),
        ...(data ? { data } : {}),
        ...(typeof node?.accessibleLabel === 'string'
          ? { accessibleLabel: node.accessibleLabel }
          : {}),
        ...(inputs ? { inputs } : {}),
        ...(outputs ? { outputs } : {}),
        ...(typeof node?.disabled === 'boolean' ? { disabled: node.disabled } : {}),
      });
      seen.add(id);
      nodes.push(snapshot);
    } catch {
      // A malformed record cannot reserve its id or suppress a later valid occurrence.
    }
  }
  return Object.freeze(nodes);
}

export function snapshotFlowEdges(value: readonly FlowEdge[], onTruncate?: () => void): readonly FlowEdge[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  if (value.length > MAX_FLOW_COLLECTION_ENTRIES) onTruncate?.();
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();
  for (const edge of value.slice(0, MAX_FLOW_COLLECTION_ENTRIES)) {
    try {
      const id = edge?.id;
      if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) continue;
      const tone = normalizeFlowVariant(edge?.tone);
      const snapshot = Object.freeze({
        id,
        source: typeof edge?.source === 'string' ? edge.source : '',
        target: typeof edge?.target === 'string' ? edge.target : '',
        ...(typeof edge?.sourceHandle === 'string' ? { sourceHandle: edge.sourceHandle } : {}),
        ...(typeof edge?.targetHandle === 'string' ? { targetHandle: edge.targetHandle } : {}),
        ...(typeof edge?.label === 'string' ? { label: edge.label } : {}),
        ...(tone ? { tone } : {}),
      });
      seen.add(id);
      edges.push(snapshot);
    } catch {
      // A malformed record cannot reserve its id or suppress a later valid occurrence.
    }
  }
  return Object.freeze(edges);
}

export function snapshotFlowDecorations(value: unknown): FlowRunDecorations {
  if (!isPlainRecord(value)) return Object.freeze({});
  const entries: [string, Readonly<FlowRunDecoration>][] = [];
  let keys: (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value).slice(0, MAX_FLOW_COLLECTION_ENTRIES);
  } catch {
    return Object.freeze({});
  }
  for (const id of keys) {
    if (typeof id !== 'string') continue;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, id);
    } catch {
      continue;
    }
    if (!descriptor?.enumerable || !('value' in descriptor)) continue;
    const candidate: unknown = descriptor.value;
    try {
      if (!isPlainRecord(candidate)) continue;
      const status = normalizeFlowStatus(candidate['status']);
      if (!status) continue;
      const progress = candidate['progress'];
      const durationMs = candidate['durationMs'];
      const detail = candidate['detail'];
      entries.push([
        id,
        Object.freeze({
          status,
          ...(typeof progress === 'number' ? { progress } : {}),
          ...(typeof durationMs === 'number' ? { durationMs } : {}),
          ...(typeof detail === 'string' ? { detail } : {}),
        }),
      ]);
    } catch {
      // One unreadable decoration must not reject the collection or erase valid neighbors.
    }
  }
  return Object.freeze(Object.fromEntries(entries));
}
