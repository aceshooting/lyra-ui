import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { planMapLayerOrder, type MapLayerOrderGroup } from './map-layer-order.js';

const basemap = ['b0', 'b1', 'b2', 'b3', 'b4'];
const owned = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'];
const anchors = [...basemap, 'g0', 'g1', 'g2', 'o0', 'o3', 'missing', undefined] as const;

// Existing layers are any subset of basemap and owned ids in any order; each owned id joins at most one of three groups.
const scenarios = fc.record({
  existing: fc.shuffledSubarray([...basemap, ...owned]),
  membership: fc.array(fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }), { minLength: owned.length, maxLength: owned.length }),
  before: fc.array(fc.constantFrom(...anchors), { minLength: 3, maxLength: 3 }),
});

function groupsOf(membership: readonly (number | undefined)[], before: readonly (string | undefined)[]): MapLayerOrderGroup[] {
  return [0, 1, 2].flatMap(index => {
    const layerIds = owned.filter((_, position) => membership[position] === index);
    const anchor = before[index];
    return layerIds.length ? [{ id: `g${index}`, layerIds, ...(anchor === undefined ? {} : { before: anchor }) }] : [];
  });
}

/** Applies the planned operations to a copy of the layer stack, counting those that change nothing. */
function replay(existing: readonly string[], operations: ReturnType<typeof planMapLayerOrder>['operations']): { order: string[]; redundant: number } {
  const result = [...existing];
  let redundant = 0;
  for (const operation of operations) {
    const previous = result.join();
    const index = result.indexOf(operation.id);
    if (index >= 0) result.splice(index, 1);
    result.splice(operation.before === undefined ? result.length : result.indexOf(operation.before), 0, operation.id);
    if (result.join() === previous) redundant += 1;
  }
  return { order: result, redundant };
}

describe('map layer order properties', () => {
  it('replays to the planned order with no redundant move, keeping basemap layers in place and each group contiguous', () => {
    fc.assert(fc.property(scenarios, ({ existing, membership, before }) => {
      const groups = groupsOf(membership, before);
      const plan = planMapLayerOrder(existing, groups);
      if (!plan.valid) {
        expect(plan.operations.length).to.equal(0);
        expect(plan.order.length).to.equal(0);
        return;
      }
      const replayed = replay(existing, plan.operations);
      expect(replayed.order).to.deep.equal(plan.order);
      expect(replayed.redundant).to.equal(0);
      const claimed = new Set(groups.flatMap(group => group.layerIds));
      const unclaimed = existing.filter(id => !claimed.has(id));
      expect(plan.order.filter(id => !claimed.has(id))).to.deep.equal(unclaimed);
      expect(plan.operations.some(operation => !claimed.has(operation.id))).to.equal(false);
      expect([...plan.order].sort()).to.deep.equal([...unclaimed, ...claimed].sort());
      for (const group of groups) {
        const start = plan.order.indexOf(group.layerIds[0]!);
        expect(plan.order.slice(start, start + group.layerIds.length)).to.deep.equal(group.layerIds);
      }
    }), propertyRuns());
  });

  it('plans no operation when the layers already stand in the planned order', () => {
    fc.assert(fc.property(scenarios, ({ existing, membership, before }) => {
      const plan = planMapLayerOrder(existing, groupsOf(membership, before));
      fc.pre(plan.valid);
      expect(planMapLayerOrder(plan.order, groupsOf(membership, before)).operations.length).to.equal(0);
    }), propertyRuns());
  });
});
