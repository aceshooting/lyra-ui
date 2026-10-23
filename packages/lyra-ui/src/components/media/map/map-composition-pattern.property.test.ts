import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { composeMapModules, createMapModuleDemo, createMapModulePublisher, MAP_MODULE_ORDER } from '../../../../test/map-module-composition.js';
import type { LyraMapOverlays } from './map.js';

describe('application map composition invariants', () => {
  it('module insertion order cannot change the explicit aggregate order or data identity', () => {
    fc.assert(fc.property(fc.shuffledSubarray([...MAP_MODULE_ORDER], { minLength: 8, maxLength: 8 }), order => {
      const original = createMapModuleDemo('red');
      const modules = Object.fromEntries(order.map(name => [name, original[name]]));
      const composed = composeMapModules(modules);
      expect(composed.sources?.map(source => source.id)).to.deep.equal(MAP_MODULE_ORDER.map(name => `city:${name}:data`));
      MAP_MODULE_ORDER.forEach((name, index) => {
        expect(composed.sources?.[index]?.source['data'] === original[name]?.sources[0]?.source['data']).to.equal(true);
      });
    }), propertyRuns());
  });

  it('every duplicate module rejects without advancing assignment or successful-input cache', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 7 }), index => {
      const original = createMapModuleDemo('red'); const assigned: LyraMapOverlays[] = [];
      const publish = createMapModulePublisher(value => assigned.push(value)); publish(original);
      expect(() => publish({ ...original, [MAP_MODULE_ORDER[index]!]: original.districts })).to.throw('duplicate-source');
      expect(assigned.length).to.equal(1); expect(publish(original)).to.equal(false);
    }), propertyRuns());
  });
});
