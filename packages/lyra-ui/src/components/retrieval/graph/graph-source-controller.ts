import type { ReactiveControllerHost } from 'lit';
import type { LyraGraphSource } from '../../../data-sources.js';
import { GraphSceneController, type SceneDomain } from '../../../internal/graph-scene-controller.js';
import type { LyraGraphEdge, LyraGraphNode } from './graph-model.js';

export type GraphSourceEdge = LyraGraphEdge & { readonly id: string };
export type GraphSceneSource = LyraGraphSource<LyraGraphNode, GraphSourceEdge>;
export type { GraphSceneIntent } from '../../../internal/graph-scene-controller.js';
const graphSceneDomain: SceneDomain<LyraGraphNode, GraphSourceEdge> = {
  create: reader => ({
    node(value, entryPosition) {
      const id = reader.text(reader.field(value, 'id'), true);
      const radius = reader.field(value, 'radius');
      const expandable = reader.flag(value, 'expandable');
      const ownPosition = reader.position(reader.field(value, 'position'));
      const placed = reader.position(entryPosition) ?? ownPosition;
      return Object.freeze({ id, ...reader.texts(value, ['label', 'accessibleLabel', 'description', 'color', 'type', 'communityId']),
        ...(radius === undefined ? {} : { radius: Math.max(6, Math.min(24, reader.number(radius))) }),
        ...(expandable === undefined ? {} : { expandable }), ...(placed === undefined ? {} : { position: placed }) });
    },
    edge(value) {
      const id = reader.text(reader.field(value, 'id'), true);
      const source = reader.text(reader.field(value, 'source'), true);
      const target = reader.text(reader.field(value, 'target'), true);
      const width = reader.field(value, 'width');
      const directed = reader.flag(value, 'directed');
      const rawDash = reader.field(value, 'dash');
      let dash: readonly number[] | undefined;
      if (rawDash !== undefined) {
        const entries = reader.array(rawDash, 32);
        dash = Object.freeze(Array.from({ length: entries.length }, (_, i) => {
          const item = reader.number(entries.at(i), 1_000_000);
          if (item < 0) throw new RangeError('Invalid scene dash');
          return item;
        }));
      }
      return Object.freeze({ id, source, target, ...reader.texts(value, ['label', 'accessibleLabel', 'description', 'color']),
        ...(width === undefined ? {} : { width: Math.max(0, reader.number(width, 1_000_000)) }),
        ...(directed === undefined ? {} : { directed }), ...(dash === undefined ? {} : { dash }) });
    },
  }),
};

/** Graph projection using the shared bounded scene authority. */
export class GraphSourceController extends GraphSceneController<LyraGraphNode, GraphSourceEdge> {
  constructor(host: HTMLElement & ReactiveControllerHost, options: { readonly onChange: () => void }) {
    super(host, { ...options, domain: graphSceneDomain });
  }
}
