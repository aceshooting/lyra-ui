import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { MapBasemapOrder } from './map-basemap-order.js';

const ids = Array.from({ length: 12 }, (_, index) => `layer-${index}`);

describe('basemap placement ownership properties', () => {
  it('moves only selected IDs, is idempotent and restores the original order for every subset and input order', () => {
    fc.assert(fc.property(fc.shuffledSubarray(ids), fc.shuffledSubarray(ids), (existing, selected) => {
      const claimed = selected.filter(id => existing.includes(id));
      const input = claimed.map(layerId => ({ layerId, before: null }));
      const layers = existing.map(id => ({ id, type: 'line' }));
      const owner = new MapBasemapOrder();
      const draft = owner.stage(existing, input, layers, () => false);
      const plan = draft.plan(existing, []);
      expect(plan.valid).to.equal(true);
      expect(plan.operations.every(operation => operation.kind === 'move' && claimed.includes(operation.id))).to.equal(true);
      // Independent append oracle: remove claimed IDs, then append in authored order.
      expect(plan.order).to.deep.equal([...existing.filter(id => !claimed.includes(id)), ...claimed]);
      draft.commit(plan.order);
      const repeated = owner.stage(plan.order, input, layers, () => false).plan(plan.order, []);
      expect(repeated.operations.length).to.equal(0);
      const release = owner.stage(plan.order, [], layers, () => false).plan(plan.order, []);
      expect(release.order).to.deep.equal(existing);
      expect(release.operations.every(operation => claimed.includes(operation.id))).to.equal(true);
    }), propertyRuns());
  });

  it('never commits an abandoned draft and resets all style-generation ownership', () => {
    fc.assert(fc.property(fc.shuffledSubarray(ids), (existing) => {
      const owner = new MapBasemapOrder();
      const layers = existing.map(id => ({ id, type: 'line' }));
      const stale = owner.stage(existing, existing.map(layerId => ({ layerId, before: null })), layers, () => false);
      owner.reset(); stale.commit([...existing].reverse());
      const fresh = owner.stage(existing, [], layers, () => false).plan(existing, []);
      expect(fresh.order).to.deep.equal(existing);
      expect(fresh.operations.length).to.equal(0);
      expect(owner.active).to.equal(false);
    }), propertyRuns());
  });
});
