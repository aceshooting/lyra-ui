import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import type { LyraVariant } from '../../../internal/variants.js';
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
const MAX_FLOW_COLLECTION_NODES = 50_000;
const MAX_FLOW_COLLECTION_DEPTH = 16;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/** Clones and freezes the JSON-shaped portion of consumer node metadata without invoking getters.
 * Cycles and shared references retain their topology. Non-plain leaf objects remain opaque values;
 * the public `data` contract only promises a record, while arrays/plain nested records are the
 * structured state the canvas can safely own. */
function snapshotFlowData(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const root: Record<string, unknown> = {};
  const seen = new WeakMap<object, Record<string, unknown> | unknown[]>();
  const work: Array<{
    source: Record<string, unknown> | unknown[];
    target: Record<string, unknown> | unknown[];
    depth: number;
  }> = [{ source: value, target: root, depth: 0 }];
  const owned: Array<Record<string, unknown> | unknown[]> = [root];
  seen.set(value, root);
  let remaining = MAX_FLOW_COLLECTION_NODES;

  while (work.length > 0 && remaining > 0) {
    const { source, target, depth } = work.pop()!;
    let descriptors: PropertyDescriptorMap;
    try {
      descriptors = Object.getOwnPropertyDescriptors(source as object);
    } catch {
      continue;
    }
    let retainedEntries = 0;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable || !('value' in descriptor)) continue;
      if (retainedEntries >= MAX_FLOW_COLLECTION_ENTRIES || remaining <= 0) break;
      retainedEntries += 1;
      remaining -= 1;
      const item = descriptor.value as unknown;
      if (Array.isArray(item) || isRecord(item)) {
        if (depth >= MAX_FLOW_COLLECTION_DEPTH) continue;
        let clone = seen.get(item);
        if (!clone) {
          clone = Array.isArray(item) ? [] : {};
          seen.set(item, clone);
          owned.push(clone);
          work.push({ source: item, target: clone, depth: depth + 1 });
        }
        (target as Record<string, unknown>)[key] = clone;
      } else {
        (target as Record<string, unknown>)[key] = item;
      }
    }
  }

  for (let index = owned.length - 1; index >= 0; index--) Object.freeze(owned[index]);
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
      seen.add(id);
      result.push(
        Object.freeze({
          id,
          ...(typeof handle?.label === 'string' ? { label: handle.label } : {}),
        })
      );
    } catch {
      // A malformed handle cannot reserve its id or suppress a later valid occurrence.
    }
  }
  return Object.freeze(result);
}

export function snapshotFlowNodes(value: readonly FlowNode[]): readonly FlowNode[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const nodes: FlowNode[] = [];
  const seen = new Set<string>();
  for (const node of value.slice(0, MAX_FLOW_COLLECTION_ENTRIES)) {
    try {
      const id = node?.id;
      if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) continue;
      const data = isRecord(node?.data) ? snapshotFlowData(node.data) : undefined;
      const position = node?.position
        ? Object.freeze({ x: node.position.x, y: node.position.y })
        : undefined;
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
      });
      seen.add(id);
      nodes.push(snapshot);
    } catch {
      // A malformed record cannot reserve its id or suppress a later valid occurrence.
    }
  }
  return Object.freeze(nodes);
}

export function snapshotFlowEdges(value: readonly FlowEdge[]): readonly FlowEdge[] {
  if (!Array.isArray(value)) return Object.freeze([]);
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
  if (!isRecord(value)) return Object.freeze({});
  const entries: [string, Readonly<FlowRunDecoration>][] = [];
  let keys: string[];
  try {
    keys = Object.keys(value).slice(0, MAX_FLOW_COLLECTION_ENTRIES);
  } catch {
    return Object.freeze({});
  }
  for (const id of keys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, id);
    } catch {
      continue;
    }
    if (!descriptor || !('value' in descriptor)) continue;
    const candidate: unknown = descriptor.value;
    if (!isRecord(candidate)) continue;
    const status = normalizeFlowStatus(candidate['status']);
    if (!status) continue;
    entries.push([
      id,
      Object.freeze({
        status,
        ...(typeof candidate['progress'] === 'number' ? { progress: candidate['progress'] } : {}),
        ...(typeof candidate['durationMs'] === 'number'
          ? { durationMs: candidate['durationMs'] }
          : {}),
        ...(typeof candidate['detail'] === 'string' ? { detail: candidate['detail'] } : {}),
      }),
    ]);
  }
  return Object.freeze(Object.fromEntries(entries));
}
