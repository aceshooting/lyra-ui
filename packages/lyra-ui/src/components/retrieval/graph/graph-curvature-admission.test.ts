import { expect } from '@open-wc/testing';
import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { normalizeGraphModel, type LyraGraphEdge } from './graph-model.js';

it('retains record curvature through the ordinary bounded snapshot and model normalization', () => {
  const input = [{ id: 'curve', source: 'a', target: 'b', curvature: -0.5 }];
  const snapshot = snapshotPublicCollection(input) as readonly LyraGraphEdge[];
  const model = normalizeGraphModel([{ id: 'a' }, { id: 'b' }], snapshot, [], []);
  expect((model.links[0] as unknown as { curvature: number }).curvature).to.equal(-0.5);
  input[0]!.curvature = 0.5;
  expect((model.links[0] as unknown as { curvature: number }).curvature).to.equal(-0.5);
  expect(Object.isFrozen(model.links[0])).to.equal(true);
});

it('charges curvature to the existing snapshot value budget and never invokes its accessor', () => {
  const base = { id: 'edge', source: 'a', target: 'b' };
  const straight = snapshotPublicCollection([base], undefined, { limits: { nodes: 4 } }) as readonly unknown[];
  const curved = snapshotPublicCollection([{ ...base, curvature: 0.5 }], undefined, { limits: { nodes: 4 } }) as readonly unknown[];
  expect(straight.length).to.equal(1); expect(curved.length).to.equal(0);
  let reads = 0;
  const hostile = { ...base, get curvature() { reads++; throw Error(); } };
  const snapshot = snapshotPublicCollection([hostile]) as readonly Record<string, unknown>[];
  expect(reads).to.equal(0); expect(snapshot.length).to.equal(1); expect(snapshot[0]!['curvature']).to.equal(undefined);
});
