import { readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import type { LyraTopic } from './mind-map-layout.js';

const TOPIC_COPY_LIMIT = 50_000;
const TOPIC_DEPTH_LIMIT = 64;

function arrayLength(value: unknown): number | undefined {
  try { return Array.isArray(value) ? readOwnArrayLength(value) : undefined; }
  catch { return undefined; }
}

type TopicCopy = { id: string; label: string; children?: TopicCopy[] };
interface TopicAncestor { readonly source: object; readonly parent?: TopicAncestor; }

/** Own a bounded breadth-first projection without evaluating consumer accessors or walking
 * unseen branches to estimate their size. Array frames keep queue allocation bounded by work
 * already admitted, even when a root or child array has millions of logical positions. */
export function snapshotMindMapTopics(value: unknown): {
  readonly topics: readonly LyraTopic[];
  readonly truncated: boolean;
} {
  const topics: TopicCopy[] = [];
  const owned: TopicCopy[] = [];
  const queue: { source: readonly unknown[]; target: TopicCopy[]; depth: number; length: number; parent?: TopicAncestor }[] = [];
  const length = arrayLength(value);
  if (length !== undefined) queue.push({ source: value as readonly unknown[], target: topics, depth: 0, length });
  let inspected = 0;
  let truncated = false;
  for (let frameIndex = 0; frameIndex < queue.length; frameIndex++) {
    const frame = queue[frameIndex]!;
    if (inspected >= TOPIC_COPY_LIMIT) { truncated = true; break; }
    for (let index = 0; index < frame.length; index++) {
      if (inspected >= TOPIC_COPY_LIMIT) { truncated = true; break; }
      inspected++;
      const topic = readOwnDataValue(frame.source, String(index));
      if (topic === null || typeof topic !== 'object') continue;
      // Cut only ancestry cycles. Shared occurrences remain available for the layout's existing
      // depth-first first-id policy, which may choose a deeper occurrence before a later root.
      let cyclic = false;
      for (let ancestor = frame.parent; ancestor; ancestor = ancestor.parent) {
        if (ancestor.source === topic) { cyclic = true; break; }
      }
      if (cyclic) continue;
      const id = readOwnDataValue(topic, 'id');
      const label = readOwnDataValue(topic, 'label');
      if (typeof id !== 'string' || !id.trim() || typeof label !== 'string') continue;
      const children = readOwnDataValue(topic, 'children');
      const childCount = arrayLength(children);
      const copy: TopicCopy = { id, label, ...(childCount === undefined ? {} : { children: [] }) };
      frame.target.push(copy);
      owned.push(copy);
      if (childCount) {
        if (frame.depth >= TOPIC_DEPTH_LIMIT) truncated = true;
        else queue.push({ source: children as readonly unknown[], target: copy.children!, depth: frame.depth + 1, length: childCount, parent: { source: topic, parent: frame.parent } });
      }
    }
  }
  for (const copy of owned) {
    if (copy.children) Object.freeze(copy.children);
    Object.freeze(copy);
  }
  return { topics: Object.freeze(topics), truncated };
}
