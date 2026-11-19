import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { newestCollectionWindow } from './collection-window.js';

it('a window is the newest suffix and accounts for every omitted entry', () => {
  fc.assert(fc.property(fc.array(fc.integer(), { maxLength: 60 }), fc.integer({ min: -5, max: 80 }), (items, max) => {
    const { items: shown, omitted } = newestCollectionWindow(items, max);
    expect(shown.length + omitted).to.equal(items.length);
    expect([...shown]).to.deep.equal(items.slice(omitted));
    if (max > 0) expect(shown.length).to.be.at.most(max);
  }), propertyRuns());
});
