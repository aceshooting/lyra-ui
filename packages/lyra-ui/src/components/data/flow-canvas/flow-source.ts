import type { LyraGraphRecord, LyraGraphOverview, LyraGraphSourceSummary, LyraSourceBounds, LyraSourceRecord } from '../../../data-sources.js';
import { SceneReader } from '../../../internal/graph-scene-controller.js';
import { sourceCount } from '../../../internal/source-request-controller.js';
import type { FlowNode, FlowEdge } from './flow-types.js';
export type FlowSourceValue = LyraGraphRecord<FlowNode, FlowEdge>;
export function flowSourceSummary(raw: unknown, reader: SceneReader): LyraGraphSourceSummary {
  return Object.freeze({ nodes: sourceCount(reader.field(raw, 'nodes')), edges: sourceCount(reader.field(raw, 'edges')) });
}
/** Record pages retain display fields only; complete strict metadata belongs to accepted scenes. */
export function flowSourceRows(raw: unknown, limit: number, reader: SceneReader): readonly LyraSourceRecord<FlowSourceValue>[] {
  const rows = reader.array(raw, limit);
  return Object.freeze(Array.from({ length: rows.length }, (_, index) => {
    const rawRow = rows.at(index), key = reader.key(reader.field(rawRow, 'key'));
    const order = sourceCount(reader.field(rawRow, 'order')), rawValue = reader.field(rawRow, 'value');
    const kind = reader.field(rawValue, 'kind'), value = reader.field(rawValue, 'value');
    const id = reader.text(reader.field(value, 'id'), true);
    if (!id.trim() || key !== `${kind}:${id}`) throw new TypeError('Invalid flow record identity');
    if (kind === 'node') {
      const data = reader.field(value, 'data');
      const label = data === undefined ? undefined : reader.field(data, 'label');
      const disabled = reader.flag(value, 'disabled');
      const node: FlowNode = Object.freeze({ id, ...reader.texts(value, ['accessibleLabel', 'type']),
        ...(label === undefined ? {} : { data: Object.freeze({ label: reader.text(label) }) }),
        ...(disabled === undefined ? {} : { disabled }) });
      return Object.freeze({ key, order, value: Object.freeze({ kind, value: node }) });
    }
    if (kind !== 'edge') throw new TypeError('Invalid flow record kind');
    const source = reader.text(reader.field(value, 'source'), true), target = reader.text(reader.field(value, 'target'), true);
    if (!source.trim() || !target.trim()) throw new TypeError('Invalid flow endpoint');
    return Object.freeze({ key, order, value: Object.freeze({ kind, value: Object.freeze({ id, source, target, ...reader.texts(value, ['label']) }) }) });
  }));
}
export function sameFlowBounds(left: LyraSourceBounds, right: LyraSourceBounds): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}
/** At most 1024 rectangles: the bounded pair check performs at most 523776 comparisons. */
export function flowSourceOverview(raw: unknown, world: LyraSourceBounds, population: number, current: () => boolean): LyraGraphOverview {
  const reader = new SceneReader(current), bounds = reader.bounds(reader.field(raw, 'bounds'));
  if (!bounds || !sameFlowBounds(bounds, world)) throw new TypeError('Invalid flow overview extent');
  const entries = reader.array(reader.field(raw, 'bins'), 1024);
  let total = 0;
  const bins = Array.from({ length: entries.length }, (_, index) => {
    const entry = entries.at(index), area = reader.bounds(reader.field(entry, 'bounds'));
    const count = sourceCount(reader.field(entry, 'count')); total += count;
    if (!Number.isSafeInteger(total) || !area || area.x < bounds.x || area.y < bounds.y ||
      area.x + area.width > bounds.x + bounds.width || area.y + area.height > bounds.y + bounds.height ||
      (bounds.width > 0 && area.width === 0) || (bounds.height > 0 && area.height === 0)) throw new RangeError('Invalid flow overview bin');
    return Object.freeze({ bounds: area, count });
  });
  if (total !== population) throw new TypeError('Invalid flow overview population');
  for (let i = 0; i < bins.length; i++) for (let j = 0; j < i; j++) {
    const a = bins[i]!.bounds, b = bins[j]!.bounds;
    if ((bounds.width === 0 || a.x < b.x + b.width && b.x < a.x + a.width) &&
      (bounds.height === 0 || a.y < b.y + b.height && b.y < a.y + a.height)) throw new TypeError('Overlapping flow overview bins');
  }
  reader.check(); return Object.freeze({ bounds, bins: Object.freeze(bins) });
}
